import {
  type DaemonInfo,
  DaemonUnreachableError,
  GnomeolaApiError,
  type LiveRecording,
  type RestartMode,
  type RestartResponse,
} from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, refused } from '../errors.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'

// The daemon's own lifecycle: what it is recording right now (asked of the daemon, not inferred from
// the session list), and restarts that wait for the recording to finish.
//
//   daemon status                  pid, data dir, live recordings, a pending restart
//   daemon idle                    exit 0 when nothing is recording (or no daemon runs), 5 when something is
//   daemon restart [--when-idle]   exit once nothing is recording; waits and prints what it waits for
//   daemon restart --now [--force] restart straight away; refused while recording unless --force, which
//                                  suspends the recording for the next daemon to resume
//   daemon restart --cancel        call off a waiting restart

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const brief = (s: LiveRecording) => `"${s.title}" (${s.id}, ${s.status})`

/** A daemon from before /daemon existed answers 404: fall back to the session list (private included). */
async function liveOf(ctx: Ctx): Promise<{ info: DaemonInfo | null; recording: LiveRecording[] }> {
  try {
    const info = await ctx.client.call('daemonInfo')
    return { info, recording: info.recording }
  } catch (err) {
    if (!(err instanceof GnomeolaApiError) || err.status !== 404) throw err
    const { sessions } = await ctx.client.call('listSessions', {
      query: { limit: 200, includePrivate: true },
    })
    const recording = sessions
      .filter((s) => s.status === 'recording' || s.status === 'paused')
      .map((s) => ({
        id: s.id,
        title: s.private ? 'a private recording' : s.title,
        status: s.status,
        private: s.private,
        startedAt: s.startedAt,
      }))
    return { info: null, recording }
  }
}

export async function daemonStatus(ctx: Ctx) {
  const { info, recording } = await liveOf(ctx).catch(mapApiError)
  if (ctx.format === 'json')
    return ctx.io.stdout(renderJson(info ?? { legacy: true, recording, restart: null }, ctx.io))
  if (info)
    ctx.io.stdout(
      `gnomeolad ${info.version} pid ${info.pid} at ${ctx.client.baseUrl} — data ${info.dataDir}` +
        `${info.supervised ? ' (supervised)' : ' (not supervised: a restart will not bring it back)'}\n`,
    )
  else ctx.io.stdout(`gnomeolad at ${ctx.client.baseUrl} (an older daemon: no /daemon route)\n`)
  if (!recording.length) ctx.io.stdout('  recording  nothing\n')
  for (const s of recording) ctx.io.stdout(`  recording  ${brief(s)}\n`)
  if (info?.restart)
    ctx.io.stdout(
      `  restart    pending (${info.restart.mode}, asked by ${info.restart.by} at ${info.restart.requestedAt})\n`,
    )
  for (const r of info?.resumed ?? [])
    ctx.io.stdout(
      `  resumed    ${r.id} after a ${Math.round(r.gapMs / 1000)} s gap (the previous daemon stopped mid-meeting)\n`,
    )
}

/** For scripts (scripts/install.sh): exit 0 if nothing is recording or no daemon answers, 5 if something is. */
export async function daemonIdle(ctx: Ctx) {
  let recording: LiveRecording[]
  try {
    recording = (await liveOf(ctx)).recording
  } catch (err) {
    if (err instanceof DaemonUnreachableError) {
      if (ctx.format === 'json') ctx.io.stdout(renderJson({ running: false, recording: [] }, ctx.io))
      else ctx.io.stdout('no daemon is running\n')
      return
    }
    return mapApiError(err)
  }
  if (ctx.format === 'json') ctx.io.stdout(renderJson({ running: true, recording }, ctx.io))
  else if (!recording.length) ctx.io.stdout('idle: nothing is recording\n')
  if (recording.length) throw refused(`recording ${recording.map(brief).join(', ')}`)
}

export async function daemonRestart(
  ctx: Ctx,
  o: { mode: RestartMode; force: boolean; wait: boolean; timeoutMs: number | null },
) {
  const before = await ctx.client.call('daemonInfo').catch((err) => {
    if (err instanceof GnomeolaApiError && err.status === 404)
      throw new CliError(
        EXIT.UNAVAILABLE,
        'this daemon predates restarts that wait for the recording',
        'check `gnomeola daemon idle` and restart it with systemctl --user restart gnomeolad when idle',
      )
    return mapApiError(err)
  })
  let r: RestartResponse
  try {
    r = await ctx.client.call('requestRestart', { body: { mode: o.mode, force: o.force, by: 'cli' } })
  } catch (err) {
    if (err instanceof GnomeolaApiError && err.code === 'conflict') throw refused(err.message)
    return mapApiError(err)
  }
  const say = (line: string) => {
    if (ctx.format !== 'json') ctx.io.stderr(`${line}\n`)
  }
  if (r.state === 'waiting')
    say(
      `waiting for ${r.waitingOn.map(brief).join(', ')} to finish before restarting` +
        `${o.wait ? '' : ' (the daemon restarts by itself when it ends)'}; gnomeola daemon restart --cancel calls it off`,
    )
  else say(`restarting (pid ${before.pid})`)
  if (!r.supervised)
    say(
      'note: this daemon is not supervised (systemd or the window): nothing will start it again after it exits',
    )
  if (!o.wait) {
    if (ctx.format === 'json') ctx.io.stdout(renderJson(r, ctx.io))
    return
  }
  // wait for a different daemon (a new pid) to answer on the same URL
  const t0 = Date.now()
  let goneSince: number | null = null
  for (;;) {
    if (o.timeoutMs !== null && Date.now() - t0 > o.timeoutMs)
      throw new CliError(
        EXIT.ERROR,
        `gave up waiting after ${Math.round(o.timeoutMs / 1000)} s`,
        'the restart request stays pending',
      )
    await sleep(500)
    let now: DaemonInfo | null = null
    try {
      now = await ctx.client.call('daemonInfo')
      goneSince = null
    } catch (err) {
      if (!(err instanceof DaemonUnreachableError)) throw err
      goneSince ??= Date.now()
      if (!r.supervised && Date.now() - goneSince > 5_000)
        throw new CliError(
          EXIT.UNREACHABLE,
          'the daemon exited for the restart, and nothing started it again (it is not supervised)',
          'start it again: systemctl --user start gnomeolad, or open the window',
        )
      if (Date.now() - goneSince > 60_000)
        throw new CliError(
          EXIT.UNREACHABLE,
          'the daemon exited for the restart but did not come back within 60 s',
        )
      continue
    }
    if (now.pid !== before.pid) {
      if (ctx.format === 'json')
        ctx.io.stdout(
          renderJson({ restarted: true, from: before.pid, to: now.pid, resumed: now.resumed }, ctx.io),
        )
      else {
        ctx.io.stdout(`restarted: pid ${before.pid} → ${now.pid}\n`)
        for (const x of now.resumed)
          ctx.io.stdout(`resumed ${x.id} after a ${Math.round(x.gapMs / 1000)} s gap\n`)
      }
      return
    }
    if (!now.restart) throw new CliError(EXIT.ERROR, 'the restart was cancelled')
  }
}

export async function daemonRestartCancel(ctx: Ctx) {
  const r = await ctx.client.call('cancelRestart').catch(mapApiError)
  if (ctx.format === 'json') return ctx.io.stdout(renderJson(r, ctx.io))
  ctx.io.stdout(r.cancelled ? 'restart cancelled\n' : 'no restart was waiting\n')
}
