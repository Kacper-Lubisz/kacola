import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type DurableEvent, type ShareOp } from '@gnomeola/protocol'
import { SqliteStoreApi } from '@gnomeola/store'
import { Atlas } from '@gnomeola/testkit/atlas'
import { type Browser, chromium, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { built, type Harness, startHarness } from './harness.ts'

// The screen atlas, web part: the hosted viewer as deployed (the Vercel build output behind the local
// harness, as viewer.e2e does) in headless Chrome — the pairing screen, the meetings list, a meeting
// with its notes, search — each asserted, then captured in light and dark (prefers-color-scheme) at
// 1280 / 800 / 360 px into dist/atlas/shots/. The hosted store keeps the time a session was first
// synced (not the device's createdAt), so dates are masked, as are the random pairing code, its expiry
// and the live status line. Then the shared agenda page (team sharing, /a/<token>) as an invitee without
// kacola meets it: the agenda, an item added after confirming an email (the code mailed through the
// webhook mailer to a sink here), and the recap once the organiser shares it.

const CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => existsSync(p))
const SECRET = 'atlas-web-secret-0123456789abcdef0123456'
const ADMIN = 'atlas-web-admin-0123456789'

describe.skipIf(!CHROME)('atlas: the web viewer in headless Chrome', () => {
  let h: Harness
  let browser: Browser
  let page: Page
  const tmp = mkdtempSync(join(tmpdir(), 'gnomeola-atlas-web-'))
  const atlas = new Atlas('web', (p, theme) => p.emulateMedia({ colorScheme: theme }), { height: 760 })
  let sink: Server
  const mails: { to: string; text: string }[] = []

  beforeAll(async () => {
    sink = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      mails.push(JSON.parse(Buffer.concat(chunks).toString()) as { to: string; text: string })
      res.writeHead(204).end()
    })
    await new Promise<void>((r) => sink.listen(0, '127.0.0.1', r))
    h = await startHarness(await built({ events: 2 }), {
      GNOMEOLA_MAIL_WEBHOOK: `http://127.0.0.1:${(sink.address() as AddressInfo).port}/mail`,
      DATABASE_URL: `sqlite:${join(tmp, 'db.sqlite')}`,
      GNOMEOLA_AUTH_SECRET: SECRET,
      GNOMEOLA_ADMIN_TOKEN: ADMIN,
      GNOMEOLA_POLL_MS: '50',
      GNOMEOLA_STREAM_MARGIN_MS: '700',
    })
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      env: { ...process.env, TZ: 'UTC' },
    })
  }, 120_000)
  afterAll(async () => {
    await browser?.close()
    await h?.close()
    await new Promise<void>((r) => (sink ? sink.close(() => r()) : r()))
    rmSync(tmp, { recursive: true, force: true })
  })

  it('pairing, the list, a meeting with notes, search', async () => {
    const admin = createClient({ baseUrl: h.url, token: ADMIN })
    const dev = SqliteStoreApi.open(':memory:')
    const lines: [string, 'mic' | 'system', string, number][] = [
      ['me', 'mic', 'Morning. Quick round, then the retry question.', 5],
      ['me', 'mic', 'Did we settle the retry budget?', 62],
      ['Ana', 'system', 'Yes. The retry budget is three attempts, then dead-letter.', 66],
      ['Ana', 'system', 'And the migration lands Thursday, assuming staging is green.', 120],
      ['me', 'mic', 'Who owns the dashboard for that?', 180],
      ['Ben', 'system', 'Ana owns the dashboard.', 184],
    ]
    const fixed = async (title: string, iso: string, min: number) => {
      // apart in time, so the list's order (newest first) is the same every run
      await new Promise((r) => setTimeout(r, 30))
      const s = await dev.createSession({ title })
      return dev.updateSession(s.id, (x) => ({
        ...x,
        status: 'stopped',
        createdAt: iso,
        startedAt: iso,
        endedAt: iso,
        durationMs: min * 60_000,
      }))
    }
    await fixed('Sprint retro', '2026-03-04T15:00:00.000Z', 20)
    await fixed('Quarterly planning', '2026-03-11T13:00:00.000Z', 90)
    const standup = await fixed('Platform standup', '2026-03-12T09:30:00.000Z', 12)
    let n = 0
    for (const [speaker, track, text, t] of lines)
      await dev.upsertSegment({
        id: `seg_atlas${String(++n).padStart(3, '0')}`,
        sessionId: standup.id,
        track,
        speaker,
        startMs: t * 1000,
        endMs: t * 1000 + 3500,
        text,
        quality: 'final',
        confidence: 0.9,
      })
    const push = (es: DurableEvent[]) =>
      admin.call('syncPush', {
        body: { deviceId: 'laptop', items: es.map((e) => ({ seq: e.seq, data: e.data })) },
      })
    await push(await dev.eventsAfter(0))
    await admin.call('syncPush', {
      body: {
        deviceId: 'laptop-notes',
        items: [
          {
            seq: 1,
            data: {
              type: 'note.version',
              version: {
                sessionId: standup.id,
                version: 1,
                kind: 'user',
                markdown:
                  '## Decisions\n\n- Retry budget: three attempts, then dead-letter.\n- The migration lands Thursday.\n\n## Action items\n\n- [ ] Own the dashboard — owner: Ana — due: Thursday',
                baseVersion: 0,
                createdAt: '2026-03-12T10:00:00.000Z',
                enhancement: null,
                merge: null,
                restoredFrom: null,
              },
            },
          },
        ],
      },
    })

    page = await browser.newPage({ viewport: { width: 1280, height: 760 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${h.url}/`)
    const code = page.locator('.code').first()
    await code.waitFor({ timeout: 10_000 })
    expect((await code.textContent())!.trim()).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    await atlas.shoot(page, 'web-viewer__pair__code', {
      expect: [code, page.getByText('Approve this code from kacola on a computer that is already signed in')],
      // the code (twice: big, and in the approve command) is random; the expiry is the wall clock
      masks: [code, page.locator('.pairing pre'), page.locator('.pairing .meta'), page.locator('#status')],
    })
    await admin.call('pairApprove', { body: { userCode: (await code.textContent())!.trim() } })

    const list = page.locator('ul.sessions')
    await list.waitFor({ timeout: 15_000 })
    // the live line flips between "live" and "reconnecting…" as the 2 s function cap ends each stream
    // (viewer.e2e asserts it); a mask would change size with the word, so it is taken out for the shots
    await page.evaluate(`document.querySelector('#status').remove()`)
    await atlas.shoot(page, 'web-viewer__list__sessions', {
      expect: [list.getByText('Platform standup'), list.getByText('Quarterly planning')],
      masks: [page.locator('.meta')],
    })
    await list.locator('a', { hasText: 'Platform standup' }).click()
    await page.locator('ol.transcript').waitFor()
    await atlas.shoot(page, 'web-viewer__session__transcript-notes', {
      expect: [
        page.locator('ol.transcript').getByText(/three attempts/),
        page.locator('.notes').getByText(/Own the dashboard/),
      ],
      masks: [page.locator('.meta')],
    })
    await page.fill('#search input', 'retry budget')
    await page.press('#search input', 'Enter')
    await page.locator('ul.hits').waitFor()
    await atlas.shoot(page, 'web-viewer__search__hits', {
      expect: page.locator('ul.hits mark').first(),
      masks: [page.locator('.meta')],
    })
    expect(errors).toEqual([])
    await dev.close()
  })

  it('the shared agenda page: an invitee reads it, adds an item with their email, then sees the recap', async () => {
    const owner = createClient({ baseUrl: h.url, token: ADMIN })
    // what the organiser's daemon pushes when it shares (fixed times: the page shows the meeting's)
    const created = await owner.call('createShare', {
      body: {
        ownerName: 'Kacper',
        ownerLabel: 'kacper@example.com',
        options: { allowInvitees: true, members: ['ben@example.com'] },
        occurrence: {
          agendaId: 'agd_atlas_w1',
          title: 'Platform weekly',
          meeting: {
            eventUid: 'weekly@x',
            start: '2026-03-12T09:00:00.000Z',
            end: '2026-03-12T09:30:00.000Z',
            recurring: true,
          },
          goals: [],
        },
      },
    })
    const push = (ops: ShareOp[]) =>
      owner.call('pushShare', { params: { shareId: created.share.id }, body: { ops } })
    const item = (
      id: string,
      text: string,
      order: number,
      kind: 'topic' | 'must-cover' | 'decision' = 'topic',
    ): ShareOp => ({
      op: 'item',
      item: {
        id,
        occurrence: 'agd_atlas_w1',
        text,
        kind,
        owner: null,
        timeboxMin: order === 0 ? 15 : null,
        order,
        carriedFrom: null,
      },
    })
    const status = (
      key: string,
      itemId: string,
      to: 'in-progress' | 'covered',
      by: 'user' | 'tracker',
    ): ShareOp => ({
      op: 'status',
      key,
      itemId,
      from: to === 'covered' ? 'in-progress' : 'open',
      to,
      by,
      at: '2026-03-12T09:05:00.000Z',
      auto: false,
      confidence: by === 'tracker' ? 0.7 : null,
    })
    await push([
      item('itm_atlas_w1', 'Incident review', 0, 'must-cover'),
      item('itm_atlas_w2', 'Retry budget', 1, 'decision'),
      item('itm_atlas_w3', 'On-call rota', 2),
      status('k1', 'itm_atlas_w1', 'in-progress', 'tracker'),
      {
        op: 'card',
        card: {
          id: 'ctx_atlas_w1',
          occurrence: 'agd_atlas_w1',
          title: 'Last incident',
          body: 'Two outages in September; both from the retry storm.',
          pinned: true,
          sourceUrl: 'https://status.example/sept',
        },
      },
    ])
    const web = await browser.newPage({ viewport: { width: 1280, height: 760 } })
    const errors: string[] = []
    web.on('pageerror', (e) => errors.push(e.message))
    await web.emulateMedia({ reducedMotion: 'reduce' })
    await web.goto(`${h.url}/a/${created.token}`)
    const items = web.getByRole('list', { name: 'Agenda items' })
    await items.waitFor({ timeout: 15_000 })
    await atlas.shoot(web, 'agenda-invitee__web__agenda', {
      expect: [items.getByText('Incident review'), web.getByRole('heading', { name: 'Last incident' })],
    })

    // an invitee confirms an email with the mailed code and adds an item
    await web.getByLabel('Email').fill('ivy@example.com')
    await web.getByLabel(/^Name/).fill('Ivy')
    await web.getByRole('button', { name: 'Send code' }).click()
    await web.getByLabel('Code').waitFor({ timeout: 10_000 })
    const code = /code is ([A-Z]{4}-[A-Z]{4})/.exec(
      mails.filter((m) => m.to === 'ivy@example.com').at(-1)!.text,
    )![1]!
    await web.getByLabel('Code').fill(code)
    await web.getByRole('button', { name: 'Confirm' }).click()
    await web.getByLabel('Item', { exact: true }).fill('Pager fatigue')
    await web.getByRole('button', { name: 'Add item' }).click()
    const added = web.locator('ol.items > li').filter({ hasText: 'Pager fatigue' })
    await added.waitFor({ timeout: 10_000 })
    await atlas.shoot(web, 'agenda-invitee__web__add-item', {
      expect: [added.getByText(/Added by Ivy/), web.getByText('As Ivy', { exact: false })],
    })

    // after the meeting: the organiser shares the recap; outcomes appear (never private notes)
    await push([
      status('k2', 'itm_atlas_w1', 'covered', 'user'),
      { op: 'recap', occurrence: 'agd_atlas_w1', shared: true },
      {
        op: 'outcome',
        itemId: 'itm_atlas_w1',
        outcome: 'Root cause: the retry storm.\nAction: cap retries at 3.',
      },
      { op: 'outcome', itemId: 'itm_atlas_w2', outcome: 'Three attempts, then dead-letter.' },
    ])
    await web.reload()
    await web.getByRole('heading', { name: 'Agenda and outcomes' }).waitFor({ timeout: 10_000 })
    await atlas.shoot(web, 'agenda-invitee__web__recap', {
      expect: web.locator('ol.items > li').first().locator('.outcome'),
    })
    expect(errors).toEqual([])
  })

  it('captured every built web state', () => {
    expect(atlas.finish()).toEqual([])
    const unstable = atlas.unstable()
    if (unstable.length) console.warn(`atlas: differs from the previous run:\n  ${unstable.join('\n  ')}`)
    if (process.env.GNOMEOLA_ATLAS_STRICT === '1') expect(unstable).toEqual([])
  })
})
