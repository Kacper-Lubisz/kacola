import { contentWords } from '@gnomeola/decisions'
import type { SearchHit } from '@gnomeola/protocol'
import type { Store } from '@gnomeola/store'

// Context from past meetings: when a name or a project comes up in the live transcript and earlier
// recordings mention it too, the tracker adds a private context card ("Last time with Ana: …") with the
// most recent earlier meeting's lines about it. Full-text search (the store's FTS5 index), no model.
// Private sessions are never searched; the card is private (the user decides whether to share it).

/** Capitalised words that are not names or projects. */
const NOT_NAMES = new Set(
  `I I'm I'll I've I'd Im Ok Okay OK Yes No Yeah Yep Sure Right Great Thanks Thank Hi Hello Hey So And But Or If
  Then Well Also Just Let Lets Let's We We'll We're You You're They It It's That's This That What When Where Who Why
  How Which There Here Good Nice Cool Sorry Please Maybe Actually Monday Tuesday Wednesday Thursday Friday Saturday
  Sunday January February March April May June July August September October November December Today Tomorrow
  Yesterday Next Last First Second One Two Three AI Claude Mr Mrs Ms Dr`
    .split(/\s+/)
    .map((w) => w.toLowerCase()),
)

/** Common sentence openers that contentWords keeps (not stopwords there). */
const COMMON =
  /^(anyway|basically|honestly|next|last|first|finally|also|another|everything|nothing|something|someone|everyone|because|since|although|though|still|even|only|maybe|perhaps|definitely|absolutely|exactly|really|awesome|perfect|lovely|fine|done|sounds|looks|seems|makes|feels|let's|lets|going|thinking|looking|talking|speaking|moving|coming)$/i

/** Candidate names/projects in the recent lines: speaker names, then capitalised words mid-sentence. */
export function contextTerms(lines: readonly { speaker: string; text: string }[], max = 5): string[] {
  const count = new Map<string, number>()
  const add = (w: string, n = 1) => count.set(w, (count.get(w) ?? 0) + n)
  for (const l of lines) {
    if (l.speaker && !['me', 'them'].includes(l.speaker) && /^\p{Lu}/u.test(l.speaker)) add(l.speaker, 2)
    for (const sentence of l.text.split(/(?<=[.!?])\s+/)) {
      const words = sentence.split(/\s+/)
      words.forEach((raw, i) => {
        const w = raw.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '').replace(/'s$/, '')
        if (w.length < 3 || !/^\p{Lu}/u.test(w) || NOT_NAMES.has(w.toLowerCase())) return
        // a capital at the start of a sentence says little ("Priya owns…" vs "Budget is…"): half weight,
        // and never a common word
        if (i === 0) {
          if (w.length >= 4 && contentWords(w).size > 0 && !COMMON.test(w)) add(w, 0.5)
          return
        }
        add(w)
      })
    }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w)
}

export type PastContext = { term: string; title: string; body: string; sessionId: string }

const bold = (snippet: string) => snippet.replace(/\[([^\]]+)\]/g, '**$1**')

/**
 * The most recent earlier (non-private) recording that mentions one of `terms`, as a card; null when
 * none does. `skip`: terms already carded in this meeting.
 */
export function findPastContext(
  store: Store,
  o: {
    sessionId: string
    terms: readonly string[]
    /** Speaker names heard in this meeting (a match on one reads "Last time with …"). */
    people: ReadonlySet<string>
    skip: ReadonlySet<string>
    /** Only recordings that started before this. */
    before: Date
  },
): PastContext | null {
  for (const term of o.terms) {
    if (o.skip.has(term.toLowerCase())) continue
    const { hits } = store.search({ q: `"${term}"`, limit: 50 })
    const bySession = new Map<string, SearchHit[]>()
    for (const h of hits) {
      if (h.sessionId === o.sessionId) continue
      const list = bySession.get(h.sessionId)
      if (list) list.push(h)
      else bySession.set(h.sessionId, [h])
    }
    const earlier = [...bySession.keys()]
      .map((id) => store.getSession(id))
      .filter((s) => s && !s.private && Date.parse(s.startedAt ?? s.createdAt) < o.before.getTime())
      .sort((a, b) => Date.parse(b!.startedAt ?? b!.createdAt) - Date.parse(a!.startedAt ?? a!.createdAt))
    const s = earlier[0]
    if (!s) continue
    const lines = bySession
      .get(s.id)!
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 3)
      .map((h) => `- ${h.speaker}: ${bold(h.snippet)}`)
    const day = (s.startedAt ?? s.createdAt).slice(0, 10)
    const title = o.people.has(term) ? `Last time with ${term}` : `Earlier on ${term}`
    return {
      term,
      title,
      body: `From **${s.title}** (${day}):\n\n${lines.join('\n')}\n`,
      sessionId: s.id,
    }
  }
  return null
}
