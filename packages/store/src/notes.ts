import {
  type DurableEventData,
  diffNoteBlocks,
  type Enhancement,
  type MergeChoice,
  mergeNoteBlocks,
  type Note,
  type NoteTemplate,
  type NoteVersion,
} from '@kacola/protocol'
import type Database from 'better-sqlite3'
import { type Store, StoreError } from './store.ts'

// M7 — notes persistence. Same discipline as the rest of the store: every change is one durable event
// committed through `store.commit()`, and the tables below are written only by `applyNotesEvent`, so a
// replay of the log reproduces them exactly.
//
//   note_versions  append-only: every autosave, enhancement, merge and restore. Never updated, never
//                  deleted except with the session. This is what makes every word the user ever typed
//                  recoverable.
//   notes          one row per session: which version is the head, and which enhanced version (if any)
//                  is waiting for review. Derived entirely from the versions.
//   note_templates the user's custom templates (built-in ones live in code).

export type NotesEvent = Extract<
  DurableEventData,
  { type: 'note.version' } | { type: 'template.upserted' } | { type: 'template.deleted' }
>

export const isNotesEvent = (d: DurableEventData): d is NotesEvent =>
  d.type === 'note.version' || d.type === 'template.upserted' || d.type === 'template.deleted'

type VersionRow = {
  session_id: string
  version: number
  kind: string
  markdown: string
  base_version: number
  created_at: string
  /** JSON: { enhancement, merge, restoredFrom } */
  meta: string
}
type TemplateRow = { id: string; name: string; keywords: string; body: string }

const prepared = new WeakMap<Database.Database, Map<string, Database.Statement>>()
function stmt(db: Database.Database, q: string): Database.Statement {
  let m = prepared.get(db)
  if (!m) {
    m = new Map()
    prepared.set(db, m)
  }
  let s = m.get(q)
  if (!s) {
    s = db.prepare(q)
    m.set(q, s)
  }
  return s
}

