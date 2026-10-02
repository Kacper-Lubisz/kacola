import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Store } from '@gnomeola/store'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  expectScreenshot,
  poll,
  rowCount,
  rowName,
  rowNames,
  selectedRowNames,
  setScheme,
  transcriptList,
  visibleRowNames,
} from '../src/desktop-ui.ts'
import { SEED, seedMeetings } from '../src/seed.ts'
import { markOnboarded } from '../src/ui.ts'

// Port of ui-transcript.e2e.test.ts (V-9a / T-6) to the Electron window: the transcript pane against
// the real daemon (child process, fake capture + STT pipeline), asserted by role + accessible name.
// Every line is an option of the listbox "Transcript" named "<Speaker> at <m:ss>: <text>", suffixed
// " (provisional)" for a live-quality segment and " (in progress)" for the partial line — the GTK
// app's names, so the assertions are the same ones.

// Audio at 4x wall clock: a segment closes every 2.5 s of audio per track (≈0.6 s wall), partials every
// 250 ms of audio, and a live segment is re-emitted as final 1.5 s (wall; 6 s of audio) after it closes.
// Deterministic: audio advances exactly 80 ms per tick, so what the pipeline has said at a given audio
// time is the same every run — and the live recording holds at 30 s of audio (provisional and final
// lines, two open partials) until the test writes the release file, for a pixel-exact baseline.
const PIPELINE = { speed: 4, segmentEveryMs: 2500, partialEveryMs: 250, finalizeAfterMs: 1500, tickMs: 20 }
const HOLD_AT_MS = 30_000
const PERF_OUT = join(import.meta.dirname, '__artifacts__', 'desktop-transcript-perf.json')

