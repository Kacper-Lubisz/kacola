import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type DurableEvent } from '@gnomeola/protocol'
import { SqliteStoreApi } from '@gnomeola/store'
import { type Browser, chromium } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { built, type Harness, startHarness } from './harness.ts'

// H-9 in a real browser: the web viewer as deployed (the Vercel build output behind the local harness),
// driven headless in the system's Chrome. A browser without a token is shown a pairing code; approving
// it (as the owner would, from a trusted device) signs the browser in; then the meeting list, a
// transcript with notes, search with highlighted matches, and a live update pushed by hybrid sync while
// the page is open — through /events streams that the 2 s function cap keeps ending.

const CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => existsSync(p))
const SECRET = 'viewer-e2e-secret-0123456789abcdef012345'
const ADMIN = 'viewer-e2e-admin-0123456789'

describe.skipIf(!CHROME)(`web viewer in headless Chrome (${CHROME ?? 'no browser found'})`, () => {
  let h: Harness
  let browser: Browser
  const tmp = mkdtempSync(join(tmpdir(), 'gnomeola-viewer-e2e-'))
  beforeAll(async () => {
    h = await startHarness(await built({ events: 2 }), {
      DATABASE_URL: `sqlite:${join(tmp, 'db.sqlite')}`,
      GNOMEOLA_AUTH_SECRET: SECRET,
      GNOMEOLA_ADMIN_TOKEN: ADMIN,
      GNOMEOLA_POLL_MS: '50',
      GNOMEOLA_STREAM_MARGIN_MS: '700',
    })
    browser = await chromium.launch({ executablePath: CHROME, headless: true })
  }, 120_000)
  afterAll(async () => {
    await browser?.close()
    await h?.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('pairs, lists, opens, searches, and updates live', async () => {
    const adminClient = createClient({ baseUrl: h.url, token: ADMIN })
    // a device's archive, synced up
    const dev = SqliteStoreApi.open(':memory:')
    const standup = await dev.createSession({ title: 'Platform standup' })
    await dev.upsertSegment({
      id: 'seg_v1',
      sessionId: standup.id,
      track: 'system',
      speaker: 'Ana',
      startMs: 61_000,
      endMs: 64_000,
      text: 'We agreed the retry budget is three attempts.',
      quality: 'final',
      confidence: 0.9,
    })
    await dev.upsertSegment({
      id: 'seg_v2',
      sessionId: standup.id,
      track: 'mic',
      speaker: 'me',
      startMs: 65_000,
      endMs: 67_000,
      text: '<script>alert("not html")</script> Ship it Thursday.',
      quality: 'final',
      confidence: 0.9,
    })
    const push = async (es: DurableEvent[], from: number) =>
      adminClient.call('syncPush', {
        body: {
          deviceId: 'laptop',
          items: es.filter((e) => e.seq > from).map((e) => ({ seq: e.seq, data: e.data })),
        },
      })
    await push(await dev.eventsAfter(0), 0)
    await adminClient.call('syncPush', {
      body: {
        deviceId: 'tablet', // notes written on another device: its own cursor
        items: [
          {
            seq: 1,
            data: {
              type: 'note.version',
              version: {
                sessionId: standup.id,
                version: 1,
                kind: 'user',
                markdown: '# Standup\n\n- [ ] Ana: retry budget doc',
                baseVersion: 0,
                createdAt: '2026-09-01T10:00:00.000Z',
                enhancement: null,
                merge: null,
                restoredFrom: null,
              },
            },
          },
        ],
      },
    })

    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${h.url}/`)

    // 1. no token: the pairing screen with a code; the owner approves it
    const code = (await page.locator('.code').first().textContent({ timeout: 10_000 }))!.trim()
    expect(code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    await adminClient.call('pairApprove', { body: { userCode: code } })

    // 2. signed in: the list
    await page.locator('ul.sessions').waitFor({ timeout: 15_000 })
    expect(await page.locator('ul.sessions li').count()).toBe(1)
    expect(await page.locator('ul.sessions').textContent()).toContain('Platform standup')
    expect(await page.evaluate(() => localStorage.getItem('gnomeola.token'))).toMatch(/^gnm1\./)

    // 3. a transcript, with notes; hostile text stays text
    await page.locator('ul.sessions a').first().click()
    await page.locator('ol.transcript').waitFor()
    const rows = await page.locator('ol.transcript li').allTextContents()
    expect(rows[0]).toContain('1:01')
    expect(rows[0]).toContain('retry budget is three attempts')
    expect(rows[1]).toContain('<script>alert("not html")</script>')
    expect(await page.locator('ol.transcript script').count()).toBe(0)
    expect(await page.locator('.notes .prose').textContent()).toContain('Ana: retry budget doc')

    // 4. search, with the match highlighted
    await page.fill('#search input', 'retry budget')
    await page.press('#search input', 'Enter')
    await page.locator('ul.hits').waitFor()
    expect(await page.locator('ul.hits mark').allTextContents()).toEqual(['retry', 'budget'])

    // 5. live: a meeting synced while the list is open appears without a reload — across stream caps
    await page.goto(`${h.url}/#/`)
    await page.locator('ul.sessions').waitFor()
    await new Promise((r) => setTimeout(r, 2500)) // let at least one /events stream hit its cap
    const before = (await dev.eventsAfter(0)).length
    await dev.createSession({ title: 'Roadmap sync (live)' })
    await push(await dev.eventsAfter(0), before)
    await page.locator('ul.sessions li', { hasText: 'Roadmap sync (live)' }).waitFor({ timeout: 15_000 })
    expect(await page.locator('#status').textContent()).toMatch(/live|reconnecting/)

    // 6. revoking is instant: a stale token sends the browser back to pairing
    await page.evaluate(() => localStorage.setItem('gnomeola.token', 'gnm1.forged.token'))
    await page.reload()
    await page.locator('.code').first().waitFor({ timeout: 10_000 })
    expect(errors).toEqual([])
    await dev.close()
  })
})
