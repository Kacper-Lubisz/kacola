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
  GNOMEOLA_KEYRING         secret-tool | memory | none
  GNOMEOLA_KEYRING_SERVICE libsecret service attribute (default gnomeola)
  GNOMEOLA_HEARTBEAT_MS    SSE heartbeat period (default 15000)
  GNOMEOLA_REPLAY_PAGE_SIZE events per replay page on /events (default 500)
  ANTHROPIC_API_KEY        takes precedence over the keyring
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
    remote: values.remote === true || Boolean(env.GNOMEOLA_AUTH_SECRET),
    authSecret: env.GNOMEOLA_AUTH_SECRET || null,
    adminToken: env.GNOMEOLA_ADMIN_TOKEN || null,
    syncUrl: env.GNOMEOLA_SYNC_URL || null,
    syncToken: env.GNOMEOLA_SYNC_TOKEN || null,
  }
}
