import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  assertDefaultsUnchanged,
  cleanupStaleRigs,
  type Defaults,
  encodeWav16,
  listRigNodes,
  PipeWireRig,
  pwDump,
  RIG_PREFIX,
  readDefaults,
} from '../src/rig/index.ts'

// V-1a: the rig's own safety contract, verified against the real PipeWire graph on this machine.

const sh = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) =>
    execFile(cmd, args, (e, out, err) =>
      e ? reject(new Error(`${cmd}: ${err || e.message}`)) : resolve(out),
    ),
  )
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const dir = mkdtempSync(join(tmpdir(), 'gnomeola-rig-test-'))

let before: Defaults
beforeAll(async () => {
  before = await readDefaults()
  expect(before.sink, 'a default sink must exist before the rig is created').not.toBeNull()
})
afterAll(async () => {
  await assertDefaultsUnchanged(before)
  expect(await listRigNodes(`${RIG_PREFIX}${process.pid}-`)).toEqual([])
})

describe('PipeWireRig', () => {
  it('creates a virtual mic (Audio/Source/Virtual) and a virtual speaker, without touching defaults', async () => {
    const rig = await PipeWireRig.create()
    try {
      const nodes = await rig.nodes()
      const byName = Object.fromEntries(nodes.map((n) => [n.name, n.mediaClass]))
      expect(byName).toEqual({
        [rig.mic.captureTarget]: 'Audio/Source/Virtual',
        [rig.system.captureTarget]: 'Audio/Sink',
      })
      expect(rig.mic.playTarget).toBe(rig.mic.captureTarget)
      const dump = await pwDump()
      for (const o of dump) {
        const p = o.info?.props ?? {}
        if (o.type === 'PipeWire:Interface:Node' && String(p['node.name']).startsWith(rig.id)) {
          expect(p['priority.session']).toBe(1)
          expect(p['priority.driver']).toBe(1)
        }
      }
      await assertDefaultsUnchanged(before)
    } finally {
      await rig.teardown()
    }
    expect(await listRigNodes(rig.id)).toEqual([])
  })

  it('names are unique per rig, so parallel rigs never collide', async () => {
    const [a, b] = await Promise.all([PipeWireRig.create(), PipeWireRig.create()])
    try {
      expect(a.id).not.toBe(b.id)
      expect(a.id.startsWith(`${RIG_PREFIX}${process.pid}-`)).toBe(true)
      expect((await a.nodes()).length).toBe(2)
      expect((await b.nodes()).length).toBe(2)
    } finally {
      await Promise.all([a.teardown(), b.teardown()])
    }
  })

  it('refuses to play into anything that is not its own present device', async () => {
    const rig = await PipeWireRig.create()
    const wav = join(dir, 'silence.wav')
    writeFileSync(wav, encodeWav16(new Int16Array(1600)))
    try {
      await expect(rig.play(before.sink!, wav)).rejects.toThrow(/not a rig device/)
      await expect(rig.play(before.source!, wav)).rejects.toThrow(/not a rig device/)
      await expect(rig.play(`${rig.id}-nonexistent`, wav)).rejects.toThrow(/missing/)
      await rig.remove(rig.system)
      await expect(rig.play(rig.system, wav)).rejects.toThrow(/missing/)
    } finally {
      await rig.teardown()
    }
  })

  it('players are linked only to the rig device they target — never by WirePlumber, never elsewhere', async () => {
    const rig = await PipeWireRig.create()
    const wav = join(dir, 'quiet.wav')
    const quiet = new Int16Array(16000 * 1.5).map((_, i) => Math.round(300 * Math.sin(i / 5)))
    writeFileSync(wav, encodeWav16(quiet))
    try {
      const playing = rig.playTogether([
        [rig.mic, wav],
        [rig.system, wav],
      ])
      await sleep(700)
      // `pw-link -l` while playing: a port line, then indented `|-> peer:port` / `|<- peer:port` lines
      const snapshot = await sh('pw-link', ['-l'])
      await playing
      const pairs: Array<[string, string]> = []
      let port = ''
      for (const line of snapshot.split('\n')) {
        if (!line.trim()) continue
        if (!/^\s/.test(line)) port = line.trim()
        else pairs.push([port.split(':')[0]!, line.replace(/^\s*\|?(->|<-)\s*/, '').split(':')[0]!])
      }
      const playerPeers = pairs
        .filter(([node]) => node.startsWith(`${rig.id}-player-`))
        .map(([, peer]) => peer)
      expect(playerPeers.sort()).toEqual([rig.mic.captureTarget, rig.system.captureTarget].sort())
      // and nothing else in the graph links to a rig player
      const intoPlayers = pairs
        .filter(([, peer]) => peer.startsWith(`${rig.id}-player-`))
        .map(([node]) => node)
      expect(intoPlayers.every((n) => n === rig.mic.captureTarget || n === rig.system.captureTarget)).toBe(
        true,
      )
    } finally {
      await rig.teardown()
    }
  })

  it('pw-play with the rig stream properties fails instead of falling back to the default sink', async () => {
    // Bypass play()'s own check to prove the second line of defence: node.dont-fallback. The file is
    // digital silence at volume 0, so even a fallback would be inaudible.
    const wav = join(dir, 'silence2.wav')
    writeFileSync(wav, encodeWav16(new Int16Array(16000 * 3)))
    const name = `${RIG_PREFIX}${process.pid}-fallback-probe`
    const child = spawn(
      'pw-play',
      [
        '--volume',
        '0',
        '--target',
        `${RIG_PREFIX}${process.pid}-does-not-exist`,
        '-P',
        `{ node.dont-fallback=true node.dont-reconnect=true node.dont-move=true node.name=${name} }`,
        wav,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let stderr = ''
    child.stderr!.on('data', (b) => {
      stderr += b
    })
    const exited = new Promise<number | null>((r) => child.on('exit', (c) => r(c)))
    await sleep(500)
    const links = await sh('pw-link', ['-l'])
    const linked = links.split('\n').some((l) => l.includes(name))
    child.kill('SIGKILL')
    await exited
    expect(linked).toBe(false)
    expect(stderr).toMatch(/target not found/)
  })

  it('a SIGKILLed owner takes its rig nodes with it (pw-cli exits on stdin EOF)', async () => {
    const child = spawn(process.execPath, [join(import.meta.dirname, 'helpers', 'rig-owner.ts')], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    const ready = await readyLine(child)
    expect(ready.nodes).toHaveLength(2)
    expect((await listRigNodes(ready.id)).length).toBe(2)
    child.kill('SIGKILL')
    const t0 = Date.now()
    while ((await listRigNodes(ready.id)).length && Date.now() - t0 < 5000) await sleep(50)
    const gone = Date.now() - t0
    expect(await listRigNodes(ready.id)).toEqual([])
    console.log(`[rig] nodes of SIGKILLed owner gone after ${gone} ms`)
    await assertDefaultsUnchanged(before)
  })

  it('cleanupStaleRigs removes nodes whose owner pid is dead, and leaves live rigs alone', async () => {
    // A "stale" device: named for a pid that has exited, held by a pw-cli that is still alive (as if
    // its stdin had leaked into another process).
    const makeStale = async (suffix: string) => {
      const dead = spawn('true')
      await new Promise((r) => dead.on('exit', r))
      const name = `${RIG_PREFIX}${dead.pid}-${suffix}`
      const holder = spawn('pw-cli', [], { stdio: ['pipe', 'ignore', 'ignore'] })
      holder.stdin!.write(
        `create-node adapter { factory.name=support.null-audio-sink node.name=${name} media.class=Audio/Sink audio.position=[MONO] priority.session=1 priority.driver=1 }\n`,
      )
      const t0 = Date.now()
      while (!(await listRigNodes(name)).length && Date.now() - t0 < 5000) await sleep(50)
      expect((await listRigNodes(name)).length).toBe(1)
      return { name, holder }
    }
    const s1 = await makeStale('stale-a')
    let live: PipeWireRig | null = null
    let s2: Awaited<ReturnType<typeof makeStale>> | null = null
    try {
      // create() sweeps stale rigs first
      live = await PipeWireRig.create()
      expect(await listRigNodes(s1.name)).toEqual([])
      // and the sweep can be run directly, with a live rig present
      s2 = await makeStale('stale-b')
      const removed = await cleanupStaleRigs()
      expect(removed).toEqual([s2.name])
      expect(await listRigNodes(s2.name)).toEqual([])
      expect((await live.nodes()).length).toBe(2)
      for (const h of [s1.holder, s2.holder])
        await new Promise((r) => (h.exitCode !== null || h.signalCode ? r(null) : h.on('exit', r)))
    } finally {
      s1.holder.kill('SIGKILL')
      s2?.holder.kill('SIGKILL')
      await live?.teardown()
    }
  })
})

async function readyLine(child: ChildProcess): Promise<{ id: string; nodes: string[] }> {
  const rl = createInterface({ input: child.stdout! })
  for await (const line of rl) if (line.startsWith('READY ')) return JSON.parse(line.slice(6))
  throw new Error('child exited before READY')
}
