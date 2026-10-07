import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

// V-1a — the synthetic PipeWire rig.
//
// Two virtual devices stand in for the user's microphone and speakers, so the production capture path
// (pw-record against named nodes) can be exercised end to end without touching real hardware:
//
//   mic    — `<id>-mic`, a server-side null node of class Audio/Source/Virtual: fixtures are linked
//            into its input, and it is recorded exactly as a microphone is. (A client-side loopback
//            module was tried first; under CPU load it dropped ~2-quantum blocks, so it was replaced.)
//   system — a null Audio/Sink `<id>-system`; fixtures are played into it and capture records its
//            monitor (stream.capture.sink=true), exactly as for real speakers.
//
// Safety properties (verified by the rig's own e2e tests):
//   * The user's defaults are never changed: every rig node has priority.session/driver = 1, far below
//     any real device, so WirePlumber never picks one as a default. assertDefaultsUnchanged() checks.
//   * Nothing is ever played to a real device: players are created with `--target 0` (WirePlumber never
//     links them anywhere) plus node.dont-fallback, and the rig links them itself, only to input ports
//     of nodes it owns and has verified are present.
//   * No leaks: each device is owned by a long-lived `pw-cli` whose stdin we hold. The nodes live exactly
//     as long as that process, and pw-cli exits on stdin EOF — so if the test process dies for any
//     reason, even SIGKILL, the kernel closes the pipe and the nodes disappear. Node names carry the
//     owning pid, so `cleanupStaleRigs()` can find leftovers from a dead owner and kill their pw-cli.

export const RIG_PREFIX = 'kacola-rig-'
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
    const owner = Number(/^kacola-rig-(\d+)-/.exec(n.name)?.[1])
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
  /** Rig node whose input ports fixtures are linked into (a null sink, or the virtual source itself). */
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
    this.mic = { role: 'mic', playTarget: `${id}-mic`, captureTarget: `${id}-mic`, nodes: [`${id}-mic`] }
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
    // With no real default device WirePlumber would elect a rig node as the default (low priority is
    // still the highest when it is the only candidate), so the no-touch guarantee needs real defaults.
    const d = await readDefaults()
    if (!d.sink || !d.source)
      throw new Error(
        `PipeWire has no default ${d.sink ? 'source' : 'sink'}; the rig needs real (or CI stand-in) defaults ` +
          'with priority.session > 1 before it starts, or WirePlumber would make a rig device the default',
      )
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
   * Add a virtual microphone `<id>-<suffix>`: a server-side null node with media.class
   * Audio/Source/Virtual. Its input port is fed by linking a player to it directly (WirePlumber will
   * not route a playback stream to a source), and it is recorded exactly like a microphone.
   */
  async addSource(suffix: string, description = `kacola rig ${suffix}`): Promise<RigDevice> {
    const name = `${this.id}-${suffix}`
    const cmd =
      `create-node adapter { factory.name=support.null-audio-sink node.name=${name} ` +
      `node.description="${description}" media.class=Audio/Source/Virtual audio.position=[MONO] ` +
      'priority.session=1 priority.driver=1 }'
    await this.hold(name, cmd, [name])
    return { role: 'mic', playTarget: name, captureTarget: name, nodes: [name] }
  }

  /** Add a virtual speaker (null sink) named `<id>-<suffix>`; capture records its monitor. */
  async addSink(suffix: string, description = `kacola rig ${suffix}`): Promise<RigDevice> {
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

  /** Play a WAV into one rig device and resolve when playback finishes. */
  async play(target: RigDevice | string, wavPath: string, opts: { timeoutMs?: number } = {}): Promise<void> {
    await this.playTogether([[target, wavPath]], opts)
  }

  /**
   * Play several WAVs into several rig devices at once. Every player is created unlinked
   * (`--target 0`: WirePlumber never routes it anywhere, so it cannot reach a real device), and an
   * unlinked stream is not scheduled — it consumes nothing until linked. All links are then made
   * together, so the players start within a few ms of each other.
   */
  async playTogether(
    pairs: ReadonlyArray<readonly [RigDevice | string, string]>,
    opts: { timeoutMs?: number } = {},
  ): Promise<void> {
    await this.playLinked(
      pairs.map(([t, wav]) => ({ targets: [typeof t === 'string' ? t : t.playTarget], wav })),
      opts.timeoutMs,
    )
  }

  /**
   * Play ONE stream into several rig devices: one player linked to all of them, so every target gets
   * the identical samples in the same graph cycle and any offset between the captured tracks is the
   * capture path's own.
   */
  async playInto(
    targets: ReadonlyArray<RigDevice | string>,
    wavPath: string,
    opts: { timeoutMs?: number } = {},
  ): Promise<void> {
    await this.playLinked(
      [{ targets: targets.map((t) => (typeof t === 'string' ? t : t.playTarget)), wav: wavPath }],
      opts.timeoutMs,
    )
  }

  private playerSeq = 0

  private async playLinked(
    jobs: Array<{ targets: string[]; wav: string }>,
    timeoutMs = 120_000,
  ): Promise<void> {
    const inputs = await this.ownInputPorts(jobs.flatMap((j) => j.targets))
    const players = jobs.map((j) => ({ ...j, name: `${this.id}-player-${++this.playerSeq}` }))
    const done = players.map((p) => this.spawnPlayer(p.name, p.wav, timeoutMs))
    // a player that dies before its port appears must fail the call, not hang it
    let early: Error | null = null
    for (const d of done)
      d.catch((e: Error) => {
        early ??= e
      })
    const outs: string[] = []
    for (const p of players) {
      let port: string | undefined
      await waitFor(
        async () => {
          if (early) throw early
          port = (await portsOf(p.name))[0]
          return port !== undefined
        },
        5000,
        `${p.name} output port`,
      )
      outs.push(port!)
    }
    await Promise.all(
      players.flatMap((p, i) =>
        p.targets.flatMap((t) => inputs.get(t)!.map((inPort) => run('pw-link', [outs[i]!, inPort]))),
      ),
    )
    await Promise.all(done)
  }

  /** Input ports of rig devices; refuses anything the rig does not own or that is not present. */
  private async ownInputPorts(names: string[]): Promise<Map<string, string[]>> {
    const nodes = await listRigNodes(this.id)
    const ports = await listPorts()
    const out = new Map<string, string[]>()
    for (const name of names) {
      if (!name.startsWith(`${this.id}-`) || name.includes('-player-'))
        throw new Error(`refusing to play into ${name}: not a rig device`)
      const node = nodes.find((n) => n.name === name)
      if (node?.mediaClass !== 'Audio/Sink' && node?.mediaClass !== 'Audio/Source/Virtual')
        throw new Error(
          `refusing to play into ${name}: not a present rig device (${node?.mediaClass ?? 'missing'})`,
        )
      const inPorts = ports.filter((p) => p.startsWith(`${name}:`))
      if (!inPorts.length) throw new Error(`rig device ${name} has no input port`)
      out.set(name, inPorts)
    }
    return out
  }

  private async spawnPlayer(nodeName: string, wavPath: string, timeoutMs: number): Promise<void> {
    const props = `{ ${NO_FALLBACK} media.role=Test node.name=${nodeName} }`
    const child = spawn('pw-play', ['--target', '0', '-P', props, wavPath], {
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
          reject(new Error(`${nodeName} did not finish within ${timeoutMs} ms: ${stderr}`))
        }, timeoutMs)
        child.on('exit', (code, sig) => {
          clearTimeout(timer)
          if (code === 0) resolve()
          else reject(new Error(`${nodeName} failed (code ${code}, signal ${sig}): ${stderr.trim()}`))
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
