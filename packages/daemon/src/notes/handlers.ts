import {
  type Citation,
  type EnhanceStreamEvent,
  type ErrorDetail,
  extractActionItems,
  type NoteTemplate,
  type notesRoutes,
  type Session,
} from '@gnomeola/protocol'
import { NoteStore, type Store } from '@gnomeola/store'
import type { Handlers } from '../daemon.ts'
import { DaemonError, toDaemonError } from '../errors.ts'
import type { Logger } from '../logger.ts'
import { assertMayLeave, notReadyError } from '../privacy.ts'
import type { SettingsService } from '../settings.ts'
import type { NotesEngine } from './engine.ts'
import { allTemplates, isBuiltIn, suggestTemplate } from './templates.ts'

// M7 routes. Reads of a private session's notes are 404 without includePrivate, exactly like its
// transcript (the CLI and the skill never pass it); edits are not gated, like renames.
//
// Enhancement streams `started, delta*, (done | error)`. The result is appended as an `enhanced`
// version beside the notes: it never replaces what the user wrote. A refusal or failure stores nothing.

export type NotesDeps = {
  store: Store
  engine: NotesEngine | null
  settings: SettingsService
  logger: Logger
  /** The daemon's private-session guard: the session, or a 404. */
  visible: (id: string, includePrivate: boolean | undefined) => Session
}

type NotesRouteName = keyof typeof notesRoutes

export function notesHandlers(deps: NotesDeps): Pick<Handlers, NotesRouteName> {
  const { store, engine, logger, visible } = deps
  const notes = new NoteStore(store)
  const exists = (id: string) => {
    if (!store.getSession(id)) throw new DaemonError('not_found', `no session ${id}`)
  }
  const findTemplate = (id: string): NoteTemplate => {
    const t = allTemplates(notes.templates()).find((x) => x.id === id)
    if (!t) throw new DaemonError('not_found', `no template ${id}`)
    return t
  }

  return {
    getNotes: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      const note = notes.get(params.id)
      const enhanced = note.pendingEnhancement ? notes.version(params.id, note.pendingEnhancement) : null
      return { note, enhanced }
    },
    putNotes: ({ params, body }) => {
      exists(params.id)
      return notes.put(params.id, body.markdown, body.baseVersion)
    },
    listNoteVersions: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      return { versions: notes.versions(params.id) }
    },
    mergeNotes: ({ params, body }) => {
      exists(params.id)
      return notes.merge(params.id, body.enhancedVersion, body.baseVersion, body.choices)
    },
    restoreNoteVersion: ({ params, body }) => {
      exists(params.id)
      const v = Number(params.version)
      if (!Number.isInteger(v) || v < 1)
        throw new DaemonError('bad_request', 'version must be a positive integer')
      return notes.restore(params.id, v, body.baseVersion)
    },
    getActionItems: ({ params, query }) => {
      visible(params.id, query.includePrivate)
      const v = query.version !== undefined ? notes.version(params.id, query.version) : null
      if (query.version !== undefined && !v)
        throw new DaemonError('not_found', `no version ${query.version} of these notes`)
      const source = v ?? notes.get(params.id)
      return { version: source.version, items: extractActionItems(source.markdown) }
    },

    listTemplates: ({ query }) => {
      const session = query.sessionId !== undefined ? visible(query.sessionId, query.includePrivate) : null
      const custom = notes.templates()
      return {
        templates: allTemplates(custom),
        suggested: suggestTemplate(
          { sessionTitle: session?.title, calendarTitle: query.calendarTitle ?? session?.meeting?.title },
          custom,
        ),
      }
    },
    putTemplate: ({ params, body }) => {
      if (isBuiltIn(params.id))
        throw new DaemonError('conflict', `${params.id} is a built-in template; pick another id`)
      if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(params.id))
        throw new DaemonError('bad_request', 'template ids are lowercase letters, digits and dashes')
      return notes.putTemplate({ id: params.id, builtIn: false, ...body })
    },
    deleteTemplate: ({ params }) => {
      if (isBuiltIn(params.id)) throw new DaemonError('conflict', `${params.id} is a built-in template`)
      notes.deleteTemplate(params.id)
      return { deleted: true as const }
    },

    enhanceNotes: async ({ params, body }, open) => {
      // everything that can be a plain 4xx is checked before the stream opens
      const session = visible(params.id, body.includePrivate)
      // private means never sent to the cloud: refused before anything streams (a typed 409)
      assertMayLeave(session, deps.settings.get().llm, 'Enhance')
      const custom = notes.templates()
      const templateId =
        body.templateId ??
        suggestTemplate(
          { sessionTitle: session.title, calendarTitle: body.calendarTitle ?? session.meeting?.title },
          custom,
        ).templateId
      const template = findTemplate(templateId)
      const head = notes.get(params.id)
      const segments = store.segments(params.id).filter((s) => s.text.trim())
      if (!segments.length && !head.markdown.trim())
        throw new DaemonError('bad_request', 'nothing to enhance yet: no notes and no transcript')

      const sse = open()
      const send = (e: EnhanceStreamEvent) => sse.send({ data: JSON.stringify(e) })
      const fail = (code: DaemonError['code'], message: string, detail: ErrorDetail = {}) => {
        send({ type: 'error', error: { code, message, ...detail } })
        sse.end()
      }
      const failWith = (e: DaemonError) => fail(e.code, e.message, e.detail)
      const abort = new AbortController()
      sse.onClose(() => abort.abort())
      send({ type: 'started', templateId, baseVersion: head.version })

      const llm = deps.settings.get().llm
      if (!engine) return failWith(notReadyError(llm, false, 'Enhance'))
      const apiKey = await deps.settings.apiKey()
      if (!engine.ready({ settings: llm, apiKeyConfigured: apiKey !== null }))
        return failWith(notReadyError(llm, apiKey !== null, 'Enhance'))

      const known = new Set(segments.map((s) => s.id))
      try {
        for await (const chunk of engine.enhance({
          session,
          segments,
          notes: head.markdown,
          template,
          settings: llm,
          apiKey,
          signal: abort.signal,
        })) {
          if (sse.closed) return
          if (chunk.type === 'delta') {
            send({ type: 'delta', text: chunk.text })
            continue
          }
          if (chunk.stopReason === 'refusal')
            return fail(
              'unavailable',
              'The model declined to enhance these notes. Your notes are unchanged.',
              {
                reason: 'refused',
                action: 'none',
              },
            )
          if (!chunk.markdown.trim())
            return fail('internal', 'the model returned no notes; your notes are unchanged')
          const citations: Citation[] = chunk.citations.filter((c) => known.has(c.segmentId))
          const version = notes.addEnhanced(params.id, chunk.markdown, head.version, {
            templateId,
            model: chunk.model,
            usage: chunk.usage,
            stopReason: chunk.stopReason,
            citations,
          })
          send({ type: 'done', version })
          sse.end()
          return
        }
        if (!sse.closed) fail('internal', 'the engine finished without a result')
      } catch (err) {
        if (abort.signal.aborted) return
        const e = toDaemonError(err)
        logger.error('enhance failed', { sessionId: params.id, err, code: e.code })
        fail(
          e.code,
          logger.redact(e.code === 'internal' && err instanceof Error ? err.message : e.message),
          e.detail,
        )
      }
    },
  }
}
