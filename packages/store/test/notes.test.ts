import {
  defaultChoices,
  diffNoteBlocks,
  type Enhancement,
  type MergeChoice,
  mergeNoteBlocks,
  type NoteVersion,
} from '@kacola/protocol'
import { pick, randInt, seededRandom } from '@kacola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@kacola/testkit/invariants'
import { describe, expect, it } from 'vitest'
import { NoteStore, Store, StoreError } from '../src/index.ts'

// N-1 / V-7 — notes persistence: optimistic concurrency, enhancement beside the head, merges computed
// in the transaction, replay == state, and the invariant that matters most: every version the user ever
// saved stays recoverable, byte for byte, whatever happens afterwards.

function clock(start = Date.parse('2026-09-01T09:00:00.000Z')) {
  let t = start
  return () => {
    t += 1000
    return new Date(t)
  }
}

const ENH: Enhancement = {
  templateId: 'general',
  model: 'claude-opus-5',
  usage: null,
  stopReason: 'end_turn',
  citations: [],
}

function world() {
  const now = clock()
  const store = Store.open(':memory:', { now })
  const notes = new NoteStore(store)
  const s = store.createSession({ title: 'Platform standup' })
  return { store, notes, id: s.id, now }
}

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e instanceof StoreError ? e.code : String(e)
  }
  return 'ok'
}

describe('put: autosave with optimistic concurrency', () => {
  it('starts empty, appends a version per change, and moves the head', () => {
    const { notes, id, store } = world()
    expect(notes.get(id)).toEqual({
      sessionId: id,
      version: 0,
      markdown: '',
      updatedAt: null,
      pendingEnhancement: null,
    })
    const a = notes.put(id, '- retry budget?\n', 0)
    expect(a).toMatchObject({ version: 1, markdown: '- retry budget?\n', pendingEnhancement: null })
    expect(a.updatedAt).not.toBeNull()
    const b = notes.put(id, '- retry budget?\n- Ana dashboard\n', 1)
    expect(b.version).toBe(2)
    expect(notes.versions(id).map((v) => [v.version, v.kind, v.baseVersion])).toEqual([
      [1, 'user', 0],
      [2, 'user', 1],
    ])
    expect(
      store
        .eventsAfter(0)
        .filter((e) => e.data.type === 'note.version')
        .map((e) => e.sessionId),
    ).toEqual([id, id])
  })

  it('refuses a stale base version with a conflict and writes nothing', () => {
    const { notes, id, store } = world()
    notes.put(id, 'one\n', 0)
    notes.put(id, 'two\n', 1)
    const before = store.dump()
    const seq = store.lastSeq()
    expect(code(() => notes.put(id, 'from a stale editor\n', 1))).toBe('conflict')
    expect(store.dump()).toBe(before)
    expect(store.lastSeq()).toBe(seq)
  })

  it('writes nothing when the text did not change', () => {
    const { notes, id, store } = world()
    notes.put(id, 'same\n', 0)
    const seq = store.lastSeq()
    expect(notes.put(id, 'same\n', 1).version).toBe(1)
    expect(store.lastSeq()).toBe(seq)
  })

  it('refuses notes for a session that does not exist', () => {
    const { notes } = world()
    expect(code(() => notes.put('ses_nope', 'x', 0))).toBe('not_found')
  })
})

