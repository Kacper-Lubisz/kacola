import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { AgendaItemInput, ItemKind } from '../fixtures/agenda-schema.ts'
import { FIXTURES_DIR } from '../fixtures/index.ts'

export * from '../fixtures/agenda-schema.ts'

// Labelled datasets for the AI evals (agendas + live intelligence). Two kinds:
//
//   - fixture meetings with agendas (fixtures/agenda/<id>/truth.json): real audio + utterance-level ground
//     truth, plus an `agenda` block saying when each item was settled, by which utterances, and with what
//     outcome/answer. Replayed utterance by utterance to simulate a live meeting.
//   - small text-only datasets (fixtures/evals/<name>.jsonl): one JSON object per line, one behaviour each.

export const AGENDA_FIXTURES_DIR = join(FIXTURES_DIR, 'agenda')
export const EVAL_DATASETS_DIR = join(FIXTURES_DIR, 'evals')

/** A line of transcript as text-only datasets carry it. */
export const Turn = z.object({ speaker: z.string(), text: z.string().min(1) })
export type Turn = z.infer<typeof Turn>

// ------------------------------------------------------------------------------ text-only datasets

export const AgendaDraftingCase = z.object({
  id: z.string(),
  meeting: z.object({
    title: z.string(),
    kind: z.enum(['one-on-one', 'interview', 'standup', 'planning', 'review', 'other']),
    attendees: z.array(z.string()),
    durationMin: z.number().positive(),
    userRole: z.string().optional(),
  }),
  goals: z.array(z.string()).min(1),
  /** Extra context the user gave (past-meeting notes, open items carried over). */
  context: z.string().optional(),
  expected: z.object({
    /** Concepts a good agenda must cover; a concept is covered when an item mentions any keyword. */
    mustInclude: z.array(
      z.object({ concept: z.string(), keywords: z.array(z.string()).min(1), kind: ItemKind.optional() }),
    ),
    /** Phrases that must not appear (e.g. private context the user asked to keep out). */
    mustNotInclude: z.array(z.string()),
    minItems: z.int().positive(),
    maxItems: z.int().positive(),
  }),
})
export type AgendaDraftingCase = z.infer<typeof AgendaDraftingCase>

export const RelevanceCase = z.object({
  id: z.string(),
  agenda: z.array(AgendaItemInput).min(1),
  /** Preceding utterances, oldest first (context only). */
  recent: z.array(Turn),
  segment: Turn,
  label: z.object({
    /** Worth waking the agent / LLM for: bears on an agenda item, or is a decision/action/question. */
    relevant: z.boolean(),
    itemIds: z.array(z.string()),
  }),
  note: z.string().optional(),
})
export type RelevanceCase = z.infer<typeof RelevanceCase>

export const InjectionCase = z.object({
  id: z.string(),
  speaker: z.string(),
  text: z.string().min(1),
  label: z.object({ injection: z.boolean() }),
  /** direct | indirect | obfuscated | benign-mention | benign-instruction | quoted | meta */
  category: z.string(),
  note: z.string().optional(),
})
export type InjectionCase = z.infer<typeof InjectionCase>

export const NextPointCase = z.object({
  id: z.string(),
  agenda: z.array(
    AgendaItemInput.extend({
      status: z.enum(['open', 'in-progress', 'covered', 'skipped', 'parked']),
      /** Minutes since the item was last discussed, if ever. */
      lastDiscussedMinAgo: z.number().nonnegative().optional(),
    }),
  ),
  elapsedMin: z.number().nonnegative(),
  remainingMin: z.number().nonnegative(),
  recent: z.array(Turn),
  label: z.object({
    /** The single best next talking point. */
    best: z.string(),
    /** Other answers a reasonable person would accept. */
    acceptable: z.array(z.string()),
  }),
  note: z.string().optional(),
})
export type NextPointCase = z.infer<typeof NextPointCase>

export const RecapCase = z.object({
  id: z.string(),
  item: AgendaItemInput,
  transcript: z.array(Turn).min(1),
  expected: z.object({
    status: z.enum(['covered', 'in_progress', 'not_started', 'parked']),
    /** Each inner list is any-of: the recap must mention one keyword from every group. */
    outcomeKeywords: z.array(z.array(z.string()).min(1)),
    actions: z.array(z.object({ owner: z.string(), keywords: z.array(z.string()).min(1) })),
    /** Must not appear (hallucination / private / injected content). */
    mustNotInclude: z.array(z.string()),
  }),
})
export type RecapCase = z.infer<typeof RecapCase>

export const InterviewExtractionCase = z.object({
  id: z.string(),
  item: AgendaItemInput,
  transcript: z.array(Turn).min(1),
  label: z.object({
    answered: z.boolean(),
    answer: z.string().nullable(),
    aliases: z.array(z.string()),
  }),
  note: z.string().optional(),
})
export type InterviewExtractionCase = z.infer<typeof InterviewExtractionCase>

export const DATASETS = {
  'agenda-drafting': AgendaDraftingCase,
  'relevance-precheck': RelevanceCase,
  'injection-guardrail': InjectionCase,
  'next-point': NextPointCase,
  recap: RecapCase,
  'interview-extraction': InterviewExtractionCase,
} as const
export type DatasetName = keyof typeof DATASETS
export type DatasetCase<N extends DatasetName> = z.infer<(typeof DATASETS)[N]>

/** Parse a JSONL file: one JSON value per non-empty line; errors name the line. */
export function parseJsonl<T>(text: string, schema: z.ZodType<T>, source = 'jsonl'): T[] {
  const out: T[] = []
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return
    let json: unknown
    try {
      json = JSON.parse(line)
    } catch (err) {
      throw new Error(`${source}:${i + 1}: invalid JSON: ${(err as Error).message}`)
    }
    const r = schema.safeParse(json)
    if (!r.success) throw new Error(`${source}:${i + 1}: ${r.error.message}`)
    out.push(r.data)
  })
  return out
}

export function loadDataset<N extends DatasetName>(name: N, dir = EVAL_DATASETS_DIR): DatasetCase<N>[] {
  const file = join(dir, `${name}.jsonl`)
  const cases = parseJsonl(
    readFileSync(file, 'utf8'),
    DATASETS[name] as unknown as z.ZodType<DatasetCase<N>>,
    file,
  )
  const ids = new Set<string>()
  for (const c of cases) {
    const id = (c as { id: string }).id
    if (ids.has(id)) throw new Error(`${file}: duplicate id ${id}`)
    ids.add(id)
  }
  return cases
}

/** Ids of the fixture meetings that carry an agenda (directories under fixtures/agenda with a truth.json). */
export function listAgendaFixtures(): string[] {
  try {
    return readdirSync(AGENDA_FIXTURES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return []
  }
}
