import type { AnyEvent, EnhanceStreamEvent, Note, NotesState, NoteVersion } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
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
