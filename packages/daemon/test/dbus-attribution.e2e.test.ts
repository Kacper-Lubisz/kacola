import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DbusProbe, type PrivateBus, startPrivateBus } from '@kacola/testkit/dbus'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { BUS_NAME, INTERFACE, OBJECT_PATH } from '../src/dbus/bridge-protocol.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'

// The panel's last line follows attribution (M3 × M4): a far-end line is shown as "them" until the
// diarizer attributes it, and must then read as that speaker — and follow a rename — instead of staying
// a step behind the window. A silent pipeline, so the only transcript lines are the ones written here.

let bus: PrivateBus
let dir: string
let d: Daemon
let probe: DbusProbe

beforeAll(async () => {
  bus = await startPrivateBus()
  dir = mkdtempSync(join(tmpdir(), 'kacola-dbus-attr-'))
  d = await createDaemon({
    dataDir: dir,
    port: 0,
    pipeline: new FakePipeline({ segmentEveryMs: 1e9, partialEveryMs: 1e9 }),
    keyring: new MemoryKeyring(),
    env: {},
    calendar: new ManualCalendarProvider(),
    dbus: { env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: bus.address }, minBackoffMs: 100 },
  })
  probe = new DbusProbe({ address: bus.address, name: BUS_NAME, path: OBJECT_PATH, iface: INTERFACE })
  await probe.until((p) => p.DaemonUrl === d.url, 15_000, 'the bridge to own the name and publish')
})
afterAll(async () => {
  await probe?.close()
  await d?.close()
  await bus?.close()
  rmSync(dir, { recursive: true, force: true })
})

it('relabels the last far-end line when it is attributed, and again when its speaker is renamed', async () => {
  const [sessionId] = (await probe.call('Start', '(s)', ['Sync'])) as [string]
  await probe.until((x) => x.State === 'recording')
  d.store.upsertSegment({
    id: 'seg_far_1',
    sessionId,
    track: 'system',
    speaker: 'them',
    startMs: 0,
    endMs: 900,
    text: 'we ship on friday',
    quality: 'live',
    confidence: null,
  })
  await probe.until((x) => x.LastLine === 'we ship on friday' && x.LastSpeaker === 'them')

  const spk = d.store.createSpeaker(sessionId)
  expect(d.store.attributeSegments(sessionId, spk.id, ['seg_far_1'], 'auto')).toEqual(['seg_far_1'])
  await probe.until((x) => x.LastSpeaker === spk.label, 5_000, `LastSpeaker = ${spk.label}`)

  d.store.renameSpeaker(sessionId, spk.id, 'Ana')
  await probe.until((x) => x.LastSpeaker === 'Ana' && x.LastLine === 'we ship on friday', 5_000, 'Ana')
  await probe.call('Stop')
})
