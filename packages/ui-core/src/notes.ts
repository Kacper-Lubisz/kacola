import {
  type AnyEvent,
  type BodyIn,
  defaultChoices,
  diffNoteBlocks,
  type EnhanceStreamEvent,
  type ErrorDetail,
  type Hunk,
  isChoice,
  type MergeChoice,
  mergeNoteBlocks,
  type Note,
  type NotesState,
  type NoteTemplate,
  type NoteVersion,
  type Session,
  type TemplateSuggestion,
} from '@kacola/protocol'

// M7 — one session's notes in the window: the editor's draft with debounced autosave (optimistic
// concurrency against the daemon's head), enhancement streaming, and the block-by-block review of an
// enhanced version. Pure TS (no DOM) so it is unit-tested under plain vitest.
//
// Nothing here can lose what the user typed: every save is a new version on the daemon, a conflict
// re-saves the draft on top of the newer head (whose text stays in history), an enhancement never
// touches the head, and a merge is computed by the daemon from exactly the hunks the review showed.

export type NotesError = { code: string; message: string } & ErrorDetail

export type Enhancing = { templateId: string; text: string }

export type NotesFeedState = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** The daemon's head. */
  note: Note
  /** What the editor holds. Equal to note.markdown when nothing is unsaved. */
  draft: string
  /** Bumped when the head changed underneath the editor (merge, restore, another client): reload it. */
  revision: number
  saving: boolean
  /** The last save failed (other than a conflict, which is resolved by re-saving). */
  saveError: string | null
  /** A save conflicted and was re-applied on top of a newer head (shown once). */
  rebased: boolean
  /** The enhanced version awaiting review. */
  enhanced: NoteVersion | null
  enhancing: Enhancing | null
  enhanceError: NotesError | null
  templates: NoteTemplate[]
  suggested: TemplateSuggestion | null
}

export type NotesFeedDeps = {
  load: (sessionId: string, signal: AbortSignal) => Promise<NotesState>
  put: (sessionId: string, body: BodyIn<'putNotes'>) => Promise<Note>
  enhance: (
    sessionId: string,
    body: BodyIn<'enhanceNotes'>,
    signal: AbortSignal,
  ) => AsyncIterable<EnhanceStreamEvent>
  merge: (sessionId: string, body: BodyIn<'mergeNotes'>) => Promise<Note>
  /** Bring an old version back as the head (optional: only windows with a history UI need it). */
  restore?: (sessionId: string, version: number, body: BodyIn<'restoreNoteVersion'>) => Promise<Note>
  templates: (
    sessionId: string,
    signal: AbortSignal,
  ) => Promise<{ templates: NoteTemplate[]; suggested: TemplateSuggestion }>
  onEvent: (l: (e: AnyEvent) => void) => () => void
  /** Autosave delay after the last keystroke. */
  debounceMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
}

const emptyNote = (sessionId: string): Note => ({
  sessionId,
  version: 0,
  markdown: '',
  updatedAt: null,
  pendingEnhancement: null,
})

const errorOf = (err: unknown): NotesError => {
  const e = err as { code?: unknown; message?: unknown; detail?: ErrorDetail } | null
  return {
    code: typeof e?.code === 'string' ? e.code : 'internal',
    message: typeof e?.message === 'string' ? e.message : String(err),
    // a KacolaApiError carries the structured detail (reason, action, provider, link)
    ...(e?.detail && typeof e.detail === 'object' ? e.detail : {}),
  }
}

export const AUTOSAVE_MS = 800

export class NotesFeed {
  private state: NotesFeedState
  private readonly listeners = new Set<() => void>()
  private readonly abort = new AbortController()
  private unsubscribe: (() => void) | null = null
  private buffered: AnyEvent[] | null = []
  private timer: unknown = null
  private inflight: Promise<void> | null = null
  private merging = false
  readonly sessionId: string
  private readonly deps: NotesFeedDeps

