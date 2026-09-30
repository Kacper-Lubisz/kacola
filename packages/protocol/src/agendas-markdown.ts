// The markdown form of an agenda — what `gnomeola agenda export|import` and `agenda create --from` speak,
// and what a person (or Claude) writes by hand:
//
//   # 1:1 with Ana
//
//   ## Goals
//   - agree the promo timeline
//
//   ## Items
//   - [ ] Promo timeline (10m, @ana) [must-cover]
//   - [~] Hiring plan (@me)
//   - [x] Budget sign-off [decision]
//     > approved at 40k
//   - [>] Offsite dates
//
// Checkboxes: `[ ]` open, `[~]` in progress, `[x]` covered, `[-]` skipped, `[>]` parked. After the text:
// an optional `(…)` with a timebox (`10m`, `1h30m`) and/or an owner (`@ana`, `@"Ana Smith"`), and an
// optional `[kind]` (topic is the default and is not written). Indented `> ` lines under an item are its
// outcome. Plain bullets under `## Goals` are goals; every other bullet — and every task-list bullet,
// wherever it is — is an item (a plain `- text` is open).
//
// Export → import is lossless for everything the form carries (a property test proves it): text that
// would itself read as a trailing `(…)` or `[…]` group is escaped with a backslash, and backslashes are
// doubled.

import type { AgendaItemKind, AgendaItemStatus } from './agendas.ts'

const KINDS: readonly AgendaItemKind[] = [
  'topic',
  'question',
  'must-cover',
  'decision',
  'info-to-get',
  'competency',
]

const MARK_OF: Record<AgendaItemStatus, string> = {
  open: ' ',
  'in-progress': '~',
  covered: 'x',
  skipped: '-',
  parked: '>',
}
const STATUS_OF: Record<string, AgendaItemStatus> = {
  ' ': 'open',
  '': 'open',
  '~': 'in-progress',
  '/': 'in-progress',
  x: 'covered',
  X: 'covered',
  '-': 'skipped',
  '>': 'parked',
}

/** One item as the markdown form carries it. */
export type MarkdownItem = {
  text: string
  kind: AgendaItemKind
  owner: string | null
  timeboxMin: number | null
  status: AgendaItemStatus
  outcome: string | null
}

export type MarkdownAgenda = {
  title: string | null
  goals: string[]
  items: MarkdownItem[]
}

// ------------------------------------------------------------------------------------ trailing groups

/** Is the character at `i` escaped (preceded by an odd number of backslashes)? */
function escaped(s: string, i: number): boolean {
  let n = 0
  for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) n++
  return n % 2 === 1
}

/** Minutes from `10m`, `10 min`, `1h`, `1h30m`, `90`; null if it is not a duration. */
function minutesOf(part: string): number | null {
  const p = part.trim().toLowerCase().replace(/\s+/g, '')
  let m = /^(\d{1,3})(?:m|min|mins)?$/.exec(p)
  if (m) return Number(m[1])
  m = /^(\d{1,2})h(?:(\d{1,2})m?)?$/.exec(p)
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0)
  return null
}

