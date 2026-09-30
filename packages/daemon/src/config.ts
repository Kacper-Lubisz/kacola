import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { DEFAULT_PORT, platformPaths } from '@gnomeola/protocol'
import type { FakePipelineOptions } from './fakes/pipeline.ts'

/**
 * `$GNOMEOLA_DATA_DIR`, else the platform's (see @gnomeola/protocol platformPaths): Linux and Flatpak
 * `${XDG_DATA_HOME:-~/.local/share}/gnomeola`, macOS `~/Library/Application Support/gnomeola`.
 */
export function defaultDataDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string {
  return platformPaths({ platform, env, home: homedir() }).dataDir
}

export type KeyringKind = 'secret-tool' | 'keychain' | 'memory' | 'none'

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
  /** Where meetings come from: Evolution Data Server, a JSON file, an iCalendar file/URL, or nowhere. */
  calendar:
    | { kind: 'eds' }
    | { kind: 'file'; path: string }
    | { kind: 'ics'; source: string; me: string[] }
    | { kind: 'off' }
  /** Own org.gnome.Gnomeola on the session bus. */
  dbus: boolean
  /** Source for the microphone auto-record rule; `target` restricts it to streams on one source node. */
  micActivity: { kind: 'pipewire'; target?: string } | { kind: 'off' }
  micIdleStopMs: number
  gjs: string
  /**
   * H-6: accept remote devices (pairing auth on). The HMAC secret comes from GNOMEOLA_AUTH_SECRET, else
   * from `<dataDir>/auth-secret` (created on first use, mode 0600). Required for a non-loopback --host.
   */
  remote: boolean
  authSecret: string | null
  adminToken: string | null
  /** H-7: push durable events to this hosted server (hybrid sync), with GNOMEOLA_SYNC_TOKEN. */
  syncUrl: string | null
  syncToken: string | null
  // ---- P: platform
  /** process.platform the config was resolved for. */
  platform: string
  /**
   * 'pipewire': the daemon records with pw-record (Linux, Flatpak). 'external': a client (the macOS app)
   * streams audio to the ingest route; the daemon never looks for PipeWire, gjs, D-Bus or EDS.
   */
  capture: 'pipewire' | 'external'
}