  constructor(sessionId: string, deps: NotesFeedDeps) {
    this.sessionId = sessionId
    this.deps = deps
    this.state = {
      status: 'loading',
      error: null,
      note: emptyNote(sessionId),
      draft: '',
      revision: 0,
      saving: false,
      saveError: null,
      rebased: false,
      enhanced: null,
      enhancing: null,
      enhanceError: null,
      templates: [],
      suggested: null,
    }
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getSnapshot = (): NotesFeedState => this.state

  private set(patch: Partial<NotesFeedState>) {
    this.state = { ...this.state, ...patch }
    for (const l of [...this.listeners]) l()
  }

  get dirty(): boolean {
    return this.state.draft !== this.state.note.markdown
  }

  start(): this {
    this.unsubscribe = this.deps.onEvent((e) => {
      if (this.buffered) this.buffered.push(e)
      else this.apply(e)
    })
    void this.load()
    void this.loadTemplates()
    return this
  }

  private async load() {
    try {
      const s = await this.deps.load(this.sessionId, this.abort.signal)
      if (this.abort.signal.aborted) return
      this.set({
        status: 'ready',
        error: null,
        note: s.note,
        // anything typed before the notes arrived is kept (and saved on top)
        draft: this.state.draft !== '' ? this.state.draft : s.note.markdown,
        enhanced: s.enhanced,
        revision: this.state.revision + 1,
      })
      const pending = this.buffered ?? []
      this.buffered = null
      for (const e of pending) this.apply(e)
      if (this.dirty) this.schedule()
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.buffered = null
      this.set({ status: 'error', error: errorOf(err).message })
    }
  }

  private async loadTemplates() {
    try {
      const t = await this.deps.templates(this.sessionId, this.abort.signal)
      if (!this.abort.signal.aborted) this.set({ templates: t.templates, suggested: t.suggested })
    } catch {
      // no templates list: enhancement still works with the daemon's own suggestion
    }
  }

  /** Fold a durable event about this session's notes. */
  private apply(e: AnyEvent) {
    if (e.sessionId !== this.sessionId || e.data.type !== 'note.version') return
    const v = e.data.version
    if (v.kind === 'enhanced') {
      if (!this.state.enhanced || v.version > this.state.enhanced.version)
        this.set({ enhanced: v, note: { ...this.state.note, pendingEnhancement: v.version } })
      return
    }
    const cleared =
      v.merge && this.state.enhanced?.version === v.merge.enhancedVersion
        ? { enhanced: null, note: { ...this.state.note, pendingEnhancement: null } }
        : {}
    if (v.version <= this.state.note.version) {
      if (Object.keys(cleared).length) this.set(cleared)
      return // our own save, already applied
    }
    const note: Note = {
      sessionId: this.sessionId,
      version: v.version,
      markdown: v.markdown,
      updatedAt: v.createdAt,
      pendingEnhancement: cleared.note ? null : this.state.note.pendingEnhancement,
    }
    if (this.dirty && !this.state.saving) {
      // unsaved typing: keep the draft; the next save conflicts and lands on top of this head
      this.set({ ...cleared })
      return
    }
    if (this.state.saving || this.merging) return // the save or merge in flight will reconcile
    this.set({ ...cleared, note, draft: v.markdown, revision: this.state.revision + 1 })
  }

  // ------------------------------------------------------------------------------ editing

  /** The editor's text changed. Autosaves after a pause in typing. */
  edit(text: string) {
    if (text === this.state.draft) return
    this.set({ draft: text })
    this.schedule()
  }

  private schedule() {
    const setT = this.deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    const clearT = this.deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
    if (this.timer !== null) clearT(this.timer)
    this.timer = setT(() => {
      this.timer = null
      void this.flush()
    }, this.deps.debounceMs ?? AUTOSAVE_MS)
  }

  /** Save now (and wait for any save in flight). Resolves when the head holds the draft, or on error. */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      ;(this.deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.timer)
      this.timer = null
    }
    while (this.inflight) await this.inflight
    if (!this.dirty || this.state.status !== 'ready' || this.abort.signal.aborted) return
    this.inflight = this.save().finally(() => {
      this.inflight = null
    })
    await this.inflight
    if (this.dirty && !this.state.saveError) await this.flush() // typed while saving
  }

  private async save(retries = 3): Promise<void> {
    const markdown = this.state.draft
    this.set({ saving: true })
    try {
      const note = await this.deps.put(this.sessionId, { markdown, baseVersion: this.state.note.version })
      if (this.abort.signal.aborted) return
      this.set({ note, saving: false, saveError: null })
    } catch (err) {
      if (this.abort.signal.aborted) return
      const e = errorOf(err)
      if (e.code === 'conflict' && retries > 0) {
        // someone else moved the head: re-read it, then save the draft on top (theirs stays in history)
        try {
          const s = await this.deps.load(this.sessionId, this.abort.signal)
          this.set({ note: s.note, enhanced: s.enhanced ?? this.state.enhanced, rebased: true })
          return await this.save(retries - 1)
        } catch (err2) {
          this.set({ saving: false, saveError: errorOf(err2).message })
          return
        }
      }
      this.set({ saving: false, saveError: e.message })
    }
  }

  // ------------------------------------------------------------------------- enhancement

  /** Enhance with a template (default: the suggested one). Saves pending typing first. */
  async enhance(templateId?: string): Promise<void> {
    if (this.state.enhancing) return
    await this.flush()
    const id = templateId ?? this.state.suggested?.templateId ?? 'general'
    this.set({ enhancing: { templateId: id, text: '' }, enhanceError: null })
    try {
      for await (const ev of this.deps.enhance(
        this.sessionId,
        { templateId: id, includePrivate: true },
        this.abort.signal,
      )) {
        if (this.abort.signal.aborted) return
        if (ev.type === 'delta')
          this.set({ enhancing: { templateId: id, text: this.state.enhancing!.text + ev.text } })
        else if (ev.type === 'done')
          this.set({
            enhancing: null,
            enhanced: ev.version,
            note: { ...this.state.note, pendingEnhancement: ev.version.version },
          })
        else if (ev.type === 'error') this.set({ enhancing: null, enhanceError: ev.error })
      }
      if (this.state.enhancing)
        this.set({
          enhancing: null,
          enhanceError: { code: 'internal', message: 'the enhancement stream ended early' },
        })
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.set({ enhancing: null, enhanceError: errorOf(err) })
    }
  }

  dismissEnhanceError() {
    this.set({ enhanceError: null })
  }

  /**
   * Apply a review. The daemon recomputes the hunks against its head, so a review that raced another
   * edit fails with a conflict instead of merging the wrong blocks.
   */
  async merge(choices: MergeChoice[]): Promise<void> {
    const enhanced = this.state.enhanced
    if (!enhanced) return
    await this.flush()
    this.merging = true
    try {
      const note = await this.deps.merge(this.sessionId, {
        enhancedVersion: enhanced.version,
        baseVersion: this.state.note.version,
        choices,
      })
      if (this.abort.signal.aborted) return
      this.set({
        note,
        draft: note.markdown,
        enhanced: null,
        revision: this.state.revision + 1,
        enhanceError: null,
      })
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.set({ enhanceError: errorOf(err) })
      // the head may have moved: reload so the review is rebuilt against it
      void this.load()
    } finally {
      this.merging = false
    }
  }

  /**
   * Bring an old version back as the head. Pending typing is saved first (so it too stays in history),
   * and the restore is made against that head: a head that moved meanwhile is a conflict, not a loss.
   */
  async restore(version: number): Promise<void> {
    const restore = this.deps.restore
    if (!restore) throw new Error('this window cannot restore versions')
    await this.flush()
    if (this.state.saveError) throw new Error(this.state.saveError)
    this.merging = true
    try {
      const note = await restore(this.sessionId, version, { baseVersion: this.state.note.version })
      if (this.abort.signal.aborted) return
      this.set({ note: { ...note }, draft: note.markdown, revision: this.state.revision + 1 })
    } catch (err) {
      if (!this.abort.signal.aborted) void this.load()
      throw err
    } finally {
      this.merging = false
    }
  }

  dispose() {
    if (this.timer !== null)
      (this.deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.timer)
    this.abort.abort()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.listeners.clear()
  }
}

