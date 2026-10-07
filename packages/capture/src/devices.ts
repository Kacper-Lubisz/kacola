import { execFile } from 'node:child_process'
import type { AudioDevice } from '@kacola/protocol'

// R-1: device enumeration from `pw-dump` (the JSON snapshot of the PipeWire graph) and the defaults
// from the `default` metadata object. node.name is the identity everywhere: it is stable across
// reboots, numeric ids are not.

export type Defaults = {
  /** `default.audio.sink` — what WirePlumber is actually using now. */
  sink: string | null
  source: string | null
  /** `default.configured.*` — what the user chose; may name a device that is not present. */
  configuredSink: string | null
  configuredSource: string | null
}

export type GraphSnapshot = {
  devices: AudioDevice[]
  defaults: Defaults
  /** Every node name in the graph (any media class), for "does this target exist" checks. */
  nodeNames: Set<string>
}

type PwObject = {
  id?: number
  type?: string
  info?: { props?: Record<string, unknown> } | null
  props?: Record<string, unknown>
  metadata?: Array<{ subject?: number; key?: string; type?: string; value?: unknown }>
}

/** Extract `name` from a metadata value, which pw-dump gives as an object (or occasionally a JSON string). */
export function metadataName(value: unknown): string | null {
  let v = value
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return (v as string) || null
    }
  }
  if (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string')
    return (v as { name: string }).name || null
  return null
}

const SOURCE_CLASSES = new Set(['Audio/Source', 'Audio/Source/Virtual', 'Audio/Duplex'])
const SINK_CLASSES = new Set(['Audio/Sink', 'Audio/Duplex'])

export function parsePwDump(json: unknown): GraphSnapshot {
  if (!Array.isArray(json)) throw new Error('pw-dump output is not a JSON array')
  const defaults: Defaults = { sink: null, source: null, configuredSink: null, configuredSource: null }
  const nodes: Array<{ name: string; description: string; mediaClass: string }> = []
  const nodeNames = new Set<string>()
  for (const raw of json as PwObject[]) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.type === 'PipeWire:Interface:Metadata' && raw.props?.['metadata.name'] === 'default') {
      for (const m of raw.metadata ?? []) {
        if (m.subject !== 0 && m.subject !== undefined) continue
        const name = metadataName(m.value)
        if (m.key === 'default.audio.sink') defaults.sink = name
        else if (m.key === 'default.audio.source') defaults.source = name
        else if (m.key === 'default.configured.audio.sink') defaults.configuredSink = name
        else if (m.key === 'default.configured.audio.source') defaults.configuredSource = name
      }
    } else if (raw.type === 'PipeWire:Interface:Node') {
      const p = raw.info?.props ?? {}
      const name = typeof p['node.name'] === 'string' ? p['node.name'] : null
      if (!name) continue
      nodeNames.add(name)
      const mediaClass = typeof p['media.class'] === 'string' ? p['media.class'] : ''
      const description =
        (typeof p['node.description'] === 'string' && p['node.description']) ||
        (typeof p['node.nick'] === 'string' && p['node.nick']) ||
        name
      nodes.push({ name, description, mediaClass })
    }
  }
  const devices: AudioDevice[] = []
  for (const n of nodes) {
    if (SOURCE_CLASSES.has(n.mediaClass))
      devices.push({
        name: n.name,
        description: n.description,
        kind: 'source',
        isDefault: n.name === defaults.source,
      })
    if (SINK_CLASSES.has(n.mediaClass))
      devices.push({
        name: n.name,
        description: n.description,
        kind: 'sink',
        isDefault: n.name === defaults.sink,
      })
  }
  devices.sort((a, b) => a.kind.localeCompare(b.kind) || a.description.localeCompare(b.description))
  return { devices, defaults, nodeNames }
}

export function runPwDump(timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile('pw-dump', [], { timeout: timeoutMs, maxBuffer: 64 << 20 }, (err, stdout) => {
      if (err) return reject(new Error(`pw-dump failed: ${err.message}`, { cause: err }))
      try {
        resolve(JSON.parse(stdout))
      } catch (e) {
        reject(new Error(`pw-dump produced invalid JSON: ${(e as Error).message}`))
      }
    })
  })
}

export async function snapshotGraph(): Promise<GraphSnapshot> {
  return parsePwDump(await runPwDump())
}

/** Audio sources and sinks, defaults flagged. */
export async function listDevices(): Promise<AudioDevice[]> {
  return (await snapshotGraph()).devices
}

/**
 * Parse one line of `pw-metadata [-m] -n default` output, e.g.
 * `update: id:0 key:'default.audio.sink' value:'{"name":"alsa_output…"}' type:'Spa:String:JSON'`.
 */
export function parseMetadataLine(
  line: string,
): { subject: number; key: string; value: string | null } | null {
  const m = /^update: id:(\d+) key:'([^']*)' value:'(.*)' type:'([^']*)'\s*$/.exec(line.trim())
  if (!m) return null
  return { subject: Number(m[1]), key: m[2]!, value: metadataName(m[3]) }
}
