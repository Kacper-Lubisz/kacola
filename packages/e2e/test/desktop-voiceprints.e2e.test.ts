import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SpeakerSummary } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { poll, rowNames } from '../src/desktop-ui.ts'
import { markOnboarded } from '../src/ui.ts'

// The speaker settings and voiceprints (A-6) end to end through the Electron window, against the real
// daemon whose fake pipeline diarizes the far end (three fixed voices, one-hot "embeddings", recognised
// against the known voiceprints the way the real diarizer is — the daemon's speakers.int test, driven
// from the window here): the Preferences switches reach the daemon and follow it; a meeting recorded,
// paused, resumed and stopped with the window's own Record controls; a far-end speaker named in the
// Speakers dialog becomes a voiceprint; the next meeting recorded from the window names them by voice.

const PIPELINE = {
  speed: 4,
  segmentEveryMs: 1500,
  partialEveryMs: 250,
  finalizeAfterMs: 200,
  tickMs: 20,
  diarize: true,
}

describe('desktop: speaker settings and voiceprints against the real daemon', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dataDir: string
  let markerId = ''
  let first = ''

  const w = () => app.window
  const prefs = () => w().getByRole('dialog', { name: 'Preferences' })
  const speakersDialog = () => w().getByRole('dialog', { name: 'Speakers' })
  const settings = () => daemon.client.call('getSettings')
  const speakers = async (id: string): Promise<SpeakerSummary[]> =>
    (await daemon.client.call('listSpeakers', { params: { id } })).speakers
  const farEnd = async (id: string) =>
    (await daemon.client.call('getTranscript', { params: { id }, query: { track: 'system' } })).segments
  /** Toggle a switch the way a keyboard user does (its input is visually hidden). */
  const toggle = async (name: string) => {
    await prefs().getByRole('switch', { name }).focus()
    await w().keyboard.press('Space')
  }
  const status = async (id: string) => (await daemon.client.call('getSession', { params: { id } })).status

  /** Record with the window's own controls until the far end has spoken `n` times; returns the session. */
  const recordFromWindow = async (n: number, pause = false): Promise<string> => {
    const before = new Set(
      (await daemon.client.call('listSessions', { query: {} })).sessions.map((s) => s.id),
    )
    await w().getByRole('button', { name: 'Record', exact: true }).click()
    const live = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => !before.has(s.id) && s.status === 'recording',
        ),
      10_000,
      'a new recording session',
    )
    await w().getByRole('heading', { level: 1, name: live.title }).waitFor({ timeout: 10_000 })
    if (pause) {
      await poll(async () => (await farEnd(live.id)).length >= 1, 15_000, 'the far end speaking')
      await w().getByRole('button', { name: 'Pause', exact: true }).click()
      await poll(async () => (await status(live.id)) === 'paused', 5000, 'paused in the daemon')
      await w()
        .getByRole('timer', { name: /^Paused, / })
        .waitFor({ timeout: 5000 })
      // paused means paused: the pipeline says nothing new
      const said = (await farEnd(live.id)).length
      await new Promise((r) => setTimeout(r, 1500))
      expect((await farEnd(live.id)).length).toBe(said)
      await w().getByRole('button', { name: 'Resume', exact: true }).click()
      await poll(async () => (await status(live.id)) === 'recording', 5000, 'recording again')
    }
    await poll(async () => (await farEnd(live.id)).length >= n, 30_000, `${n} far-end segments`)
    await w().getByRole('button', { name: 'Stop', exact: true }).click()
    await poll(async () => (await status(live.id)) === 'stopped', 10_000, 'stopped in the daemon')
    await w().getByRole('button', { name: 'Record', exact: true }).waitFor({ timeout: 10_000 })
    return live.id
  }
  const openSpeakers = async () => {
    await w().getByRole('button', { name: 'Speakers', exact: true }).click()
    await speakersDialog().getByRole('list', { name: 'Speakers' }).waitFor({ timeout: 5000 })
  }
  const closeSpeakers = () =>
    poll(
      async () => {
        if ((await speakersDialog().count()) === 0) return true
        await w().keyboard.press('Escape')
        await new Promise((r) => setTimeout(r, 150))
        return (await speakersDialog().count()) === 0
      },
      5000,
      'the Speakers dialog closed',
    )

  beforeAll(async () => {
    buildDesktop()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-voiceprints-'))
    daemon = await startDaemon({ dataDir, env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) } })
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
    // no sessions yet: the sidebar shows its empty state, the Record button is there
    await w().getByRole('button', { name: 'Record', exact: true }).waitFor({ timeout: 20_000 })
  }, 240_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('Preferences: the speaker switches reach the daemon, follow changes made elsewhere, and Escape closes', async () => {
    await w().keyboard.press('Control+,')
    await prefs().getByRole('region', { name: 'Speakers' }).waitFor({ timeout: 5000 })
    const diarize = prefs().getByRole('switch', { name: 'Tell far-end speakers apart' })
    const voiceprints = prefs().getByRole('switch', { name: 'Recognise people across meetings' })
    // the daemon's defaults: far-end speakers told apart, no voices kept
    expect(await diarize.isChecked()).toBe(true)
    expect(await voiceprints.isChecked()).toBe(false)
    expect(await app.axe()).toEqual([])

    await toggle('Tell far-end speakers apart')
    await poll(async () => (await settings()).speakers?.diarize === false, 5000, 'diarize off')
    await toggle('Tell far-end speakers apart')
    await poll(async () => (await settings()).speakers?.diarize === true, 5000, 'diarize on again')
    await toggle('Recognise people across meetings')
    await poll(async () => (await settings()).speakers?.voiceprints === true, 5000, 'voiceprints on')
    await poll(async () => voiceprints.isChecked(), 5000, 'the voiceprints switch on')

    // another client (the CLI, say) changes them while the dialog is open: the switches follow
    await daemon.client.call('updateSettings', { body: { speakers: { diarize: false } } })
    await poll(async () => !(await diarize.isChecked()), 5000, 'the diarize switch to follow')
    await daemon.client.call('updateSettings', { body: { speakers: { diarize: true } } })
    await poll(async () => diarize.isChecked(), 5000, 'the diarize switch back on')
    expect((await settings()).speakers).toEqual({ diarize: true, voiceprints: true })

    // Escape closes Preferences, and it opens again (showing what is stored)
    await w().keyboard.press('Escape')
    await prefs().waitFor({ state: 'detached', timeout: 5000 })
    await w().keyboard.press('Control+,')
    await prefs().getByRole('region', { name: 'Speakers' }).waitFor({ timeout: 5000 })
    expect(await prefs().getByRole('switch', { name: 'Recognise people across meetings' }).isChecked()).toBe(
      true,
    )
    await w().keyboard.press('Escape')
    await prefs().waitFor({ state: 'detached', timeout: 5000 })
  })

  it('records from the window (Record, Pause, Resume, Stop) and tells the far end apart', async () => {
    first = await recordFromWindow(4, true)
    const sp = await speakers(first)
    expect(sp.map((s) => s.label).slice(0, 3)).toEqual(['me', 'Speaker 1', 'Speaker 2'])
    // voiceprints on: the meeting kept its voices, nobody is named yet
    expect(sp.every((s) => !s.named && s.voiceprintId === null)).toBe(true)
    expect((await daemon.client.call('listVoiceprints')).voiceprints).toEqual([])
    await poll(
      async () => (await rowNames(w())).some((n) => n.startsWith('Speaker 1 at ')),
      10_000,
      'Speaker 1 lines',
    )
  })

  it('naming a speaker in the Speakers dialog remembers their voice', async () => {
    const s1 = (await speakers(first)).find((s) => s.label === 'Speaker 1')!
    await openSpeakers()
    await speakersDialog().getByRole('button', { name: 'Rename Speaker 1' }).click()
    const field = speakersDialog().getByRole('textbox', { name: 'New name for Speaker 1' })
    await field.fill('Priya')
    await field.press('Enter')
    const named = await poll(
      async () => (await speakers(first)).find((s) => s.id === s1.id && s.label === 'Priya'),
      5000,
      'Priya in the daemon',
    )
    expect(named.named).toBe(true)
    expect(named.voiceprintId).toMatch(/^vp_/)
    expect((await daemon.client.call('listVoiceprints')).voiceprints).toEqual([
      expect.objectContaining({ id: named.voiceprintId, name: 'Priya', model: 'fake-embedding', samples: 1 }),
    ])
    await speakersDialog().getByRole('listitem', { name: 'Priya' }).waitFor({ timeout: 5000 })
    expect(await app.axe()).toEqual([])
    await closeSpeakers()
  })

  it('the next meeting recorded from the window names Priya by her voice; the other voice stays a number', async () => {
    const vp = (await daemon.client.call('listVoiceprints')).voiceprints[0]!
    const second = await recordFromWindow(4)
    expect(second).not.toBe(first)
    const sp = await speakers(second)
    expect(sp.map((s) => [s.label, s.named, s.voiceprintId]).slice(0, 3)).toEqual([
      ['me', false, null],
      ['Priya', true, vp.id],
      ['Speaker 1', false, null],
    ])
    // the window shows her by name — in the transcript and in the Speakers dialog — without anyone
    // having named her in this meeting
    await poll(
      async () => (await rowNames(w())).some((n) => n.startsWith('Priya at ')),
      10_000,
      'Priya lines',
    )
    const t = await daemon.client.call('getTranscript', {
      params: { id: second },
      query: { speaker: 'priya' },
    })
    expect(t.segments.length).toBeGreaterThan(0)
    await openSpeakers()
    await speakersDialog().getByRole('listitem', { name: 'Priya' }).waitFor({ timeout: 5000 })
    await speakersDialog().getByRole('listitem', { name: 'Speaker 1' }).waitFor({ timeout: 5000 })
    await closeSpeakers()
    // …and the meeting refined her voiceprint
    await poll(
      async () => (await daemon.client.call('listVoiceprints')).voiceprints[0]?.samples === 2,
      5000,
      'a second sample',
    )
  })

  it('switching voiceprints off in Preferences forgets every voice', async () => {
    await w().keyboard.press('Control+,')
    await prefs().getByRole('region', { name: 'Speakers' }).waitFor({ timeout: 5000 })
    await toggle('Recognise people across meetings')
    await poll(
      async () => (await daemon.client.call('listVoiceprints')).voiceprints.length === 0,
      5000,
      'every voiceprint forgotten',
    )
    expect((await settings()).speakers?.voiceprints).toBe(false)
    await w().keyboard.press('Escape')
    await prefs().waitFor({ state: 'detached', timeout: 5000 })
  })
})
