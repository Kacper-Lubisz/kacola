// @vitest-environment jsdom
import { defaultChoices, diffNoteBlocks, isChoice, type NoteTemplate } from '@gnomeola/protocol'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keys } from '../src/renderer/data/keys.ts'
import type { Api } from '../src/renderer/data/queries.ts'
import { ActionItems, actionItemsMarkdown } from '../src/renderer/features/notes/action-items.tsx'
import {
  parseKeywords,
  putTemplateMutation,
  templateIdFor,
} from '../src/renderer/features/notes/notes-data.ts'
import { NotesReview } from '../src/renderer/features/notes/notes-review.tsx'
import { versionTitle } from '../src/renderer/features/notes/version-history.tsx'

// The notes pane's pieces without a daemon: the review (choices in, choices out), the live action
// items, template helpers and the optimistic template mutation. The whole pane runs against the real
// daemon in packages/e2e/test/desktop-notes.e2e.test.ts.

afterEach(cleanup)

const HEAD = '- retry budgt\n- my aside\n'
const ENHANCED = '## Decisions\n\n- retry budget: three attempts\n- Ana owns the dashboard\n'

describe('NotesReview', () => {
  it('shows one switch per change with the safe defaults, and applies exactly the choices made', () => {
    const onApply = vi.fn()
    render(
      <NotesReview head={HEAD} enhanced={ENHANCED} templateName="General" busy={false} onApply={onApply} />,
    )
    const hunks = diffNoteBlocks(HEAD, ENHANCED)
    const defaults = defaultChoices(hunks)
    const changes = hunks.filter(isChoice)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(changes.length)
    // defaults: additions / rewrites on, the user's dropped lines kept (switch off)
    let n = 0
    hunks.forEach((h, i) => {
      if (!isChoice(h)) return
      n++
      const sw = screen.getByRole('switch', { name: `Use enhanced text for change ${n}` }) as HTMLInputElement
      expect(sw.checked).toBe(defaults[i] === 'enhanced')
    })
    // flip change 1, apply: the choices are the defaults with that one hunk flipped
    fireEvent.click(screen.getByRole('switch', { name: 'Use enhanced text for change 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    const first = hunks.findIndex(isChoice)
    const expected = [...defaults]
    expected[first] = defaults[first] === 'enhanced' ? 'mine' : 'enhanced'
    expect(onApply).toHaveBeenCalledWith(expected)
  })

  it('Use All Enhanced / Keep All Mine / Discard', () => {
    const onApply = vi.fn()
    render(
      <NotesReview head={HEAD} enhanced={ENHANCED} templateName="General" busy={false} onApply={onApply} />,
    )
    const hunks = diffNoteBlocks(HEAD, ENHANCED)
    fireEvent.click(screen.getByRole('button', { name: 'Keep All Mine' }))
    expect(screen.getAllByRole('switch').every((s) => !(s as HTMLInputElement).checked)).toBe(true)
    screen.getByText(/0 using the enhanced text/)
    fireEvent.click(screen.getByRole('button', { name: 'Use All Enhanced' }))
    expect(screen.getAllByRole('switch').every((s) => (s as HTMLInputElement).checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onApply).toHaveBeenLastCalledWith(hunks.map(() => 'mine'))
  })

  it('says so when the enhanced text is the same, and disables apply while busy', () => {
    render(<NotesReview head={HEAD} enhanced={HEAD} templateName="General" busy onApply={() => {}} />)
    screen.getByText('The enhanced notes are the same as yours.')
    expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('ActionItems', () => {
  it('lists items live from the markdown with owner and due, and copies them as a task list', () => {
    const onCopy = vi.fn()
    const md = '## Action items\n\n- [ ] Book the room — owner: Carla — due: Monday\n- [x] Send the deck\n'
    const { rerender } = render(<ActionItems markdown={md} onCopy={onCopy} />)
    const list = screen.getByRole('list', { name: 'Action items' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['Book the room', 'Send the deck'])
    screen.getByText('Owner: Carla · Due: Monday')
    fireEvent.click(screen.getByRole('button', { name: 'Copy Action Items' }))
    expect(onCopy).toHaveBeenCalledWith(
      '- [ ] Book the room — owner: Carla — due: Monday\n- [x] Send the deck\n',
    )
    rerender(<ActionItems markdown="no tasks here" onCopy={onCopy} />)
    expect(screen.queryByRole('list', { name: 'Action items' })).toBeNull()
  })

  it('formats owners and dues only where stated', () => {
    expect(actionItemsMarkdown([{ text: 'A', owner: null, due: null, done: false }])).toBe('- [ ] A\n')
  })
})

describe('templates', () => {
  it('derives ids and keywords', () => {
    expect(templateIdFor('Retrospective', ['general'])).toBe('retrospective')
    expect(templateIdFor('Retrospective', ['retrospective'])).toBe('retrospective-2')
    expect(templateIdFor('1:1 — Café sync!', [])).toBe('1-1-cafe-sync')
    expect(templateIdFor('!!!', [])).toBe('template')
    expect(parseKeywords(' retro, post-mortem ,,retro\nsprint ')).toEqual(['retro', 'post-mortem', 'sprint'])
  })

  it('names versions for the history list', () => {
    const t: NoteTemplate[] = [
      { id: 'general', name: 'General meeting', builtIn: true, keywords: [], body: 'x' },
    ]
    const v = {
      sessionId: 's',
      version: 3,
      markdown: '',
      baseVersion: 2,
      createdAt: '2026-09-30T10:00:00.000Z',
      enhancement: null,
      merge: null,
      restoredFrom: null,
    }
    expect(versionTitle({ ...v, kind: 'user' }, t)).toBe('Typed')
    expect(
      versionTitle(
        {
          ...v,
          kind: 'enhanced',
          enhancement: { templateId: 'general', model: null, usage: null, stopReason: null, citations: [] },
        },
        t,
      ),
    ).toBe('Enhanced (General meeting)')
    expect(versionTitle({ ...v, kind: 'merge' }, t)).toBe('Review applied')
    expect(versionTitle({ ...v, kind: 'restore', restoredFrom: 1 }, t)).toBe('Restored version 1')
  })

  it('saving a template shows it at once; a failure rolls it back', async () => {
    const qc = new QueryClient()
    const general: NoteTemplate = { id: 'general', name: 'General', builtIn: true, keywords: [], body: 'x' }
    qc.setQueryData(keys.templates('s'), { templates: [general], suggested: { templateId: 'general' } })
    let reject: (e: Error) => void = () => {}
    const api = { call: vi.fn(() => new Promise((_r, rj) => (reject = rj))) } as unknown as Api
    const m = new MutationObserver(qc, putTemplateMutation(api, qc, 's'))
    const draft = { id: 'retro', name: 'Retro', keywords: ['retro'], body: '## Went well' }
    const p = m.mutate(draft).catch(() => {})
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ids = () =>
      (qc.getQueryData(keys.templates('s')) as { templates: NoteTemplate[] }).templates.map((t) => t.id)
    expect(ids()).toEqual(['general', 'retro'])
    expect(api.call).toHaveBeenCalledWith('putTemplate', {
      params: { id: 'retro' },
      body: { name: 'Retro', keywords: ['retro'], body: '## Went well' },
    })
    reject(new Error('boom'))
    await p
    expect(ids()).toEqual(['general'])
  })
})