describe('enhancement: beside the head, reviewed block by block', () => {
  const mine = '- retry budget?\n- Ana dashboard\n'
  const enhanced =
    '## Decisions\n\n- Retry budget: three attempts [1]\n\n## Action items\n\n- [ ] Update the dashboard — owner: Ana\n'

  it('an enhanced version never replaces the head; it waits as pending', () => {
    const { notes, id } = world()
    notes.put(id, mine, 0)
    const v = notes.addEnhanced(id, enhanced, 1, ENH)
    expect(v).toMatchObject({ version: 2, kind: 'enhanced', baseVersion: 1, enhancement: ENH })
    expect(notes.get(id)).toMatchObject({ version: 1, markdown: mine, pendingEnhancement: 2 })
  })

  it('merge applies one choice per hunk against the head, and clears the pending review', () => {
    const { notes, id } = world()
    notes.put(id, mine, 0)
    notes.addEnhanced(id, enhanced, 1, ENH)
    const hunks = diffNoteBlocks(mine, enhanced)
    const choices: MergeChoice[] = hunks.map((_h, i) => (i === hunks.length - 1 ? 'mine' : 'enhanced'))
    const merged = notes.merge(id, 2, 1, choices)
    expect(merged).toMatchObject({
      version: 3,
      markdown: mergeNoteBlocks(hunks, choices),
      pendingEnhancement: null,
    })
    expect(notes.version(id, 3)).toMatchObject({ kind: 'merge', merge: { enhancedVersion: 2, choices } })
    // the user's original and the enhanced text are both still there, untouched
    expect(notes.version(id, 1)!.markdown).toBe(mine)
    expect(notes.version(id, 2)!.markdown).toBe(enhanced)
  })

  it('refuses a merge against a stale head, of a non-pending version, or with the wrong number of choices', () => {
    const { notes, id, store } = world()
    notes.put(id, mine, 0)
    notes.addEnhanced(id, enhanced, 1, ENH)
    const n = diffNoteBlocks(mine, enhanced).length
    const before = store.dump()
    expect(code(() => notes.merge(id, 2, 0, Array(n).fill('mine')))).toBe('conflict')
    expect(code(() => notes.merge(id, 1, 1, Array(n).fill('mine')))).toBe('not_found')
    expect(code(() => notes.merge(id, 2, 1, Array(n + 1).fill('mine')))).toBe('bad_request')
    expect(store.dump()).toBe(before)
    // the user kept typing during enhancement: the review is against the new head
    notes.put(id, `${mine}- one more line\n`, 1)
    expect(code(() => notes.merge(id, 2, 1, Array(n).fill('mine')))).toBe('conflict')
    const hunks = diffNoteBlocks(`${mine}- one more line\n`, enhanced)
    expect(notes.merge(id, 2, 3, defaultChoices(hunks)).markdown).toContain('- one more line')
    // once merged, the same enhancement cannot be merged twice
    expect(code(() => notes.merge(id, 2, 4, defaultChoices(hunks)))).toBe('conflict')
  })

  it('restore brings an old version back as a new head', () => {
    const { notes, id } = world()
    notes.put(id, 'original words\n', 0)
    notes.put(id, 'rewritten\n', 1)
    const r = notes.restore(id, 1, 2)
    expect(r).toMatchObject({ version: 3, markdown: 'original words\n' })
    expect(notes.version(id, 3)).toMatchObject({ kind: 'restore', restoredFrom: 1 })
    expect(code(() => notes.restore(id, 9, 3))).toBe('not_found')
    expect(code(() => notes.restore(id, 1, 2))).toBe('conflict')
  })

  it('notes go when their session is deleted', () => {
    const { notes, id, store } = world()
    notes.put(id, 'x\n', 0)
    notes.addEnhanced(id, 'y\n', 1, ENH)
    store.deleteSession(id)
    expect(notes.versions(id)).toEqual([])
    expect(notes.get(id).version).toBe(0)
  })
})

describe('templates', () => {
  it('upserts and deletes custom templates as durable events', () => {
    const { notes, store } = world()
    notes.putTemplate({
      id: 'retro',
      name: 'Retro',
      builtIn: true,
      keywords: ['retro'],
      body: '## Went well',
    })
    notes.putTemplate({
      id: 'retro',
      name: 'Retrospective',
      builtIn: false,
      keywords: ['retro'],
      body: '## Went well',
    })
    expect(notes.templates()).toEqual([
      { id: 'retro', name: 'Retrospective', builtIn: false, keywords: ['retro'], body: '## Went well' },
    ])
    notes.deleteTemplate('retro')
    expect(notes.templates()).toEqual([])
    expect(code(() => notes.deleteTemplate('retro'))).toBe('not_found')
    expect(
      store
        .eventsAfter(0)
        .map((e) => e.data.type)
        .filter((t) => t.startsWith('template')),
    ).toEqual(['template.upserted', 'template.upserted', 'template.deleted'])
  })
})

