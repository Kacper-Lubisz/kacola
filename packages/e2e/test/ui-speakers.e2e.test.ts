import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Segment, SpeakerSummary } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkAttribution } from '@gnomeola/testkit/invariants'
import {
  type AccessibleNode,
  type AppHandle,
  type HeadlessDisplay,
  markedPids,
  startHeadlessDisplay,
} from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  APP,
  buildUi,
  capture,
  launchUi,
  logTail,
  markOnboarded,
  unnamedInteractive,
  waitForWindow,
} from '../src/ui.ts'

// A-5 in the real window, against the real daemon (child process) whose fake pipeline diarizes the far
// end into three voices. Asserted through AT-SPI: speaker chips carry the daemon's colour slot in their
// accessible description ("colour 2"), so "the colour never moves" is checkable without pixels; rename,
// merge and split go through the window's own controls, and the daemon is asked afterwards whether it
// agrees. The microphone stays "me" throughout.

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

describe('speakers in the real window', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle
  let app: AppHandle
  let dataDir: string
  let markerId: string
  let sessionId = ''

  const speakers = async (): Promise<SpeakerSummary[]> =>
    (await daemon.client.call('listSpeakers', { params: { id: sessionId } })).speakers
  const segments = async (): Promise<Segment[]> =>
    (await daemon.client.call('getTranscript', { params: { id: sessionId } })).segments
  const rowNames = async (): Promise<string[]> => {
    const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
    return ((await d.describe(list, true)).children ?? [])
      .filter((c) => c.role === 'list item')
      .map((c) => c.name)
  }
  const chips = (name: string) => d.find({ app: APP, role: 'label', name, states: ['showing'] })
  const micIsMe = async () => {
    const segs = await segments()
    assertNoViolations(checkAttribution(segs))
    for (const s of segs.filter((x) => x.track === 'mic'))
      expect([s.speaker, s.speakerId]).toEqual(['me', undefined])
    for (const n of await rowNames()) if (/^Me at /.test(n)) expect(n).not.toMatch(/Speaker|Ana/)
  }

  beforeAll(async () => {
    buildUi()
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-speakers-'))
    daemon = await startDaemon({ dataDir, env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) } })
    // a short recording, diarized by the fake pipeline: far-end voices in the pattern 0 1 1 0 2 0 1
    const s = await daemon.client.call('createSession', { body: { title: TITLE } })
    sessionId = s.id
    await daemon.client.call('startSession', { params: { id: s.id } })
    await d_wait(async () => (await segments()).filter((x) => x.track === 'system').length >= 7, 20_000)
    await daemon.client.call('stopSession', { params: { id: s.id } })
    d = await startHeadlessDisplay({ size: '1280x800' })
    markerId = d.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(d)
    app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
  }, 120_000)

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('shows every line with its speaker chip, coloured by the daemon’s palette slot', async () => {
    await d.click(await d.findOne({ app: APP, role: 'list item', name: TITLE }))
    await d.findOne({ app: APP, role: 'heading', name: TITLE })
    const spk = await speakers()
    expect(spk.map((x) => x.label)).toEqual(['me', 'Speaker 1', 'Speaker 2', 'Speaker 3'])
    await d.findOne(
      { app: APP, role: 'list item', nameContains: 'Speaker 1 at ', states: ['showing'] },
      10_000,
    )
    const names = await rowNames()
    expect(names.some((n) => n.startsWith('Me at '))).toBe(true)
    // every visible line agrees with the daemon about who said it
    const segs = await segments()
    for (const n of names) {
      const hit = segs.find((s) => n.endsWith(`: ${s.text}`) || n.includes(`: ${s.text} (`))
      if (!hit) continue
      const who = hit.speaker === 'me' ? 'Me' : hit.speaker
      expect(n.startsWith(`${who} at `), n).toBe(true)
    }
    // chip colours are the daemon's slots
    for (const x of spk.filter((s) => s.id.startsWith('spk_'))) {
      const shown = await chips(x.label)
      if (!shown.length) continue
      for (const c of shown) expect(c.description).toBe(`colour ${x.colour! + 1}`)
    }
    const me = await chips('Me')
    expect(me.length).toBeGreaterThan(0)
    expect(me[0]!.description).toBe('your colour')
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'speakers-chips')
  })

  it('renames a speaker inline: every line relabels, the daemon agrees, the colour stays', async () => {
    const before = (await speakers()).find((s) => s.label === 'Speaker 1')!
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Speakers', states: ['showing'] }))
    await d.findOne({ app: APP, role: 'list', name: 'Speakers', states: ['showing'] })
    // me is never renamable or mergeable
    expect(await d.find({ app: APP, role: 'button', name: 'Rename me', states: ['showing'] })).toEqual([])
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Rename Speaker 1', states: ['showing'] }),
    )
    const entry = await d.findOne({
      app: APP,
      role: 'text',
      name: 'New name for Speaker 1',
      states: ['showing'],
    })
    await d.focus(entry) // the entry takes focus itself; this only confirms (or Tabs to) it
    await d.setText(entry, 'Ana')
    await d.pressKeys('Return')
    await d.waitFor(
      async () => (await speakers()).find((s) => s.id === before.id)?.label === 'Ana',
      5000,
      'the daemon to hold the new name',
    )
    // the dialog row and the transcript follow the durable event
    await d.findOne({ app: APP, role: 'list item', name: 'Ana', states: ['showing'] }, 5000)
    const img = await d.findOne({ app: APP, role: 'image', name: `Ana, colour ${before.colour! + 1}` }, 5000)
    expect(img).toBeDefined()
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'speakers-dialog')
    await d.pressKeys('Escape')
    await d.waitFor(async () => (await rowNames()).some((n) => n.startsWith('Ana at ')), 5000, 'Ana lines')
    expect((await rowNames()).some((n) => n.startsWith('Speaker 1 at '))).toBe(false)
    for (const c of await chips('Ana')) expect(c.description).toBe(`colour ${before.colour! + 1}`)
    const segs = await segments()
    expect(segs.filter((s) => s.speakerId === before.id).every((s) => s.speaker === 'Ana')).toBe(true)
    await micIsMe()
  })

  it('shows the daemon’s refusal instead of swallowing it (reserved and duplicate names)', async () => {
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Speakers', states: ['showing'] }))
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Rename Speaker 2', states: ['showing'] }),
    )
    const entry = await d.findOne({
      app: APP,
      role: 'text',
      name: 'New name for Speaker 2',
      states: ['showing'],
    })
    await d.focus(entry)
    await d.setText(entry, 'ana')
    await d.pressKeys('Return')
    await d.findOne(
      { app: APP, role: 'label', nameContains: 'merge them instead', states: ['showing'] },
      5000,
    )
    await d.setText(entry, 'me')
    await d.pressKeys('Return')
    await d.findOne({ app: APP, role: 'label', nameContains: 'reserved', states: ['showing'] }, 5000)
    expect((await speakers()).map((s) => s.label)).toEqual(['me', 'Ana', 'Speaker 2', 'Speaker 3'])
  })

  it('merges two speakers from the dialog: the merged one is gone, its lines are the survivor’s', async () => {
    const three = (await speakers()).find((s) => s.label === 'Speaker 3')!
    const ana = (await speakers()).find((s) => s.label === 'Ana')!
    const menu = await d.findOne({
      app: APP,
      role: 'button',
      name: 'Merge Speaker 3 into…',
      states: ['showing'],
    })
    const toggle =
      ((await d.describe(menu, true)).children ?? []).find(
        (c: AccessibleNode) => c.role === 'toggle button',
      ) ?? menu
    await d.click(toggle)
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Merge Speaker 3 into Ana', states: ['showing'] }),
    )
    await d.waitFor(
      async () => !(await speakers()).some((s) => s.id === three.id),
      5000,
      'Speaker 3 merged away in the daemon',
    )
    const segs = await segments()
    expect(segs.some((s) => s.speakerId === three.id)).toBe(false)
    expect(segs.filter((s) => s.speakerId === ana.id).length).toBeGreaterThan(0)
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'list item', name: 'Speaker 3', states: ['showing'] })).length === 0,
      5000,
      'the dialog row to go',
    )
    await d.pressKeys('Escape')
    await d.waitFor(
      async () => !(await rowNames()).some((n) => n.startsWith('Speaker 3 at ')),
      5000,
      'no Speaker 3 lines left',
    )
    await micIsMe()
  })

  it('splits one line off to a new speaker ("Someone Else Said This"); a mic line cannot be', async () => {
    const list = await d.findOne({ app: APP, role: 'list', name: 'Transcript', states: ['showing'] })
    const row = await d.findOne({ app: APP, role: 'list item', nameContains: 'Ana at ', states: ['showing'] })
    const how = await d.click(row)
    const text = row.name.replace(/^Ana at \d+:\d+: /, '').replace(/ \((provisional|in progress)\)$/, '')
    const seg = (await segments()).find((s) => s.text === text && s.speaker === 'Ana')!
    expect(seg, `${row.name} (${how})`).toBeDefined()
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Someone Else Said This', states: ['showing'] }),
    )
    await d.waitFor(
      async () => {
        const now = (await segments()).find((s) => s.id === seg.id)!
        return now.speakerId !== seg.speakerId && now.speaker === 'Speaker 4'
      },
      5000,
      'the line to belong to a new speaker in the daemon',
    )
    await d.waitFor(
      async () => (await rowNames()).some((n) => n.startsWith('Speaker 4 at ')),
      5000,
      'the line relabelled in the window',
    )
    expect((await speakers()).map((s) => s.label)).toEqual(['me', 'Ana', 'Speaker 2', 'Speaker 4'])
    // a new speaker, a new colour slot — nobody else's colour moved
    const four = (await speakers()).find((s) => s.label === 'Speaker 4')!
    expect(four.colour).toBe(3)
    for (const c of await chips('Speaker 4')) expect(c.description).toBe('colour 4')

    // select a mic line: it explains itself, and offers nothing to change
    await d.focusInto(list, { reverse: true })
    await d.pressKeys('Home')
    await d.waitFor(
      async () =>
        (await d.find({ app: APP, role: 'label', nameContains: 'your microphone is always you' })).length >
          0 || (await d.pressKeys('Down'), false),
      10_000,
      'a mic line selected',
    )
    expect(
      await d.find({ app: APP, role: 'button', name: 'Someone Else Said This', states: ['showing'] }),
    ).toEqual([])
    await micIsMe()
    await capture(d, 'speakers-split')
  })

  it('Preferences: the speaker switches reach the daemon', async () => {
    await d.pressKeys('Control_L', ',')
    const vp = await d.findOne({
      app: APP,
      role: 'switch',
      name: 'Recognise people across meetings',
      states: ['showing'],
    })
    expect(vp.states).not.toContain('checked')
    const di = await d.findOne({ app: APP, role: 'switch', name: 'Tell far-end speakers apart' })
    expect(di.states).toContain('checked')
    await d.click(vp)
    await d.waitFor(
      async () => (await daemon.client.call('getSettings')).speakers?.voiceprints === true,
      5000,
      'voiceprints on in the daemon',
    )
    await capture(d, 'speakers-prefs')
    await d.pressKeys('Escape')
  })

  it('left nothing unexpected in the log', () => {
    expect(logTail(app)).not.toMatch(/Gtk-CRITICAL|Uncaught|TypeError/)
  })
})

async function d_wait(probe: () => Promise<boolean>, timeoutMs: number) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await probe()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('timed out waiting for the recording')
}
