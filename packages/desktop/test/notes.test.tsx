// @vitest-environment jsdom
import type { NoteTemplate } from '@kacola/protocol'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keys } from '../src/renderer/data/keys.ts'
import type { Api } from '../src/renderer/data/queries.ts'
import {
  parseKeywords,
  putTemplateMutation,
  templateIdFor,
} from '../src/renderer/features/notes/notes-data.ts'
import { versionTitle } from '../src/renderer/features/notes/version-history.tsx'

// The notes' pieces without a daemon: template helpers, version titles and the optimistic template
// mutation. The notes on the meeting page run against the real daemon in
// packages/e2e/test/desktop-notes.e2e.test.ts; the outcome built from them is in day.test.ts.

afterEach(cleanup)

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