/** Tables are a function of the log: the only code that writes the notes tables. */
export function applyNotesEvent(db: Database.Database, data: NotesEvent): void {
  switch (data.type) {
    case 'note.version': {
      const v = data.version
      stmt(
        db,
        `INSERT INTO note_versions (session_id, version, kind, markdown, base_version, created_at, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        v.sessionId,
        v.version,
        v.kind,
        v.markdown,
        v.baseVersion,
        v.createdAt,
        JSON.stringify({ enhancement: v.enhancement, merge: v.merge, restoredFrom: v.restoredFrom }),
      )
      stmt(
        db,
        'INSERT INTO notes (session_id, head, pending_enhancement) VALUES (?, 0, NULL) ON CONFLICT (session_id) DO NOTHING',
      ).run(v.sessionId)
      if (v.kind === 'enhanced') {
        // a proposal: it waits beside the head and never replaces it by itself
        stmt(db, 'UPDATE notes SET pending_enhancement = ? WHERE session_id = ?').run(v.version, v.sessionId)
      } else {
        stmt(db, 'UPDATE notes SET head = ? WHERE session_id = ?').run(v.version, v.sessionId)
        if (v.merge)
          stmt(
            db,
            'UPDATE notes SET pending_enhancement = NULL WHERE session_id = ? AND pending_enhancement = ?',
          ).run(v.sessionId, v.merge.enhancedVersion)
      }
      return
    }
    case 'template.upserted': {
      const t = data.template
      stmt(
        db,
        `INSERT INTO note_templates (id, name, keywords, body) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, keywords = excluded.keywords, body = excluded.body`,
      ).run(t.id, t.name, JSON.stringify(t.keywords), t.body)
      return
    }
    case 'template.deleted':
      stmt(db, 'DELETE FROM note_templates WHERE id = ?').run(data.id)
      return
  }
}

/** Part of `session.deleted`: the notes go with the session. */
export function deleteNotesOf(db: Database.Database, sessionId: string): void {
  stmt(db, 'DELETE FROM notes WHERE session_id = ?').run(sessionId)
  stmt(db, 'DELETE FROM note_versions WHERE session_id = ?').run(sessionId)
}

function rowToVersion(r: VersionRow): NoteVersion {
  const meta = JSON.parse(r.meta) as Pick<NoteVersion, 'enhancement' | 'merge' | 'restoredFrom'>
  return {
    sessionId: r.session_id,
    version: r.version,
    kind: r.kind as NoteVersion['kind'],
    markdown: r.markdown,
    baseVersion: r.base_version,
    createdAt: r.created_at,
    enhancement: meta.enhancement ?? null,
    merge: meta.merge ?? null,
    restoredFrom: meta.restoredFrom ?? null,
  }
}

/** Thrown inside a commit to abort it when there is nothing to write (an autosave of unchanged text). */
class NoChange extends Error {}

/** Notes operations over a Store. Stateless: construct one wherever it is needed. */
export class NoteStore {
  private readonly store: Store
  constructor(store: Store) {
    this.store = store
  }

  private get db(): Database.Database {
    return this.store.db
  }

  // --------------------------------------------------------------- reads

  get(sessionId: string): Note {
    const row = stmt(this.db, 'SELECT head, pending_enhancement FROM notes WHERE session_id = ?').get(
      sessionId,
    ) as { head: number; pending_enhancement: number | null } | undefined
    const head = row && row.head > 0 ? this.version(sessionId, row.head) : null
    return {
      sessionId,
      version: head?.version ?? 0,
      markdown: head?.markdown ?? '',
      updatedAt: head?.createdAt ?? null,
      pendingEnhancement: row?.pending_enhancement ?? null,
    }
  }

  version(sessionId: string, version: number): NoteVersion | null {
    const r = stmt(this.db, 'SELECT * FROM note_versions WHERE session_id = ? AND version = ?').get(
      sessionId,
      version,
    ) as VersionRow | undefined
    return r ? rowToVersion(r) : null
  }

  /** Every version, oldest first. */
  versions(sessionId: string): NoteVersion[] {
    return (
      stmt(this.db, 'SELECT * FROM note_versions WHERE session_id = ? ORDER BY version').all(
        sessionId,
      ) as VersionRow[]
    ).map(rowToVersion)
  }

  templates(): NoteTemplate[] {
    return (stmt(this.db, 'SELECT * FROM note_templates ORDER BY id').all() as TemplateRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      builtIn: false,
      keywords: JSON.parse(r.keywords) as string[],
      body: r.body,
    }))
  }

  // -------------------------------------------------------------- writes

  private nextVersion(sessionId: string): number {
    const r = stmt(this.db, 'SELECT max(version) AS v FROM note_versions WHERE session_id = ?').get(
      sessionId,
    ) as { v: number | null }
    return (r.v ?? 0) + 1
  }

  private requireSession(sessionId: string): void {
    if (!this.store.getSession(sessionId)) throw new StoreError('not_found', `no session ${sessionId}`)
  }

  private requireHead(sessionId: string, baseVersion: number): Note {
    const cur = this.get(sessionId)
    if (cur.version !== baseVersion)
      throw new StoreError(
        'conflict',
        `notes changed: the head is version ${cur.version}, not ${baseVersion}; re-read them and try again`,
      )
    return cur
  }

  /** Append one version inside a commit. `build` sees the current head and returns what to write. */
  private append(
    sessionId: string,
    build: (head: Note) => Omit<NoteVersion, 'sessionId' | 'version' | 'createdAt'>,
    now: Date,
  ): Note {
    try {
      this.store.commit(() => {
        this.requireSession(sessionId)
        const partial = build(this.get(sessionId))
        const version: NoteVersion = {
          ...partial,
          sessionId,
          version: this.nextVersion(sessionId),
          createdAt: now.toISOString(),
        }
        return { sessionId, data: { type: 'note.version', version } }
      })
    } catch (err) {
      if (!(err instanceof NoChange)) throw err
    }
    return this.get(sessionId)
  }

  /**
   * An edit by the user (every autosave). Optimistic concurrency: `baseVersion` must be the current head,
   * or it is a conflict and nothing is written. Saving unchanged text writes nothing.
   */
  put(sessionId: string, markdown: string, baseVersion: number, now = new Date()): Note {
    return this.append(
      sessionId,
      (head) => {
        this.requireHead(sessionId, baseVersion)
        if (markdown === head.markdown) throw new NoChange()
        return { kind: 'user', markdown, baseVersion, enhancement: null, merge: null, restoredFrom: null }
      },
      now,
    )
  }

  /** An enhancement result: a new version beside the head, pending review. The head is untouched. */
  addEnhanced(
    sessionId: string,
    markdown: string,
    baseVersion: number,
    enhancement: Enhancement,
    now = new Date(),
  ): NoteVersion {
    const before = this.nextVersion(sessionId)
    this.append(
      sessionId,
      () => ({ kind: 'enhanced', markdown, baseVersion, enhancement, merge: null, restoredFrom: null }),
      now,
    )
    return this.version(sessionId, before)!
  }

  /**
   * Apply a review: one choice per hunk of diffNoteBlocks(head, enhanced), computed here against the
   * current head inside the transaction, so the merge is exactly what the reviewer saw.
   */
  merge(
    sessionId: string,
    enhancedVersion: number,
    baseVersion: number,
    choices: MergeChoice[],
    now = new Date(),
  ): Note {
    return this.append(
      sessionId,
      (head) => {
        this.requireHead(sessionId, baseVersion)
        const enhanced = this.version(sessionId, enhancedVersion)
        if (enhanced?.kind !== 'enhanced')
          throw new StoreError('not_found', `no enhanced version ${enhancedVersion} of these notes`)
        if (head.pendingEnhancement !== enhancedVersion)
          throw new StoreError(
            'conflict',
            `enhanced version ${enhancedVersion} is not the one awaiting review`,
          )
        const hunks = diffNoteBlocks(head.markdown, enhanced.markdown)
        if (choices.length !== hunks.length)
          throw new StoreError(
            'bad_request',
            `expected ${hunks.length} choices (one per hunk of the review), got ${choices.length}`,
          )
        return {
          kind: 'merge',
          markdown: mergeNoteBlocks(hunks, choices),
          baseVersion,
          enhancement: null,
          merge: { enhancedVersion, choices },
          restoredFrom: null,
        }
      },
      now,
    )
  }

  /** Bring an older version back as the head (as a new version: history is never rewritten). */
  restore(sessionId: string, version: number, baseVersion: number, now = new Date()): Note {
    return this.append(
      sessionId,
      () => {
        this.requireHead(sessionId, baseVersion)
        const old = this.version(sessionId, version)
        if (!old) throw new StoreError('not_found', `no version ${version} of these notes`)
        return {
          kind: 'restore',
          markdown: old.markdown,
          baseVersion,
          enhancement: null,
          merge: null,
          restoredFrom: version,
        }
      },
      now,
    )
  }

  putTemplate(template: NoteTemplate): NoteTemplate {
    const t = { ...template, builtIn: false }
    this.store.commit(() => ({ sessionId: null, data: { type: 'template.upserted', template: t } }))
    return t
  }

  deleteTemplate(id: string): void {
    this.store.commit(() => {
      if (!stmt(this.db, 'SELECT 1 FROM note_templates WHERE id = ?').get(id))
        throw new StoreError('not_found', `no custom template ${id}`)
      return { sessionId: null, data: { type: 'template.deleted', id } }
    })
  }
}
