import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type ShareOp } from '@kacola/protocol'
import { type Browser, chromium, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { built, type Harness, startHarness } from './harness.ts'

// L-19 in a real browser: the shared agenda page as deployed (the Vercel build output behind the local
// harness), headless in the system's Chrome. An invitee without kacola opens the link, reads the agenda
// (light and dark, by the brand tokens), confirms an email with the code the server mails (through the
// webhook mailer, to a sink here), adds an item and a comment the organiser then sees; a second browser
// confirms through the magic link alone; after the meeting the recap appears once the organiser shares
// it; unsharing turns the page into "no longer shared".

const CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => existsSync(p))
const SECRET = 'agenda-web-e2e-secret-0123456789abcdef0123'
const ADMIN = 'agenda-web-e2e-admin-0123456789'

type Mail = { to: string; subject: string; text: string }

/** KACOLA_SHOT_DIR=…: keep full-page screenshots for a visual check. */
const shot = async (page: Page, name: string) => {
  if (process.env.KACOLA_SHOT_DIR)
    await page.screenshot({ path: join(process.env.KACOLA_SHOT_DIR, `${name}.png`), fullPage: true })
}

describe.skipIf(!CHROME)(`shared agenda page in headless Chrome (${CHROME ?? 'no browser found'})`, () => {
  let h: Harness
  let browser: Browser
  let sink: Server
  const mails: Mail[] = []
  const tmp = mkdtempSync(join(tmpdir(), 'kacola-agenda-web-'))
  const s = { shareId: '', token: '' }
  const owner = () => createClient({ baseUrl: h.url, token: ADMIN })
  const push = (ops: ShareOp[]) =>
    owner().call('pushShare', { params: { shareId: s.shareId }, body: { ops } })

  beforeAll(async () => {
    sink = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      mails.push(JSON.parse(Buffer.concat(chunks).toString()) as Mail)
      res.writeHead(204).end()
    })
    await new Promise<void>((r) => sink.listen(0, '127.0.0.1', r))
    h = await startHarness(await built(), {
      DATABASE_URL: `sqlite:${join(tmp, 'db.sqlite')}`,
      KACOLA_AUTH_SECRET: SECRET,
      KACOLA_ADMIN_TOKEN: ADMIN,
      KACOLA_MAIL_WEBHOOK: `http://127.0.0.1:${(sink.address() as AddressInfo).port}/mail`,
    })
    browser = await chromium.launch({ executablePath: CHROME, headless: true })
    // the organiser's device shares an agenda (what a daemon's share sync pushes)
    const created = await owner().call('createShare', {
      body: {
        ownerName: 'Kacper',
        ownerLabel: 'kacper@example.com',
        options: { allowInvitees: true, members: ['ben@example.com'] },
        occurrence: {
          agendaId: 'agd_w1',
          title: 'Platform weekly',
          meeting: {
            eventUid: 'weekly@x',
            start: '2026-10-08T09:00:00.000Z',
            end: '2026-10-08T09:30:00.000Z',
            recurring: true,
          },
          goals: [],
        },
      },
    })
    s.shareId = created.share.id
    s.token = created.token
    const item = (
      id: string,
      text: string,
      order: number,
      kind: 'topic' | 'must-cover' = 'topic',
    ): ShareOp => ({
      op: 'item',
      item: {
        id,
        occurrence: 'agd_w1',
        text,
        kind,
        owner: null,
        timeboxMin: order === 0 ? 15 : null,
        order,
        carriedFrom: null,
      },
    })
    await push([
      item('itm_w1', 'Incident review', 0, 'must-cover'),
      item('itm_w2', 'Retry budget <b>bold?</b>', 1),
      item('itm_w3', 'On-call rota', 2),
      {
        op: 'status',
        key: 'k1',
        itemId: 'itm_w1',
        from: 'open',
        to: 'in-progress',
        by: 'tracker',
        at: '2026-10-08T09:05:00.000Z',
        auto: false,
        confidence: 0.7,
      },
      {
        op: 'card',
        card: {
          id: 'ctx_w1',
          occurrence: 'agd_w1',
          title: 'Last incident',
          body: 'Two outages in September.',
          pinned: true,
          sourceUrl: 'https://status.example/sept',
        },
      },
    ])
  }, 180_000)
  afterAll(async () => {
    await browser?.close()
    await h?.close()
    await new Promise<void>((r) => (sink ? sink.close(() => r()) : r()))
    rmSync(tmp, { recursive: true, force: true })
  })

  const open = async (path = `/a/${s.token}`, scheme: 'light' | 'dark' = 'light') => {
    const ctx = await browser.newContext({ colorScheme: scheme })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${h.url}${path}`)
    await page.locator('ol.items').waitFor({ timeout: 15_000 })
    return { page, errors, close: () => ctx.close() }
  }
  const codeIn = (to: string) =>
    /code is ([A-Z]{4}-[A-Z]{4})/.exec(mails.filter((m) => m.to === to).at(-1)?.text ?? '')?.[1]
  const items = (page: Page) => page.locator('ol.items > li .item-text').allTextContents()

  it('shows the agenda: items, statuses in words, who set them, the shared card; accessible landmarks', async () => {
    const { page, errors, close } = await open()
    expect(await page.title()).toBe('Platform weekly · shared agenda')
    expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe('Platform weekly')
    expect(await items(page)).toEqual(['Incident review', 'Retry budget <b>bold?</b>', 'On-call rota'])
    const first = page.locator('ol.items > li').first()
    expect(await first.locator('.status').textContent()).toBe('In progress')
    // the five actors: the organiser's on-device tracker is "kacola", never "Kacper (tracker)"
    expect(await first.textContent()).toContain('Set by kacola')
    expect(await first.textContent()).not.toContain('(tracker)')
    expect(await first.textContent()).toContain('Must cover')
    expect(await page.locator('.card h3').textContent()).toBe('Last incident')
    expect(await page.locator('.card a').getAttribute('href')).toBe('https://status.example/sept')
    // landmarks and labelled lists: a screen reader can find its way
    for (const role of ['banner', 'main', 'complementary', 'contentinfo'] as const)
      expect(await page.getByRole(role).count(), role).toBe(1)
    expect(await page.getByRole('list', { name: 'Agenda items' }).count()).toBe(1)
    expect(await page.getByLabel('Email').count()).toBe(1)
    // the quiet prompt, and nothing that looks like the organiser's private material
    expect(await page.locator('footer').textContent()).toContain('kacola')
    expect(errors).toEqual([])
    await close()
  })

  it('follows the brand tokens in light and dark', async () => {
    const light = await open('/a/' + s.token, 'light')
    const dark = await open('/a/' + s.token, 'dark')
    // (expressions as strings: this test is typechecked without the DOM library)
    const css = (p: Page, expr: string) => p.evaluate(expr) as Promise<string>
    const bg = (p: Page) => css(p, 'getComputedStyle(document.body).backgroundColor')
    const fg = (p: Page) => css(p, 'getComputedStyle(document.body).color')
    const tokenBg = (p: Page) =>
      css(p, "getComputedStyle(document.documentElement).getPropertyValue('--k-color-bg-window').trim()")
    expect(await bg(light.page)).not.toBe(await bg(dark.page))
    expect(await fg(light.page)).not.toBe(await fg(dark.page))
    expect(await tokenBg(light.page)).not.toBe('')
    expect(await css(light.page, 'getComputedStyle(document.body).fontFamily')).toContain('Instrument Sans')
    await shot(light.page, 'agenda-light')
    await shot(dark.page, 'agenda-dark')
    await light.close()
    await dark.close()
  })

  it('an invitee confirms an email with the mailed code, adds an item and a comment; the organiser sees them', async () => {
    const { page, errors, close } = await open()
    await page.getByLabel('Email').fill('ivy@example.com')
    await page.getByLabel(/^Name/).fill('Ivy')
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.getByLabel('Code').waitFor({ timeout: 10_000 })
    const code = codeIn('ivy@example.com')!
    expect(code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    await page.getByLabel('Code').fill('BBBB-BBBB')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page
      .locator('.feedback')
      .filter({ hasText: /wrong or has expired/ })
      .waitFor({ timeout: 10_000 })
    await page.getByLabel('Code').fill(code)
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.getByLabel('Item', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.locator('.contribute').textContent()).toContain('As Ivy')
    await page.getByLabel('Item', { exact: true }).fill('Pager fatigue')
    await page.getByLabel('Question').check()
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.locator('ol.items > li').filter({ hasText: 'Pager fatigue' }).waitFor({ timeout: 10_000 })
    const added = page.locator('ol.items > li').filter({ hasText: 'Pager fatigue' })
    expect(await added.textContent()).toContain('Added by Ivy')
    expect(await added.textContent()).toContain('Question')
    // a comment on an item
    const rota = page.locator('ol.items > li').filter({ hasText: 'On-call rota' })
    await rota.locator('summary').click()
    await rota.getByLabel('Comment on “On-call rota”').fill('Can we swap weeks 41 and 42?')
    await rota.getByRole('button', { name: 'Post' }).click()
    await page
      .locator('ol.items > li')
      .filter({ hasText: 'On-call rota' })
      .locator('.comment')
      .waitFor({ timeout: 10_000 })
    // the organiser's view (what their daemon mirrors into the agenda)
    const st = await owner().call('getShareState', { params: { shareId: s.shareId } })
    expect(st.items.find((i) => i.text === 'Pager fatigue')).toMatchObject({
      kind: 'question',
      createdBy: { role: 'invitee', label: 'ivy@example.com' },
    })
    expect(st.comments.map((c) => [c.text, c.itemId, c.author.label])).toEqual([
      ['Can we swap weeks 41 and 42?', 'itm_w3', 'ivy@example.com'],
    ])
    // the token survives a reload (this browser stays confirmed)
    await page.reload()
    await page.getByLabel('Item', { exact: true }).waitFor({ timeout: 10_000 })
    expect(errors).toEqual([])
    await close()
  })

  it('the magic link alone confirms a second browser', async () => {
    const first = await open()
    await first.page.getByLabel('Email').fill('zoe@example.com')
    await first.page.getByRole('button', { name: 'Send code' }).click()
    await first.page.getByLabel('Code').waitFor({ timeout: 10_000 })
    await first.close()
    const link = /(\/a\/\S+#verify=\S+)/.exec(
      mails.filter((m) => m.to === 'zoe@example.com').at(-1)!.text,
    )![1]!
    const second = await open(link)
    await second.page.getByLabel('Item', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await second.page.evaluate('location.hash')).toBe('')
    await second.close()
  })

  it('after the meeting: outcomes appear once the organiser shares the recap', async () => {
    await push([
      {
        op: 'status',
        key: 'k2',
        itemId: 'itm_w1',
        from: 'in-progress',
        to: 'covered',
        by: 'user',
        at: '2026-10-08T09:25:00.000Z',
        auto: false,
        confidence: null,
      },
    ])
    const before = await open()
    expect(await before.page.locator('.outcome').count()).toBe(0)
    await before.close()
    await push([
      { op: 'recap', occurrence: 'agd_w1', shared: true },
      { op: 'outcome', itemId: 'itm_w1', outcome: 'Root cause: the retry storm.\nAction: cap retries at 3.' },
    ])
    const { page, close } = await open()
    const first = page.locator('ol.items > li').first()
    expect(await first.locator('.status').textContent()).toBe('Covered')
    expect(await first.locator('.outcome').textContent()).toContain('Root cause: the retry storm.')
    expect(await page.getByRole('heading', { name: 'Agenda and outcomes' }).count()).toBe(1)
    await shot(page, 'agenda-recap')
    await close()
  })

  it('unsharing: the page says so', async () => {
    await owner().call('revokeShare', { params: { shareId: s.shareId } })
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${h.url}/a/${s.token}`)
    await page.getByRole('heading', { name: 'This agenda is no longer shared' }).waitFor({ timeout: 10_000 })
    await ctx.close()
  })
})
