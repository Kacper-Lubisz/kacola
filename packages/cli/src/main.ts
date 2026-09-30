#!/usr/bin/env node
import { type ParseArgsConfig, parseArgs } from 'node:util'
import { DaemonUnreachableError, GnomeolaApiError, PROTOCOL_VERSION } from '@gnomeola/protocol'
import {
  agendaAdd,
  agendaCreate,
  agendaEdit,
  agendaExport,
  agendaImport,
  agendaLink,
  agendaList,
  agendaRemove,
  agendaShare,
  agendaShow,
  agendaStatus,
  contextAdd,
  suggest,
} from './commands/agenda.ts'
import { ask } from './commands/ask.ts'
import { bugReport } from './commands/bugreport.ts'
import { installCliCommand, uninstallCliCommand } from './commands/install-cli.ts'
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
import { type Io, resolveFormat } from './output.ts'

export const VERSION = '0.1.0'

export const HELP = `gnomeola — read and search your recorded meetings, and plan the next ones

usage: gnomeola <command> [options]

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
                [--evidence "…"] [--note "…"] [--outcome "…"]
  agenda export <agenda> | import <agenda> (--from FILE | --stdin) [--merge]
                                              the markdown form: - [ ] item (10m, @ana) [kind]
  agenda link <agenda> --meeting <ref> [--start ISO]
  agenda share <agenda> [--write | --remove]  the invitation block (kacola:// link); --write puts it
                                              in the calendar event where the calendar allows
  context add [--agenda A] --title T (--file F | --stdin | --body TEXT) [--shared] [--pinned]
                                              a card for the meeting; private unless --shared
  suggest [--agenda A] "…" --kind next-point|question|missed|fact-check|looks-covered
          [--item <item>] [--as NAME]
  skill install [--dir DIR] [--force]         install the Claude Code skill
  install-cli [--mode auto|flatpak|macos|dev] [--bin-dir DIR] [--launch CMD] [--no-skill] [--force]
                                              put this gnomeola on PATH (+ the Claude skill)
  uninstall-cli [--mode M] [--bin-dir DIR] [--keep-skill]
                                              remove what install-cli wrote
  bug-report [--out FILE]                     write a diagnostics bundle
  mcp                                         serve the same tools over MCP (stdio)
  pair [--name N] | pair approve <CODE> | pair token | pair revoke <DEVICE>
                                              pair with a remote gnomeola (device code → token)

ids: a full id, an unambiguous prefix, or latest / current.
global: --url URL (or GNOMEOLA_URL), --token T (or GNOMEOLA_TOKEN; else the one saved by
        \`gnomeola pair\` for that URL), --json, --text, -h/--help, --version
output: compact JSON when stdout is not a terminal, text otherwise.

exit codes: 0 ok · 1 error · 2 usage · 3 daemon unreachable · 4 not found
            5 refused (e.g. a whole transcript without --full) · 6 capability unavailable
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
    throw usage((err as Error).message.split('\n')[0]!, 'see gnomeola --help')
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
    io.stdout(`gnomeola ${VERSION} (protocol ${PROTOCOL_VERSION})\n`)
    return EXIT.OK
  }

  try {
    const ctxFor = (v: { url?: string; token?: string; json?: boolean; text?: boolean }): Ctx => ({
      io,
      client: makeClient(v.url, io, v.token),
      format: resolveFormat(v, io),
      now: new Date(),
    })
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
        if (p.length)
          throw usage(`unexpected argument: ${p[0]}`, 'usage: gnomeola meetings [--next | --today]')
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
          note: { type: 'string' },
          as: { type: 'string' },
          merge: { type: 'boolean' },
          write: { type: 'boolean' },
          remove: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        const ctx = ctxFor({ ...v, text: typeof v.text === 'boolean' ? v.text : undefined })
        const [sub, ...args] = p
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
              note: v.note,
              outcome: v.outcome,
              as: v.as,
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
          case 'share':
            await agendaShare(ctx, args[0], { write: v.write, remove: v.remove })
            break
          default:
            throw usage(
              sub ? `unknown subcommand: agenda ${sub}` : 'agenda what?',
              'agenda create|list|show|add|edit|remove|status|export|import|link|share — see gnomeola --help',
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
        })
        if (helpOr(v)) return EXIT.OK
        if (p[0] !== 'add')
          throw usage(
            'usage: gnomeola context add [--agenda A] --title T (--file F | --stdin | --body TEXT) [--shared]',
          )
        await contextAdd(ctxFor(v), {
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
        await suggest(ctxFor(v), p.join(' '), { agenda: v.agenda, kind: v.kind, item: v.item, as: v.as })
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
      case 'skill': {
        const { values: v, positionals: p } = parse(rest, {
          dir: { type: 'string' },
          force: { type: 'boolean' },
        })
        if (helpOr(v)) return EXIT.OK
        if (p[0] !== 'install') throw usage('usage: gnomeola skill install [--dir DIR] [--force]')
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
            'gnomeola pair [--name N] | pair approve <CODE> | pair token',
          )
        break
      }
      default:
        throw usage(`unknown command: ${cmd}`, 'see gnomeola --help')
    }
    return EXIT.OK
  } catch (err) {
    return report(err, io)
  }
}

function report(err: unknown, io: Io): number {
  if (err instanceof GnomeolaApiError && err.status === 401) {
    io.stderr(`gnomeola: ${err.message}\n`)
    io.stderr(
      '  this host needs a device token: run `gnomeola pair --url <URL>`, or pass --token / GNOMEOLA_TOKEN\n',
    )
    return EXIT.ERROR
  }
  if (err instanceof CliError) {
    io.stderr(`gnomeola: ${err.message}\n`)
    if (err.hint) io.stderr(`  ${err.hint}\n`)
    return err.exitCode
  }
  if (err instanceof DaemonUnreachableError) {
    io.stderr(`gnomeola: the daemon is not running at ${err.baseUrl}\n`)
    // under the install-cli shim, the shim starts the app next and says so
    if (!io.env.GNOMEOLA_SHIM)
      io.stderr('  start it with `systemctl --user start gnomeolad`, or pass --url / set GNOMEOLA_URL\n')
    return EXIT.UNREACHABLE
  }
  io.stderr(`gnomeola: ${(err as Error)?.stack ?? String(err)}\n`)
  return EXIT.ERROR
}

if (import.meta.main) {
  process.stdout.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0)
    throw e
  })
  const io: Io = {
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
