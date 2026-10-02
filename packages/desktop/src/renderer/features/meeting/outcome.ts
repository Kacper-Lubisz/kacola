import { type AgendaView, type Evidence, extractActionItems } from '@gnomeola/protocol'
import { carriesOver, parseRecapOutcome } from '@gnomeola/ui-core/agendas'
import { _, fmt } from '@gnomeola/ui-core/i18n'

// The outcome of a meeting (unit-tested in test/day.test.ts): ONE place for what was decided, what
// people will do (owner, due date; yours first) and what carries over — gathered from the agenda's recap
// (per item: decisions, actions) and from the notes (a Decisions section; action items, the same parser
// the daemon, CLI and skill use). And the summary that "Share summary" hands out.

export type OutcomeDecision = { text: string; evidence: Evidence | null }
export type OutcomeAction = {
  text: string
  owner: string | null
  due: string | null
  done: boolean
  mine: boolean
}
export type OutcomeCarried = { text: string }
export type Outcome = {
  decisions: OutcomeDecision[]
  actions: OutcomeAction[]
  carried: OutcomeCarried[]
  /** Carried items go to the next occurrence (a recurring meeting); otherwise they are just not settled. */
  recurring: boolean
}

const ME = new Set(['me', 'you', 'i', 'myself'])
const isMine = (owner: string | null) => owner !== null && ME.has(owner.trim().toLowerCase())
const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/, '')

/** The list items under a heading whose text matches `name` (any level), until the next heading. */
export function notesSection(markdown: string, name: RegExp): string[] {
  const out: string[] = []
  let inSection = false
  for (const line of markdown.replace(/\r/g, '').split('\n')) {
    const h = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (h) {
      inSection = name.test(h[1]!)
      continue
    }
    if (!inSection) continue
    const item = /^\s*[-*+]\s+(?!\[[ xX]\])(.+)$/.exec(line)
    if (item) out.push(item[1]!.trim())
  }
  return out
}

export function buildOutcome(view: AgendaView | null, notes: string): Outcome {
  const decisions: OutcomeDecision[] = []
  const actions: OutcomeAction[] = []
  const seenD = new Set<string>()
  const seenA = new Set<string>()
  const items = view ? [...view.items].sort((a, b) => a.order - b.order) : []
  for (const i of items) {
    const r = parseRecapOutcome(i.outcome)
    for (const d of r.decisions)
      if (!seenD.has(norm(d))) {
        seenD.add(norm(d))
        decisions.push({ text: d, evidence: i.evidence.at(-1) ?? null })
      }
    for (const a of r.actions)
      if (!seenA.has(norm(a.text))) {
        seenA.add(norm(a.text))
        actions.push({ text: a.text, owner: a.owner, due: null, done: false, mine: isMine(a.owner) })
      }
  }
  for (const d of notesSection(notes, /^decisions?\b/i))
    if (!seenD.has(norm(d))) {
      seenD.add(norm(d))
      decisions.push({ text: d, evidence: null })
    }
  for (const a of extractActionItems(notes))
    if (!seenA.has(norm(a.text))) {
      seenA.add(norm(a.text))
      actions.push({ text: a.text, owner: a.owner, due: a.due, done: a.done, mine: isMine(a.owner) })
    }
  // yours first, then the rest, each in the order they came; done ones last
  const rank = (a: OutcomeAction) => (a.done ? 2 : a.mine ? 0 : 1)
  const sorted = actions.map((a, n) => ({ a, n })).sort((x, y) => rank(x.a) - rank(y.a) || x.n - y.n)
  const recurring = Boolean(view?.agenda.meeting?.recurring)
  const carried = view
    ? (recurring
        ? carriesOver(view)
        : items.filter((i) => i.status === 'open' || i.status === 'in-progress' || i.status === 'parked')
      ).map((i) => ({ text: i.text }))
    : []
  return { decisions, actions: sorted.map((x) => x.a), carried, recurring }
}

/** "You", or the owner as the notes name them. */
export const ownerLabel = (owner: string | null): string | null =>
  owner === null ? null : isMine(owner) ? _('You') : owner

/** What "Share summary" hands out: the outcome and the notes as markdown — never private context. */
export function summaryMarkdown(o: { title: string; when: string; outcome: Outcome; notes: string }): string {
  const lines = [`# ${o.title}`, '', o.when, '']
  if (o.outcome.decisions.length) {
    lines.push(`## ${_('Decisions')}`, '')
    for (const d of o.outcome.decisions) lines.push(`- ${d.text}`)
    lines.push('')
  }
  if (o.outcome.actions.length) {
    lines.push(`## ${_('Action items')}`, '')
    for (const a of o.outcome.actions) {
      const who = ownerLabel(a.owner)
      const meta = [
        who ? fmt(_('owner: {owner}'), { owner: who }) : null,
        a.due ? fmt(_('due: {due}'), { due: a.due }) : null,
      ]
        .filter(Boolean)
        .join(' — ')
      lines.push(`- [${a.done ? 'x' : ' '}] ${a.text}${meta ? ` — ${meta}` : ''}`)
    }
    lines.push('')
  }
  if (o.outcome.carried.length) {
    lines.push(`## ${o.outcome.recurring ? _('Carried over') : _('Not settled')}`, '')
    for (const c of o.outcome.carried) lines.push(`- ${c.text}`)
    lines.push('')
  }
  if (o.notes.trim()) lines.push(`## ${_('Notes')}`, '', o.notes.trim(), '')
  return `${lines.join('\n').trimEnd()}\n`
}
