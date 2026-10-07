import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { DEFAULT_PORT, platformPaths } from '@kacola/protocol'
import type { AgentLimits } from './agents/channel.ts'
import type { FakePipelineOptions } from './fakes/pipeline.ts'

/**
 * `$KACOLA_DATA_DIR`, else the platform's (see @kacola/protocol platformPaths): Linux and Flatpak
 * `${XDG_DATA_HOME:-~/.local/share}/kacola`, macOS `~/Library/Application Support/kacola`.
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
  /** Agent channel: lease timeouts and rate limits (KACOLA_AGENT_LIMITS, JSON; tests shorten them). */
  agentLimits: Partial<AgentLimits>
  /** Agent channel: the SpeechGuard (KACOLA_SPEECH_GUARD: none | heuristic). */
  /** decisions (default): the tracker's decision-based guard; none: pass-through; heuristic: stand-in. */
  speechGuard: 'decisions' | 'none' | 'heuristic'
  /** KACOLA_TRACKER=off disables the live agenda tracker (tests of the agent channel in isolation). */
  tracker: boolean
  livePartialEveryMs: number
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
  /** Own com.kacperlubisz.Kacola on the session bus. */
  dbus: boolean
  /** Source for the microphone auto-record rule; `target` restricts it to streams on one source node. */
  micActivity: { kind: 'pipewire'; target?: string } | { kind: 'off' }
  micIdleStopMs: number
  gjs: string
  /**
   * H-6: accept remote devices (pairing auth on). The HMAC secret comes from KACOLA_AUTH_SECRET, else
   * from `<dataDir>/auth-secret` (created on first use, mode 0600). Required for a non-loopback --host.
   */
  remote: boolean
  authSecret: string | null
  adminToken: string | null
  /** H-7: push durable events to this hosted server (hybrid sync), with KACOLA_SYNC_TOKEN. */
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
  // ---- sticky daemon
  /**
   * Started by something that starts it again after it exits: systemd (INVOCATION_ID is set for every
   * unit process) or the desktop window's supervisor (KACOLA_SUPERVISED=1). Reported on /daemon so
   * `kacola daemon restart` can tell whether the daemon will come back by itself.
   */
  supervised: boolean
}

