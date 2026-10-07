import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { TrackKind } from '@kacola/protocol'
import {
  assertDefaultsUnchanged,
  type Defaults,
  detectBursts,
  goertzel,
  PipeWireRig,
  readDefaults,
  writeFixture,
} from '@kacola/testkit/rig'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type CaptureResult,
  ManualDefaultsWatcher,
  PipeWireCaptureSource,
  readWavInfo,
  recoverWav,
  wavToInt16,
} from '../src/index.ts'
import {
  ALIGN_TOLERANCE_MS,
  MIC_FIXTURE,
  observe,
  outageGaps,
  readTrack,
  SYSTEM_FIXTURE,
  sleep,
  tempDir,
} from './scenario.ts'

// V-1b chaos: each scenario breaks something real on the PipeWire rig and asserts the recovery —
// reattach, a *recorded* gap of plausible length, an unbroken and still-aligned timeline, and no leaks.

const CHILD = join(import.meta.dirname, 'helpers', 'record-child.ts')

let defaults: Defaults
let rig: PipeWireRig
let dir: string

beforeAll(async () => {
  defaults = await readDefaults()
})
beforeEach(async (ctx) => {
  rig = await PipeWireRig.create()
  dir = tempDir(ctx.task.name.replace(/\W+/g, '-').slice(0, 40))
})
afterEach(async () => {
  await rig.teardown()
  await assertDefaultsUnchanged(defaults)
  expect(await strayRecorders(rig.id)).toEqual([])
})
afterAll(async () => {
  await assertDefaultsUnchanged(defaults)
})

function strayRecorders(id: string): Promise<string[]> {
  return new Promise((resolve) =>
    execFile('pgrep', ['-af', 'pw-record'], (_e, out) =>
      resolve(
        String(out ?? '')
          .split('\n')
          .filter((l) => l.includes(id)),
      ),
    ),
  )
}

function assertTimeline(result: CaptureResult, frames: ReturnType<typeof observe>['frames']) {
  for (const t of result.tracks) {
    const pcm = readTrack(t.audioPath!)
    // WAV covers the session timeline; frames are contiguous and identical to it
    expect(Math.abs((pcm.length / 16000) * 1000 - result.durationMs)).toBeLessThanOrEqual(60)
    let pos = 0
    let synthetic = 0
    for (const f of frames[t.kind]) {
      expect(f.startSample).toBe(pos)
      pos += f.samples.length
      if (f.synthetic) synthetic += f.samples.length
    }
    expect(pos).toBe(pcm.length)
    // padded samples are exactly the reported gaps
    const gapMs = t.gaps.reduce((a, g) => a + g.durationMs, 0)
    expect(Math.abs(synthetic / 16 - gapMs)).toBeLessThanOrEqual(t.gaps.length)
  }
}

const track = (r: CaptureResult, k: TrackKind) => r.tracks.find((t) => t.kind === k)!
/** A track's gaps minus bounded start/stop latency (see outageGaps). */
const outages = (r: CaptureResult, k: TrackKind) => outageGaps(track(r, k).gaps, r.durationMs)