// ------------------------------------------------------------------ folds for a query cache

/**
 * Fold a durable event into a session's NotesState (the `getNotes` response), the way the store folds
 * it: user / merge / restore versions move the head, an enhanced version becomes the pending review,
 * a merge clears the review it applied. Idempotent: an event for a version already seen is a no-op.
 */
export function applyNotesEvent(s: NotesState, sessionId: string, e: AnyEvent): NotesState {
  if (e.sessionId !== sessionId || e.data.type !== 'note.version') return s
  const v = e.data.version
  if (v.kind === 'enhanced') {
    if (s.enhanced && s.enhanced.version >= v.version) return s
    if (s.note.pendingEnhancement !== null && s.note.pendingEnhancement >= v.version) return s
    return { note: { ...s.note, pendingEnhancement: v.version }, enhanced: v }
  }
  if (v.version <= s.note.version) return s
  const cleared = v.merge !== null && s.note.pendingEnhancement === v.merge.enhancedVersion
  return {
    note: {
      sessionId,
      version: v.version,
      markdown: v.markdown,
      updatedAt: v.createdAt,
      pendingEnhancement: cleared ? null : s.note.pendingEnhancement,
    },
    enhanced: cleared ? null : s.enhanced,
  }
}

/** Fold a durable event into a session's version history (oldest first). Idempotent. */
export function applyVersionEvent(vs: NoteVersion[], sessionId: string, e: AnyEvent): NoteVersion[] {
  if (e.sessionId !== sessionId || e.data.type !== 'note.version') return vs
  const v = e.data.version
  if (vs.some((x) => x.version === v.version)) return vs
  return [...vs, v].sort((a, b) => a.version - b.version)
}