function ownerOf(part: string): string | null {
  const p = part.trim()
  const quoted = /^@"([^"\n,()[\]]+)"$/.exec(p)
  if (quoted) return quoted[1]!.trim() || null
  const bare = /^@([^\s",()[\]]+)$/.exec(p)
  return bare ? bare[1]! : null
}

type Meta = { owner: string | null; timeboxMin: number | null }

/** A `(…)` group's content as metadata, or null when any part is not a timebox or an owner. */
function metaOf(content: string): Meta | null {
  const parts = content.split(',')
  if (!parts.length || !content.trim()) return null
  const out: Meta = { owner: null, timeboxMin: null }
  for (const part of parts) {
    const min = minutesOf(part)
    if (min !== null && min >= 1 && min <= 480 && out.timeboxMin === null) {
      out.timeboxMin = min
      continue
    }
    const owner = ownerOf(part)
    if (owner !== null && out.owner === null) {
      out.owner = owner
      continue
    }
    return null
  }
  return out
}

type Trailing =
  | { kind: 'kind'; at: number; value: AgendaItemKind }
  | { kind: 'meta'; at: number; value: Meta }
  | null

/** The metadata group that ends `s` (after trimming), if any: where its opener is and what it says. */
function trailingGroup(s: string): Trailing {
  const t = s.trimEnd()
  const close = t.at(-1)
  if (close !== ']' && close !== ')') return null
  if (escaped(t, t.length - 1)) return null
  const open = close === ']' ? '[' : '('
  for (let i = t.length - 2; i >= 0; i--) {
    if (t[i] !== open || escaped(t, i)) continue
    const content = t.slice(i + 1, -1)
    if (close === ']') {
      const k = content.trim().toLowerCase() as AgendaItemKind
      return KINDS.includes(k) ? { kind: 'kind', at: i, value: k } : null
    }
    const meta = metaOf(content)
    return meta ? { kind: 'meta', at: i, value: meta } : null
  }
  return null
}

const unescapeText = (s: string) => s.replace(/\\([\\()[\]])/g, '$1')

/** Escape text so that it never reads as having a trailing group, and round-trips through unescapeText. */
function escapeText(text: string): string {
  let s = text.replace(/\\/g, '\\\\')
  for (let guard = 0; guard < 100; guard++) {
    const g = trailingGroup(s)
    if (!g) break
    s = `${s.slice(0, g.at)}\\${s.slice(g.at)}`
  }
  // a leading "[x] " would be read as a second checkbox by nobody, but a leading "[ ]" confuses people
  return s
}

/** `text (10m, @ana) [kind]` → its parts. Groups may come in either order, each at most once. */
export function parseItemText(line: string): Omit<MarkdownItem, 'status' | 'outcome'> {
  let s = line.trim()
  let kind: AgendaItemKind | null = null
  let meta: Meta | null = null
  for (let i = 0; i < 2; i++) {
    const g = trailingGroup(s)
    if (!g) break
    if (g.kind === 'kind' && kind === null) kind = g.value
    else if (g.kind === 'meta' && meta === null) meta = g.value
    else break
    s = s.slice(0, g.at).trimEnd()
  }
  return {
    text: unescapeText(s).replace(/\s+/g, ' ').trim(),
    kind: kind ?? 'topic',
    owner: meta?.owner ?? null,
    timeboxMin: meta?.timeboxMin ?? null,
  }
}

const ownerToken = (o: string) => (/^[^\s",()[\]]+$/.test(o) ? `@${o}` : `@"${o}"`)

export function formatItemLine(item: MarkdownItem): string {
  const meta = [
    item.timeboxMin !== null ? `${item.timeboxMin}m` : null,
    item.owner ? ownerToken(item.owner) : null,
  ]
    .filter(Boolean)
    .join(', ')
  let line = `- [${MARK_OF[item.status]}] ${escapeText(item.text)}`
  if (meta) line += ` (${meta})`
  if (item.kind !== 'topic') line += ` [${item.kind}]`
  if (item.outcome?.trim())
    for (const o of item.outcome.trim().split('\n')) line += `\n  > ${o.trim()}`.trimEnd()
  return line
}

// ----------------------------------------------------------------------------------------- document

export function formatAgendaMarkdown(a: MarkdownAgenda): string {
  const out: string[] = []
  if (a.title) out.push(`# ${a.title.replace(/\s+/g, ' ').trim()}`, '')
  if (a.goals.length) {
    out.push('## Goals')
    for (const g of a.goals) {
      // a goal that starts like a checkbox would read as an item: one backslash keeps it a goal
      const text = g.replace(/\s+/g, ' ').trim()
      out.push(`- ${/^\\*\[.?\](\s|$)/.test(text) ? `\\${text}` : text}`)
    }
    out.push('')
  }
  out.push('## Items')
  for (const item of a.items) out.push(formatItemLine(item))
  return `${out.join('\n')}\n`
}

const TASK = /^[-*+]\s+\[.?\](\s|$)/
const BULLET = /^(\s*)[-*+]\s+(?:\[(.?)\]\s+)?(.*)$/
const CHECKBOX_ONLY = /^(\s*)[-*+]\s+\[(.?)\]\s*$/

/** Parse the markdown form. Lenient: headings other than Goals/Items are ignored, unknown lines too. */
export function parseAgendaMarkdown(md: string): MarkdownAgenda {
  const out: MarkdownAgenda = { title: null, goals: [], items: [] }
  let section: 'items' | 'goals' = 'items'
  let last: MarkdownItem | null = null
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      last = null
      const title = h[2]!.trim()
      if (h[1]!.length === 1 && out.title === null) out.title = title || null
      else if (/^goals?$/i.test(title)) section = 'goals'
      else section = 'items'
      continue
    }
    const quote = /^\s+>\s?(.*)$/.exec(line)
    if (quote && last) {
      const text = quote[1]!.trim()
      if (text) last.outcome = last.outcome ? `${last.outcome}\n${text}` : text
      continue
    }
    if (section === 'goals' && !TASK.test(line)) {
      // goals are plain bullets (a task-list bullet is always an item, wherever it is)
      const g = /^[-*+]\s+(.*)$/.exec(line)?.[1]?.replace(/\s+/g, ' ').trim()
      if (g) out.goals.push(g.replace(/^\\(\\*\[.?\](?:\s|$))/, '$1'))
      last = null
      continue
    }
    if (CHECKBOX_ONLY.test(line)) continue
    const b = BULLET.exec(line)
    if (!b || b[1]!.length >= 2) {
      // nested bullets and prose are not part of the form
      if (line.trim()) last = null
      continue
    }
    const status = b[2] === undefined ? 'open' : STATUS_OF[b[2]]
    const parsed = parseItemText(b[3]!)
    if (!parsed.text) {
      last = null
      continue
    }
    last = { ...parsed, status: status ?? 'open', outcome: null }
    out.items.push(last)
  }
  return out
}