describe('desktop transcript pane against the real daemon', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string
  let releaseFile = ''
  let markerId = ''
  let liveId = ''
  const perf: Record<string, number> = {}

  const w = () => app.window
  const pane = () => w().getByRole('region', { name: 'Transcript' })
  // a meeting opens with its transcript beside it (?panel=transcript, what Ctrl+T toggles)
  const openSession = async (title: string) => {
    const id = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: { includePrivate: true } })).sessions.find(
          (s) => s.title === title,
        )?.id,
      10_000,
      `the session ${title}`,
    )
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${id}?panel=transcript`)}`)
    await w().getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 10_000 })
    await pane().waitFor({ timeout: 10_000 })
  }

  beforeAll(async () => {
    buildDesktop()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-transcript-'))
    seedMeetings(dataDir)
    // a recorded gap in the retro (a device switch 10 s in), so the gap marker has something to show
    const store = Store.open(join(dataDir, 'gnomeola.db'))
    store.updateSession(SEED.retro, (s) => ({
      ...s,
      tracks: s.tracks.map((t) =>
        t.kind === 'system'
          ? { ...t, gaps: [{ atMs: 10_000, durationMs: 4000, reason: 'device switched' }] }
          : t,
      ),
    }))
    store.close()
    releaseFile = join(dataDir, 'release-live-hold')
    daemon = await startDaemon({
      dataDir,
      env: {
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
          ...PIPELINE,
          deterministic: true,
          hold: { atMs: HOLD_AT_MS, releaseFile },
        }),
      },
    })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
  }, 240_000)

  afterAll(async () => {
    mkdirSync(dirname(PERF_OUT), { recursive: true })
    writeFileSync(PERF_OUT, `${JSON.stringify(perf, null, 2)}\n`)
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('renders a seeded transcript as speaker-labelled, timestamped lines from getTranscript', async () => {
    await openSession('Platform standup')
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.standup } })
    const expected = segments.map((s) => rowName(s) + (s.quality === 'live' ? ' (provisional)' : ''))
    await poll(
      async () => JSON.stringify(await rowNames(w())) === JSON.stringify(expected),
      10_000,
      'the standup rows',
    )
    // the last standup line is still live-quality in the seed: visibly provisional
    expect((await rowNames(w())).at(-1)).toBe(
      'Me at 7:00: Okay, that is everything, thanks all. (provisional)',
    )
    // speaker grouping: a "Them" chip heads the first system line of a run, not every line of it
    expect(await transcriptList(w()).getByText('Them', { exact: true }).count()).toBe(2) // 1:06-2:00, 3:04-5:00
    // timestamps are tabular mono
    const font = (await w().evaluate(`(() => {
      const opt = document.querySelector('[role=listbox][aria-label="Transcript"] [role=option] span')
      const cs = getComputedStyle(opt)
      return cs.fontFamily + '|' + cs.fontVariantNumeric
    })()`)) as string
    expect(font).toMatch(/JetBrains Mono.*\|tabular-nums/)
    // …and the bundled face really is the one drawing them (not a system fallback)
    const loaded = (await w().evaluate(`(async () => {
      await document.fonts.ready
      return [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'JetBrains Mono').map((f) => f.status)
    })()`)) as string[]
    expect(loaded).toContain('loaded')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'transcript-final-light', { region: pane() })
    await setScheme(w(), 'dark')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'transcript-final-dark', { region: pane() })
    await setScheme(w(), 'light')
  })

  it('shows a recorded gap where it happened', async () => {
    await openSession('Sprint retro')
    await poll(
      async () => (await rowNames(w())).includes('Recording gap at 0:10, 0:04: device switched'),
      10_000,
      'the gap marker',
    )
    expect(await rowNames(w())).toEqual([
      'Recording gap at 0:10, 0:04: device switched',
      'Them at 0:30: The retry storm last sprint was the worst incident.',
    ])
  })

  it('renders the 1,350-line meeting quickly and scrolls it end to end from the keyboard', async () => {
    const t0 = Date.now()
    await openSession('Quarterly planning')
    const list = transcriptList(w())
    await list.getByRole('option', { name: /^Me at 0:00: Planning item 0:/ }).waitFor({ timeout: 10_000 })
    perf.selectToFirstRowMs = Date.now() - t0
    // only the visible rows (plus overscan) exist in the DOM: that is what keeps a long meeting responsive
    const rendered = await rowNames(w())
    expect(rendered.length).toBeGreaterThan(5)
    expect(rendered.length).toBeLessThan(60)
    expect(await rowCount(w())).toBe(1350)
    // the app's own measurement: snapshot in hand → first painted frame
    const first = await poll(
      async () =>
        (
          (await w().evaluate(`(() => performance.getEntriesByName('transcript.first-paint')
            .map((e) => ({ ms: e.duration, rows: e.detail && e.detail.rows })))()`)) as {
            ms: number
            rows: number
          }[]
        ).find((x) => x.rows === 1350),
      5000,
      'the first-paint measure for 1,350 rows',
    )
    perf.snapshotToFirstPaintMs = Math.round(first!.ms)
    expect(first!.ms).toBeLessThan(250)

    await list.focus()
    const t1 = Date.now()
    await w().keyboard.press('End')
    await poll(
      async () => (await visibleRowNames(w())).some((n) => n.includes('Planning item 1349:')),
      5000,
      'the last line on screen',
    )
    perf.endMs = Date.now() - t1
    await w().keyboard.press('Home')
    await poll(
      async () => (await visibleRowNames(w())).some((n) => n.includes('Planning item 0:')),
      5000,
      'the first line on screen',
    )
    // Page Down moves through it without stalls
    const t2 = Date.now()
    for (let i = 0; i < 10; i++) await w().keyboard.press('PageDown')
    await poll(
      async () => (await visibleRowNames(w())).some((n) => /Planning item (1\d\d|[2-9]\d):/.test(n)),
      5000,
      'ten pages down',
    )
    perf.tenPageDownsMs = Date.now() - t2
    console.log(
      `long transcript: first paint ${perf.snapshotToFirstPaintMs} ms, select→first row ${perf.selectToFirstRowMs} ms, End ${perf.endMs} ms, 10×PageDown ${perf.tenPageDownsMs} ms`,
    )
    expect(perf.endMs).toBeLessThan(3000)
    expect(perf.tenPageDownsMs).toBeLessThan(3000)
    // the keyboard's position is the selection (one line), and it is on screen
    await poll(
      async () => {
        const sel = await selectedRowNames(w())
        return sel.length === 1 && (await visibleRowNames(w())).includes(sel[0]!)
      },
      3000,
      'the selected line on screen',
    )
  })

  it('follows a citation target from the URL (?seg= / ?t=): scrolled to, one line highlighted', async () => {
    const { segments } = await daemon.client.call('getTranscript', { params: { id: SEED.long } })
    const target = segments.find((s) => s.text.startsWith('Planning item 900:'))!
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${SEED.long}?segment=${target.id}`)}`)
    await poll(
      async () => JSON.stringify(await selectedRowNames(w())) === JSON.stringify([rowName(target)]),
      5000,
      'the cited line selected',
    )
    expect(await visibleRowNames(w())).toContain(rowName(target))
    // by time: 2000 s is item 500's line
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${SEED.long}?t=2001.5`)}`)
    await poll(
      async () => (await selectedRowNames(w()))[0]?.includes('Planning item 500:'),
      5000,
      'the line at 33:20 selected',
    )
    expect(await visibleRowNames(w())).toEqual(
      expect.arrayContaining([expect.stringContaining('Planning item 500:')]),
    )
  })

  it('searches within the transcript: matches counted, stepped through, highlighted', async () => {
    await w().keyboard.press('Control+f')
    const field = w().getByRole('textbox', { name: 'Search the transcript' })
    await field.waitFor()
    await field.fill('item 1234:')
    await w().getByText('1 of 1', { exact: true }).waitFor({ timeout: 5000 })
    await poll(
      async () => (await selectedRowNames(w()))[0]?.includes('Planning item 1234:'),
      5000,
      'the match selected',
    )
    expect(await visibleRowNames(w())).toEqual(
      expect.arrayContaining([expect.stringContaining('Planning item 1234:')]),
    )
    expect(await transcriptList(w()).locator('mark').first().textContent()).toBe('item 1234:')
    await field.fill('item 13')
    // item 13, 130-139, 1300-1349
    await w().getByText('1 of 61', { exact: true }).waitFor({ timeout: 5000 })
    await field.press('Enter')
    await w().getByText('2 of 61', { exact: true }).waitFor({ timeout: 5000 })
    await field.press('Shift+Enter')
    await field.press('Shift+Enter')
    await w().getByText('61 of 61', { exact: true }).waitFor({ timeout: 5000 })
    expect(await app.axe()).toEqual([])
    await field.press('Escape')
    expect(await w().getByRole('textbox', { name: 'Search the transcript' }).count()).toBe(0)
  })

  it('shows a live recording: partial line, provisional segments replaced in place by final ones', async () => {
    const s = await daemon.client.call('createSession', { body: { title: 'Live transcript' } })
    liveId = s.id
    await daemon.client.call('startSession', { params: { id: s.id } })
    await openSession('Live transcript')

    // caught at the hold: the daemon's transcript stops changing (finals are held too), and the pane
    // shows exactly those segments plus the two open partial lines
    const held = await poll(
      async () => {
        const a = await daemon.client.call('getTranscript', { params: { id: s.id } })
        await new Promise((r) => setTimeout(r, 700))
        const b = await daemon.client.call('getTranscript', { params: { id: s.id } })
        return a.segments.length > 10 && JSON.stringify(a) === JSON.stringify(b) ? b.segments : null
      },
      30_000,
      'the recording to reach its hold point',
    )
    expect(held.some((x) => x.quality === 'live')).toBe(true)
    expect(held.some((x) => x.quality === 'final')).toBe(true)
    let lastSeen = ''
    const heldName = (x: (typeof held)[number]) => rowName(x) + (x.quality === 'live' ? ' (provisional)' : '')
    const heldNames = new Set(held.map(heldName))
    const newest = heldName(held.reduce((a, b) => (b.startMs > a.startMs ? b : a)))
    await poll(
      async () => {
        // the virtualiser renders only the rows around the viewport
        const names = await rowNames(w())
        const lines = names.filter((n) => !n.endsWith('(in progress)'))
        lastSeen = JSON.stringify({ names, heldNames: [...heldNames] }, null, 1)
        return (
          names.length - lines.length === 2 &&
          lines.every((n) => heldNames.has(n)) &&
          lines.includes(newest) &&
          (await visibleRowNames(w())).at(-1)?.endsWith('(in progress)')
        )
      },
      10_000,
      'the held transcript in the pane, followed to its live end',
    ).catch((e) => {
      throw new Error(`${e.message}\n${lastSeen}`)
    })
    expect(await app.axe()).toEqual([])
    // no caret blink, no hover, no focus ring: the baseline is the state
    await w().emulateMedia({ reducedMotion: 'reduce' })
    await w().evaluate('document.activeElement?.blur()')
    await w().mouse.move(0, 0)
    await expectScreenshot(app, 'transcript-live-light', { region: pane() })
    await setScheme(w(), 'dark')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'transcript-live-dark', { region: pane() })
    await setScheme(w(), 'light')
    await w().emulateMedia({ reducedMotion: null })
    writeFileSync(releaseFile, '')

    // the in-progress line, fed by transcript.partial, grows while its speaker talks
    const partialNames = new Set<string>()
    await poll(
      async () => {
        for (const n of await rowNames(w())) if (n.endsWith('(in progress)')) partialNames.add(n)
        return partialNames.size >= 3
      },
      15_000,
      'three different partial lines',
    )
    // italic secondary text with a caret
    const style = (await w().evaluate(`(() => {
      const opt = [...document.querySelectorAll('[role=listbox][aria-label="Transcript"] [role=option]')]
        .find((o) => o.getAttribute('aria-label').endsWith('(in progress)'))
      if (!opt) return null
      const p = opt.querySelector('p')
      return { italic: getComputedStyle(p).fontStyle, caret: !!opt.querySelector('.k-caret') }
    })()`)) as { italic: string; caret: boolean } | null
    if (style) expect(style).toEqual({ italic: 'italic', caret: true })

    // a provisional line appears, then the same line — same speaker, same time — becomes final in place
    const provisional = await poll(
      async () => (await rowNames(w())).find((n) => n.endsWith('(provisional)')),
      15_000,
      'a provisional line',
    )
    const prefix = provisional.slice(0, provisional.indexOf(': ') + 2)
    const finalName = await poll(
      async () => {
        const same = (await rowNames(w())).filter((n) => n.startsWith(prefix))
        if (same.length > 1) throw new Error(`two rows for one segment: ${JSON.stringify(same)}`)
        return same.length === 1 && !same[0]!.endsWith('(provisional)') && !same[0]!.endsWith('(in progress)')
          ? same[0]
          : null
      },
      15_000,
      'the provisional line to become final',
    )
    const { segments } = await daemon.client.call('getTranscript', { params: { id: s.id } })
    const seg = segments.find((x) => rowName(x) === finalName)
    expect(seg, `${finalName} must be a segment the daemon holds`).toBeDefined()
    expect(seg!.quality).toBe('final')
    expect(seg!.revision).toBeGreaterThanOrEqual(2)
  })

  it('follows live output, stops following when scrolled up, and Jump to Live brings it back', async () => {
    await poll(async () => (await rowCount(w())) >= 30, 40_000, 'more than a screenful of lines')
    // following: the newest line stays on screen as lines are added
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 700))
      const names = await visibleRowNames(w())
      expect(names.at(-1)!).toMatch(/\((in progress|provisional)\)$|\.$/)
    }
    const jump = w().getByRole('button', { name: 'Jump to Live' })
    expect(await jump.count()).toBe(0)

    // keyboard focus entering a followed transcript lands on the newest line, not the first
    await transcriptList(w()).focus()
    await poll(
      async () => {
        const sel = (await selectedRowNames(w()))[0]
        return sel && (await visibleRowNames(w())).includes(sel) && !/ at 0:0[0-2]: /.test(sel)
      },
      3000,
      'the selection on a visible line near the live end',
    )
    await w().keyboard.press('Home')
    await jump.waitFor({ timeout: 5000 })
    // not following: new lines arrive but the view stays at the top
    // (Home scrolls; the virtualiser may be between frames for a moment — take the settled top line)
    const top = await poll(
      async () => (await visibleRowNames(w()))[0]?.includes(' at 0:00: ') && (await visibleRowNames(w()))[0],
      5000,
      'the view at the top',
    )
    await new Promise((r) => setTimeout(r, 1500))
    expect((await visibleRowNames(w()))[0]).toBe(top)

    await jump.click()
    await poll(
      async () => (await visibleRowNames(w())).some((n) => n.endsWith('(in progress)')),
      5000,
      'the live end back in view',
    )
    await poll(async () => (await jump.count()) === 0, 5000, 'the Jump to Live button to go away')

    // the wheel detaches too
    await transcriptList(w()).hover()
    await w().mouse.wheel(0, -600)
    await jump.waitFor({ timeout: 5000 })
    await jump.click()
    await poll(async () => (await jump.count()) === 0, 5000, 'following again')
  })

  it('stops: the partial line goes, every line becomes final, and it matches the daemon', async () => {
    // following the live end (whatever the previous test left)
    const jump = w().getByRole('button', { name: 'Jump to Live' })
    if (await jump.count()) await jump.click()
    // with the window's own Stop button, as the GTK suite did
    await w().getByRole('button', { name: 'Stop', exact: true }).click()
    // the page moves on to the outcome (the transcript panel stays open)
    await w().getByRole('button', { name: 'Share summary' }).waitFor({ timeout: 10_000 })
    expect((await daemon.client.call('getSession', { params: { id: liveId } })).status).toBe('stopped')
    const { segments } = await poll(
      async () => {
        const t = await daemon.client.call('getTranscript', { params: { id: liveId } })
        return t.segments.length > 10 && t.segments.every((x) => x.quality === 'final') ? t : null
      },
      15_000,
      'a final transcript in the daemon',
    )
    // the outcome page's panel opens at the top: go to the end
    await transcriptList(w()).focus()
    await w().keyboard.press('End')
    await poll(
      async () => {
        const names = await visibleRowNames(w())
        return (
          names.length > 0 &&
          names.every((n) => !n.endsWith('(in progress)') && !n.endsWith('(provisional)')) &&
          names.at(-1) === rowName(segments.at(-1)!)
        )
      },
      10_000,
      'a final, complete transcript ending in the daemon’s last segment',
    )
    expect(await w().getByRole('button', { name: 'Jump to Live' }).count()).toBe(0)
    expect(app.problems()).toEqual([])
  })
})
