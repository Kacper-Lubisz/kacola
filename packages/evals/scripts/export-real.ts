// Export one recorded meeting's transcript as a private eval fixture (read-only against the daemon):
//
//   node packages/evals/scripts/export-real.ts <sessionId> <outDir>
//   e.g. node packages/evals/scripts/export-real.ts ses_… packages/testkit/fixtures/evals/private/my-meeting
//
// Only GET routes are called (GET /sessions/:id/transcript), so nothing in the daemon changes. The daemon
// is GNOMEOLA_URL (default http://127.0.0.1:8787); a remote host needs GNOMEOLA_TOKEN. Writes
// <outDir>/transcript.json (segments in time order: id, speaker, track, startMs, endMs, text).
//
// The output is a real conversation: keep it in a gitignored directory (fixtures/evals/private/ is one)
// and never commit it. Labels are written next to it by hand (see docs/decisions.md).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { RealTranscript } from '../src/real.ts'

const [sessionId, outDir] = process.argv.slice(2)
if (!sessionId || !outDir) {
  console.error('usage: node packages/evals/scripts/export-real.ts <sessionId> <outDir>')
  process.exit(2)
}
const base = (process.env.GNOMEOLA_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
const headers: Record<string, string> = { accept: 'application/json' }
if (process.env.GNOMEOLA_TOKEN) headers.authorization = `Bearer ${process.env.GNOMEOLA_TOKEN}`

const res = await fetch(`${base}/sessions/${encodeURIComponent(sessionId)}/transcript?quality=best`, {
  method: 'GET',
  headers,
})
if (!res.ok) {
  console.error(`GET transcript failed: ${res.status} ${await res.text()}`)
  process.exit(1)
}
const body = (await res.json()) as {
  session: { id: string; title: string; startedAt: string | null; durationMs: number | null }
  segments: { id: string; speaker: string; track: string; startMs: number; endMs: number; text: string }[]
}
const segments = body.segments
  .filter((s) => s.text.trim())
  .map((s) => ({
    id: s.id,
    speaker: s.speaker,
    track: s.track,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text.trim(),
  }))
  .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
const out: RealTranscript = {
  sessionId: body.session.id,
  startedAt: body.session.startedAt,
  durationMs: body.session.durationMs ?? segments.at(-1)?.endMs ?? 0,
  exportedAt: new Date().toISOString(),
  segments,
}
const dir = resolve(outDir)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'transcript.json'), `${JSON.stringify(out, null, 2)}\n`)
// counts only: the text stays on disk
console.log(
  `wrote ${join(dir, 'transcript.json')}: ${segments.length} segments, ${Math.round(out.durationMs / 60_000)} min`,
)
