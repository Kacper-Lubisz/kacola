import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SharedAgendaPage } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { buildViewer } from '../scripts/build.ts'
import {
  esc,
  occurrenceOf,
  participantKey,
  renderAgenda,
  renderContribute,
  renderGone,
  shareTokenOf,
  verifyFromHash,
} from '../src/agenda.ts'

// L-19: the shared agenda page's routing and views, in Node (the page itself runs in headless Chrome
// against the Vercel build in packages/vercel/test/agenda-web.e2e.test.ts).

const TOKEN = 'hkL_k2xoTeYfEOJOdiKWoKIZjkCL3g1I'
const occ = (id: string, recapShared = false) => ({
  agendaId: id,
  title: 'Team sync',
  meeting: { eventUid: 'team@x', start: '2026-10-01T10:00:00.000Z', end: null, recurring: true },
  goals: [],
  recapShared,
  addedAt: '2026-10-01T09:00:00.000Z',
})
const page = (over: Partial<SharedAgendaPage> = {}): SharedAgendaPage => ({
  title: 'Team sync',
  ownerName: 'Kacper',
  occurrence: occ('agd_1'),
  occurrences: [{ agendaId: 'agd_1', title: 'Team sync', meeting: occ('agd_1').meeting, recapShared: false }],
  current: 'agd_1',
  items: [
    {
      id: 'itm_1',
      text: 'Roadmap <script>alert(1)</script>',
      kind: 'must-cover',
      owner: 'ana',
      timeboxMin: 10,
      status: 'covered',
      outcome: 'Agreed\nQ4 plan',
      auto: false,
      changedBy: 'Ben',
      addedBy: 'Kacper',
      contributed: false,
      carriedOver: false,
    },
    {
      id: 'itm_2',
      text: 'Offsite',
      kind: 'topic',
      owner: null,
      timeboxMin: null,
      status: 'open',
      outcome: null,
      auto: false,
      changedBy: 'Ivy',
      addedBy: 'Ivy',
      contributed: true,
      carriedOver: true,
    },
  ],
  cards: [
    { id: 'ctx_1', title: 'Q3', body: 'up <b>12%</b>', pinned: false, sourceUrl: 'javascript:alert(1)' },
  ],
  comments: [
    {
      id: 'scm_1',
      itemId: 'itm_2',
      author: 'Ivy',
      text: 'Friday? <img src=x>',
      at: '2026-10-01T09:30:00.000Z',
      mine: false,
    },
  ],
  contributions: true,
  you: null,
  ...over,
})

describe('shared agenda page: routing', () => {
  it('reads the token from /a/<token>, the magic link from #verify=…, a past meeting from ?o=', () => {
    expect(shareTokenOf(`/a/${TOKEN}`)).toBe(TOKEN)
    expect(shareTokenOf(`/a/${TOKEN}/`)).toBe(TOKEN)
    expect(shareTokenOf('/a/short')).toBeNull()
    expect(shareTokenOf(`/x/${TOKEN}`)).toBeNull()
    expect(shareTokenOf(`/a/${TOKEN}/../../etc`)).toBeNull()
    expect(verifyFromHash('#verify=ivy%40example.com/BCDF-GHJK')).toEqual({
      email: 'ivy@example.com',
      code: 'BCDF-GHJK',
    })
    expect(verifyFromHash('#verify=%E0%A4/BCDF-GHJK')).toBeNull()
    expect(verifyFromHash('#/s/x')).toBeNull()
    expect(occurrenceOf('?o=agd_7')).toBe('agd_7')
    expect(participantKey(TOKEN)).toBe('kacola.share.hkL_k2xoTeYf')
  })
})

describe('shared agenda page: views', () => {
  it('escapes everything people wrote; links only http(s) sources', () => {
    const html = renderAgenda(page({ occurrence: occ('agd_1', true) }), { canContribute: true })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).toContain(esc('Roadmap <script>alert(1)</script>'))
    expect(html).not.toContain('javascript:')
  })

  it('shows statuses as text (not colour alone), who set them, contributions and carry-over', () => {
    const html = renderAgenda(page(), { canContribute: false })
    expect(html).toContain('>Covered<')
    expect(html).toContain('Set by Ben')
    expect(html).toContain('Added by Ivy')
    expect(html).toContain('Carried over')
    expect(html).toContain('Must cover')
    expect(html).not.toContain('class="comment-form"')
  })

  it('outcomes only when the recap is shared', () => {
    expect(renderAgenda(page(), { canContribute: false })).not.toContain('Outcome')
    const recap = renderAgenda(page({ occurrence: occ('agd_1', true) }), { canContribute: false })
    expect(recap).toContain('<h4>Outcome</h4><p>Agreed<br>Q4 plan</p>')
    expect(recap).toContain('Agenda and outcomes')
  })

  it('the series: past meetings link to their recap, the current one is the default', () => {
    const p = page({
      occurrence: occ('agd_1', true),
      current: 'agd_2',
      occurrences: [
        { agendaId: 'agd_1', title: 'Team sync', meeting: occ('agd_1').meeting, recapShared: true },
        { agendaId: 'agd_2', title: 'Team sync', meeting: occ('agd_2').meeting, recapShared: false },
      ],
    })
    const html = renderAgenda(p, { canContribute: false })
    expect(html).toContain('href="?">Next meeting</a>')
  })

  it('the contribute steps: email, code, ready; nothing without contributions', () => {
    expect(renderContribute(page(), { step: 'email' })).toContain('id="email-form"')
    expect(renderContribute(page(), { step: 'code', email: 'ivy@example.com' })).toContain(
      'autocomplete="one-time-code"',
    )
    const ready = renderContribute(
      page({ you: { email: 'ivy@example.com', name: 'Ivy', role: 'invitee' } }),
      { step: 'ready' },
    )
    expect(ready).toContain('id="add-item"')
    expect(ready).toContain('As Ivy')
    expect(renderContribute(page({ contributions: false }), { step: 'email' })).toBe('')
    // every field has a label
    for (const html of [renderContribute(page(), { step: 'email' }), ready])
      for (const id of [...html.matchAll(/<(?:input|textarea)[^>]* id="([^"]+)"/g)].map((m) => m[1]))
        expect(html, id).toContain(`for="${id}"`)
  })

  it('gone and unknown links say so plainly', () => {
    expect(renderGone(410)).toContain('no longer shared')
    expect(renderGone(404)).toContain('No agenda here')
  })

  it('builds agenda.html/js/css with the brand tokens, favicon and fonts', async () => {
    const out = mkdtempSync(join(tmpdir(), 'kacola-agenda-build-'))
    try {
      await buildViewer(out)
      for (const f of [
        'agenda.html',
        'agenda.js',
        'agenda.css',
        'brand/tokens.css',
        'brand/favicon.svg',
        'fonts/InstrumentSans-Variable.woff2',
      ])
        expect(existsSync(join(out, f)), f).toBe(true)
      expect(readFileSync(join(out, 'agenda.js'), 'utf8')).not.toMatch(/from\s*["']node:/)
      expect(readFileSync(join(out, 'agenda.css'), 'utf8')).not.toMatch(/#[0-9a-f]{3,6}\b/i)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
