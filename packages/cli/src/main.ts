#!/usr/bin/env node
// first: GNOMEOLA_* from before the rename are read as KACOLA_* (one release; @kacola/protocol legacy.ts)
import '@kacola/protocol/legacy-env'
import { type ParseArgsConfig, parseArgs } from 'node:util'
import { DaemonUnreachableError, KacolaApiError, PROTOCOL_VERSION, parseDuration } from '@kacola/protocol'
import {
  agendaAdd,
  agendaCreate,
  agendaEdit,
  agendaExport,
  agendaImport,
  agendaInvite,
  agendaLink,
  agendaList,
  agendaRemove,
  agendaShow,
  agendaStatus,
  contextAdd,
  suggest,
} from './commands/agenda.ts'
import {
  agendaFollow,
  agendaFollowConfirm,
  agendaSend,
  agendaShareHistory,
  agendaShareOn,
  agendaShareRecap,
  agendaShareStatus,
  agendaUnshare,
} from './commands/agenda-share.ts'
import { ask } from './commands/ask.ts'
import { bugReport } from './commands/bugreport.ts'
import { daemonIdle, daemonRestart, daemonRestartCancel, daemonStatus } from './commands/daemon.ts'
import { installCliCommand, uninstallCliCommand } from './commands/install-cli.ts'
import { liveAttach, liveWait } from './commands/live.ts'
import { meetingsNext, meetingsToday } from './commands/meetings.ts'
import { notes } from './commands/notes.ts'
import { pair, pairApprove, pairRevoke, pairToken } from './commands/pair.ts'
import { recordStart, recordStatus, recordStop, recordUsage } from './commands/record.ts'
import { search } from './commands/search.ts'
import { sessionsList, sessionsShow } from './commands/sessions.ts'
import { skillInstall } from './commands/skill.ts'
import { speakers } from './commands/speakers.ts'
import { status } from './commands/status.ts'
import { transcript } from './commands/transcript.ts'
import { type Ctx, makeClient } from './context.ts'
import { CliError, EXIT, usage } from './errors.ts'
import { activeLease, leaseClient } from './lease.ts'
import { type Io, resolveFormat } from './output.ts'

export const VERSION = '0.1.0'

