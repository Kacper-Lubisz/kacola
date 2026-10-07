import { enhanceEvents, type NoteTemplate } from '@kacola/protocol'
import { NotesFeed, type NotesFeedState } from '@kacola/ui-core/notes'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { EventBridge } from '../../data/event-bridge.ts'
import { keys } from '../../data/keys.ts'
import { optimistic } from '../../data/mutations.ts'
import type { Api, Queries } from '../../data/queries.ts'
import { useServices } from '../../data/services.tsx'

// The notes pane's data: ui-core's NotesFeed (draft + 800 ms autosave + optimistic concurrency +
// enhance + merge + restore — the controller the GTK window ran, unit-tested in ui-core) wired to this window's
// services. Its reads go through React Query (so `['notes', id]`, `['templates', id]` are the cache
// every screen shares and the EventBridge keeps folded), its events come from the one EventBridge, its
// writes are the protocol routes. What only the editor knows (the unsaved draft, streaming tokens) stays
// in the feed, never in the cache.

type FeedServices = {
  api: Api
  queries: Queries
  queryClient: QueryClient
  events: Pick<EventBridge, 'listen'>
}

export function createNotesFeed(sessionId: string, s: FeedServices): NotesFeed {
  const { api, queries, queryClient: qc, events } = s
  return new NotesFeed(sessionId, {
    // always fresh (a conflict re-reads the head through here); the result lands in the shared cache
    load: (id) => qc.fetchQuery({ ...queries.notes(id), staleTime: 0 }),
    put: (id, body) => api.call('putNotes', { params: { id }, body }),
    enhance: (id, body, signal) =>
      enhanceEvents(api.stream('enhanceNotes', { params: { id }, body, signal })),
    merge: (id, body) => api.call('mergeNotes', { params: { id }, body }),
    restore: (id, version, body) =>
      api.call('restoreNoteVersion', { params: { id, version: String(version) }, body }),
    templates: (id) => qc.fetchQuery(queries.templates(id)),
    onEvent: (l) => events.listen(l),
  })
}

/**
 * One feed per mounted pane. Leaving the session (unmount, or another session id) saves what was typed
 * before letting go — the "flush on leaving" rule. StrictMode-safe: the feed is made inside the effect.
 */
export function useNotesFeed(sessionId: string): { feed: NotesFeed | null; state: NotesFeedState | null } {
  const services = useServices()
  const [feed, setFeed] = useState<NotesFeed | null>(null)
  useEffect(() => {
    const f = createNotesFeed(sessionId, services).start()
    setFeed(f)
    return () => {
      void f.flush().finally(() => f.dispose())
    }
  }, [sessionId, services])
  const state = useSyncExternalStore(
    (l) => (feed ? feed.subscribe(l) : () => {}),
    () => (feed ? feed.getSnapshot() : null),
  )
  return { feed, state: feed && state?.note.sessionId === sessionId ? state : null }
}

// ---- custom templates (durable: template.upserted / template.deleted; the bridge invalidates ['templates'])

export type TemplateDraft = { id: string; name: string; keywords: string[]; body: string }

type TemplatesData = { templates: NoteTemplate[]; suggested: unknown }

/** Save a custom template. The list shows it at once; the durable echo refetches every template list. */
export function putTemplateMutation(api: Api, qc: QueryClient, sessionId: string) {
  return {
    mutationKey: ['putTemplate'],
    mutationFn: (t: TemplateDraft) =>
      api.call('putTemplate', {
        params: { id: t.id },
        body: { name: t.name, keywords: t.keywords, body: t.body },
      }),
    ...optimistic<TemplateDraft>(qc, (t) => [
      {
        key: keys.templates(sessionId),
        update: (p) => {
          const d = p as TemplatesData
          const next: NoteTemplate = { ...t, builtIn: false }
          const has = d.templates.some((x) => x.id === t.id)
          return {
            ...d,
            templates: has ? d.templates.map((x) => (x.id === t.id ? next : x)) : [...d.templates, next],
          }
        },
      },
    ]),
  }
}

export function deleteTemplateMutation(api: Api, qc: QueryClient, sessionId: string) {
  return {
    mutationKey: ['deleteTemplate'],
    mutationFn: (id: string) => api.call('deleteTemplate', { params: { id } }),
    ...optimistic<string>(qc, (id) => [
      {
        key: keys.templates(sessionId),
        update: (p) => {
          const d = p as TemplatesData
          return { ...d, templates: d.templates.filter((x) => x.id !== id) }
        },
      },
    ]),
  }
}

/** A template id from its name: lowercase words joined by dashes (TEMPLATE_ID), unique among `taken`. */
export function templateIdFor(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'template'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

/** "standup, daily sync" → ["standup", "daily sync"] (trimmed, deduplicated, empty dropped). */
export function parseKeywords(s: string): string[] {
  return [
    ...new Set(
      s
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20)
}
