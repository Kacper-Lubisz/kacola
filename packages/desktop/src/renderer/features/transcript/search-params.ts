// The session route's search params: which pane shows, and a citation target in the transcript.
//
//   #/sessions/<id>?pane=transcript&seg=<segment id>     scroll to that line and highlight it
//   #/sessions/<id>?pane=transcript&t=83.5               …or to the line playing at 83.5 s
//
// Anything can link to a line this way (an Ask citation, a search hit, a notes quote); following the
// same link twice re-scrolls (the router's per-navigation key is the trigger, not the params).

export type Pane = 'transcript' | 'ask' | 'notes'
const PANES: readonly Pane[] = ['transcript', 'ask', 'notes']

export type SessionSearch = { pane?: Pane; seg?: string; t?: number }

export function parseSessionSearch(raw: Record<string, unknown>): SessionSearch {
  const out: SessionSearch = {}
  if (typeof raw.pane === 'string' && (PANES as readonly string[]).includes(raw.pane))
    out.pane = raw.pane as Pane
  if (typeof raw.seg === 'string' && /^[\w-]{1,80}$/.test(raw.seg)) out.seg = raw.seg
  const t = typeof raw.t === 'number' ? raw.t : typeof raw.t === 'string' ? Number(raw.t) : Number.NaN
  if (Number.isFinite(t) && t >= 0) out.t = t
  return out
}