const USAGE = `usage: gnomeolad [--port N] [--host HOST] [--remote] [--data-dir DIR] [--fake]

  --host HOST   default 127.0.0.1. Anything but loopback requires --remote (pairing auth).
  --remote      accept paired remote devices: loopback stays anonymous, everything else needs a
                token from \`gnomeola pair\`

environment:
  GNOMEOLA_DATA_DIR        data directory (default \${XDG_DATA_HOME:-~/.local/share}/gnomeola)
  GNOMEOLA_FAKES=1         fake capture/STT, devices and models (same as --fake)
  GNOMEOLA_FAKE_PIPELINE   JSON FakePipelineOptions
  GNOMEOLA_FAKE_QA=1       fake question-answering engine
  GNOMEOLA_KEYRING         secret-tool | keychain | memory | none (default keychain on macOS)
  GNOMEOLA_KEYRING_SERVICE libsecret service attribute (default gnomeola)
  GNOMEOLA_HEARTBEAT_MS    SSE heartbeat period (default 15000)
  GNOMEOLA_REPLAY_PAGE_SIZE events per replay page on /events (default 500)
  ANTHROPIC_API_KEY        takes precedence over the keyring (Anthropic provider)
  OPENAI_API_KEY           takes precedence over the keyring (OpenAI provider)
  OPENAI_BASE_URL          OpenAI-compatible endpoint (default https://api.openai.com/v1)
  GNOMEOLA_CALENDAR        eds | off | file:PATH | ics:PATH-OR-URL  (default eds; off with --fake / macOS)
  GNOMEOLA_CALENDAR_ME     your addresses (comma-separated), to read your RSVP from an ICS calendar
  GNOMEOLA_CAPTURE         pipewire | external     (default pipewire; external on macOS)
  GNOMEOLA_PLATFORM        resolve defaults as this platform (tests: darwin on Linux)
  GNOMEOLA_SECURITY_BIN    the macOS security binary for the keychain keyring (tests: a fake)
  GNOMEOLA_DBUS            session | off           (default session; off with --fake)
  GNOMEOLA_MIC_ACTIVITY    pipewire[:SOURCE] | off (default pipewire; off with --fake)
  GNOMEOLA_MIC_IDLE_STOP_MS stop a mic-triggered recording after this long idle (default 30000)
  GNOMEOLA_GJS             gjs binary for cal-agent and the D-Bus bridge (default gjs)
  GNOMEOLA_AUTH_SECRET     HMAC key for device tokens (implies --remote; else <data-dir>/auth-secret)
  GNOMEOLA_ADMIN_TOKEN     optional owner token that can approve pairings remotely
  GNOMEOLA_SYNC_URL        hybrid sync: push transcripts and notes to this hosted server
  GNOMEOLA_SYNC_TOKEN      the device token for GNOMEOLA_SYNC_URL (from \`gnomeola pair\`)
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

export function parseConfig(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): MainConfig {
  let values: Record<string, string | boolean | undefined>
  try {
    values = parseArgs({
      args: argv,
      options: {
        port: { type: 'string' },
        host: { type: 'string' },
        'data-dir': { type: 'string' },
        fake: { type: 'boolean' },
        remote: { type: 'boolean' },
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
  // P: macOS has no PipeWire, gjs, session bus or EDS. Everything that needs them defaults off there and
  // is refused if asked for; capture comes from the app instead.
  const mac = platform === 'darwin'
  const capture = (env.GNOMEOLA_CAPTURE ?? (mac ? 'external' : 'pipewire')) as MainConfig['capture']
  if (capture !== 'pipewire' && capture !== 'external')
    throw new UsageError(`GNOMEOLA_CAPTURE must be pipewire or external (got ${capture})`)
  if (mac && capture === 'pipewire')
    throw new UsageError('GNOMEOLA_CAPTURE=pipewire is not available on macOS')
  const linuxOnly = (name: string, value: string, off: string) => {
    if (mac && value !== off) throw new UsageError(`${name}=${value} is not available on macOS`)
    return value
  }
  // M4 integrations touch the desktop session (EDS, the session bus, PipeWire's graph), so the fakes —
  // which every test harness uses — leave them off unless a test asks for one explicitly.
  const cal = env.GNOMEOLA_CALENDAR ?? (fakes || mac ? 'off' : 'eds')
  let calendar: MainConfig['calendar']
  if (cal === 'eds' || cal === 'off')
    calendar = { kind: linuxOnly('GNOMEOLA_CALENDAR', cal, 'off') as 'eds' | 'off' }
  else if (cal.startsWith('file:') && cal.length > 5) calendar = { kind: 'file', path: cal.slice(5) }
  else if (cal.startsWith('ics:') && cal.length > 4)
    calendar = {
      kind: 'ics',
      source: cal.slice(4),
      me: (env.GNOMEOLA_CALENDAR_ME ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
  else throw new UsageError(`GNOMEOLA_CALENDAR must be eds, off, file:PATH or ics:PATH-OR-URL (got ${cal})`)
  const dbusEnv = linuxOnly('GNOMEOLA_DBUS', env.GNOMEOLA_DBUS ?? (fakes || mac ? 'off' : 'session'), 'off')
  if (dbusEnv !== 'session' && dbusEnv !== 'off') throw new UsageError('GNOMEOLA_DBUS must be session or off')
  const mic = linuxOnly(
    'GNOMEOLA_MIC_ACTIVITY',
    env.GNOMEOLA_MIC_ACTIVITY ?? (fakes || mac || capture === 'external' ? 'off' : 'pipewire'),
    'off',
  )
  let micActivity: MainConfig['micActivity']
  if (mic === 'off') micActivity = { kind: 'off' }
  else if (mic === 'pipewire') micActivity = { kind: 'pipewire' }
  else if (mic.startsWith('pipewire:') && mic.length > 9)
    micActivity = { kind: 'pipewire', target: mic.slice(9) }
  else throw new UsageError('GNOMEOLA_MIC_ACTIVITY must be pipewire, pipewire:SOURCE or off')
  const keyring = (env.GNOMEOLA_KEYRING ?? (mac ? 'keychain' : 'secret-tool')) as KeyringKind
  if (!['secret-tool', 'keychain', 'memory', 'none'].includes(keyring))
    throw new UsageError(`unknown GNOMEOLA_KEYRING ${keyring}`)
  return {
    port: int(values.port as string | undefined, '--port', DEFAULT_PORT),
    host: (values.host as string | undefined) ?? '127.0.0.1',
    dataDir: (values['data-dir'] as string | undefined) ?? defaultDataDir(env, platform),
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
    remote: values.remote === true || Boolean(env.GNOMEOLA_AUTH_SECRET),
    authSecret: env.GNOMEOLA_AUTH_SECRET || null,
    adminToken: env.GNOMEOLA_ADMIN_TOKEN || null,
    syncUrl: env.GNOMEOLA_SYNC_URL || null,
    syncToken: env.GNOMEOLA_SYNC_TOKEN || null,
    platform,
    capture,
  }
}
