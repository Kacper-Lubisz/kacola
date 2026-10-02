import { parseTime } from '../transcript/search-params.ts'

// The meeting page's search params (the routes: routes/router.tsx):
//
//   ?panel=transcript                 the transcript, beside the page (Ctrl+T toggles it)
//   ?segment=<segment id> / ?t=83.5   …opened at that line (an Ask citation, a search moment, evidence)
//
// A citation implies the panel: anything that links to a line opens the transcript there. The old
// `?tab=transcript` links (before the redesign) still open it.

export type MeetingSearch = { panel?: 'transcript'; segment?: string; t?: number }

export function parseMeetingSearch(s: Record<string, unknown>): MeetingSearch {
  const segment = typeof s.segment === 'string' && s.segment ? s.segment : undefined
  const time = parseTime(s.t)
  const panel =
    s.panel === 'transcript' || s.tab === 'transcript' || segment !== undefined || time.t !== undefined
      ? ('transcript' as const)
      : undefined
  return { ...(panel ? { panel } : {}), ...(segment ? { segment } : {}), ...time }
}

/** The search for "open the transcript at this line". */
export const atLine = (segment: string | null | undefined, startMs?: number | null): MeetingSearch => ({
  panel: 'transcript',
  ...(segment ? { segment } : {}),
  ...(typeof startMs === 'number' ? { t: startMs / 1000 } : {}),
})
