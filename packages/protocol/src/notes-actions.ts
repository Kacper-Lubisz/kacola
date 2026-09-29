import type { ActionItem } from './notes.ts'

// N-5 — action items out of markdown notes. Deterministic parsing, no model call: the enhancement prompt
// asks for one canonical line per item —
//
//     - [ ] Update the dashboard — owner: Ana — due: Thursday
//
// — and this also understands what people type by hand: task-list items anywhere, and list items under
// an "Action items" / "Next steps" / "To-dos" / "Follow-ups" heading, with owners written as
// `owner: Ana`, `@ana`, `**Ana**: …`, `Ana: …` or `Ana to …`, and dates as `due: …` or `by Friday`.
// Owner and due are only ever what the notes state; nothing is inferred.

const TASK = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/
const ITEM = /^ ?(?:[-*+]|\d{1,9}[.)])\s+(.*)$/
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const ACTION_HEADING = /\b(action items?|actions|next steps|to-?dos?|follow[- ]?ups?|tasks)\b/i

const DAY =
  '(?:mon|tues|wednes|thurs|fri|satur|sun)day|today|tonight|tomorrow|eod|eow|end of (?:the )?(?:day|week|month|quarter|sprint)|next (?:week|month|sprint|(?:mon|tues|wednes|thurs|fri)day)|this week|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.? \\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*'
const BY_DATE = new RegExp(`\\b(?:by|before|on|until)\\s+(${DAY})\\b`, 'i')
const DUE = /\bdue(?:\s+date)?\s*[:\-–]?\s*([^—–;()[\]]+?)\s*(?=$|[—–;()[\]]|,\s*owner\b)/i
const OWNER = /\b(?:owner|assignee|assigned to)\s*[:\-–]?\s*([^—–;,()[\]]+?)\s*(?=$|[—–;,()[\]])/i
const MENTION = /(?:^|\s)@([\p{L}][\p{L}\p{N}._-]*)/u
const NAME = "[\\p{Lu}][\\p{L}'.-]*(?:\\s[\\p{Lu}][\\p{L}'.-]*){0,2}"
const BOLD_LEAD = new RegExp(`^\\*\\*(${NAME}|me|I)\\*\\*\\s*(?::|—|–|-)\\s*`, 'u')
const COLON_LEAD = new RegExp(`^(${NAME}):\\s+`, 'u')
const TO_LEAD = new RegExp(`^(${NAME}|I)\\s+(?:to|will|should|needs to|is going to)\\s+`, 'u')
/** Capitalised words that open a sentence but are not people. */
const NOT_NAMES = new Set(['We', 'They', 'Team', 'Everyone', 'All', 'Someone', 'TBD', 'Todo', 'TODO', 'Note'])

const CITATIONS = /\s*(?:\[\d+\])+/g

function normaliseOwner(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/^\*\*|\*\*$/g, '')
    .trim()
  if (!s || /^(tbd|unknown|n\/a|none|unassigned|-)$/i.test(s)) return null
  if (/^(me|i|myself)$/i.test(s)) return 'me'
  return s
}

/** Parse one item's text into an action item. `null` text = not an item. */
export function parseActionItem(raw: string, done = false): ActionItem | null {
  let text = raw.replace(CITATIONS, '').trim()
  if (!text) return null
  let owner: string | null = null
  let due: string | null = null

  // the canonical form: "Task — owner: X — due: Y" (either part optional, any order)
  const o = OWNER.exec(text)
  if (o) {
    owner = normaliseOwner(o[1]!)
    text = text.replace(o[0], ' ')
  }
  const d = DUE.exec(text)
  if (d) {
    due = d[1]!.trim() || null
    text = text.replace(d[0], ' ')
  }
  if (!owner) {
    const lead = BOLD_LEAD.exec(text) ?? COLON_LEAD.exec(text)
    if (lead && !NOT_NAMES.has(lead[1]!)) {
      owner = normaliseOwner(lead[1]!)
      text = text.slice(lead[0].length)
    }
  }
  if (!owner) {
    const to = TO_LEAD.exec(text)
    if (to && !NOT_NAMES.has(to[1]!)) owner = normaliseOwner(to[1]!)
  }
  if (!owner) {
    const m = MENTION.exec(text)
    if (m) owner = normaliseOwner(m[1]!)
  }
  if (!due) {
    const b = BY_DATE.exec(text)
    if (b) due = b[1]!
  }
  text = text
    .replace(/\(\s*\)/g, '') // "(due next week)" once the due part is taken out
    .replace(/\s*[—–]\s*(?=[—–]|$)/g, '') // separators left dangling by the removals above
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/[\s—–,;:-]+$/, '')
    .trim()
  if (!text) return null
  return { text, owner, due, done }
}

/**
 * Every action item in the notes, in order: task-list items anywhere, plus plain list items under an
 * action-items heading. Nested lines under an item are part of its text only if they are continuations.
 */
export function extractActionItems(markdown: string): ActionItem[] {
  const out: ActionItem[] = []
  /** Heading level of the action section we are in, or 0. */
  let section = 0
  let fence = false
  for (const line of markdown.replace(/\r/g, '').split('\n')) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const h = HEADING.exec(line)
    if (h) {
      const level = h[1]!.length
      if (ACTION_HEADING.test(h[2]!)) section = level
      else if (section && level <= section) section = 0
      continue
    }
    const t = TASK.exec(line)
    if (t) {
      const item = parseActionItem(t[2]!, t[1] !== ' ')
      if (item) out.push(item)
      continue
    }
    if (section) {
      const i = ITEM.exec(line)
      if (i) {
        const item = parseActionItem(i[1]!)
        if (item) out.push(item)
      }
    }
  }
  return out
}
