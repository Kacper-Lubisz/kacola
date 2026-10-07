import { formatOffset, parseDuration, parseOffset, type Segment, type Transcript } from '@kacola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, refused, usage } from '../errors.ts'
import { localStamp, renderJson } from '../output.ts'
import { briefSession, mapApiError, resolveSessionId } from '../sessions.ts'
import { BUDGET, countTokens } from '../tokens.ts'

export type TranscriptOpts = {
  from?: string
  to?: string
  around?: string
  context?: string
  speaker?: string
  track?: string
  full?: boolean
  maxTokens?: number
}

type Window = { fromMs: number; toMs: number } | null

function toMs(label: string, v: string): number {
  try {
    return parseOffset(v)
  } catch {
    throw usage(`invalid ${label} time ${JSON.stringify(v)}`, 'use mm:ss, h:mm:ss, or a duration like 90s')
  }
}

export async function transcript(ctx: Ctx, idArg: string | undefined, o: TranscriptOpts) {
  const id = await resolveSessionId(ctx, idArg)
  if (o.track && o.track !== 'mic' && o.track !== 'system') throw usage('--track must be mic or system')
  if (o.around && (o.from || o.to)) throw usage('use either --around or --from/--to, not both')

  const hasWindow = Boolean(o.from || o.to || o.around)
  if (!hasWindow && !o.full) {
    const probe = await ctx.client
      .call('getTranscript', { params: { id }, query: { fromMs: 0, toMs: 0 } })
      .catch(mapApiError)
    throw refused(
      `refusing to print the whole transcript of "${probe.session.title}" (${probe.total} segments)`,
      'search first (`kacola search "<topic>"`), then fetch a window: --around <mm:ss|segment-id>, ' +
        'or --from/--to. Pass --full only if you truly need all of it.',
    )
  }

  const contextMs = o.context ? parseDuration(o.context) : 90_000
  let window: Window = null
  const filters = { speaker: o.speaker, track: o.track as 'mic' | 'system' | undefined }
  let result: Transcript

  if (o.around?.startsWith('seg_')) {
    // Locate the segment server-side data, then print only the window around it. The full transcript
    // crosses the loopback socket; only the window reaches the reader's context.
    const all = await ctx.client.call('getTranscript', { params: { id }, query: {} }).catch(mapApiError)
    const hit = all.segments.find((s) => s.id === o.around)
    if (!hit) throw new CliError(EXIT.NOT_FOUND, `segment ${o.around} is not in session ${id}`)
    window = { fromMs: Math.max(0, hit.startMs - contextMs), toMs: hit.endMs + contextMs }
    result = await fetchWindow(ctx, id, window, filters)
  } else if (o.around) {
    const center = toMs('--around', o.around)
    window = { fromMs: Math.max(0, center - contextMs), toMs: center + contextMs }
    result = await fetchWindow(ctx, id, window, filters)
  } else if (hasWindow) {
    const fromMs = o.from ? toMs('--from', o.from) : 0
    const toMsV = o.to ? toMs('--to', o.to) : undefined
    if (toMsV !== undefined && toMsV <= fromMs) throw usage('--to must be after --from')
    result = await ctx.client
      .call('getTranscript', { params: { id }, query: { fromMs, toMs: toMsV, ...filters } })
      .catch(mapApiError)
    window = { fromMs, toMs: toMsV ?? result.session.durationMs }
  } else {
    result = await ctx.client.call('getTranscript', { params: { id }, query: filters }).catch(mapApiError)
  }

  const rendered = render(ctx, result, window)
  const tokens = countTokens(rendered)
  const ceiling = o.maxTokens ?? BUDGET.transcriptWindow
  if (!o.full && tokens > ceiling) {
    throw refused(
      `that window is ~${tokens} tokens, over the ${ceiling}-token ceiling (${result.segments.length} segments)`,
      'narrow it (a smaller --context, --from/--to, or --speaker), or raise --max-tokens deliberately',
    )
  }
  ctx.io.stdout(rendered)
}

async function fetchWindow(
  ctx: Ctx,
  id: string,
  w: { fromMs: number; toMs: number },
  filters: { speaker?: string; track?: 'mic' | 'system' },
): Promise<Transcript> {
  return ctx.client
    .call('getTranscript', { params: { id }, query: { fromMs: w.fromMs, toMs: w.toMs, ...filters } })
    .catch(mapApiError)
}

function segmentJson(s: Segment) {
  return {
    id: s.id,
    t: formatOffset(s.startMs),
    startMs: s.startMs,
    endMs: s.endMs,
    speaker: s.speaker,
    text: s.text,
    ...(s.quality === 'live' ? { quality: 'live' as const } : {}),
  }
}

export function render(ctx: Ctx, r: Transcript, window: Window): string {
  if (ctx.format === 'json') {
    return renderJson(
      {
        session: briefSession(r.session),
        window: window
          ? {
              from: formatOffset(window.fromMs),
              to: formatOffset(window.toMs),
              fromMs: window.fromMs,
              toMs: window.toMs,
            }
          : null,
        total: r.total,
        returned: r.segments.length,
        segments: r.segments.map(segmentJson),
      },
      ctx.io,
    )
  }
  const head = [
    r.session.title,
    r.session.id,
    localStamp(r.session.createdAt),
    formatOffset(r.session.durationMs),
    window ? `window ${formatOffset(window.fromMs)}–${formatOffset(window.toMs)}` : 'full',
    `${r.segments.length} of ${r.total} segments`,
  ].join(' · ')
  const lines = r.segments.map(
    (s) => `[${formatOffset(s.startMs)}] ${s.speaker}: ${s.text}${s.quality === 'live' ? ' (live)' : ''}`,
  )
  return `${head}\n${lines.join('\n')}${lines.length ? '\n' : ''}`
}
