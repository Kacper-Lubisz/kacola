#!/usr/bin/env node
// gnomeola-agent — the local half, as a command.
//
//   gnomeola-agent sync   --remote URL [--local URL] [--once]
//       hybrid sync: push this machine's transcripts and notes to a hosted server
//   gnomeola-agent record --remote URL [--title T] [--spool DIR]
//       full offload: record here, upload the audio, let the server transcribe (Ctrl-C to stop)
//   gnomeola-agent resume --remote URL --session ID --duration-ms N [--spool DIR]
//       finish an interrupted upload from the local WAVs
//
// The remote token comes from --token or GNOMEOLA_TOKEN (see `gnomeola pair`).
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createClient, DEFAULT_BASE_URL } from '@gnomeola/protocol'
import { CaptureAgent } from './agent.ts'
import { SyncAgent } from './sync.ts'
import { resumeUpload } from './upload.ts'

const USAGE = `usage: gnomeola-agent sync --remote URL [--local URL] [--once]
       gnomeola-agent record --remote URL [--title T] [--spool DIR]
       gnomeola-agent resume --remote URL --session ID --duration-ms N [--spool DIR]
   (token: --token or GNOMEOLA_TOKEN)
`

const log = (level: string, msg: string, fields?: Record<string, unknown>) =>
  process.stderr.write(`${JSON.stringify({ level, msg, ...fields })}\n`)

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv
  const { values: v } = parseArgs({
    args: rest,
    options: {
      remote: { type: 'string' },
      local: { type: 'string' },
      token: { type: 'string' },
      once: { type: 'boolean' },
      title: { type: 'string' },
      spool: { type: 'string' },
      session: { type: 'string' },
      'duration-ms': { type: 'string' },
    },
  })
  const env = process.env
  if (!v.remote) {
    process.stderr.write(USAGE)
    return 2
  }
  const token = v.token ?? env.GNOMEOLA_TOKEN
  const remote = createClient({ baseUrl: v.remote, timeoutMs: 60_000, ...(token ? { token } : {}) })
  const spool =
    v.spool ?? join(env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'gnomeola', 'agent-spool')
  const ac = new AbortController()
  process.on('SIGINT', () => ac.abort())
  process.on('SIGTERM', () => ac.abort())

  if (cmd === 'sync') {
    const local = createClient({ baseUrl: v.local ?? env.GNOMEOLA_URL ?? DEFAULT_BASE_URL })
    const agent = new SyncAgent({ local, remote, log })
    if (v.once) {
      const s = await agent.syncOnce(ac.signal)
      process.stdout.write(`${JSON.stringify(s)}\n`)
    } else await agent.run(ac.signal)
    return 0
  }
  if (cmd === 'record') {
    const rec = await new CaptureAgent({ remote, spoolDir: spool, log }).record({ title: v.title })
    process.stdout.write(`${JSON.stringify({ event: 'recording', sessionId: rec.session.id })}\n`)
    await new Promise<void>((r) => ac.signal.addEventListener('abort', () => r(), { once: true }))
    const s = await rec.stop()
    process.stdout.write(`${JSON.stringify({ event: 'finalized', session: s })}\n`)
    return 0
  }
  if (cmd === 'resume') {
    if (!v.session || !v['duration-ms']) {
      process.stderr.write(USAGE)
      return 2
    }
    const r = await resumeUpload({
      client: remote,
      sessionId: v.session,
      sessionDir: join(spool, v.session),
      durationMs: Number(v['duration-ms']),
      log,
    })
    process.stdout.write(
      `${JSON.stringify({ event: 'finalized', uploaded: r.uploaded, alreadyThere: r.alreadyThere })}\n`,
    )
    return 0
  }
  process.stderr.write(USAGE)
  return 2
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`gnomeola-agent: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  },
)
