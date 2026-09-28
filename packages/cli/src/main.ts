#!/usr/bin/env node
import { type ParseArgsConfig, parseArgs } from 'node:util'
import { DaemonUnreachableError, PROTOCOL_VERSION } from '@gnomeola/protocol'
import { ask } from './commands/ask.ts'
import { bugReport } from './commands/bugreport.ts'
import { recordStart, recordStatus, recordStop, recordUsage } from './commands/record.ts'
import { search } from './commands/search.ts'
import { sessionsList, sessionsShow } from './commands/sessions.ts'
import { skillInstall } from './commands/skill.ts'
import { status } from './commands/status.ts'
import { transcript } from './commands/transcript.ts'
import { type Ctx, makeClient } from './context.ts'
import { CliError, EXIT, usage } from './errors.ts'
import { type Io, resolveFormat } from './output.ts'

export const VERSION = '0.1.0'

export const HELP = `gnomeola — read and search your recorded meetings

usage: gnomeola <command> [options]

  sessions list [--since 7d] [--limit N]      recent meetings
  sessions show <id>                          one meeting: status, segments, gaps
  search "<query>" [--since D] [--speaker S] [--session ID] [--limit N]
                                              ranked snippets + ids (start here)
  ask "<question>" [--session ID | --since D] [--effort low|medium|high]
                                              answered by the daemon, with citations
  transcript <id> (--around <mm:ss|segment-id> [--context 90s] | --from T [--to T])
                  [--speaker S] [--track mic|system] [--max-tokens N] [--full]
                                              a window of a transcript
  record start [--title T] | stop [id] | status
  status                                      daemon, models and LLM health
  skill install [--dir DIR] [--force]         install the Claude Code skill
  bug-report [--out FILE]                     write a diagnostics bundle
  mcp                                         serve the same tools over MCP (stdio)

ids: a full id, an unambiguous prefix, or latest / current.
global: --url URL (or GNOMEOLA_URL), --json, --text, -h/--help, --version
output: compact JSON when stdout is not a terminal, text otherwise.

exit codes: 0 ok · 1 error · 2 usage · 3 daemon unreachable · 4 not found
            5 refused (e.g. a whole transcript without --full) · 6 capability unavailable
`

const GLOBAL = {
  url: { type: 'string' },
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
    const ctxFor = (v: { url?: string; json?: boolean; text?: boolean }): Ctx => ({
      io,
      client: makeClient(v.url, io),
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
        await serveMcp(makeClient(v.url, io), io.env, VERSION)
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
  if (err instanceof CliError) {
    io.stderr(`gnomeola: ${err.message}\n`)
    if (err.hint) io.stderr(`  ${err.hint}\n`)
    return err.exitCode
  }
  if (err instanceof DaemonUnreachableError) {
    io.stderr(`gnomeola: the daemon is not running at ${err.baseUrl}\n`)
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
  }
  run(process.argv.slice(2), io).then((code) => {
    process.exitCode = code
  })
}
