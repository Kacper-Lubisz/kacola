// Citation targets in the session route's search params (the route itself: routes/router.tsx):
//
//   #/sessions/<id>?tab=transcript&segment=<segment id>   scroll to that line and highlight it
//   #/sessions/<id>?tab=transcript&t=83.5                 …or to the line playing at 83.5 s
//
// Anything can link to a line this way (an Ask citation, a search hit, a notes quote); following the
// same link twice re-scrolls (the router's per-navigation key is the trigger, not the params).

export type CitationTarget = { segment?: string; t?: number }

/** `?t=` as seconds (a number or a numeric string, ≥ 0), or nothing. */
export function parseTime(raw: unknown): { t?: number } {
  const t = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN
  return Number.isFinite(t) && t >= 0 ? { t } : {}
}
