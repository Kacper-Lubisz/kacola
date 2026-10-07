import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { createClient, type KacolaClient, LEASE_HEADER } from '@kacola/protocol'
import type { Ctx } from './context.ts'
import { CliError, EXIT, usage } from './errors.ts'

// The lease a connected agent holds (agent channel). `kacola live attach` takes one from the daemon
// and writes it to a lease file. The agent write verbs (`agenda status|add|edit`, `suggest`,
// `context add`) pick it up from there, or from KACOLA_LEASE, and send it in the LEASE_HEADER. The
// daemon then binds what they write to the lease (`agent:<name>`, the lease's mode and limits).
//
// Where: $KACOLA_LEASE_DIR, else $XDG_RUNTIME_DIR/kacola, else <tmp>/kacola-<user>. The dir is
// 0700 and the file 0600: the token is a bearer secret for the meeting's live channel. Which one:
//   KACOLA_LEASE=<token>   that lease (KACOLA_LEASE=none: act as the user, never as an agent)
//   --as NAME                lease-NAME.json
//   neither                  the only live lease file (its `live attach` still running), if exactly one

export type LeaseFile = {
  leaseId: string
  token: string
  sessionId: string
  agendaId: string | null
  name: string
  mode: string
  expiresAt: string
  baseUrl: string
  /** The live stream's resume cursor (the last seq seen). */
  cursor: number | null
  /** The `live attach` process holding it. */
  pid: number
}

export type ActiveLease = {
  token: string
  leaseId: string
  agendaId: string | null
  sessionId: string | null
  name: string | null
}

export function leaseDir(env: Record<string, string | undefined>): string {
  if (env.KACOLA_LEASE_DIR) return env.KACOLA_LEASE_DIR
  if (env.XDG_RUNTIME_DIR) return join(env.XDG_RUNTIME_DIR, 'kacola')
  let user = 'user'
  try {
    user = userInfo().username
  } catch {}
  return join(tmpdir(), `kacola-${user}`)
}

export const leasePath = (env: Record<string, string | undefined>, name: string) =>
  join(leaseDir(env), `lease-${name}.json`)

export function readLeaseFile(path: string): LeaseFile | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LeaseFile
  } catch {
    return null
  }
}

export function writeLeaseFile(env: Record<string, string | undefined>, f: LeaseFile): string {
  const dir = leaseDir(env)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const path = leasePath(env, f.name)
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(f), { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
  return path
}

export function removeLeaseFile(
  env: Record<string, string | undefined>,
  name: string,
  leaseId?: string,
): void {
  const path = leasePath(env, name)
  const f = readLeaseFile(path)
  // another attach may have taken this name over since: only remove our own
  if (f && leaseId && f.leaseId !== leaseId) return
  rmSync(path, { force: true })
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const usable = (f: LeaseFile | null): f is LeaseFile =>
  !!f && Date.parse(f.expiresAt) > Date.now() && (f.pid === process.pid || alive(f.pid))

const fromToken = (token: string): ActiveLease => ({
  token,
  leaseId: token.split('.')[0] ?? '',
  agendaId: null,
  sessionId: null,
  name: null,
})

/** The lease the agent verbs act under, or null (then they act as the user). */
export function activeLease(env: Record<string, string | undefined>, as?: string): ActiveLease | null {
  if (as !== undefined && !/^[A-Za-z0-9._-]{1,64}$/.test(as))
    throw usage('--as must be a short name (letters, digits, . _ -)')
  const envToken = env.KACOLA_LEASE?.trim()
  if (envToken === 'none') return null
  if (envToken) return fromToken(envToken)
  const dir = leaseDir(env)
  if (as !== undefined) {
    const f = readLeaseFile(leasePath(env, as))
    if (!usable(f))
      throw new CliError(
        EXIT.LEASE,
        `no live lease for "${as}"`,
        `attach first: kacola live attach --as ${as} (and keep it running)`,
      )
    return { token: f.token, leaseId: f.leaseId, agendaId: f.agendaId, sessionId: f.sessionId, name: f.name }
  }
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((n) => /^lease-.+\.json$/.test(n))
    .map((n) => readLeaseFile(join(dir, n)))
    .filter(usable)
  if (files.length !== 1) return null
  const f = files[0]!
  return { token: f.token, leaseId: f.leaseId, agendaId: f.agendaId, sessionId: f.sessionId, name: f.name }
}

/** A client that presents the lease. */
export function leaseClient(ctx: Ctx, lease: ActiveLease): KacolaClient {
  return createClient({
    baseUrl: ctx.client.baseUrl,
    timeoutMs: 30_000,
    headers: { 'x-kacola-client': 'cli', [LEASE_HEADER]: lease.token },
  })
}

/** The agenda a lease is for (asks the daemon when the lease came from KACOLA_LEASE alone). */
export async function leaseAgenda(ctx: Ctx, lease: ActiveLease): Promise<string> {
  if (!lease.agendaId) {
    const l = await leaseClient(ctx, lease)
      .call('heartbeatAgentLease', { params: { leaseId: lease.leaseId }, body: {} })
      .catch((err) => {
        throw new CliError(
          EXIT.LEASE,
          `the lease is not usable: ${(err as Error).message}`,
          'attach again: kacola live attach',
        )
      })
    lease.agendaId = l.agendaId
    lease.sessionId = l.sessionId
  }
  if (!lease.agendaId)
    throw new CliError(
      EXIT.NOT_FOUND,
      'this recording has no agenda',
      'the user can create one: kacola agenda create --meeting next',
    )
  return lease.agendaId
}
