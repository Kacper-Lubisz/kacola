import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_PORT } from '@gnomeola/protocol'
import type { FakePipelineOptions } from './fakes/pipeline.ts'

/** `$GNOMEOLA_DATA_DIR`, else `${XDG_DATA_HOME:-~/.local/share}/gnomeola`. */
export function defaultDataDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GNOMEOLA_DATA_DIR) return env.GNOMEOLA_DATA_DIR
  const xdg = env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(xdg, 'gnomeola')
}

export type KeyringKind = 'secret-tool' | 'memory' | 'none'

export type MainConfig = {
  port: number
  host: string
  dataDir: string
  heartbeatMs: number
  replayPageSize: number
  /** Use the in-memory fakes for capture/STT, devices, models (tests and demos). */
  fakes: boolean
  fakePipeline: FakePipelineOptions
  /** Wire the fake Q&A engine (tests only). */
  fakeQa: boolean
  keyring: KeyringKind
  /** The libsecret `service` attribute; tests use a unique one. */
  keyringService: string
  echoLogs: boolean
  // ---- M4
  /** Where meetings come from: Evolution Data Server, a JSON file, or nowhere. */
  calendar: { kind: 'eds' } | { kind: 'file'; path: string } | { kind: 'off' }
  /** Own org.gnome.Gnomeola on the session bus. */
  dbus: boolean
  /** Source for the microphone auto-record rule; `target` restricts it to streams on one source node. */
  micActivity: { kind: 'pipewire'; target?: string } | { kind: 'off' }
  micIdleStopMs: number
  gjs: string
}

const USAGE = `usage: gnomeolad [--port N] [--host 127.0.0.1|::1|localhost] [--data-dir DIR] [--fake]

environment:
  GNOMEOLA_DATA_DIR        data directory (default \${XDG_DATA_HOME:-~/.local/share}/gnomeola)
  GNOMEOLA_FAKES=1         fake capture/STT, devices and models (same as --fake)
  GNOMEOLA_FAKE_PIPELINE   JSON FakePipelineOptions
  GNOMEOLA_FAKE_QA=1       fake question-answering engine
  GNOMEOLA_KEYRING         secret-tool | memory | none
  GNOMEOLA_KEYRING_SERVICE libsecret service attribute (default gnomeola)
  GNOMEOLA_HEARTBEAT_MS    SSE heartbeat period (default 15000)
  GNOMEOLA_REPLAY_PAGE_SIZE events per replay page on /events (default 500)
  ANTHROPIC_API_KEY        takes precedence over the keyring
  GNOMEOLA_CALENDAR        eds | off | file:PATH  (default eds; off with --fake)
  GNOMEOLA_DBUS            session | off           (default session; off with --fake)
  GNOMEOLA_MIC_ACTIVITY    pipewire[:SOURCE] | off (default pipewire; off with --fake)
  GNOMEOLA_MIC_IDLE_STOP_MS stop a mic-triggered recording after this long idle (default 30000)
  GNOMEOLA_GJS             gjs binary for cal-agent and the D-Bus bridge (default gjs)
`

export class UsageError extends Error {
  override name = 'UsageError'
}

const int = (v: string | undefined, name: string, def: number, min = 0): number => {
  if (v === undefined || v === '') return def
  const n = Number(v)
  if (!Number.isInteger(n) || n < min)
    throw new UsageError(`${name} must be an integer >= ${min}\n\n${USAGE}`)
  return n
}

export function parseConfig(argv: string[], env: NodeJS.ProcessEnv = process.env): MainConfig {
  let values: Record<string, string | boolean | undefined>
  try {
    values = parseArgs({
      args: argv,
      options: {
        port: { type: 'string' },
        host: { type: 'string' },
        'data-dir': { type: 'string' },
        fake: { type: 'boolean' },
        'heartbeat-ms': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    }).values
  } catch (err) {
    throw new UsageError(`${(err as Error).message}\n\n${USAGE}`)
  }
  if (values.help) throw new UsageError(USAGE)
  let fakePipeline: FakePipelineOptions = {}
  if (env.GNOMEOLA_FAKE_PIPELINE) {
    try {
      fakePipeline = JSON.parse(env.GNOMEOLA_FAKE_PIPELINE) as FakePipelineOptions
    } catch {
      throw new UsageError('GNOMEOLA_FAKE_PIPELINE must be JSON')
    }
  }
  const fakes = values.fake === true || env.GNOMEOLA_FAKES === '1'
  // M4 integrations touch the desktop session (EDS, the session bus, PipeWire's graph), so the fakes —
  // which every test harness uses — leave them off unless a test asks for one explicitly.
  const cal = env.GNOMEOLA_CALENDAR ?? (fakes ? 'off' : 'eds')
  let calendar: MainConfig['calendar']
  if (cal === 'eds' || cal === 'off') calendar = { kind: cal }
  else if (cal.startsWith('file:') && cal.length > 5) calendar = { kind: 'file', path: cal.slice(5) }
  else throw new UsageError(`GNOMEOLA_CALENDAR must be eds, off or file:PATH (got ${cal})`)
  const dbusEnv = env.GNOMEOLA_DBUS ?? (fakes ? 'off' : 'session')
  if (dbusEnv !== 'session' && dbusEnv !== 'off') throw new UsageError('GNOMEOLA_DBUS must be session or off')
  const mic = env.GNOMEOLA_MIC_ACTIVITY ?? (fakes ? 'off' : 'pipewire')
  let micActivity: MainConfig['micActivity']
  if (mic === 'off') micActivity = { kind: 'off' }
  else if (mic === 'pipewire') micActivity = { kind: 'pipewire' }
  else if (mic.startsWith('pipewire:') && mic.length > 9)
    micActivity = { kind: 'pipewire', target: mic.slice(9) }
  else throw new UsageError('GNOMEOLA_MIC_ACTIVITY must be pipewire, pipewire:SOURCE or off')
  const keyring = (env.GNOMEOLA_KEYRING ?? 'secret-tool') as KeyringKind
  if (!['secret-tool', 'memory', 'none'].includes(keyring))
    throw new UsageError(`unknown GNOMEOLA_KEYRING ${keyring}`)
  return {
    port: int(values.port as string | undefined, '--port', DEFAULT_PORT),
    host: (values.host as string | undefined) ?? '127.0.0.1',
    dataDir: (values['data-dir'] as string | undefined) ?? defaultDataDir(env),
    heartbeatMs: int(
      (values['heartbeat-ms'] as string | undefined) ?? env.GNOMEOLA_HEARTBEAT_MS,
      'heartbeat',
      15_000,
      1,
    ),
    replayPageSize: int(env.GNOMEOLA_REPLAY_PAGE_SIZE, 'GNOMEOLA_REPLAY_PAGE_SIZE', 500, 1),
    fakes,
    fakePipeline,
    fakeQa: env.GNOMEOLA_FAKE_QA === '1',
    keyring,
    keyringService: env.GNOMEOLA_KEYRING_SERVICE || 'gnomeola',
    echoLogs: env.GNOMEOLA_ECHO_LOGS === '1' || env.INVOCATION_ID !== undefined, // INVOCATION_ID: under systemd
    calendar,
    dbus: dbusEnv === 'session',
    micActivity,
    micIdleStopMs: int(env.GNOMEOLA_MIC_IDLE_STOP_MS, 'GNOMEOLA_MIC_IDLE_STOP_MS', 30_000, 0),
    gjs: env.GNOMEOLA_GJS || 'gjs',
  }
}