/** Random notes operations, as a user, an enhancer and a reviewer would interleave them. */
function randomHistory(seed: number, steps = 150) {
  const rnd = seededRandom(seed)
  const now = clock()
  const store = Store.open(':memory:', { now })
  const notes = new NoteStore(store)
  const sessions = [store.createSession({ title: 'A' }).id, store.createSession({ title: 'B' }).id]
  const lines = [
    '- retry budget',
    '- Ana owns dashboard',
    '## Decisions',
    'a paragraph of my own words',
    '1. first',
  ]
  /** Every user version ever written: [session, version, markdown]. */
  const saved: [string, number, string][] = []
  for (let i = 0; i < steps; i++) {
    const id = pick(rnd, sessions)
    const head = notes.get(id)
    const op = randInt(rnd, 0, 9)
    try {
      if (op <= 4) {
        const text = `${head.markdown}${pick(rnd, lines)} ${i}\n${rnd() < 0.3 ? '\n' : ''}`
        const base = rnd() < 0.1 ? head.version + 1 : head.version // sometimes stale: must conflict
        const n = notes.put(id, text, base)
        if (n.version !== head.version) saved.push([id, n.version, text])
      } else if (op <= 6) {
        const enh = `## Summary\n\n${head.markdown.split('\n').reverse().join('\n')}\n- [ ] follow up ${i}\n`
        notes.addEnhanced(id, enh, head.version, ENH)
      } else if (op <= 8 && head.pendingEnhancement) {
        const e = notes.version(id, head.pendingEnhancement)!
        const hunks = diffNoteBlocks(head.markdown, e.markdown)
        notes.merge(
          id,
          e.version,
          head.version,
          hunks.map(() => (rnd() < 0.5 ? 'mine' : 'enhanced')),
        )
      } else if (head.version > 1) {
        notes.restore(id, randInt(rnd, 1, head.version), head.version)
      }
      if (rnd() < 0.05)
        notes.putTemplate({ id: `t${i % 3}`, name: `T ${i}`, builtIn: false, keywords: [`k${i}`], body: 'b' })
    } catch (err) {
      if (!(err instanceof StoreError)) throw err
    }
  }
  return { store, notes, sessions, saved }
}

describe('replay == state (notes events)', () => {
  it.each([1, 2, 3, 4, 5])('seed %i: a replayed log reproduces every notes table byte for byte', (seed) => {
    const { store } = randomHistory(seed)
    const events = store.eventsAfter(0)
    expect(events.some((e) => e.data.type === 'note.version')).toBe(true)
    assertNoViolations(checkEventLog(events))
    const copy = Store.open(':memory:')
    copy.replay(events, 17)
    expect(copy.dump()).toBe(store.dump())
    expect(copy.dump()).toMatch(/note_versions/)
  })
})

describe('V-7: your own words are never lost or silently rewritten', () => {
  it.each([11, 12, 13, 14, 15, 16, 17, 18])(
    'seed %i: every version the user saved is recoverable, verbatim',
    (seed) => {
      const { notes, saved } = randomHistory(seed, 250)
      expect(saved.length).toBeGreaterThan(10)
      for (const [id, version, text] of saved) {
        const v = notes.version(id, version)
        expect(v?.kind).toBe('user')
        expect(v?.markdown).toBe(text)
      }
    },
  )

  it('history is append-only: every earlier version is unchanged after any later operation', () => {
    const rnd = seededRandom(99)
    const { store, notes, sessions } = randomHistory(99, 20)
    let snapshot = new Map<string, NoteVersion[]>(sessions.map((id) => [id, notes.versions(id)]))
    for (let i = 0; i < 200; i++) {
      const id = pick(rnd, sessions)
      const head = notes.get(id)
      try {
        if (rnd() < 0.6) notes.put(id, `${head.markdown}line ${i}\n`, head.version)
        else if (head.pendingEnhancement) {
          const e = notes.version(id, head.pendingEnhancement)!
          notes.merge(
            id,
            e.version,
            head.version,
            diffNoteBlocks(head.markdown, e.markdown).map(() => 'enhanced'),
          )
        } else notes.addEnhanced(id, `# rewritten ${i}\n`, head.version, ENH)
      } catch (err) {
        if (!(err instanceof StoreError)) throw err
      }
      for (const sid of sessions) {
        const now = notes.versions(sid)
        const before = snapshot.get(sid)!
        expect(now.slice(0, before.length)).toEqual(before)
      }
      snapshot = new Map(sessions.map((sid) => [sid, notes.versions(sid)]))
    }
    expect(store.lastSeq()).toBeGreaterThan(100)
  })

  it('a merge that accepts everything still leaves the original user text in history', () => {
    const { notes, id } = world()
    const mine = 'my exact words, typos and all: teh retry budgt\n'
    notes.put(id, mine, 0)
    notes.addEnhanced(id, '## Summary\n\nThe retry budget was discussed.\n', 1, ENH)
    const hunks = diffNoteBlocks(mine, notes.version(id, 2)!.markdown)
    const merged = notes.merge(
      id,
      2,
      1,
      hunks.map(() => 'enhanced'),
    )
    expect(merged.markdown).not.toContain('teh retry budgt')
    expect(notes.versions(id).find((v) => v.kind === 'user')!.markdown).toBe(mine)
  })
})
