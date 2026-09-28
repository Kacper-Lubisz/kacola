import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

// V-1a — the synthetic PipeWire rig.
//
// Two virtual devices stand in for the user's microphone and speakers, so the production capture path
// (pw-record against named nodes) can be exercised end to end without touching real hardware:
//
//   mic    — a loopback: an Audio/Sink `<id>-mic-in` you play fixtures into, and an Audio/Source
//            `<id>-mic` you record from, exactly as you would a microphone.
//   system — a null Audio/Sink `<id>-system`; fixtures are played into it and capture records its
//            monitor (stream.capture.sink=true), exactly as for real speakers.
//
// Safety properties (verified by the rig's own e2e tests):
//   * The user's defaults are never changed: every rig node has priority.session/driver = 1, far below
//     any real device, so WirePlumber never picks one as a default. assertDefaultsUnchanged() checks.
//   * Nothing is ever played to a real device: play() refuses any target that is not one of this rig's
//     own sinks, and pw-play runs with node.dont-fallback so a vanished target fails instead of being
//     rerouted to the default sink.
//   * No leaks: each device is owned by a long-lived `pw-cli` whose stdin we hold. The nodes live exactly
//     as long as that process, and pw-cli exits on stdin EOF — so if the test process dies for any
//     reason, even SIGKILL, the kernel closes the pipe and the nodes disappear. Node names carry the
//     owning pid, so `cleanupStaleRigs()` can find leftovers from a dead owner and kill their pw-cli.

export const RIG_PREFIX = 'gnomeola-rig-'
const NO_FALLBACK = 'node.dont-fallback=true node.dont-reconnect=true node.dont-move=true'

export type Defaults = {
  sink: string | null
  source: string | null
  configuredSink: string | null
  configuredSource: string | null
}

type PwObj = {
  id: number
  type: string
  info?: { props?: Record<string, unknown> } | null
  props?: Record<string, unknown>
  metadata?: Array<{ subject?: number; key?: string; value?: unknown }>
}

export function pwDump(): Promise<PwObj[]> {
  return new Promise((resolve, reject) => {
    execFile('pw-dump', [], { maxBuffer: 64 << 20, timeout: 10_000 }, (err, stdout) => {
      if (err) return reject(new Error(`pw-dump failed — is PipeWire running? ${err.message}`))
      resolve(JSON.parse(stdout) as PwObj[])
    })
  })
}

