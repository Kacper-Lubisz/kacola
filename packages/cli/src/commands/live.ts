import {
  AgentMode,
  createClient,
  DaemonUnreachableError,
  GnomeolaApiError,
  LEASE_HEADER,
  type LeaseGrant,
  LiveEvent,
  type LiveSession,
  type SseMessage,
} from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, usage } from '../errors.ts'
import { type LeaseFile, leasePath, readLeaseFile, removeLeaseFile, writeLeaseFile } from '../lease.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'

// `gnomeola live attach` / `live wait`: a connected agent's side of the live channel.
//
// attach prints ONE JSON line per LiveEvent on stdout until the meeting ends: made to run as a
// background command whose every output line wakes the agent (Claude Code's Monitor tool). Meanwhile it:
//   - takes a lease on the recording (or reuses the one in its lease file after a restart of this
//     command), writes the lease file the agent write verbs pick up, and removes it on the way out;
//   - heartbeats, so the lease lives exactly as long as this command does;
//   - reconnects when the stream drops, resuming from the last seq it saw (no gaps, no duplicates), and
//     takes a new lease when the daemon restarted (leases do not survive it).
// Exit: 0 the meeting ended · 7 the lease ended (the user disconnected the agent, or access withdrawn)
// · 4 no such recording · 3 the daemon went away and stayed away · 2 usage.
//
// wait blocks until a recording an agent may attach to is under way (optionally: for one meeting),
// prints it as one JSON line and exits 0; exit 4 on --timeout.

export type AttachOpts = {
  session?: string
  as?: string
  mode?: string
  replay?: boolean
  noPartials?: boolean
  heartbeatSec?: number
  /** Give up reconnecting after this long without a connection (default 120 s). */
  reconnectSec?: number
}

const line = (ctx: Ctx, ev: LiveEvent) => ctx.io.stdout(`${JSON.stringify(ev)}\n`)
const note = (ctx: Ctx, s: string) => ctx.io.stderr(`gnomeola live: ${s}\n`)
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    })
  })

async function liveSessions(ctx: Ctx, q: { wait?: number; meeting?: string } = {}): Promise<LiveSession[]> {
  const { sessions } = await ctx.client.call('listLiveSessions', { query: q }).catch(mapApiError)
  return sessions
}

async function resolveSession(ctx: Ctx, ref: string): Promise<string> {
  const list = await liveSessions(ctx)
  if (ref === 'current' || ref === 'latest') {
    const s = list[0]
    if (!s)
      throw new CliError(EXIT.NOT_FOUND, 'no recording is in progress', 'wait for one: gnomeola live wait')
    return s.sessionId
  }
  const hits = list.filter(
    (s) => s.sessionId === ref || s.sessionId.startsWith(ref.startsWith('ses_') ? ref : `ses_${ref}`),
  )
  if (hits.length === 1) return hits[0]!.sessionId
  if (hits.length > 1) throw usage(`${JSON.stringify(ref)} matches ${hits.length} recordings`)
  return ref // let the daemon say (not recording / no such session)
}

