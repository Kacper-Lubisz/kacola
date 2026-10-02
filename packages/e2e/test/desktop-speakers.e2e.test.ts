import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Segment, SpeakerSummary } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { assertNoViolations, checkAttribution } from '@gnomeola/testkit/invariants'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  expectScreenshot,
  poll,
  rowNames,
  selectedRowNames,
  setScheme,
  transcriptList,
} from '../src/desktop-ui.ts'
import { markOnboarded } from '../src/ui.ts'

// Port of ui-speakers.e2e.test.ts (A-5) to the Electron window, against the real daemon (child process)
// whose fake pipeline diarizes the far end into three voices. Speaker chips carry the daemon's colour
// slot in their accessible description ("colour 2"), so "the colour never moves" is checkable without
// pixels; rename, merge and split go through the window's own controls (optimistic, reconciled by the
// daemon's echo), and the daemon is asked afterwards whether it agrees. The microphone stays "me".

// Audio at 4x wall clock; a segment closes every 1.5 s of audio per track and turns final quickly.
const PIPELINE = {
  speed: 4,
  segmentEveryMs: 1500,
  partialEveryMs: 250,
  finalizeAfterMs: 200,
  tickMs: 20,
  diarize: true,
}
const TITLE = 'Speaker sync'

type Chip = { name: string; description: string | null }