export const HELP = `kacola — kacola's command-line tool: read and search your recorded meetings, and plan the next ones

usage: kacola <command> [options]

  sessions list [--since 7d] [--limit N]      recent meetings
  sessions show <id>                          one meeting: status, segments, gaps
  speakers <id>                               who spoke and how much (the names --speaker matches)
  search "<query>" [--since D] [--speaker S] [--session ID] [--limit N]
                                              ranked snippets + ids (start here)
  ask "<question>" [--session ID | --since D] [--effort low|medium|high]
                                              answered by the daemon, with citations
  transcript <id> (--around <mm:ss|segment-id> [--context 90s] | --from T [--to T])
                  [--speaker S] [--track mic|system] [--max-tokens N] [--full]
                                              a window of a transcript
  notes <id> [--actions | --versions | --version N] [--full]
                                              the meeting's notes (yours, enhanced); action items
  record start [--title T] | stop [id] | status
  meetings [--next | --today]                 your calendar: what is on now / next, or today
  status                                      daemon, models and LLM health
  daemon status | idle                        what the daemon is recording right now (idle: exit 0
                                              when nothing is, 5 when something is)
  daemon restart [--when-idle | --now [--force]] [--no-wait] [--timeout D] | --cancel
                                              restart once nothing is recording (default; prints what
                                              it waits for); --now --force suspends a recording, which
                                              the next daemon resumes after a short gap

 agendas (the owner's write verbs; <agenda>: agd_… | next | latest, default next;
          <item>: its position, id or text):
  agenda create --meeting next|today|<meeting id|event uid> [--start ISO] [--title T]
                [--from FILE.md | --stdin] [--private] [--no-carry-over] [--reuse]
  agenda list [--meeting <ref>] [--since D] [--limit N]   every occurrence of that meeting's event
  agenda show [<agenda>] [--history] [--full]
  agenda add <agenda> "<item>"… [--kind K] [--owner O] [--timebox 10m] [--before <item>]
                                              "<item>" may be "Text (10m, @ana) [must-cover]"
  agenda edit <agenda> <item> [--text T] [--kind K] [--owner O | --no-owner] [--timebox D] [--outcome T]
  agenda remove <agenda> <item>
  agenda status <agenda> <item> open|in-progress|covered|skipped|parked
                [--evidence "…"] [--segment <segment id>] [--note "…"] [--outcome "…"]
  agenda export <agenda> | import <agenda> (--from FILE | --stdin) [--merge]
                                              the markdown form: - [ ] item (10m, @ana) [kind]
  agenda link <agenda> --meeting <ref> [--start ISO]
  agenda invite <agenda> [--write | --remove] the invitation block (the web link first once shared, then
                                              the kacola:// link); --write puts it in the calendar event
 team sharing (the user's decision: share, unshare, share-recap and follow only when they ask):
  agenda share <agenda> [--name N] [--members a@x,b@y] [--goals] [--no-invitees]
                                              share on your hosted server: a web link for invitees;
                                              listed attendees may follow it in their own kacola
  agenda send <agenda> [--no-write] [--name N] [--members a@x,b@y] [--goals] [--no-invitees]
                                              share it and put the web link in the invitation (or print it
                                              to paste); exit 6 when no sharing server is set up
  agenda unshare <agenda>                     the link stops working (a follower: stop following)
  agenda share-status <agenda>                link, sync state, comments, who joined
  agenda share-recap <agenda> [--off]         let people with the link see the outcomes
  agenda share-history <agenda>               every device's status changes and their outcome
  agenda follow <link> --email E [--name N]   follow someone's agenda: the host emails a code
  agenda follow-confirm <link> --email E --code C
                                              …then the code: a local copy that stays in step
  context add [--agenda A] --title T (--file F | --stdin | --body TEXT) [--shared] [--pinned]
                                              a card for the meeting; private unless --shared
  suggest [--agenda A] "…" --kind next-point|question|missed|fact-check|looks-covered
          [--item <item>] [--as NAME]           (a connected agent's verb: needs a live lease)

 live (a connected agent — e.g. Claude Code's Monitor tool running \`live attach\`):
  live attach [--session current|<id>] [--as NAME] [--mode observe|suggest|act] [--replay]
              [--no-partials] [--heartbeat 15s]
                                              one JSON line per event (segment.final, partial,
                                              agenda.updated, suggestion, context, agent.presence,
                                              lease.ended, meeting.ended) until the meeting ends
  live wait [--meeting next|<meeting id|event uid>] [--timeout 30m]
                                              block until a recording starts; print it
 While \`live attach\` runs, the agent verbs (agenda status|add|edit, suggest, context add) act under
 its lease (as agent:NAME, within its mode); <agenda> may be \`live\`. KACOLA_LEASE=<token> picks a
 lease explicitly, KACOLA_LEASE=none acts as the user.
  skill install [--dir DIR] [--force]         install the Claude Code skill
  install-cli [--mode auto|flatpak|macos|dev] [--bin-dir DIR] [--launch CMD] [--no-skill] [--force]
                                              put this command on PATH (+ the Claude skill)
  uninstall-cli [--mode M] [--bin-dir DIR] [--keep-skill]
                                              remove what install-cli wrote
  bug-report [--out FILE]                     write a diagnostics bundle
  mcp                                         serve the same tools over MCP (stdio)
  pair [--name N] | pair approve <CODE> | pair token | pair revoke <DEVICE>
                                              pair with a remote kacola server (device code → token)

ids: a full id, an unambiguous prefix, or latest / current.
global: --url URL (or KACOLA_URL), --token T (or KACOLA_TOKEN; else the one saved by
        \`kacola pair\` for that URL), --json, --text, -h/--help, --version
output: compact JSON when stdout is not a terminal, text otherwise.

exit codes: 0 ok · 1 error · 2 usage · 3 daemon unreachable · 4 not found
            5 refused (e.g. a whole transcript without --full; a lease's mode or rate limit)
            6 capability unavailable · 7 no live lease, or it ended (attach again)
`