function nameOf(v: unknown): string | null {
  if (typeof v === 'string') {
    try {
      return nameOf(JSON.parse(v))
    } catch {
      return v || null
    }
  }
  if (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string')
    return (v as { name: string }).name
  return null
}

export function defaultsFrom(dump: PwObj[]): Defaults {
  const d: Defaults = { sink: null, source: null, configuredSink: null, configuredSource: null }
  const meta = dump.find(
    (o) => o.type === 'PipeWire:Interface:Metadata' && o.props?.['metadata.name'] === 'default',
  )
  for (const m of meta?.metadata ?? []) {
    if (m.key === 'default.audio.sink') d.sink = nameOf(m.value)
    if (m.key === 'default.audio.source') d.source = nameOf(m.value)
    if (m.key === 'default.configured.audio.sink') d.configuredSink = nameOf(m.value)
    if (m.key === 'default.configured.audio.source') d.configuredSource = nameOf(m.value)
  }
  return d
}

export async function readDefaults(): Promise<Defaults> {
  return defaultsFrom(await pwDump())
}

/** Throws if any default (effective or configured) differs from `before`. */
export async function assertDefaultsUnchanged(before: Defaults): Promise<void> {
  const now = await readDefaults()
  const diffs = (Object.keys(before) as (keyof Defaults)[]).filter((k) => before[k] !== now[k])
  if (diffs.length)
    throw new Error(
      `PipeWire defaults changed: ${diffs.map((k) => `${k}: ${before[k]} -> ${now[k]}`).join(', ')}`,
    )
}

export type RigNode = { id: number; name: string; mediaClass: string; clientPid: number | null }

/** All nodes whose name starts with `prefix` (default: any rig), with the pid of the owning client. */
export async function listRigNodes(prefix = RIG_PREFIX): Promise<RigNode[]> {
  const dump = await pwDump()
  const clientPid = new Map<number, number | null>()
  for (const o of dump) {
    if (o.type !== 'PipeWire:Interface:Client') continue
    const p = o.info?.props ?? {}
    const pid = Number(p['application.process.id'] ?? p['pipewire.sec.pid'])
    clientPid.set(o.id, Number.isFinite(pid) ? pid : null)
  }
  const out: RigNode[] = []
  for (const o of dump) {
    if (o.type !== 'PipeWire:Interface:Node') continue
    const p = o.info?.props ?? {}
    const name = String(p['node.name'] ?? '')
    if (!name.startsWith(prefix)) continue
    out.push({
      id: o.id,
      name,
      mediaClass: String(p['media.class'] ?? ''),
      clientPid: clientPid.get(Number(p['client.id'])) ?? null,
    })
  }
  return out
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Remove rig nodes left behind by an owner process that no longer exists (their names carry the owner
 * pid). Kills the pw-cli that holds them. Returns the names removed. Rigs of live processes (another
 * test file running in parallel) are left alone.
 */
export async function cleanupStaleRigs(): Promise<string[]> {
  const stale = (await listRigNodes()).filter((n) => {
    const owner = Number(/^gnomeola-rig-(\d+)-/.exec(n.name)?.[1])
    return Number.isFinite(owner) && !alive(owner)
  })
  for (const n of stale) {
    if (n.clientPid && n.clientPid !== process.pid) {
      try {
        process.kill(n.clientPid, 'SIGTERM')
      } catch {
        // already gone
      }
    }
  }
  if (stale.length) {
    const names = new Set(stale.map((s) => s.name))
    await waitFor(
      async () => !(await listRigNodes()).some((n) => names.has(n.name)),
      5000,
      'stale rig nodes to go',
    )
  }
  return stale.map((s) => s.name)
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`))
      else resolve(stdout)
    })
  })
}

/** Input port names (`node:port`) in the graph. */
async function listPorts(): Promise<string[]> {
  const out = await run('pw-link', ['-i'])
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

async function portsOf(node: string): Promise<string[]> {
  const out = await run('pw-link', ['-o'])
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith(`${node}:`))
}

async function waitFor(cond: () => Promise<boolean>, timeoutMs: number, what: string): Promise<void> {
  const t0 = Date.now()
  for (;;) {
    if (await cond()) return
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

// ------------------------------------------------------------------------------------------ the rig

export type RigRole = 'mic' | 'system'

export type RigDevice = {
  role: RigRole
  /** Node to pass to pw-play (always an Audio/Sink owned by the rig). */
  playTarget: string
  /** Node the capture code should record: a source for the mic, the sink itself for system. */
  captureTarget: string
  /** All node names this device creates (for presence checks). */
  nodes: string[]
}

const live = new Set<ChildProcess>()
let exitHooked = false
function own(child: ChildProcess): void {
  live.add(child)
  child.on('exit', () => live.delete(child))
  if (!exitHooked) {
    exitHooked = true
    process.on('exit', () => {
      for (const c of live) c.kill('SIGKILL')
    })
  }
}

export class PipeWireRig {
  readonly id: string
  readonly mic: RigDevice
  readonly system: RigDevice
  private readonly holders = new Map<string, ChildProcess>()
  private readonly players = new Set<ChildProcess>()
  private tornDown = false

  private constructor(id: string) {
    this.id = id
    this.mic = {
      role: 'mic',
      playTarget: `${id}-mic-in`,
      captureTarget: `${id}-mic`,
      nodes: [`${id}-mic-in`, `${id}-mic`],
    }
    this.system = {
      role: 'system',
      playTarget: `${id}-system`,
      captureTarget: `${id}-system`,
      nodes: [`${id}-system`],
    }
  }

  /** Create a rig with both devices. Cleans up stale rigs from dead processes first. */
  static async create(): Promise<PipeWireRig> {
    await cleanupStaleRigs()
    const rig = new PipeWireRig(`${RIG_PREFIX}${process.pid}-${randomBytes(3).toString('hex')}`)
    try {
      await rig.addSource('mic')
      await rig.addSink('system')
    } catch (e) {
      await rig.teardown().catch(() => {})
      throw e
    }
    return rig
  }

  /**
   * Add a virtual microphone named `<id>-<suffix>` (source) fed by `<id>-<suffix>-in` (sink). The rig's
   * own `mic` is one of these; tests add more to simulate switching devices.
   */
  async addSource(suffix: string, description = `gnomeola rig ${suffix}`): Promise<RigDevice> {
    const src = `${this.id}-${suffix}`
    const sink = `${src}-in`
    const cmd =
      `load-module libpipewire-module-loopback { node.description="${description}" audio.position=[MONO] ` +
      `capture.props={ node.name=${sink} media.class=Audio/Sink priority.session=1 priority.driver=1 } ` +
      `playback.props={ node.name=${src} media.class=Audio/Source priority.session=1 priority.driver=1 } }`
    await this.hold(src, cmd, [sink, src])
    return { role: 'mic', playTarget: sink, captureTarget: src, nodes: [sink, src] }
  }

  /** Add a virtual speaker (null sink) named `<id>-<suffix>`. */
  async addSink(suffix: string, description = `gnomeola rig ${suffix}`): Promise<RigDevice> {
    const name = `${this.id}-${suffix}`
    const cmd =
      `create-node adapter { factory.name=support.null-audio-sink node.name=${name} ` +
      `node.description="${description}" media.class=Audio/Sink audio.position=[MONO] ` +
      'priority.session=1 priority.driver=1 }'
    await this.hold(name, cmd, [name])
    return { role: 'system', playTarget: name, captureTarget: name, nodes: [name] }
  }

  /** Remove a device (by its capture target), e.g. to simulate unplugging it mid-recording. */
  async remove(device: RigDevice | string): Promise<void> {
    const key = typeof device === 'string' ? device : device.captureTarget
    const holder = this.holders.get(key)
    if (!holder) throw new Error(`rig has no device ${key}`)
    this.holders.delete(key)
    const exited = new Promise<void>((r) => (holder.exitCode !== null ? r() : holder.once('exit', () => r())))
    holder.stdin!.end()
    await exited
    const nodes = typeof device === 'string' ? [key] : device.nodes
    await waitFor(
      async () => !(await listRigNodes(this.id)).some((n) => nodes.includes(n.name)),
      5000,
      `${key} to disappear`,
    )
  }

  /** Recreate one of the two standard devices after remove(). */
  async recreate(role: RigRole): Promise<void> {
    if (role === 'mic') await this.addSource('mic')
    else await this.addSink('system')
  }

  /**
   * Play a WAV into one of this rig's sinks and resolve when playback finishes. Refuses any target the
   * rig does not own, and never falls back to another device.
   */
  async play(target: RigDevice | string, wavPath: string, opts: { timeoutMs?: number } = {}): Promise<void> {
    await this.playTogether([[target, wavPath]], opts)
  }

  /**
   * Play several WAVs into several rig sinks at once. Targets are validated with one graph snapshot and
   * the players are spawned back to back, so their start skew is only process start-up (a few ms).
   */
  async playTogether(
    pairs: ReadonlyArray<readonly [RigDevice | string, string]>,
    opts: { timeoutMs?: number } = {},
  ): Promise<void> {
    const names = pairs.map(([t]) => (typeof t === 'string' ? t : t.playTarget))
    await this.assertOwnSinks(names)
    await Promise.all(pairs.map(([, wav], i) => this.spawnPlayer(names[i]!, wav, opts.timeoutMs)))
  }

  /**
   * Play ONE stream into several rig sinks: one pw-play, linked to the first target by WirePlumber and
   * to the others with pw-link. Every target receives the identical samples in the same graph cycle, so
   * any offset between the captured tracks is the capture path's own misalignment. The WAV should start
   * with ≥ 300 ms of silence (the extra links are made after playback starts).
   */
  async playInto(
    targets: ReadonlyArray<RigDevice | string>,
    wavPath: string,
    opts: { timeoutMs?: number } = {},
  ) {
    const names = targets.map((t) => (typeof t === 'string' ? t : t.playTarget))
    await this.assertOwnSinks(names)
    const player = `${this.id}-player-${++this.playerSeq}`
    const done = this.spawnPlayer(names[0]!, wavPath, opts.timeoutMs, player)
    await waitFor(async () => (await portsOf(player)).length > 0, 3000, `${player} output port`)
    const [port] = await portsOf(player)
    for (const sink of names.slice(1)) {
      const sinkPorts = (await listPorts()).filter((p) => p.startsWith(`${sink}:playback_`))
      if (!sinkPorts.length) throw new Error(`no playback port on ${sink}`)
      await run('pw-link', [port!, sinkPorts[0]!])
    }
    await done
  }

  private playerSeq = 0

  private async assertOwnSinks(names: string[]): Promise<void> {
    const nodes = await listRigNodes(this.id)
    for (const name of names) {
      if (!name.startsWith(`${this.id}-`)) throw new Error(`refusing to play into ${name}: not a rig device`)
      const node = nodes.find((n) => n.name === name)
      if (node?.mediaClass !== 'Audio/Sink')
        throw new Error(
          `refusing to play into ${name}: not a present rig Audio/Sink (${node?.mediaClass ?? 'missing'})`,
        )
    }
  }

  private async spawnPlayer(target: string, wavPath: string, timeoutMs = 120_000, nodeName?: string) {
    const props = `{ ${NO_FALLBACK} media.role=Test${nodeName ? ` node.name=${nodeName}` : ''} }`
    const child = spawn('pw-play', ['--target', target, '-P', props, wavPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    own(child)
    this.players.add(child)
    let stderr = ''
    child.stderr!.on('data', (b) => {
      stderr += b
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error(`pw-play into ${target} did not finish within ${timeoutMs} ms: ${stderr}`))
        }, timeoutMs)
        child.on('exit', (code, sig) => {
          clearTimeout(timer)
          if (code === 0) resolve()
          else
            reject(new Error(`pw-play into ${target} failed (code ${code}, signal ${sig}): ${stderr.trim()}`))
        })
      })
    } finally {
      this.players.delete(child)
    }
  }

  /** Nodes of this rig currently present in the graph. */
  nodes(): Promise<RigNode[]> {
    return listRigNodes(this.id)
  }

  /** Stop every player and device, then verify the graph holds no node of this rig. Throws otherwise. */
  async teardown(): Promise<void> {
    if (this.tornDown) return
    this.tornDown = true
    for (const p of this.players) p.kill('SIGKILL')
    const exits = [...this.holders.values()].map(
      (h) => new Promise<void>((r) => (h.exitCode !== null ? r() : h.once('exit', () => r()))),
    )
    for (const h of this.holders.values()) h.stdin!.end()
    await Promise.race([Promise.all(exits), new Promise((r) => setTimeout(r, 3000))])
    for (const h of this.holders.values()) if (h.exitCode === null) h.kill('SIGKILL')
    this.holders.clear()
    try {
      await waitFor(async () => (await listRigNodes(this.id)).length === 0, 5000, 'rig nodes to disappear')
    } catch {
      const left = await listRigNodes(this.id)
      throw new Error(`rig teardown left stray nodes: ${left.map((n) => n.name).join(', ')}`)
    }
  }

  private async hold(key: string, command: string, expectNodes: string[]): Promise<void> {
    if (this.tornDown) throw new Error('rig is torn down')
    if (this.holders.has(key)) throw new Error(`rig already has ${key}`)
    const child = spawn('pw-cli', [], { stdio: ['pipe', 'pipe', 'pipe'] })
    own(child)
    let out = ''
    child.stdout!.on('data', (b) => {
      out = (out + b).slice(-4000)
    })
    child.stderr!.on('data', (b) => {
      out = (out + b).slice(-4000)
    })
    child.on('error', () => {})
    this.holders.set(key, child)
    child.stdin!.write(`${command}\n`)
    try {
      await waitFor(
        async () => {
          if (child.exitCode !== null) throw new Error(`pw-cli exited: ${out}`)
          const names = new Set((await listRigNodes(this.id)).map((n) => n.name))
          return expectNodes.every((n) => names.has(n))
        },
        5000,
        `rig nodes ${expectNodes.join(', ')}`,
      )
    } catch (e) {
      this.holders.delete(key)
      child.kill('SIGKILL')
      throw new Error(`could not create rig device ${key}: ${(e as Error).message}\n${out}`)
    }
  }
}