const USAGE = `usage: kacolad [--port N] [--host HOST] [--remote] [--data-dir DIR] [--fake]

  --host HOST   default 127.0.0.1. Anything but loopback requires --remote (pairing auth).
  --remote      accept paired remote devices: loopback stays anonymous, everything else needs a
                token from \`kacola pair\`

environment:
  KACOLA_DATA_DIR        data directory (default \${XDG_DATA_HOME:-~/.local/share}/kacola)
  KACOLA_FAKES=1         fake capture/STT, devices and models (same as --fake)
  KACOLA_FAKE_PIPELINE   JSON FakePipelineOptions
  KACOLA_FAKE_QA=1       fake question-answering engine
  KACOLA_AGENT_LIMITS    JSON: agent lease timeouts and rate limits (see agents/channel.ts)
  KACOLA_SPEECH_GUARD    decisions (default) | none | heuristic — the guard applied to live speech for agents
  KACOLA_TRACKER         on (default) | off — the live agenda tracker
  KACOLA_LIVE_PARTIAL_MS at most one partial per track per this many ms to agents (default 1500)
  KACOLA_KEYRING         secret-tool | keychain | memory | none (default keychain on macOS)
  KACOLA_KEYRING_SERVICE libsecret service attribute (default kacola)
  KACOLA_HEARTBEAT_MS    SSE heartbeat period (default 15000)
  KACOLA_REPLAY_PAGE_SIZE events per replay page on /events (default 500)
  ANTHROPIC_API_KEY        takes precedence over the keyring (Anthropic provider)
  OPENAI_API_KEY           takes precedence over the keyring (OpenAI provider)
  TYPESAFE_API_KEY         takes precedence over the keyring (TypeSafe Jev decisions provider)
  OPENAI_BASE_URL          OpenAI-compatible endpoint (default https://api.openai.com/v1)
  KACOLA_CALENDAR        eds | off | file:PATH | ics:PATH-OR-URL  (default eds; off with --fake / macOS)
  KACOLA_CALENDAR_ME     your addresses (comma-separated), to read your RSVP from an ICS calendar
  KACOLA_CAPTURE         pipewire | external     (default pipewire; external on macOS)
  KACOLA_PLATFORM        resolve defaults as this platform (tests: darwin on Linux)
  KACOLA_SECURITY_BIN    the macOS security binary for the keychain keyring (tests: a fake)
  KACOLA_DBUS            session | off           (default session; off with --fake)
  KACOLA_MIC_ACTIVITY    pipewire[:SOURCE] | off (default pipewire; off with --fake)
  KACOLA_MIC_IDLE_STOP_MS stop a mic-triggered recording after this long idle (default 30000)
  KACOLA_GJS             gjs binary for cal-agent and the D-Bus bridge (default gjs)
  KACOLA_AUTH_SECRET     HMAC key for device tokens (implies --remote; else <data-dir>/auth-secret)
  KACOLA_ADMIN_TOKEN     optional owner token that can approve pairings remotely
  KACOLA_SYNC_URL        hybrid sync: push transcripts and notes to this hosted server
  KACOLA_SYNC_TOKEN      the device token for KACOLA_SYNC_URL (from \`kacola pair\`)
  KACOLA_SHARE_URL       team sharing: the hosted server agendas are shared on (default KACOLA_SYNC_URL)
  KACOLA_SHARE_TOKEN     its device token (default KACOLA_SYNC_TOKEN); only agendas leave, never transcripts
  KACOLA_OWNER_NAME      how you appear on shared agendas (default "Organizer")
  KACOLA_OWNER_EMAIL     your label on shared changes (others see peer:<it>)
  KACOLA_AGENDA_WEB_BASE base of the shared page link (<base>/a/<token>; default the sharing host)
  KACOLA_SHARE_POLL_MS   pull shared agendas this often (default 15000; 0 = only on demand)
  KACOLA_RESUME_WINDOW_MS resume a recording the previous daemon left mid-meeting if it stopped at
                           most this long ago (default 120000; 0 = never)
  KACOLA_SUPERVISED=1    something restarts this daemon when it exits (set by the desktop window)

exit codes: 0 stopped · 1 failed · 2 usage · 75 another daemon owns the data dir · 76 restart requested
signals: TERM/INT stop, suspending a live recording for the next daemon to resume · HUP restart once idle
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
  if (env.KACOLA_FAKE_PIPELINE) {
    try {
      fakePipeline = JSON.parse(env.KACOLA_FAKE_PIPELINE) as FakePipelineOptions
    } catch {
      throw new UsageError('KACOLA_FAKE_PIPELINE must be JSON')
    }
  }
  const fakes = values.fake === true || env.KACOLA_FAKES === '1'
  let agentLimits: Partial<AgentLimits> = {}
  if (env.KACOLA_AGENT_LIMITS) {
    try {
      agentLimits = JSON.parse(env.KACOLA_AGENT_LIMITS) as Partial<AgentLimits>
    } catch {
      throw new UsageError('KACOLA_AGENT_LIMITS must be JSON')
    }
  }
  const speechGuard = env.KACOLA_SPEECH_GUARD ?? 'decisions'
  if (speechGuard !== 'decisions' && speechGuard !== 'none' && speechGuard !== 'heuristic')
    throw new UsageError('KACOLA_SPEECH_GUARD must be decisions, none or heuristic')
  const trackerEnv = env.KACOLA_TRACKER ?? 'on'
  if (trackerEnv !== 'on' && trackerEnv !== 'off') throw new UsageError('KACOLA_TRACKER must be on or off')
  // P: macOS has no PipeWire, gjs, session bus or EDS. Everything that needs them defaults off there and
  // is refused if asked for; capture comes from the app instead.
  const mac = platform === 'darwin'
  const capture = (env.KACOLA_CAPTURE ?? (mac ? 'external' : 'pipewire')) as MainConfig['capture']
  if (capture !== 'pipewire' && capture !== 'external')
    throw new UsageError(`KACOLA_CAPTURE must be pipewire or external (got ${capture})`)
  if (mac && capture === 'pipewire') throw new UsageError('KACOLA_CAPTURE=pipewire is not available on macOS')
  const linuxOnly = (name: string, value: string, off: string) => {
    if (mac && value !== off) throw new UsageError(`${name}=${value} is not available on macOS`)
    return value
  }
  // M4 integrations touch the desktop session (EDS, the session bus, PipeWire's graph), so the fakes —
  // which every test harness uses — leave them off unless a test asks for one explicitly.
  const cal = env.KACOLA_CALENDAR ?? (fakes || mac ? 'off' : 'eds')
  let calendar: MainConfig['calendar']
  if (cal === 'eds' || cal === 'off')
    calendar = { kind: linuxOnly('KACOLA_CALENDAR', cal, 'off') as 'eds' | 'off' }
  else if (cal.startsWith('file:') && cal.length > 5) calendar = { kind: 'file', path: cal.slice(5) }
  else if (cal.startsWith('ics:') && cal.length > 4)
    calendar = {
      kind: 'ics',
      source: cal.slice(4),
      me: (env.KACOLA_CALENDAR_ME ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
  else throw new UsageError(`KACOLA_CALENDAR must be eds, off, file:PATH or ics:PATH-OR-URL (got ${cal})`)
  const dbusEnv = linuxOnly('KACOLA_DBUS', env.KACOLA_DBUS ?? (fakes || mac ? 'off' : 'session'), 'off')
  if (dbusEnv !== 'session' && dbusEnv !== 'off') throw new UsageError('KACOLA_DBUS must be session or off')
  const mic = linuxOnly(
    'KACOLA_MIC_ACTIVITY',
    env.KACOLA_MIC_ACTIVITY ?? (fakes || mac || capture === 'external' ? 'off' : 'pipewire'),
    'off',
  )
  let micActivity: MainConfig['micActivity']
  if (mic === 'off') micActivity = { kind: 'off' }
  else if (mic === 'pipewire') micActivity = { kind: 'pipewire' }
  else if (mic.startsWith('pipewire:') && mic.length > 9)
    micActivity = { kind: 'pipewire', target: mic.slice(9) }
  else throw new UsageError('KACOLA_MIC_ACTIVITY must be pipewire, pipewire:SOURCE or off')
  const keyring = (env.KACOLA_KEYRING ?? (mac ? 'keychain' : 'secret-tool')) as KeyringKind
  if (!['secret-tool', 'keychain', 'memory', 'none'].includes(keyring))
    throw new UsageError(`unknown KACOLA_KEYRING ${keyring}`)
  return {
    port: int(values.port as string | undefined, '--port', DEFAULT_PORT),
    host: (values.host as string | undefined) ?? '127.0.0.1',
    dataDir: (values['data-dir'] as string | undefined) ?? defaultDataDir(env, platform),
    heartbeatMs: int(
      (values['heartbeat-ms'] as string | undefined) ?? env.KACOLA_HEARTBEAT_MS,
      'heartbeat',
      15_000,
      1,
    ),
    replayPageSize: int(env.KACOLA_REPLAY_PAGE_SIZE, 'KACOLA_REPLAY_PAGE_SIZE', 500, 1),
    fakes,
    fakePipeline,
    agentLimits,
    speechGuard,
    tracker: trackerEnv === 'on',
    livePartialEveryMs: int(env.KACOLA_LIVE_PARTIAL_MS, 'KACOLA_LIVE_PARTIAL_MS', 1500, 0),
    fakeQa: env.KACOLA_FAKE_QA === '1',
    keyring,
    keyringService: env.KACOLA_KEYRING_SERVICE || 'kacola',
    echoLogs: env.KACOLA_ECHO_LOGS === '1' || env.INVOCATION_ID !== undefined, // INVOCATION_ID: under systemd
    calendar,
    dbus: dbusEnv === 'session',
    micActivity,
    micIdleStopMs: int(env.KACOLA_MIC_IDLE_STOP_MS, 'KACOLA_MIC_IDLE_STOP_MS', 30_000, 0),
    gjs: env.KACOLA_GJS || 'gjs',
    remote: values.remote === true || Boolean(env.KACOLA_AUTH_SECRET),
    authSecret: env.KACOLA_AUTH_SECRET || null,
    adminToken: env.KACOLA_ADMIN_TOKEN || null,
    syncUrl: env.KACOLA_SYNC_URL || null,
    syncToken: env.KACOLA_SYNC_TOKEN || null,
    platform,
    capture,
    supervised: env.INVOCATION_ID !== undefined || env.KACOLA_SUPERVISED === '1',
  }
}