const GLOBAL = {
  url: { type: 'string' },
  token: { type: 'string' },
  json: { type: 'boolean' },
  text: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies ParseArgsConfig['options']

function parse<O extends NonNullable<ParseArgsConfig['options']>>(args: string[], options: O) {
  try {
    return parseArgs({ args, options: { ...GLOBAL, ...options }, allowPositionals: true, strict: true })
  } catch (err) {
    throw usage((err as Error).message.split('\n')[0]!, 'see kacola --help')
  }
}

const int = (v: string | undefined, name: string): number | undefined => {
  if (v === undefined) return undefined
  if (!/^\d+$/.test(v) || Number(v) < 1) throw usage(`${name} must be a positive integer`)
  return Number(v)
}

export async function run(argv: string[], io: Io): Promise<number> {
  const [cmd, ...rest] = argv
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    io.stdout(HELP)
    return cmd ? EXIT.OK : EXIT.USAGE
  }
  if (cmd === '--version' || cmd === 'version') {
    io.stdout(`kacola ${VERSION} (protocol ${PROTOCOL_VERSION})\n`)
    return EXIT.OK
  }

  try {
    const ctxFor = (v: { url?: string; token?: string; json?: boolean; text?: boolean }): Ctx => ({
      io,
      client: makeClient(v.url, io, v.token),
      format: resolveFormat(v, io),
      now: new Date(),
    })
    /** The agent verbs act under the live lease when there is one (see lease.ts). */
    const agentCtx = (ctx: Ctx, as: string | undefined): Ctx => {
      const lease = activeLease(io.env, as)
      return lease ? { ...ctx, lease, client: leaseClient(ctx, lease) } : ctx
    }
    const helpOr = (v: { help?: boolean }) => {
      if (v.help) io.stdout(HELP)
      return Boolean(v.help)
    }

    switch (cmd) {
      case 'sessions': {
        const { values: v, positionals: p } = parse(rest, {
          since: { type: 'string' },
          limit: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        const sub = p[0] ?? 'list'
        if (sub === 'list') await sessionsList(ctxFor(v), { since: v.since, limit: int(v.limit, '--limit') })
        else if (sub === 'show') await sessionsShow(ctxFor(v), p[1])
        else throw usage(`unknown subcommand: sessions ${sub}`)
        break
      }
      case 'search': {
        const { values: v, positionals: p } = parse(rest, {
          since: { type: 'string' },
          speaker: { type: 'string' },
          session: { type: 'string' },
          limit: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        await search(ctxFor(v), p.join(' '), {
          since: v.since,
          speaker: v.speaker,
          session: v.session,
          limit: int(v.limit, '--limit'),
        })
        break
      }
      case 'ask': {
        const { values: v, positionals: p } = parse(rest, {
          session: { type: 'string' },
          since: { type: 'string' },
          effort: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        await ask(ctxFor(v), p.join(' '), { session: v.session, since: v.since, effort: v.effort })
        break
      }
      case 'transcript': {
        const { values: v, positionals: p } = parse(rest, {
          from: { type: 'string' },
          to: { type: 'string' },
          around: { type: 'string' },
          context: { type: 'string' },
          speaker: { type: 'string' },
          track: { type: 'string' },
          full: { type: 'boolean' },
          'max-tokens': { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        await transcript(ctxFor(v), p[0], {
          from: v.from,
          to: v.to,
          around: v.around,
          context: v.context,
          speaker: v.speaker,
          track: v.track,
          full: v.full,
          maxTokens: int(v['max-tokens'], '--max-tokens'),
        })
        break
      }
      case 'notes': {
        const { values: v, positionals: p } = parse(rest, {
          actions: { type: 'boolean' },
          versions: { type: 'boolean' },
          version: { type: 'string' },
          full: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        await notes(ctxFor(v), p[0], {
          actions: v.actions,
          versions: v.versions,
          version: int(v.version, '--version'),
          full: v.full,
        })
        break
      }
      case 'record': {
        const { values: v, positionals: p } = parse(rest, { title: { type: 'string' } })
        if (helpOr(v)) return EXIT.OK
        const ctx = ctxFor(v)
        if (p[0] === 'start') await recordStart(ctx, { title: v.title })
        else if (p[0] === 'stop') await recordStop(ctx, p[1])
        else if (p[0] === 'status' || p[0] === undefined) await recordStatus(ctx)
        else recordUsage()
        break
      }
      case 'meetings': {
        const { values: v, positionals: p } = parse(rest, {
          next: { type: 'boolean' },
          today: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        if (p.length) throw usage(`unexpected argument: ${p[0]}`, 'usage: kacola meetings [--next | --today]')
        if (v.next && v.today) throw usage('pass one of --next or --today')
        if (v.today) await meetingsToday(ctxFor(v))
        else await meetingsNext(ctxFor(v))
        break
      }
      case 'agenda': {
        // `agenda edit --text T` sets an item's text; everywhere else --text is the output format
        const itemText = rest[0] === 'edit' ? { text: { type: 'string' } } : {}
        const { values: v, positionals: p } = parse(rest, {
          ...(itemText as { text?: { type: 'string' } }),
          meeting: { type: 'string' },
          start: { type: 'string' },
          title: { type: 'string' },
          from: { type: 'string' },
          stdin: { type: 'boolean' },
          private: { type: 'boolean' },
          'no-carry-over': { type: 'boolean' },
          reuse: { type: 'boolean' },
          since: { type: 'string' },
          limit: { type: 'string' },
          history: { type: 'boolean' },
          full: { type: 'boolean' },
          kind: { type: 'string' },
          owner: { type: 'string' },
          'no-owner': { type: 'boolean' },
          timebox: { type: 'string' },
          before: { type: 'string' },
          outcome: { type: 'string' },
          evidence: { type: 'string' },
          segment: { type: 'string' },
          note: { type: 'string' },
          as: { type: 'string' },
          merge: { type: 'boolean' },
          write: { type: 'boolean' },
          remove: { type: 'boolean' },
          'no-write': { type: 'boolean' },
          // team sharing
          name: { type: 'string' },
          members: { type: 'string' },
          goals: { type: 'boolean' },
          'no-invitees': { type: 'boolean' },
          email: { type: 'string' },
          code: { type: 'string' },
          off: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        const [sub, ...args] = p
        const base = ctxFor({ ...v, text: typeof v.text === 'boolean' ? v.text : undefined })
        const agentVerb = ['status', 'add', 'edit', 'show', 'export'].includes(sub ?? '')
        const ctx = agentVerb ? agentCtx(base, v.as) : base
        switch (sub) {
          case 'create':
            await agendaCreate(ctx, {
              meeting: v.meeting,
              start: v.start,
              title: v.title,
              from: v.from,
              stdin: v.stdin,
              private: v.private,
              noCarryOver: v['no-carry-over'],
              reuse: v.reuse,
            })
            break
          case 'list':
            await agendaList(ctx, { meeting: v.meeting, since: v.since, limit: int(v.limit, '--limit') })
            break
          case 'show':
            await agendaShow(ctx, args[0], { history: v.history, full: v.full })
            break
          case 'add':
            await agendaAdd(ctx, args[0], args.slice(1), {
              kind: v.kind,
              owner: v.owner,
              timebox: v.timebox,
              before: v.before,
            })
            break
          case 'edit':
            await agendaEdit(ctx, args[0], args[1], {
              text: typeof v.text === 'string' ? v.text : undefined,
              kind: v.kind,
              owner: v.owner,
              noOwner: v['no-owner'],
              timebox: v.timebox,
              outcome: v.outcome,
            })
            break
          case 'remove':
            await agendaRemove(ctx, args[0], args[1])
            break
          case 'status':
            await agendaStatus(ctx, args[0], args[1], args[2], {
              evidence: v.evidence,
              segment: v.segment,
              note: v.note,
              outcome: v.outcome,
            })
            break
          case 'export':
            await agendaExport(ctx, args[0])
            break
          case 'import':
            await agendaImport(ctx, args[0], { from: v.from, stdin: v.stdin, merge: v.merge })
            break
          case 'link':
            await agendaLink(ctx, args[0], { meeting: v.meeting, start: v.start })
            break
          case 'invite':
            await agendaInvite(ctx, args[0], { write: v.write, remove: v.remove })
            break
          case 'share':
            if (v.write || v.remove)
              throw usage(
                'the invitation block moved to `agenda invite`',
                'kacola agenda invite <agenda> --write   (`agenda share` now shares the agenda on your server)',
              )
            await agendaShareOn(ctx, args[0], {
              name: v.name,
              members: v.members,
              goals: v.goals,
              noInvitees: v['no-invitees'],
            })
            break
          case 'send':
            await agendaSend(ctx, args[0], {
              name: v.name,
              members: v.members,
              goals: v.goals,
              noInvitees: v['no-invitees'],
              noWrite: v['no-write'],
            })
            break
          case 'unshare':
            await agendaUnshare(ctx, args[0])
            break
          case 'share-status':
            await agendaShareStatus(ctx, args[0])
            break
          case 'share-recap':
            await agendaShareRecap(ctx, args[0], { off: v.off })
            break
          case 'share-history':
            await agendaShareHistory(ctx, args[0])
            break
          case 'follow':
            await agendaFollow(ctx, args[0], { email: v.email, name: v.name })
            break
          case 'follow-confirm':
            await agendaFollowConfirm(ctx, args[0], { email: v.email, code: v.code })
            break
          default:
            throw usage(
              sub ? `unknown subcommand: agenda ${sub}` : 'agenda what?',
              'agenda create|list|show|add|edit|remove|status|export|import|link|invite|send|share|unshare|share-status|share-recap|share-history|follow|follow-confirm — see kacola --help',
            )
        }
        break
      }
      case 'context': {
        const { values: v, positionals: p } = parse(rest, {
          agenda: { type: 'string' },
          title: { type: 'string' },
          file: { type: 'string' },
          stdin: { type: 'boolean' },
          body: { type: 'string' },
          shared: { type: 'boolean' },
          pinned: { type: 'boolean' },
          as: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        if (p[0] !== 'add')
          throw usage(
            'usage: kacola context add [--agenda A] --title T (--file F | --stdin | --body TEXT) [--shared]',
          )
        await contextAdd(agentCtx(ctxFor(v), v.as), {
          agenda: v.agenda,
          title: v.title,
          file: v.file,
          stdin: v.stdin,
          body: v.body,
          shared: v.shared,
          pinned: v.pinned,
        })
        break
      }
      case 'suggest': {
        const { values: v, positionals: p } = parse(rest, {
          agenda: { type: 'string' },
          kind: { type: 'string' },
          item: { type: 'string' },
          as: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        await suggest(agentCtx(ctxFor(v), v.as), p.join(' '), {
          agenda: v.agenda,
          kind: v.kind,
          item: v.item,
        })
        break
      }
      case 'live': {
        const { values: v, positionals: p } = parse(rest, {
          session: { type: 'string' },
          as: { type: 'string' },
          mode: { type: 'string' },
          replay: { type: 'boolean' },
          'no-partials': { type: 'boolean' },
          heartbeat: { type: 'string' },
          meeting: { type: 'string' },
          timeout: { type: 'string' },
        })
        if (helpOr(v)) return EXIT.OK
        const secs = (x: string | undefined, name: string) => {
          if (x === undefined) return undefined
          try {
            return Math.max(1, Math.round(parseDuration(/^\d+$/.test(x) ? `${x}s` : x) / 1000))
          } catch {
            throw usage(`${name} must be a duration like 15s or 30m`)
          }
        }
        const ctx = ctxFor({ ...v, json: true })
        if (p[0] === 'attach')
          await liveAttach(ctx, {
            session: v.session,
            as: v.as,
            mode: v.mode,
            replay: v.replay,
            noPartials: v['no-partials'],
            heartbeatSec: secs(v.heartbeat, '--heartbeat'),
          })
        else if (p[0] === 'wait')
          await liveWait(ctx, { meeting: v.meeting, timeoutSec: secs(v.timeout, '--timeout') })
        else
          throw usage(
            p[0] ? `unknown subcommand: live ${p[0]}` : 'live what?',
            'kacola live attach [--session current|<id>] [--as NAME] [--mode …] | live wait [--meeting …]',
          )
        break
      }
      case 'speakers': {
        const { values: v, positionals: p } = parse(rest, {})
        if (helpOr(v)) return EXIT.OK
        await speakers(ctxFor(v), p[0])
        break
      }
      case 'status': {
        const { values: v } = parse(rest, {})
        if (helpOr(v)) return EXIT.OK
        await status(ctxFor(v))
        break
      }
      case 'daemon': {
        const { values: v, positionals: p } = parse(rest, {
          'when-idle': { type: 'boolean' },
          now: { type: 'boolean' },
          force: { type: 'boolean' },
          'no-wait': { type: 'boolean' },
          timeout: { type: 'string' },
          cancel: { type: 'boolean' },
          'only-supervised': { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        const sub = p[0] ?? 'status'
        if (sub === 'status') await daemonStatus(ctxFor(v))
        else if (sub === 'idle') await daemonIdle(ctxFor(v))
        else if (sub === 'restart') {
          if (v.cancel) await daemonRestartCancel(ctxFor(v))
          else {
            if (v.now && v['when-idle']) throw usage('--now and --when-idle are exclusive')
            if (v.force && !v.now)
              throw usage('--force goes with --now (a --when-idle restart never interrupts)')
            await daemonRestart(ctxFor(v), {
              mode: v.now ? 'now' : 'when-idle',
              force: Boolean(v.force),
              wait: !v['no-wait'],
              onlySupervised: Boolean(v['only-supervised']),
              timeoutMs: v.timeout
                ? (() => {
                    try {
                      return parseDuration(/^\d+$/.test(v.timeout) ? `${v.timeout}s` : v.timeout)
                    } catch {
                      throw usage('--timeout must be a duration like 90s or 2h')
                    }
                  })()
                : null,
            })
          }
        } else
          throw usage(
            'usage: kacola daemon status | idle | restart [--when-idle | --now [--force]] [--no-wait] [--timeout D] | restart --cancel',
          )
        break
      }
      case 'skill': {
        const { values: v, positionals: p } = parse(rest, {
          dir: { type: 'string' },
          force: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        if (p[0] !== 'install') throw usage('usage: kacola skill install [--dir DIR] [--force]')
        skillInstall(ctxFor(v), { dir: v.dir, force: v.force })
        break
      }
      case 'install-cli':
      case 'uninstall-cli': {
        const { values: v } = parse(rest, {
          mode: { type: 'string' },
          'bin-dir': { type: 'string' },
          app: { type: 'string' },
          launch: { type: 'string' },
          'no-skill': { type: 'boolean' },
          'keep-skill': { type: 'boolean' },
          'skill-dir': { type: 'string' },
          force: { type: 'boolean' },
          'dry-run': { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        const flags = {
          mode: v.mode,
          binDir: v['bin-dir'],
          app: v.app,
          launch: v.launch,
          noSkill: v['no-skill'],
          skillDir: v['skill-dir'],
          force: v.force,
          dryRun: v['dry-run'],
        }
        if (cmd === 'install-cli') installCliCommand(ctxFor(v), flags)
        else uninstallCliCommand(ctxFor(v), { ...flags, keepSkill: v['keep-skill'] })
        break
      }
      case 'bug-report': {
        const { values: v } = parse(rest, { out: { type: 'string' } })
        if (helpOr(v)) return EXIT.OK
        await bugReport(ctxFor(v), { out: v.out })
        break
      }
      case 'mcp': {
        const { values: v } = parse(rest, {})
        if (helpOr(v)) return EXIT.OK
        const { serveMcp } = await import('./commands/mcp.ts')
        await serveMcp(makeClient(v.url, io, v.token), io.env, VERSION)
        break
      }
      case 'pair': {
        const { values: v, positionals: p } = parse(rest, { name: { type: 'string' } })
        if (helpOr(v)) return EXIT.OK
        const ctx = ctxFor(v)
        if (p[0] === 'approve') await pairApprove(ctx, p[1])
        else if (p[0] === 'token') pairToken(ctx)
        else if (p[0] === 'revoke') await pairRevoke(ctx, p[1])
        else if (p[0] === undefined) await pair(ctx, { name: v.name })
        else
          throw usage(
            `unknown subcommand: pair ${p[0]}`,
            'kacola pair [--name N] | pair approve <CODE> | pair token',
          )
        break
      }
      default:
        throw usage(`unknown command: ${cmd}`, 'see kacola --help')
    }
    return EXIT.OK
  } catch (err) {
    return report(err, io)
  }
}

function report(err: unknown, io: Io): number {
  if (err instanceof KacolaApiError && err.status === 401 && /lease/i.test(err.message)) {
    io.stderr(`kacola: ${err.message}\n  attach again: kacola live attach\n`)
    return EXIT.LEASE
  }
  if (err instanceof KacolaApiError && err.status === 401) {
    io.stderr(`kacola: ${err.message}\n`)
    io.stderr(
      '  this host needs a device token: run `kacola pair --url <URL>`, or pass --token / KACOLA_TOKEN\n',
    )
    return EXIT.ERROR
  }
  if (err instanceof CliError) {
    io.stderr(`kacola: ${err.message}\n`)
    if (err.hint) io.stderr(`  ${err.hint}\n`)
    return err.exitCode
  }
  if (err instanceof DaemonUnreachableError) {
    io.stderr(`kacola: the kacola daemon is not running at ${err.baseUrl}\n`)
    // under the install-cli shim, the shim starts the app next and says so
    if (!io.env.KACOLA_SHIM)
      io.stderr('  start it with `systemctl --user start kacolad`, or pass --url / set KACOLA_URL\n')
    return EXIT.UNREACHABLE
  }
  io.stderr(`kacola: ${(err as Error)?.stack ?? String(err)}\n`)
  return EXIT.ERROR
}

if (import.meta.main) {
  process.stdout.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0)
    throw e
  })
  const stop = new AbortController()
  // long-running commands (live attach / wait) wind down on a signal: release the lease, remove its file
  if (process.argv[2] === 'live')
    for (const sig of ['SIGINT', 'SIGTERM'] as const)
      process.once(sig, () => {
        stop.abort()
        // a command that does not wind down still ends the process
        setTimeout(() => process.exit(130), 3_000).unref()
      })
  const io: Io = {
    signal: stop.signal,
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    isTTY: Boolean(process.stdout.isTTY),
    env: process.env,
    stdin: async () => {
      let text = ''
      for await (const chunk of process.stdin) text += chunk
      return text
    },
  }
  run(process.argv.slice(2), io).then((code) => {
    process.exitCode = code
  })
}