describe('desktop speakers against the real daemon', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string
  let markerId = ''
  let sessionId = ''

  const w = () => app.window
  const speakers = async (): Promise<SpeakerSummary[]> =>
    (await daemon.client.call('listSpeakers', { params: { id: sessionId } })).speakers
  const segments = async (): Promise<Segment[]> =>
    (await daemon.client.call('getTranscript', { params: { id: sessionId } })).segments
  /** The speaker chips in the transcript: visible name and accessible description. */
  const chips = async (name?: string): Promise<Chip[]> => {
    const all = (await w().evaluate(`(() => [...document.querySelectorAll(
      '[role=listbox][aria-label="Transcript"] [aria-description]')].map((c) => ({
        name: c.textContent, description: c.getAttribute('aria-description') })))()`)) as Chip[]
    return name === undefined ? all : all.filter((c) => c.name === name)
  }
  const dialog = () => w().getByRole('dialog', { name: 'Speakers' })
  const openDialog = async () => {
    await w().getByRole('button', { name: 'Speakers', exact: true }).click()
    await dialog().getByRole('list', { name: 'Speakers' }).waitFor({ timeout: 5000 })
  }
  /** Escape closes the dialog (a first Escape may only dismiss a tooltip on the focused button). */
  const closeDialog = () =>
    poll(
      async () => {
        if ((await dialog().count()) === 0) return true
        await w().keyboard.press('Escape')
        await new Promise((r) => setTimeout(r, 150))
        return (await dialog().count()) === 0
      },
      5000,
      'the dialog closed',
    )
  const micIsMe = async () => {
    const segs = await segments()
    assertNoViolations(checkAttribution(segs))
    for (const s of segs.filter((x) => x.track === 'mic'))
      expect([s.speaker, s.speakerId]).toEqual(['me', undefined])
    // every microphone line is labelled Me in the window (by speaker, not by text: the fake's words
    // include "Ana")
    const names = await rowNames(w())
    for (const s of segs.filter((x) => x.track === 'mic')) {
      const row = names.find((n) => n.endsWith(`: ${s.text}`) && n.includes(' at '))
      if (row) expect(row.startsWith('Me at '), row).toBe(true)
    }
  }

  beforeAll(async () => {
    buildDesktop()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-speakers-'))
    daemon = await startDaemon({ dataDir, env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) } })
    // a short recording, diarized by the fake pipeline: far-end voices in the pattern 0 1 1 0 2 0 1
    const s = await daemon.client.call('createSession', { body: { title: TITLE } })
    sessionId = s.id
    await daemon.client.call('startSession', { params: { id: s.id } })
    await poll(
      async () => (await segments()).filter((x) => x.track === 'system').length >= 7,
      20_000,
      'the recording',
    )
    await daemon.client.call('stopSession', { params: { id: s.id } })
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
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('shows every line with its speaker chip, coloured by the daemon’s palette slot', async () => {
    // the meeting's outcome page, with the transcript beside it
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${sessionId}?panel=transcript`)}`)
    await w().getByRole('heading', { level: 1, name: TITLE }).waitFor()
    const spk = await speakers()
    expect(spk.map((x) => x.label)).toEqual(['me', 'Speaker 1', 'Speaker 2', 'Speaker 3'])
    await poll(
      async () => (await rowNames(w())).some((n) => n.startsWith('Speaker 1 at ')),
      10_000,
      'Speaker 1 lines',
    )
    const names = await rowNames(w())
    expect(names.some((n) => n.startsWith('Me at '))).toBe(true)
    // every line agrees with the daemon about who said it
    const segs = await segments()
    for (const n of names) {
      const hit = segs.find((s) => n.endsWith(`: ${s.text}`))
      if (!hit) continue
      expect(n.startsWith(`${hit.speaker === 'me' ? 'Me' : hit.speaker} at `), n).toBe(true)
    }
    // chip colours are the daemon's slots
    for (const x of spk.filter((s) => s.id.startsWith('spk_'))) {
      for (const c of await chips(x.label)) expect(c.description).toBe(`colour ${x.colour! + 1}`)
    }
    const me = await chips('Me')
    expect(me.length).toBeGreaterThan(0)
    expect(me[0]!.description).toBe('your colour')
    // and the brand palette: three far-end speakers, three different chip colours
    const fills = (await w().evaluate(`(() => [...new Set([...document.querySelectorAll(
      '[role=listbox][aria-label="Transcript"] .k-speaker-dot')].map((d) => getComputedStyle(d).backgroundColor))])()`)) as string[]
    expect(fills.length).toBe(4) // me + three speakers
    expect(await app.axe()).toEqual([])
  })

  it('renames a speaker inline: every line relabels, the daemon agrees, the colour stays', async () => {
    const before = (await speakers()).find((s) => s.label === 'Speaker 1')!
    await openDialog()
    // me is never renamable or mergeable
    expect(await dialog().getByRole('button', { name: 'Rename me' }).count()).toBe(0)
    await dialog().getByRole('button', { name: 'Rename Speaker 1' }).click()
    const field = dialog().getByRole('textbox', { name: 'New name for Speaker 1' })
    // the field takes the keyboard itself
    await poll(
      async () =>
        (await w().evaluate(`(() => {
          const a = document.activeElement
          return a && a.tagName === 'INPUT' && a.labels && a.labels[0] ? a.labels[0].textContent : null
        })()`)) === 'New name for Speaker 1',
      3000,
      'the field focused',
    )
    await field.fill('Ana')
    await field.press('Enter')
    await poll(
      async () => (await speakers()).find((s) => s.id === before.id)?.label === 'Ana',
      5000,
      'the new name in the daemon',
    )
    // the dialog row and the transcript follow
    await dialog().getByRole('listitem', { name: 'Ana' }).waitFor({ timeout: 5000 })
    await dialog()
      .getByRole('img', { name: `Ana, colour ${before.colour! + 1}` })
      .waitFor({ timeout: 5000 })
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'speakers-dialog-light', { region: dialog() })
    await setScheme(w(), 'dark')
    expect(await app.axe()).toEqual([])
    await expectScreenshot(app, 'speakers-dialog-dark', { region: dialog() })
    await setScheme(w(), 'light')
    await closeDialog()
    await poll(async () => (await rowNames(w())).some((n) => n.startsWith('Ana at ')), 5000, 'Ana lines')
    expect((await rowNames(w())).some((n) => n.startsWith('Speaker 1 at '))).toBe(false)
    for (const c of await chips('Ana')) expect(c.description).toBe(`colour ${before.colour! + 1}`)
    const segs = await segments()
    expect(segs.filter((s) => s.speakerId === before.id).every((s) => s.speaker === 'Ana')).toBe(true)
    await micIsMe()
  })

  it('shows the daemon’s refusal instead of swallowing it (reserved and duplicate names), and rolls back', async () => {
    await openDialog()
    await dialog().getByRole('button', { name: 'Rename Speaker 2' }).click()
    const field = dialog().getByRole('textbox', { name: /^New name for / })
    await field.fill('ana')
    await field.press('Enter')
    await dialog()
      .getByRole('alert')
      .getByText(/merge them instead/)
      .waitFor({ timeout: 5000 })
    // the optimistic name is rolled back: the row is Speaker 2 again
    await dialog().getByRole('listitem', { name: 'Speaker 2' }).waitFor({ timeout: 5000 })
    await field.fill('me')
    await field.press('Enter')
    await dialog()
      .getByRole('alert')
      .getByText(/reserved/)
      .waitFor({ timeout: 5000 })
    expect((await speakers()).map((s) => s.label)).toEqual(['me', 'Ana', 'Speaker 2', 'Speaker 3'])
    await field.press('Escape')
  })

  it('merges two speakers from the dialog: the merged one is gone, its lines are the survivor’s', async () => {
    const three = (await speakers()).find((s) => s.label === 'Speaker 3')!
    const ana = (await speakers()).find((s) => s.label === 'Ana')!
    await dialog().getByRole('button', { name: 'Merge Speaker 3 into…' }).click()
    await w().getByRole('menuitem', { name: 'Merge Speaker 3 into Ana' }).click()
    await poll(
      async () => !(await speakers()).some((s) => s.id === three.id),
      5000,
      'Speaker 3 merged away in the daemon',
    )
    const segs = await segments()
    expect(segs.some((s) => s.speakerId === three.id)).toBe(false)
    expect(segs.filter((s) => s.speakerId === ana.id).length).toBeGreaterThan(0)
    await poll(
      async () => (await dialog().getByRole('listitem', { name: 'Speaker 3' }).count()) === 0,
      5000,
      'the row to go',
    )
    await closeDialog()
    await poll(
      async () => !(await rowNames(w())).some((n) => n.startsWith('Speaker 3 at ')),
      5000,
      'no Speaker 3 lines',
    )
    await micIsMe()
  })

  it('splits one line off to a new speaker ("Someone else said this"); a mic line cannot be', async () => {
    const row = transcriptList(w()).locator('[role=option][aria-label^="Ana at "]').first()
    const name = (await row.getAttribute('aria-label'))!
    await row.click()
    const text = name.replace(/^Ana at \d+:\d+: /, '').replace(/ \((provisional|in progress)\)$/, '')
    const seg = (await segments()).find((s) => s.text === text && s.speaker === 'Ana')!
    expect(seg, name).toBeDefined()
    await w().getByRole('button', { name: 'Someone else said this' }).click()
    await poll(
      async () => {
        const now = (await segments()).find((s) => s.id === seg.id)!
        return now.speakerId !== seg.speakerId && now.speaker === 'Speaker 4'
      },
      5000,
      'the line to belong to a new speaker in the daemon',
    )
    await poll(
      async () => (await rowNames(w())).some((n) => n.startsWith('Speaker 4 at ')),
      5000,
      'the line relabelled',
    )
    expect((await speakers()).map((s) => s.label)).toEqual(['me', 'Ana', 'Speaker 2', 'Speaker 4'])
    // a new speaker, a new colour slot — nobody else's colour moved
    const four = (await speakers()).find((s) => s.label === 'Speaker 4')!
    expect(four.colour).toBe(3)
    await poll(async () => (await chips('Speaker 4')).length > 0, 5000, 'a Speaker 4 chip')
    for (const c of await chips('Speaker 4')) expect(c.description).toBe('colour 4')

    // select a mic line: it explains itself, and offers nothing to change
    await transcriptList(w()).focus()
    await w().keyboard.press('Home')
    await poll(
      async () => {
        if ((await selectedRowNames(w()))[0]?.startsWith('Me at ')) return true
        await w().keyboard.press('ArrowDown')
        return false
      },
      10_000,
      'a mic line selected',
    )
    await w()
      .getByText(/your microphone is always you/)
      .waitFor({ timeout: 3000 })
    expect(await w().getByRole('button', { name: 'Someone else said this' }).count()).toBe(0)
    await micIsMe()
    expect(await app.axe()).toEqual([])
    expect(app.problems()).toEqual([])
  })
})
