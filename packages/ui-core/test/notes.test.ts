import type { AnyEvent, EnhanceStreamEvent, Note, NotesState, NoteVersion } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  applyNotesEvent,
  applyVersionEvent,
  enhanceProblem,
  exportFileName,
  exportMarkdown,
  NotesFeed,
  type NotesFeedDeps,
  reviewChanges,
  reviewPreview,
  setAll,
  setChoice,
  sideText,
  startReview,
} from '../src/notes.ts'

// The notes feed against a scripted daemon: autosave with optimistic concurrency, nothing typed is ever
// dropped, enhancement streaming, and the review helpers the diff view is built on.

const SES = 'ses_1'
const at = '2026-09-29T10:00:00.000Z'

/** A tiny in-memory daemon with the real rules: versions append, a stale base is a 409. */
function fakeDaemon() {
  const versions: NoteVersion[] = []
  const puts: { markdown: string; baseVersion: number }[] = []
  let pending: NoteVersion | null = null
  const head = (): Note => {
    const h = versions.filter((v) => v.kind !== 'enhanced').at(-1)
    return {
      sessionId: SES,
      version: h?.version ?? 0,
      markdown: h?.markdown ?? '',
      updatedAt: h?.createdAt ?? null,
      pendingEnhancement: pending?.version ?? null,
    }
  }
  const append = (v: Omit<NoteVersion, 'sessionId' | 'version' | 'createdAt'>) => {
    const version: NoteVersion = { ...v, sessionId: SES, version: versions.length + 1, createdAt: at }
    versions.push(version)
    for (const l of listeners)
      l({ seq: versions.length, at, sessionId: SES, data: { type: 'note.version', version } })
    return version
  }
  const listeners = new Set<(e: AnyEvent) => void>()
  let gate: Promise<void> | null = null
  let enhanceScript: EnhanceStreamEvent[] = []
  const deps: NotesFeedDeps = {
    load: async (): Promise<NotesState> => ({ note: head(), enhanced: pending }),
    put: async (_id, body) => {
      puts.push(body)
      if (gate) await gate
      if (body.baseVersion !== head().version)
        throw Object.assign(new Error('conflict'), { code: 'conflict' })
      if (body.markdown !== head().markdown)
        append({
          kind: 'user',
          markdown: body.markdown,
          baseVersion: body.baseVersion,
          enhancement: null,
          merge: null,
          restoredFrom: null,
        })
      return head()
    },
    async *enhance() {
      for (const e of enhanceScript) {
        if (e.type === 'done') pending = e.version
        yield e
      }
    },
    merge: async (_id, body) => {
      if (body.baseVersion !== head().version) throw Object.assign(new Error('stale'), { code: 'conflict' })
      const h = startReview(head().markdown, pending!.markdown)
      append({
        kind: 'merge',
        markdown: reviewPreview({ ...h, choices: body.choices }),
        baseVersion: body.baseVersion,
        enhancement: null,
        merge: { enhancedVersion: body.enhancedVersion, choices: body.choices },
        restoredFrom: null,
      })
      pending = null
      return head()
    },
    restore: async (_id, version, body) => {
      if (body.baseVersion !== head().version) throw Object.assign(new Error('stale'), { code: 'conflict' })
      const old = versions.find((v) => v.version === version)!
      append({
        kind: 'restore',
        markdown: old.markdown,
        baseVersion: body.baseVersion,
        enhancement: null,
        merge: null,
        restoredFrom: version,
      })
      return head()
    },
    templates: async () => ({
      templates: [],
      suggested: { templateId: 'standup', reason: 'keyword', matched: null },
    }),
    onEvent: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
  return {
    deps,
    versions,
    puts,
    head,
    append,
    hold: () => {
      let release!: () => void
      gate = new Promise((r) => {
        release = r
      })
      return () => {
        gate = null
        release()
      }
    },
    script: (s: EnhanceStreamEvent[]) => {
      enhanceScript = s
    },
    setPending: (v: NoteVersion) => {
      pending = v
    },
  }
}

/** Manual timers: autosave fires only when the test says so. */
function timers() {
  const queue: { fn: () => void; id: number }[] = []
  let n = 0
  return {
    setTimer: (fn: () => void) => {
      queue.push({ fn, id: ++n })
      return n
    },
    clearTimer: (h: unknown) => {
      const i = queue.findIndex((q) => q.id === h)
      if (i >= 0) queue.splice(i, 1)
    },
    fire: () => {
      const all = queue.splice(0)
      for (const q of all) q.fn()
      return all.length
    },
    get pending() {
      return queue.length
    },
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

async function started(daemon = fakeDaemon()) {
  const t = timers()
  const feed = new NotesFeed(SES, { ...daemon.deps, setTimer: t.setTimer, clearTimer: t.clearTimer }).start()
  await settle()
  return { feed, t, daemon }
}

describe('NotesFeed: autosave', () => {
  it('debounces typing into one save against the head it was typed on', async () => {
    const { feed, t, daemon } = await started()
    expect(feed.getSnapshot()).toMatchObject({ status: 'ready', draft: '' })
    feed.edit('- a')
    feed.edit('- a\n- b')
    expect(t.pending).toBe(1)
    t.fire()
    await settle()
    expect(daemon.puts).toEqual([{ markdown: '- a\n- b', baseVersion: 0 }])
    expect(feed.getSnapshot().note).toMatchObject({ version: 1, markdown: '- a\n- b' })
    expect(feed.dirty).toBe(false)
  })

  it('keeps typing that happens while a save is in flight, and saves it next', async () => {
    const { feed, daemon } = await started()
    feed.edit('one')
    const release = daemon.hold()
    const f = feed.flush()
    await settle()
    feed.edit('one two') // typed while the first save is on the wire
    release()
    await f
    await feed.flush()
    expect(daemon.puts.map((p) => [p.markdown, p.baseVersion])).toEqual([
      ['one', 0],
      ['one two', 1],
    ])
    expect(daemon.head().markdown).toBe('one two')
    expect(feed.getSnapshot().draft).toBe('one two')
  })

  it('on a conflict re-reads the head and saves the draft on top: both versions survive', async () => {
    const { feed, daemon } = await started()
    feed.edit('mine')
    // another client writes first
    daemon.append({
      kind: 'user',
      markdown: 'theirs',
      baseVersion: 0,
      enhancement: null,
      merge: null,
      restoredFrom: null,
    })
    await feed.flush()
    expect(daemon.versions.map((v) => v.markdown)).toEqual(['theirs', 'mine'])
    expect(feed.getSnapshot()).toMatchObject({ rebased: true, saveError: null, draft: 'mine' })
  })

  it('adopts a head changed elsewhere when nothing is unsaved, and bumps the editor revision', async () => {
    const { feed, daemon } = await started()
    const rev = feed.getSnapshot().revision
    daemon.append({
      kind: 'restore',
      markdown: 'restored text',
      baseVersion: 0,
      enhancement: null,
      merge: null,
      restoredFrom: 1,
    })
    expect(feed.getSnapshot()).toMatchObject({ draft: 'restored text', revision: rev + 1 })
  })

  it('never replaces unsaved typing with a head from elsewhere', async () => {
    const { feed, daemon } = await started()
    feed.edit('unsaved words')
    daemon.append({
      kind: 'user',
      markdown: 'other window',
      baseVersion: 0,
      enhancement: null,
      merge: null,
      restoredFrom: null,
    })
    expect(feed.getSnapshot().draft).toBe('unsaved words')
    await feed.flush()
    expect(daemon.head().markdown).toBe('unsaved words')
    expect(daemon.versions.map((v) => v.markdown)).toContain('other window')
  })

  it('reports a failed save and keeps the draft', async () => {
    const d = fakeDaemon()
    d.deps.put = async () => {
      throw Object.assign(new Error('daemon down'), { code: 'unavailable' })
    }
    const { feed } = await started(d)
    feed.edit('precious')
    await feed.flush()
    expect(feed.getSnapshot()).toMatchObject({ saveError: 'daemon down', draft: 'precious' })
  })
})

describe('NotesFeed: enhancement and merge', () => {
  const enhanced = (markdown: string, version: number): NoteVersion => ({
    sessionId: SES,
    version,
    kind: 'enhanced',
    markdown,
    baseVersion: version - 1,
    createdAt: at,
    enhancement: { templateId: 'standup', model: 'm', usage: null, stopReason: 'end_turn', citations: [] },
    merge: null,
    restoredFrom: null,
  })

  it('saves pending typing first, streams, then holds the result for review without touching the head', async () => {
    const { feed, daemon } = await started()
    feed.edit('- retry budget?\n')
    const result = enhanced('## Decisions\n\n- retry budget?\n- Three attempts [1]\n', 2)
    daemon.script([
      { type: 'started', templateId: 'standup', baseVersion: 1 },
      { type: 'delta', text: '## Decisions\n\n' },
      { type: 'delta', text: '- retry budget?\n- Three attempts [1]\n' },
      { type: 'done', version: result },
    ])
    const seen: string[] = []
    feed.subscribe(() => {
      const e = feed.getSnapshot().enhancing
      if (e) seen.push(e.text)
    })
    await feed.enhance()
    expect(daemon.puts[0]).toEqual({ markdown: '- retry budget?\n', baseVersion: 0 })
    expect(seen.at(-1)).toBe('## Decisions\n\n- retry budget?\n- Three attempts [1]\n')
    expect(feed.getSnapshot()).toMatchObject({
      enhancing: null,
      enhanced: result,
      note: { version: 1, markdown: '- retry budget?\n', pendingEnhancement: 2 },
      draft: '- retry budget?\n',
    })
  })

  it('shows an enhancement error and leaves the notes alone', async () => {
    const { feed, daemon } = await started()
    daemon.script([
      { type: 'started', templateId: 'general', baseVersion: 0 },
      { type: 'error', error: { code: 'unavailable', message: 'no key' } },
    ])
    await feed.enhance('general')
    expect(feed.getSnapshot()).toMatchObject({
      enhancing: null,
      enhanced: null,
      enhanceError: { code: 'unavailable', message: 'no key' },
    })
  })

  it('merges the review’s choices against the head, then loads the result into the editor', async () => {
    const { feed, daemon } = await started()
    feed.edit('- retry budget?\n- my aside\n')
    await feed.flush()
    const e = enhanced('## Decisions\n\n- retry budget?\n- Three attempts\n', 2)
    daemon.setPending(e)
    daemon.append(e)
    expect(feed.getSnapshot().enhanced?.version).toBe(2)
    const review = startReview(feed.getSnapshot().note.markdown, e.markdown)
    const rev = feed.getSnapshot().revision
    await feed.merge(review.choices)
    const s = feed.getSnapshot()
    expect(s.enhanced).toBeNull()
    expect(s.revision).toBe(rev + 1)
    // the default review keeps the line enhancement dropped
    expect(s.draft).toBe('## Decisions\n\n- retry budget?\n- my aside\n- Three attempts\n')
    expect(daemon.versions.map((v) => v.kind)).toEqual(['user', 'enhanced', 'merge'])
  })
})

describe('review helpers', () => {
  const r = startReview('- a\n- budget\n', '# H\n\n- a\n- budget expanded with detail\n')

  it('numbers the changes and starts from the safe defaults', () => {
    expect(reviewChanges(r).map((c) => [c.n, c.hunk.kind, c.choice])).toEqual([
      [1, 'added', 'enhanced'],
      [2, 'changed', 'enhanced'],
    ])
    expect(reviewPreview(r)).toBe('# H\n\n- a\n- budget expanded with detail\n')
  })

  it('toggles one change, all changes, and ignores unchanged blocks', () => {
    const same = r.hunks.findIndex((h) => h.kind === 'same')
    expect(setChoice(r, same, 'mine')).toBe(r)
    const kept = setChoice(r, reviewChanges(r)[1]!.index, 'mine')
    expect(reviewPreview(kept)).toBe('# H\n\n- a\n- budget\n')
    expect(reviewPreview(setAll(r, 'mine'))).toBe('- a\n- budget\n')
    expect(reviewPreview(setAll(setAll(r, 'mine'), 'enhanced'))).toBe(reviewPreview(r))
    expect(sideText(['- a\n', '- b\n\n'])).toBe('- a\n- b')
  })
})

describe('export', () => {
  it('names the file after the meeting and prefixes a title', () => {
    expect(exportFileName({ title: 'Q3: plan / review?', createdAt: at })).toBe('Q3 plan review.md')
    expect(exportFileName({ title: '  ', createdAt: at })).toBe('Meeting 2026-09-29.md')
    expect(exportMarkdown({ title: 'Standup', startedAt: at, createdAt: at }, '- a\n\n')).toBe(
      '# Standup\n\n2026-09-29\n\n- a\n',
    )
    expect(exportMarkdown({ title: 'Empty', startedAt: null, createdAt: at }, '')).toBe(
      '# Empty\n\n2026-09-29\n',
    )
  })
})

describe('NotesFeed: restore', () => {
  it('saves pending typing first, then restores on top of it: every version survives', async () => {
    const { feed, daemon } = await started()
    feed.edit('first draft\n')
    await feed.flush()
    feed.edit('second draft\n')
    const rev = feed.getSnapshot().revision
    await feed.restore(1)
    const s = feed.getSnapshot()
    expect(s.draft).toBe('first draft\n')
    expect(s.note).toMatchObject({ version: 3, markdown: 'first draft\n' })
    expect(s.revision).toBe(rev + 1)
    expect(daemon.versions.map((v) => [v.kind, v.markdown])).toEqual([
      ['user', 'first draft\n'],
      ['user', 'second draft\n'],
      ['restore', 'first draft\n'],
    ])
  })

  it('a restore that conflicts reloads the head and reports the error', async () => {
    const { feed, daemon } = await started()
    feed.edit('mine\n')
    await feed.flush()
    const restore = daemon.deps.restore!
    daemon.deps.restore = async (...a) => {
      // someone else saved between our flush and the restore
      daemon.append({
        kind: 'user',
        markdown: 'theirs\n',
        baseVersion: 1,
        enhancement: null,
        merge: null,
        restoredFrom: null,
      })
      return restore(...a)
    }
    const feed2 = new NotesFeed(SES, daemon.deps).start()
    await settle()
    await expect(feed2.restore(1)).rejects.toMatchObject({ code: 'conflict' })
    await settle()
    expect(feed2.getSnapshot().note.markdown).toBe('theirs\n')
    feed.dispose()
    feed2.dispose()
  })

  it('refuses without a restore dependency (the GTK window has none)', async () => {
    const d = fakeDaemon()
    const { restore: _r, ...deps } = d.deps
    const feed = new NotesFeed(SES, deps).start()
    await expect(feed.restore(1)).rejects.toThrow(/cannot restore/)
    feed.dispose()
  })
})

describe('query-cache folds', () => {
  const v = (
    version: number,
    kind: NoteVersion['kind'],
    markdown: string,
    extra: Partial<NoteVersion> = {},
  ) =>
    ({
      sessionId: SES,
      version,
      kind,
      markdown,
      baseVersion: version - 1,
      createdAt: at,
      enhancement: null,
      merge: null,
      restoredFrom: null,
      ...extra,
    }) satisfies NoteVersion
  const ev = (version: NoteVersion, seq = version.version, sessionId = SES): AnyEvent => ({
    seq,
    at,
    sessionId,
    data: { type: 'note.version', version },
  })
  const empty: NotesState = {
    note: { sessionId: SES, version: 0, markdown: '', updatedAt: null, pendingEnhancement: null },
    enhanced: null,
  }

  it('moves the head, holds an enhancement for review, and a merge clears it', () => {
    let s = applyNotesEvent(empty, SES, ev(v(1, 'user', 'a\n')))
    expect(s.note).toMatchObject({ version: 1, markdown: 'a\n', pendingEnhancement: null })
    const e = v(2, 'enhanced', 'A\n')
    s = applyNotesEvent(s, SES, ev(e))
    expect(s).toMatchObject({ note: { version: 1, pendingEnhancement: 2 }, enhanced: e })
    // a user save keeps the review pending
    s = applyNotesEvent(s, SES, ev(v(3, 'user', 'ab\n')))
    expect(s).toMatchObject({ note: { version: 3, pendingEnhancement: 2 }, enhanced: e })
    s = applyNotesEvent(
      s,
      SES,
      ev(v(4, 'merge', 'A\n', { merge: { enhancedVersion: 2, choices: ['enhanced'] } })),
    )
    expect(s).toMatchObject({
      note: { version: 4, markdown: 'A\n', pendingEnhancement: null },
      enhanced: null,
    })
    s = applyNotesEvent(s, SES, ev(v(5, 'restore', 'a\n', { restoredFrom: 1 })))
    expect(s.note).toMatchObject({ version: 5, markdown: 'a\n' })
  })

  it('is idempotent, ignores other sessions and other events', () => {
    const s1 = applyNotesEvent(empty, SES, ev(v(1, 'user', 'a\n')))
    expect(applyNotesEvent(s1, SES, ev(v(1, 'user', 'a\n')))).toBe(s1)
    expect(applyNotesEvent(s1, SES, ev(v(2, 'user', 'x\n'), 2, 'ses_other'))).toBe(s1)
    const e = v(2, 'enhanced', 'A\n')
    const s2 = applyNotesEvent(s1, SES, ev(e))
    expect(applyNotesEvent(s2, SES, ev(e))).toBe(s2)
    const other: AnyEvent = { seq: 9, at, sessionId: SES, data: { type: 'session.deleted', sessionId: SES } }
    expect(applyNotesEvent(s2, SES, other)).toBe(s2)
    // a merge of an older review does not clear a newer one
    const e3 = v(3, 'enhanced', 'B\n')
    const s3 = applyNotesEvent(s2, SES, ev(e3))
    const s4 = applyNotesEvent(
      s3,
      SES,
      ev(v(4, 'merge', 'A\n', { merge: { enhancedVersion: 2, choices: ['enhanced'] } })),
    )
    expect(s4).toMatchObject({ note: { version: 4, pendingEnhancement: 3 }, enhanced: e3 })
  })

  it('appends versions to a history in order, once', () => {
    const a = v(1, 'user', 'a\n')
    const b = v(2, 'enhanced', 'A\n')
    let h = applyVersionEvent([], SES, ev(b))
    h = applyVersionEvent(h, SES, ev(a))
    expect(h.map((x) => x.version)).toEqual([1, 2])
    expect(applyVersionEvent(h, SES, ev(a))).toBe(h)
    expect(applyVersionEvent(h, SES, ev(v(3, 'user', 'z'), 3, 'ses_other'))).toBe(h)
  })
})

describe('enhanceProblem', () => {
  it('tells a refusal, a quota problem and a missing provider apart', () => {
    expect(
      enhanceProblem({
        code: 'unavailable',
        message: 'the model declined to enhance these notes; your notes are unchanged',
      }),
    ).toBe('refused')
    expect(
      enhanceProblem({ code: 'unavailable', message: 'the provider is rate-limiting requests (429)' }),
    ).toBe('quota')
    expect(
      enhanceProblem({
        code: 'unavailable',
        message: 'the anthropic provider is not ready (is an API key configured?)',
      }),
    ).toBe('unavailable')
    expect(enhanceProblem({ code: 'internal', message: 'the model returned no notes' })).toBe('other')
  })

  it("trusts the daemon's reason over the message: busy is retry, never set-up", () => {
    const busy = { code: 'unavailable', message: 'Anthropic is busy right now. Try again in a minute.' }
    expect(enhanceProblem({ ...busy, reason: 'overloaded', action: 'retry' })).toBe('quota')
    expect(enhanceProblem({ code: 'unavailable', message: 'x', reason: 'no-credits' })).toBe('quota')
    expect(enhanceProblem({ code: 'unavailable', message: 'x', reason: 'no-provider' })).toBe('unavailable')
    expect(enhanceProblem({ code: 'unavailable', message: 'x', reason: 'refused' })).toBe('refused')
    expect(enhanceProblem({ code: 'conflict', message: 'x', reason: 'private-meeting' })).toBe('other')
  })
})