// -------------------------------------------------------------------- enhancement errors

/** What went wrong with an enhancement, as the window explains it. */
export type EnhanceProblem =
  /** The model declined; the notes are unchanged. */
  | 'refused'
  /** Rate limited / out of quota at the provider: try again later. */
  | 'quota'
  /** No provider set up (no API key, no engine): Preferences can fix it. */
  | 'unavailable'
  | 'other'

export function enhanceProblem(e: NotesError): EnhanceProblem {
  // the daemon's stable reason wins over guessing from the message
  switch (e.reason) {
    case 'refused':
      return 'refused'
    case 'no-credits':
    case 'rate-limited':
    case 'overloaded':
    case 'provider-down':
      return 'quota'
    case 'no-provider':
    case 'no-key':
    case 'bad-key':
      return 'unavailable'
    case 'private-meeting':
      return 'other'
  }
  if (/declin|refus/i.test(e.message)) return 'refused'
  if (/rate.?limit|quota|credit|429|overloaded|too many requests/i.test(e.message)) return 'quota'
  if (e.code === 'unavailable') return 'unavailable'
  return 'other'
}

// ------------------------------------------------------------------------------ review

/** A review of an enhanced version against the head: the hunks and one choice per hunk. */
export type Review = { hunks: Hunk[]; choices: MergeChoice[] }

export function startReview(head: string, enhanced: string): Review {
  const hunks = diffNoteBlocks(head, enhanced)
  return { hunks, choices: defaultChoices(hunks) }
}

export function setChoice(r: Review, index: number, choice: MergeChoice): Review {
  if (!isChoice(r.hunks[index]!) || r.choices[index] === choice) return r
  const choices = [...r.choices]
  choices[index] = choice
  return { ...r, choices }
}

export function setAll(r: Review, choice: MergeChoice): Review {
  return { ...r, choices: r.hunks.map((h, i) => (isChoice(h) ? choice : r.choices[i]!)) }
}

export const reviewPreview = (r: Review): string => mergeNoteBlocks(r.hunks, r.choices)

/** Numbered changes (1-based, skipping unchanged hunks) — what the review shows and names. */
export function reviewChanges(r: Review): { index: number; n: number; hunk: Hunk; choice: MergeChoice }[] {
  let n = 0
  return r.hunks.flatMap((hunk, index) =>
    isChoice(hunk) ? [{ index, n: ++n, hunk, choice: r.choices[index]! }] : [],
  )
}

/** The display text of one side of a hunk: its blocks without trailing blank lines. */
export const sideText = (blocks: readonly string[]): string => blocks.join('').replace(/\s+$/, '')

// ------------------------------------------------------------------------------ export

/** The file a session's notes are exported as. */
export function exportFileName(session: Pick<Session, 'title' | 'createdAt'>): string {
  const base = session.title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || `Meeting ${session.createdAt.slice(0, 10)}`}.md`
}

/** Markdown for export: a title and date line, then the notes exactly as they are. */
export function exportMarkdown(
  session: Pick<Session, 'title' | 'startedAt' | 'createdAt'>,
  markdown: string,
): string {
  const when = (session.startedAt ?? session.createdAt).slice(0, 10)
  const body = markdown.replace(/\s+$/, '')
  return `# ${session.title}\n\n${when}\n${body ? `\n${body}\n` : ''}`
}
