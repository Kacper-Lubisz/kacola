import { describe, expect, it } from 'vitest'
import {
  AGENDA_FIXTURES_DIR,
  DATASETS,
  type DatasetName,
  listAgendaFixtures,
  loadDataset,
} from '../src/evals/datasets.ts'
import { AGENDA_FIXTURE_SCRIPTS, listFixtures, loadAgendaFixture } from '../src/fixtures/index.ts'

// Static checks over the eval datasets: every text-only dataset parses and is big and balanced enough to
// mean something, and every agenda fixture's per-item ground truth is consistent with its utterances.

const MIN: Record<DatasetName, number> = {
  'agenda-drafting': 12,
  'relevance-precheck': 40,
  'injection-guardrail': 40,
  'next-point': 20,
  recap: 15,
  'interview-extraction': 25,
}

describe('text-only eval datasets', () => {
  it.each(Object.keys(DATASETS) as DatasetName[])('%s parses, has unique ids and enough cases', (name) => {
    const cases = loadDataset(name)
    expect(cases.length).toBeGreaterThanOrEqual(MIN[name])
  })

  it('injection guardrail is roughly balanced and covers the categories', () => {
    const cases = loadDataset('injection-guardrail')
    const pos = cases.filter((c) => c.label.injection).length
    expect(pos / cases.length).toBeGreaterThan(0.35)
    expect(pos / cases.length).toBeLessThan(0.65)
    const cats = new Set(cases.map((c) => c.category))
    for (const c of ['direct', 'indirect', 'obfuscated', 'role-play', 'benign-mention', 'quoted'])
      expect(cats).toContain(c)
  })

  it('relevance has both labels, and itemIds always name agenda items', () => {
    const cases = loadDataset('relevance-precheck')
    const rel = cases.filter((c) => c.label.relevant).length
    expect(rel).toBeGreaterThan(10)
    expect(cases.length - rel).toBeGreaterThan(10)
    for (const c of cases) {
      const ids = new Set(c.agenda.map((i) => i.id))
      for (const id of c.label.itemIds) expect(ids, c.id).toContain(id)
      if (!c.label.relevant) expect(c.label.itemIds, c.id).toEqual([])
    }
  })

  it('interview extraction has answered and unanswered cases; answers only when answered', () => {
    const cases = loadDataset('interview-extraction')
    const answered = cases.filter((c) => c.label.answered)
    expect(answered.length).toBeGreaterThan(8)
    expect(cases.length - answered.length).toBeGreaterThan(5)
    for (const c of cases) {
      expect(c.item.kind).toBe('info-to-get')
      if (c.label.answered) expect(c.label.answer, c.id).toBeTruthy()
      else expect(c.label.answer, c.id).toBeNull()
    }
  })

  it('next point labels name open items of the case', () => {
    for (const c of loadDataset('next-point')) {
      const open = new Set(
        c.agenda.filter((i) => i.status === 'open' || i.status === 'in-progress').map((i) => i.id),
      )
      expect(open, c.id).toContain(c.label.best)
      for (const a of c.label.acceptable) expect(open, c.id).toContain(a)
    }
  })

  it('agenda drafting bounds are sane', () => {
    for (const c of loadDataset('agenda-drafting')) {
      expect(c.expected.minItems).toBeLessThanOrEqual(c.expected.maxItems)
      expect(c.expected.mustInclude.length).toBeLessThanOrEqual(c.expected.maxItems)
    }
    expect(loadDataset('agenda-drafting').some((c) => c.expected.mustNotInclude.length > 0)).toBe(true)
  })

  it('recap covers every status and some transcripts carry an injection to keep out', () => {
    const cases = loadDataset('recap')
    const statuses = new Set(cases.map((c) => c.expected.status))
    for (const s of ['covered', 'in_progress', 'parked']) expect(statuses).toContain(s)
    expect(cases.filter((c) => c.expected.mustNotInclude.length > 0).length).toBeGreaterThanOrEqual(3)
  })
})

describe('agenda fixture meetings', () => {
  it('are the expected meetings, and stay out of listFixtures()', () => {
    expect(listAgendaFixtures()).toEqual([
      'hostile-planning',
      'interview-candidate',
      'manager-1on1',
      'standup-recurring',
    ])
    for (const id of listAgendaFixtures()) expect(listFixtures()).not.toContain(id)
    expect(AGENDA_FIXTURE_SCRIPTS.map((d) => d.id).sort()).toEqual(listAgendaFixtures())
  })

  it.each(listAgendaFixtures())('%s: per-item ground truth is consistent with the utterances', (id) => {
    const { truth } = loadAgendaFixture(id)
    const agenda = truth.agenda
    expect(agenda).toBeDefined()
    if (!agenda) return
    const def = AGENDA_FIXTURE_SCRIPTS.find((d) => d.id === id)!
    expect(agenda.items.map((i) => i.id)).toEqual(def.agenda.items.map((i) => i.id))
    expect(truth.utterances.length).toBeGreaterThanOrEqual(24)
    const n = truth.utterances.length
    for (const item of agenda.items) {
      const e = item.expected
      for (const i of e.evidence) expect(i).toBeLessThan(n)
      if (e.status === 'covered') {
        expect(e.settledBy, item.id).not.toBeNull()
        const u = truth.utterances[e.settledBy!]!
        expect(e.settledAtMs).toBe(u.endMs)
        expect(e.settledAtMs!).toBeLessThanOrEqual(truth.durationMs)
        expect(e.evidence).toContain(e.settledBy)
        expect(e.startedAtMs!).toBeLessThanOrEqual(e.settledAtMs!)
      } else {
        expect(e.settledAtMs).toBeNull()
        expect(e.implicit).toBe(false)
      }
      if (e.status === 'not_started') expect(e.evidence).toEqual([])
      if (item.kind === 'info-to-get') expect(e.answer === null).toBe(e.status !== 'covered')
    }
    for (const t of agenda.tangents) expect(t).toBeLessThan(n)
  })

  it('cover the cases the evals need: implicit settlement, unsettled discussion, never reached, injections', () => {
    const all = listAgendaFixtures().map((id) => loadAgendaFixture(id).truth)
    const items = all.flatMap((t) => t.agenda!.items)
    expect(items.some((i) => i.expected.implicit)).toBe(true)
    expect(items.some((i) => i.expected.status === 'in_progress')).toBe(true)
    expect(items.some((i) => i.expected.status === 'not_started' && i.kind === 'must-cover')).toBe(true)
    const hostile = all.find((t) => t.id === 'hostile-planning')!
    expect(hostile.injections.length).toBeGreaterThanOrEqual(2)
    expect(hostile.agenda!.meeting.scheduledEndMs).toBeLessThan(hostile.durationMs)
    const interview = all.find((t) => t.id === 'interview-candidate')!
    expect(interview.agenda!.meeting.userRole).toBe('candidate')
    expect(interview.agenda!.items.every((i) => i.kind === 'info-to-get')).toBe(true)
  })
})