export async function liveAttach(ctx: Ctx, o: AttachOpts): Promise<void> {
  const name = o.as ?? 'claude'
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) throw usage('--as must be a short name (letters, digits, . _ -)')
  const m = AgentMode.safeParse(o.mode ?? 'suggest')
  if (!m.success) throw usage(`--mode must be one of ${AgentMode.options.join(', ')}`)
  const mode = m.data
  const signal = ctx.io.signal
  const env = ctx.io.env
  const baseUrl = ctx.client.baseUrl
  const sessionId = await resolveSession(ctx, o.session ?? 'current')

  // ---- the lease: reuse ours (this command restarted), else take one
  let lease: LeaseFile | null = null
  const prev = readLeaseFile(leasePath(env, name))
  if (prev && prev.sessionId === sessionId && prev.baseUrl === baseUrl && prev.mode === mode) {
    const ok = await clientFor(baseUrl, prev.token)
      .call('heartbeatAgentLease', { params: { leaseId: prev.leaseId }, body: {} })
      .then(() => true)
      .catch(() => false)
    if (ok) lease = { ...prev, pid: process.pid }
  }
  const grant = async (): Promise<LeaseFile> => {
    const g: LeaseGrant = await ctx.client
      .call('createAgentLease', { params: { id: sessionId }, body: { name, mode } })
      .catch(mapApiError)
    return {
      leaseId: g.lease.id,
      token: g.token,
      sessionId,
      agendaId: g.lease.agendaId,
      name,
      mode,
      expiresAt: g.lease.expiresAt,
      baseUrl,
      cursor: null,
      pid: process.pid,
    }
  }
  if (!lease) {
    try {
      lease = await grant()
    } catch (err) {
      // not recording (any more): the meeting is over as far as an agent is concerned
      if (err instanceof CliError && err.exitCode === EXIT.ERROR && /not recording/.test(err.message)) {
        line(ctx, { type: 'meeting.ended', sessionId })
        return
      }
      throw err
    }
  }
  let cursor: number | null = o.replay ? 0 : lease.cursor
  const save = () => writeLeaseFile(env, { ...lease!, cursor })
  save()
  note(ctx, `attached to ${sessionId} as ${name} (${mode}); lease ${lease.leaseId}`)

  // ---- heartbeats
  const beatEvery = Math.max(1, o.heartbeatSec ?? 15) * 1000
  const beat = setInterval(() => {
    clientFor(baseUrl, lease!.token)
      .call('heartbeatAgentLease', { params: { leaseId: lease!.leaseId }, body: {} })
      .catch(() => {}) // a failed beat shows up as a lost lease on the stream
  }, beatEvery)
  beat.unref?.()

  const stop = new AbortController()
  const onAbort = () => stop.abort()
  signal?.addEventListener('abort', onAbort)
  let saveTimer: NodeJS.Timeout | null = null
  let exit: CliError | null = null
  let ended = false
  let lastConnect = Date.now()
  let backoff = 250

  try {
    while (!ended && !stop.signal.aborted) {
      try {
        const it: AsyncGenerator<SseMessage> = clientFor(baseUrl, lease.token).stream('liveAttach', {
          params: { id: sessionId },
          query: { ...(cursor !== null ? { since: cursor } : {}), partials: !o.noPartials },
          signal: stop.signal,
        })
        for await (const msg of it) {
          lastConnect = Date.now()
          backoff = 250
          if (msg.id !== undefined && /^\d+$/.test(msg.id)) {
            cursor = Number(msg.id)
            saveTimer ??= setTimeout(() => {
              saveTimer = null
              save()
            }, 1000)
          }
          if (!msg.data) continue
          const ev = LiveEvent.parse(JSON.parse(msg.data))
          if (ev.type === 'attached') {
            lease.agendaId = ev.lease.agendaId ?? lease.agendaId
            save()
          }
          line(ctx, ev)
          if (ev.type === 'meeting.ended') ended = true
          if (ev.type === 'lease.ended') {
            ended = true
            if (ev.reason === 'expired') {
              // missed heartbeats (a suspended laptop): take a new lease and carry on from the cursor
              ended = false
              lease = { ...(await grant()), cursor }
              save()
              break
            }
            exit = new CliError(
              EXIT.LEASE,
              ev.reason === 'revoked'
                ? 'the user disconnected this agent'
                : ev.reason === 'superseded'
                  ? `another "${name}" attached to this recording`
                  : `the lease ended (${ev.reason})`,
            )
          }
          if (ended) break
        }
      } catch (err) {
        if (stop.signal.aborted) break
        if (err instanceof GnomeolaApiError && err.status === 401) {
          // the daemon no longer knows the lease (it restarted): a new one, same cursor
          try {
            lease = { ...(await grant()), cursor }
            save()
            continue
          } catch (e) {
            if (e instanceof CliError && /not recording/.test(e.message)) {
              line(ctx, { type: 'meeting.ended', sessionId })
              ended = true
              break
            }
            throw e
          }
        }
        if (err instanceof GnomeolaApiError) mapApiError(err)
        if (!(err instanceof DaemonUnreachableError) && !(err instanceof TypeError) && !isStreamCut(err))
          throw err
      }
      if (ended || stop.signal.aborted) break
      if (Date.now() - lastConnect > (o.reconnectSec ?? 120) * 1000)
        throw new CliError(EXIT.UNREACHABLE, `lost the daemon at ${baseUrl} and could not reconnect`)
      await sleep(backoff, stop.signal)
      backoff = Math.min(5_000, backoff * 2)
    }
  } finally {
    clearInterval(beat)
    if (saveTimer) clearTimeout(saveTimer)
    signal?.removeEventListener('abort', onAbort)
    // stopped by the user (Ctrl-C / the agent killing us): let go of the lease; ended: nothing to let go of
    if (!ended)
      await clientFor(baseUrl, lease.token)
        .call('releaseAgentLease', { params: { leaseId: lease.leaseId } })
        .catch(() => {})
    removeLeaseFile(env, name, lease.leaseId)
  }
  if (exit) throw exit
}

const isStreamCut = (err: unknown) => {
  const m = String((err as Error)?.message ?? err)
  return /terminated|aborted|socket|ECONNRESET|other side closed|fetch failed|network/i.test(m)
}

function clientFor(baseUrl: string, token: string) {
  return createClient({
    baseUrl,
    timeoutMs: 15_000,
    headers: { 'x-gnomeola-client': 'cli', [LEASE_HEADER]: token },
  })
}

export type WaitOpts = { meeting?: string; timeoutSec?: number }

export async function liveWait(ctx: Ctx, o: WaitOpts): Promise<void> {
  const deadline = o.timeoutSec !== undefined ? Date.now() + o.timeoutSec * 1000 : Number.POSITIVE_INFINITY
  const signal = ctx.io.signal
  if (o.meeting === 'next' || o.meeting === 'current') {
    const r = await ctx.client.call('nextMeeting').catch(mapApiError)
    const m = r.current ?? r.next
    if (!m) throw new CliError(EXIT.NOT_FOUND, 'there is no meeting in progress or coming up')
    o = { ...o, meeting: m.id }
  }
  for (;;) {
    if (signal?.aborted) throw new CliError(EXIT.ERROR, 'interrupted')
    const left = deadline - Date.now()
    if (left <= 0)
      throw new CliError(
        EXIT.NOT_FOUND,
        `no recording started${o.meeting ? ` for ${o.meeting}` : ''} in time`,
      )
    let list: LiveSession[] = []
    try {
      list = await liveSessions(ctx, {
        wait: Math.max(1, Math.min(25, Math.ceil(left / 1000))),
        ...(o.meeting ? { meeting: o.meeting } : {}),
      })
    } catch (err) {
      if (
        !(err instanceof CliError && err.exitCode === EXIT.UNREACHABLE) &&
        !(err instanceof DaemonUnreachableError)
      )
        throw err
      await sleep(1000, signal)
      continue
    }
    if (list.length) {
      ctx.io.stdout(renderJson({ session: list[0] }, { ...ctx.io, isTTY: false }))
      return
    }
  }
}