describe('chaos — capture on the PipeWire rig', () => {
  it('(a) pw-record child killed mid-recording → reattach, recorded gap, timeline still aligned', async () => {
    const micWav = writeFixture(join(dir, 'mic.wav'), MIC_FIXTURE)
    const sysWav = writeFixture(join(dir, 'sys.wav'), SYSTEM_FIXTURE)
    const src = new PipeWireCaptureSource({ defaultsWatcher: null })
    const obs = observe(src)
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: rig.mic.captureTarget },
      { kind: 'system', device: rig.system.captureTarget },
    ])
    await sleep(300)
    const playing = rig.playTogether([
      [rig.mic, micWav],
      [rig.system, sysWav],
    ])
    await sleep(2200) // mic is silent between its bursts (1.5 s – 3.0 s)
    const victim = src.status().find((s) => s.kind === 'mic')!.pid!
    const killedAt = src.elapsedMs()
    process.kill(victim, 'SIGKILL')
    await playing
    await sleep(300)
    const newPid = src.status().find((s) => s.kind === 'mic')!.pid
    const result = await src.stop()

    const micGaps = outages(result, 'mic')
    expect(micGaps).toHaveLength(1)
    expect(micGaps[0]!.reason).toBe('child-exit')
    expect(micGaps[0]!.durationMs).toBeGreaterThan(0)
    expect(micGaps[0]!.durationMs).toBeLessThan(1000) // bounded reattach
    expect(micGaps[0]!.atMs).toBeGreaterThan(killedAt - 300)
    expect(micGaps[0]!.atMs).toBeLessThan(killedAt + 50)
    expect(outages(result, 'system')).toEqual([])
    expect(outageGaps(obs.gaps, result.durationMs)).toEqual([{ track: 'mic', ...micGaps[0]! }])
    expect(obs.errors).toContainEqual(
      expect.objectContaining({ track: 'mic', code: 'child-exit', fatal: false }),
    )
    expect(newPid).not.toBeNull()
    expect(newPid).not.toBe(victim)
    assertTimeline(result, obs.frames)

    // The padding was the right length: bursts after the gap are still where they belong.
    const mic = detectBursts(readTrack(track(result, 'mic').audioPath!), MIC_FIXTURE.freq)
    const sys = detectBursts(readTrack(track(result, 'system').audioPath!), SYSTEM_FIXTURE.freq)
    expect(mic).toHaveLength(2)
    expect(sys).toHaveLength(2)
    const after = sys[1]!.startMs - mic[1]!.startMs - 500 // 3500 vs 3000 in the fixtures
    const before = sys[0]!.startMs - mic[0]!.startMs - 1000
    console.log(
      `[chaos a] gap ${JSON.stringify(micGaps[0])}, skew before ${before.toFixed(1)} ms, after ${after.toFixed(1)} ms`,
    )
    expect(Math.abs(before)).toBeLessThanOrEqual(ALIGN_TOLERANCE_MS)
    expect(Math.abs(after)).toBeLessThanOrEqual(ALIGN_TOLERANCE_MS)
  })

  it('(b) recorded device removed and recreated mid-recording → device-missing gap, reattach, aligned', async () => {
    // one stream fanned into both devices (playInto), so any cross-track offset is the capture's own
    const burst = writeFixture(join(dir, 'burst.wav'), {
      freq: 700,
      bursts: [{ atMs: 400, durationMs: 300 }],
      totalMs: 900,
    })
    const src = new PipeWireCaptureSource({ defaultsWatcher: null })
    const obs = observe(src)
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: rig.mic.captureTarget },
      { kind: 'system', device: rig.system.captureTarget },
    ])
    await sleep(300)
    await rig.playInto([rig.mic, rig.system], burst)
    const gapsBefore = src.status().find((s) => s.kind === 'mic')!.gaps
    const removedAt = src.elapsedMs()
    await rig.remove(rig.mic)
    await sleep(1000)
    await rig.recreate('mic')
    const recreatedAt = src.elapsedMs()
    // wait for the supervisor to find it again (the gap is recorded when the first audio arrives)
    const t0 = Date.now()
    while (src.status().find((s) => s.kind === 'mic')!.gaps === gapsBefore) {
      if (Date.now() - t0 > 3000) throw new Error('mic never reattached')
      await sleep(20)
    }
    await rig.playInto([rig.mic, rig.system], burst)
    await sleep(300)
    const result = await src.stop()

    const gaps = outages(result, 'mic')
    expect(gaps).toHaveLength(1)
    expect(gaps[0]!.reason).toBe('device-missing')
    const outage = recreatedAt - removedAt
    const reattachLag = gaps[0]!.atMs + gaps[0]!.durationMs - recreatedAt
    console.log(
      `[chaos b] outage ${outage.toFixed(0)} ms, gap ${JSON.stringify(gaps[0])}, reattached ${reattachLag.toFixed(0)} ms after the device returned`,
    )
    expect(gaps[0]!.durationMs).toBeGreaterThanOrEqual(outage - 100)
    expect(reattachLag).toBeLessThan(1500) // retry backoff is capped at 1 s
    expect(outages(result, 'system')).toEqual([])
    const codes = obs.errors.map((e) => (e as { code: string }).code)
    expect(codes).toContain('child-exit')
    expect(codes).toContain('device-missing')
    assertTimeline(result, obs.frames)

    const mic = detectBursts(readTrack(track(result, 'mic').audioPath!), 700)
    const sys = detectBursts(readTrack(track(result, 'system').audioPath!), 700)
    expect(mic).toHaveLength(2)
    expect(sys).toHaveLength(2)
    console.log(
      `[chaos b] cross-track offsets before/after the outage: ${sys.map((b, i) => (b.startMs - mic[i]!.startMs).toFixed(1)).join(' / ')} ms`,
    )
    for (let i = 0; i < 2; i++)
      expect(Math.abs(sys[i]!.startMs - mic[i]!.startMs)).toBeLessThanOrEqual(ALIGN_TOLERANCE_MS)
    // and the second burst is after the gap, not swallowed by it
    expect(mic[1]!.startMs).toBeGreaterThan(gaps[0]!.atMs + gaps[0]!.durationMs)
  })

  it('(b2) default source changes mid-recording → follows it, device-changed gap, old device no longer recorded', async () => {
    const mic2 = await rig.addSource('mic2')
    const watcher = new ManualDefaultsWatcher({
      source: rig.mic.captureTarget,
      sink: rig.system.captureTarget,
    })
    const src = new PipeWireCaptureSource({ defaultsWatcher: watcher })
    const obs = observe(src)
    const targetsSeen = new Set<string>()
    const spy = setInterval(() => {
      for (const s of src.status()) if (s.target) targetsSeen.add(s.target)
    }, 10)
    await src.start(join(dir, 's'), [{ kind: 'mic' }, { kind: 'system' }]) // both follow "the default"
    expect(src.status().map((s) => s.target)).toEqual([rig.mic.captureTarget, rig.system.captureTarget])
    await sleep(300)
    const x = writeFixture(join(dir, 'x.wav'), {
      freq: 440,
      bursts: [{ atMs: 100, durationMs: 400 }],
      totalMs: 600,
    })
    await rig.play(rig.mic, x)
    watcher.set({ source: mic2.captureTarget })
    const t0 = Date.now()
    while (src.status()[0]!.target !== mic2.captureTarget || !src.status()[0]!.pid) {
      if (Date.now() - t0 > 3000) throw new Error('did not follow the new default')
      await sleep(10)
    }
    await sleep(300)
    const y = writeFixture(join(dir, 'y.wav'), {
      freq: 900,
      bursts: [{ atMs: 100, durationMs: 400 }],
      totalMs: 600,
    })
    const z = writeFixture(join(dir, 'z.wav'), {
      freq: 1300,
      bursts: [{ atMs: 100, durationMs: 400 }],
      totalMs: 600,
    })
    await rig.playTogether([
      [mic2, y],
      [rig.mic, z], // the old default: must NOT be on the track any more
    ])
    await sleep(200)
    const result = await src.stop()
    clearInterval(spy)

    const t = track(result, 'mic')
    expect(t.device).toBe(mic2.captureTarget)
    const changed = outages(result, 'mic')
    expect(changed).toHaveLength(1)
    expect(changed[0]!.reason).toBe('device-changed')
    expect(changed[0]!.durationMs).toBeLessThan(1000)
    console.log(`[chaos b2] ${JSON.stringify(changed[0])}`)
    const pcm = readTrack(t.audioPath!)
    expect(detectBursts(pcm, 440)).toHaveLength(1)
    expect(detectBursts(pcm, 900)).toHaveLength(1)
    expect(detectBursts(pcm, 1300)).toHaveLength(0)
    expect(goertzel(pcm, 1300)).toBeLessThan(goertzel(pcm, 900) * 1e-4)
    expect(outages(result, 'system')).toEqual([])
    assertTimeline(result, obs.frames)
    // only rig devices were ever recorded — never the user's real microphone or speakers
    expect([...targetsSeen].every((n) => n.startsWith(rig.id))).toBe(true)
  })

  it('(stall) a hung pw-record (SIGSTOP) is detected, replaced, and the silence is a recorded gap', async () => {
    const src = new PipeWireCaptureSource({ defaultsWatcher: null, stallTimeoutMs: 800 })
    const obs = observe(src)
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: rig.mic.captureTarget },
      { kind: 'system', device: rig.system.captureTarget },
    ])
    await sleep(500)
    const victim = src.status()[0]!.pid!
    process.kill(victim, 'SIGSTOP')
    await sleep(2000)
    const result = await src.stop()
    const gaps = outages(result, 'mic')
    expect(gaps).toHaveLength(1)
    expect(gaps[0]!.reason).toBe('stall')
    expect(gaps[0]!.durationMs).toBeGreaterThan(700)
    expect(gaps[0]!.durationMs).toBeLessThan(1600)
    expect(obs.errors).toContainEqual(expect.objectContaining({ code: 'stall', track: 'mic' }))
    expect(outages(result, 'system')).toEqual([])
    assertTimeline(result, obs.frames)
  })

  it('pause releases the device and excludes paused time from the timeline', async () => {
    const tone = writeFixture(join(dir, 't.wav'), {
      freq: 500,
      bursts: [{ atMs: 100, durationMs: 300 }],
      totalMs: 500,
    })
    const src = new PipeWireCaptureSource({ defaultsWatcher: null })
    const obs = observe(src)
    await src.start(join(dir, 's'), [
      { kind: 'mic', device: rig.mic.captureTarget },
      { kind: 'system', device: rig.system.captureTarget },
    ])
    await sleep(300)
    await rig.play(rig.mic, tone) // recorded
    await src.pause()
    expect(src.state).toBe('paused')
    expect(src.status().every((s) => s.pid === null)).toBe(true)
    const pausedAt = src.elapsedMs()
    await rig.play(rig.mic, tone) // not recorded
    await sleep(300)
    expect(src.elapsedMs()).toBe(pausedAt)
    await src.resume()
    await sleep(200)
    await rig.play(rig.mic, tone) // recorded
    await sleep(200)
    const result = await src.stop()
    const pcm = readTrack(track(result, 'mic').audioPath!)
    expect(detectBursts(pcm, 500)).toHaveLength(2)
    expect(result.durationMs).toBeLessThan(2500)
    assertTimeline(result, obs.frames)
    // the only gaps: bounded start/resume/stop latency — pausing is not an outage
    for (const t of result.tracks)
      for (const g of t.gaps) {
        expect(g.reason).toBe('latency')
        expect(g.durationMs).toBeLessThan(250)
      }
  })

  it('(c) recording process SIGKILLed → recoverWav yields valid WAVs up to (at least) the last flush', async () => {
    const long = writeFixture(join(dir, 'long.wav'), {
      freq: 440,
      bursts: [{ atMs: 0, durationMs: 8000 }],
      totalMs: 8000,
    })
    const session = join(dir, 's')
    const flushIntervalMs = 1000
    const child = spawn(
      process.execPath,
      [
        CHILD,
        JSON.stringify({
          session,
          mic: rig.mic.captureTarget,
          system: rig.system.captureTarget,
          flushIntervalMs,
        }),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )
    await waitLine(child, 'STARTED')
    const startedAt = performance.now()
    const playing = rig.play(rig.mic, long).catch(() => {})
    await sleep(3500)
    const expectedMs = performance.now() - startedAt
    child.kill('SIGKILL')
    await new Promise((r) => child.on('exit', r))
    await playing

    for (const kind of ['mic', 'system'] as const) {
      const p = join(session, `${kind}.wav`)
      const staleHeaderMs = (readWavInfo(p).dataBytes / 32000) * 1000
      const r = recoverWav(p)
      if (r.status === 'unrecoverable') throw new Error(r.reason)
      console.log(
        `[chaos c] ${kind}: alive ${expectedMs.toFixed(0)} ms, header said ${staleHeaderMs.toFixed(0)} ms, recovered ${r.durationMs} ms (${r.status})`,
      )
      expect(r.status).toBe('repaired')
      expect(r.durationMs).toBeGreaterThanOrEqual(expectedMs - flushIntervalMs)
      expect(r.durationMs).toBeLessThanOrEqual(expectedMs + 100)
      // the on-disk header itself was never more than one flush interval (+ slack) behind
      expect(staleHeaderMs).toBeGreaterThanOrEqual(expectedMs - flushIntervalMs - 250)
      expect(statSync(p).size).toBe(44 + r.dataBytes)
      const pcm = wavToInt16(readFileSync(p)).samples
      expect(pcm.length * 2).toBe(r.dataBytes)
      if (kind === 'mic') expect(detectBursts(pcm, 440).length).toBeGreaterThanOrEqual(1)
    }
    // the orphaned pw-record children notice the closed pipe and exit
    const t0 = Date.now()
    while ((await strayRecorders(rig.id)).length && Date.now() - t0 < 5000) await sleep(100)
  })

  it('(d) disk fills (real 192 KiB tmpfs) → clean fatal ENOSPC stop, readable WAVs, no leaked children', async () => {
    const mnt = join(dir, 'mnt')
    const out = join(dir, 'out')
    mkdirSync(mnt)
    mkdirSync(out)
    const tone = writeFixture(join(dir, 'tone.wav'), {
      freq: 440,
      bursts: [{ atMs: 0, durationMs: 6000 }],
      totalMs: 6000,
    })
    // An unprivileged user+mount namespace gives a real, tiny filesystem without root. The WAVs are
    // copied out before the namespace (and its tmpfs) disappears.
    const cfg = JSON.stringify({
      session: join(mnt, 's'),
      mic: rig.mic.captureTarget,
      system: rig.system.captureTarget,
    })
    const script =
      'mount -t tmpfs -o size=192k tmpfs "$1" || exit 90; "$3" "$4" "$5"; code=$?; ' +
      'df -k "$1" | tail -1 >&2; cp "$1"/s/*.wav "$2"/; exit $code'
    const child = spawn(
      'unshare',
      ['-Urm', 'sh', '-c', script, 'sh', mnt, out, process.execPath, CHILD, cfg],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stderr = ''
    child.stderr!.on('data', (b) => {
      stderr += b
    })
    const lines: string[] = []
    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (l) => lines.push(l))
    await waitLine(child, 'STARTED').catch((e) => {
      throw new Error(`${e.message}\n${stderr}`)
    })
    const playing = rig.play(rig.mic, tone).catch(() => {})
    const code = await new Promise<number | null>((r) => child.on('exit', (c) => r(c)))
    await playing
    expect(code, stderr).toBe(0)
    const resultLine = lines.find((l) => l.startsWith('RESULT '))
    expect(resultLine, `child output:\n${lines.join('\n')}\n${stderr}`).toBeDefined()
    const { result, errors, state } = JSON.parse(resultLine!.slice(7)) as {
      result: CaptureResult
      errors: Array<{ code: string; fatal: boolean }>
      state: string
    }
    console.log(
      `[chaos d] ${JSON.stringify(result.error)}; tmpfs at exit: ${stderr.trim().split('\n').at(-1)}`,
    )
    expect(result.error).toMatchObject({ code: 'ENOSPC', fatal: true })
    expect(errors.filter((e) => e.fatal)).toHaveLength(1)
    expect(state).toBe('failed')
    let total = 0
    for (const kind of ['mic', 'system'] as const) {
      const p = join(out, `${kind}.wav`)
      expect(recoverWav(p).status).toBe('ok') // finalised by the clean stop, nothing to repair
      const info = readWavInfo(p)
      expect(statSync(p).size).toBe(44 + info.dataBytes)
      total += info.dataBytes + 44
      expect(info.dataBytes).toBeGreaterThan(32000) // > 1 s each
    }
    expect(total).toBeGreaterThan(150 * 1024) // the disk was genuinely (nearly) full
    expect(total).toBeLessThanOrEqual(192 * 1024)
    const mic = wavToInt16(readFileSync(join(out, 'mic.wav'))).samples
    expect(detectBursts(mic, 440).length).toBeGreaterThanOrEqual(1)
  })
})

async function waitLine(child: ChildProcess, prefix: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: child.stdout! })
    const timer = setTimeout(() => reject(new Error(`no ${prefix} line within ${timeoutMs} ms`)), timeoutMs)
    rl.on('line', (l) => {
      if (l.startsWith(prefix)) {
        clearTimeout(timer)
        resolve(l)
      }
    })
    child.on('exit', (c) => {
      clearTimeout(timer)
      reject(new Error(`child exited (${c}) before ${prefix}`))
    })
  })
}
