import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listDevices, PipeWireCaptureSource, PwMetadataWatcher, snapshotGraph } from '../src/index.ts'
import { sleep, tempDir } from './scenario.ts'

// R-1 against the live graph: enumeration sees rig devices with the right kinds, defaults agree with
// the `default` metadata, and the pw-metadata watcher parses the real stream.

let rig: PipeWireRig
let before: Awaited<ReturnType<typeof readDefaults>>
beforeAll(async () => {
  before = await readDefaults()
  rig = await PipeWireRig.create()
})
afterAll(async () => {
  await rig.teardown()
  await assertDefaultsUnchanged(before)
})

const pgrep = (pattern: string) =>
  new Promise<string[]>((r) =>
    execFile('pgrep', ['-af', pattern], (_e, out) =>
      r(
        String(out ?? '')
          .split('\n')
          .filter(Boolean),
      ),
    ),
  )

describe('listDevices (live)', () => {
  it('lists rig devices with the right kinds and never marks them default', async () => {
    const devices = await listDevices()
    const find = (name: string) => devices.filter((d) => d.name === name)
    expect(find(rig.mic.captureTarget)).toEqual([
      { name: rig.mic.captureTarget, description: 'gnomeola rig mic', kind: 'source', isDefault: false },
    ])
    expect(find(rig.system.captureTarget).map((d) => [d.kind, d.isDefault])).toEqual([['sink', false]])
  })

  it('flags exactly the effective defaults from the metadata', async () => {
    const devices = await listDevices()
    const defaults = await readDefaults()
    const flagged = devices.filter((d) => d.isDefault)
    expect(flagged.map((d) => [d.kind, d.name]).sort()).toEqual(
      [
        ['sink', defaults.sink],
        ['source', defaults.source],
      ].sort(),
    )
    const g = await snapshotGraph()
    expect(g.defaults).toEqual(defaults)
  })
})

describe('PwMetadataWatcher (live)', () => {
  it('reads the real default metadata stream and cleans up its child', async () => {
    const pids = async () => new Set((await pgrep('^pw-metadata -m -n default')).map((l) => l.split(' ')[0]))
    const preexisting = await pids()
    const w = new PwMetadataWatcher()
    // start from all-null so every value in current() must have come from parsing pw-metadata output
    await w.start({ sink: null, source: null, configuredSink: null, configuredSource: null })
    const truth = await readDefaults()
    const t0 = Date.now()
    while (JSON.stringify(w.current()) !== JSON.stringify(truth) && Date.now() - t0 < 3000) await sleep(20)
    expect(w.current()).toEqual(truth)
    const ours = [...(await pids())].filter((p) => !preexisting.has(p))
    expect(ours).toHaveLength(1)
    w.stop()
    await sleep(200)
    const after = await pids()
    expect(ours.filter((p) => after.has(p))).toEqual([])
  })
})

describe('PipeWireCaptureSource start-up', () => {
  it('rejects a missing named device before creating files, and leaks no children (incl. the watcher)', async () => {
    const dir = tempDir('missing')
    const watchers = async () =>
      new Set((await pgrep('^pw-metadata -m -n default')).map((l) => l.split(' ')[0]))
    const preexisting = await watchers()
    const src = new PipeWireCaptureSource() // default PwMetadataWatcher
    await expect(
      src.start(join(dir, 's'), [
        { kind: 'system', device: rig.system.captureTarget },
        { kind: 'mic', device: `${rig.id}-does-not-exist` },
      ]),
    ).rejects.toThrow(/node '.*-does-not-exist' not found/)
    expect(existsSync(join(dir, 's'))).toBe(false)
    await sleep(200)
    expect((await pgrep('pw-record')).filter((l) => l.includes(rig.id))).toEqual([])
    expect([...(await watchers())].filter((p) => !preexisting.has(p))).toEqual([])
  })
})
