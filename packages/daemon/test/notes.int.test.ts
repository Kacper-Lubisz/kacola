import {
  defaultChoices,
  diffNoteBlocks,
  type EnhanceStreamEvent,
  enhanceEvents,
  GnomeolaApiError,
  type GnomeolaClient,
  mergeNoteBlocks,
} from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { durable, readEvents } from './helpers.ts'

// N-1 … N-5 through the real daemon process (fake capture + the fake enhancement engine): optimistic
// concurrency on the wire, enhancement streaming into a pending version, merge/restore, templates,
// action items, privacy, and failures that must leave the notes untouched.

async function status(p: Promise<unknown>): Promise<number> {
  try {
    await p
    return 200
  } catch (err) {
    if (err instanceof GnomeolaApiError) return err.status
    throw err
  }
}

async function record(c: GnomeolaClient, title: string, priv = false) {
  const s = await c.call('createSession', { body: { title, private: priv } })
  await c.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () =>
      (await c.call('getTranscript', { params: { id: s.id }, query: { includePrivate: true } })).total >= 3,
    10_000,
  )
  await c.call('stopSession', { params: { id: s.id } })
  return s
}

async function enhanceAll(c: GnomeolaClient, id: string, body: Record<string, unknown> = {}) {
  const events: EnhanceStreamEvent[] = []
  for await (const e of enhanceEvents(c.stream('enhanceNotes', { params: { id }, body }))) events.push(e)
  return events
}

describe('notes through the real daemon', () => {
  let d: DaemonHandle
  let c: GnomeolaClient
  let s: { id: string }
  let priv: { id: string }

  beforeAll(async () => {
    d = await startDaemon({
      env: {
        GNOMEOLA_FAKE_QA: '1',
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 60, finalizeAfterMs: 30 }),
      },
    })
    c = d.client
    s = await record(c, 'Daily standup')
    priv = await record(c, 'Private one-to-one', true)
  }, 60_000)
  afterAll(async () => {
    await d?.stop()
  })

  it('autosaves with optimistic concurrency: a stale base is a 409 and writes nothing', async () => {
    const params = { id: s.id }
    expect((await c.call('getNotes', { params })).note).toMatchObject({ version: 0, markdown: '' })
    const v1 = await c.call('putNotes', { params, body: { markdown: '- retry budget?\n', baseVersion: 0 } })
    expect(v1.version).toBe(1)
    const v2 = await c.call('putNotes', {
      params,
      body: { markdown: '- retry budget?\n- Ana dashboard\n', baseVersion: 1 },
    })
    expect(v2.version).toBe(2)
    expect(await status(c.call('putNotes', { params, body: { markdown: 'stale', baseVersion: 1 } }))).toBe(
      409,
    )
    expect((await c.call('getNotes', { params })).note.markdown).toBe('- retry budget?\n- Ana dashboard\n')
    // unchanged text: no new version
    expect(
      (await c.call('putNotes', { params, body: { markdown: v2.markdown, baseVersion: 2 } })).version,
    ).toBe(2)
  })

  it('suggests a template from the title, and prefers the calendar event title when given', async () => {
    const a = await c.call('listTemplates', { query: { sessionId: s.id } })
    expect(a.suggested).toEqual({
      templateId: 'standup',
      reason: 'keyword',
      matched: { keyword: 'standup', source: 'session' },
    })
    expect(a.templates.map((t) => t.id)).toEqual(['general', 'standup', 'one-on-one', 'interview'])
    const b = await c.call('listTemplates', {
      query: { sessionId: s.id, calendarTitle: 'Interview: Jo Bloggs' },
    })
    expect(b.suggested.templateId).toBe('interview')
    expect((await c.call('listTemplates', { query: {} })).suggested.templateId).toBe('general')
  })

  it('streams an enhancement into a pending version beside the notes, never over them', async () => {
    const events = await enhanceAll(c, s.id)
    expect(events[0]).toEqual({ type: 'started', templateId: 'standup', baseVersion: 2 })
    expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(3)
    const done = events.at(-1)
    if (done?.type !== 'done') throw new Error(`no done event: ${JSON.stringify(done)}`)
    expect(done.version).toMatchObject({ version: 3, kind: 'enhanced', baseVersion: 2 })
    expect(done.version.enhancement).toMatchObject({ templateId: 'standup', model: 'fake-enhance' })
    expect(done.version.enhancement!.citations).toHaveLength(1)
    const deltas = events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('')
    expect(deltas).toBe(done.version.markdown)
    const state = await c.call('getNotes', { params: { id: s.id } })
    expect(state.note).toMatchObject({
      version: 2,
      markdown: '- retry budget?\n- Ana dashboard\n',
      pendingEnhancement: 3,
    })
    expect(state.enhanced?.version).toBe(3)
  })

  it('merges a review with one choice per hunk; a wrong count is a 400, a stale head a 409', async () => {
    const params = { id: s.id }
    const { note, enhanced } = await c.call('getNotes', { params })
    const hunks = diffNoteBlocks(note.markdown, enhanced!.markdown)
    const body = { enhancedVersion: enhanced!.version, baseVersion: note.version }
    expect(await status(c.call('mergeNotes', { params, body: { ...body, choices: [] } }))).toBe(400)
    expect(
      await status(
        c.call('mergeNotes', { params, body: { ...body, baseVersion: 1, choices: defaultChoices(hunks) } }),
      ),
    ).toBe(409)
    const choices = defaultChoices(hunks)
    const merged = await c.call('mergeNotes', { params, body: { ...body, choices } })
    expect(merged).toMatchObject({
      version: 4,
      markdown: mergeNoteBlocks(hunks, choices),
      pendingEnhancement: null,
    })
    // the user's lines survive the (fake) enhancement verbatim
    expect(merged.markdown).toContain('- retry budget?\n')
    expect(merged.markdown).toContain('- Ana dashboard\n')
  })

  it('extracts action items from any version and restores an old version as a new head', async () => {
    const params = { id: s.id }
    const items = await c.call('getActionItems', { params })
    expect(items).toEqual({
      version: 4,
      items: [{ text: 'Share these Standup notes', owner: 'me', due: null, done: false }],
    })
    expect((await c.call('getActionItems', { params, query: { version: 1 } })).items).toEqual([])
    expect(await status(c.call('getActionItems', { params, query: { version: 99 } }))).toBe(404)
    const r = await c.call('restoreNoteVersion', {
      params: { id: s.id, version: '2' },
      body: { baseVersion: 4 },
    })
    expect(r).toMatchObject({ version: 5, markdown: '- retry budget?\n- Ana dashboard\n' })
    expect(
      await status(
        c.call('restoreNoteVersion', { params: { id: s.id, version: 'x' }, body: { baseVersion: 5 } }),
      ),
    ).toBe(400)
    const { versions } = await c.call('listNoteVersions', { params })
    expect(versions.map((v) => v.kind)).toEqual(['user', 'user', 'enhanced', 'merge', 'restore'])
  })

  it('a refusal or an engine failure stores nothing and says the notes are unchanged', async () => {
    const t = await record(c, 'Planning')
    const params = { id: t.id }
    await c.call('putNotes', { params, body: { markdown: 'please REFUSE this\n', baseVersion: 0 } })
    const refused = await enhanceAll(c, t.id)
    expect(refused.at(-1)).toEqual({
      type: 'error',
      error: {
        code: 'unavailable',
        message: 'The model declined to enhance these notes. Your notes are unchanged.',
        reason: 'refused',
        action: 'none',
      },
    })
    await c.call('putNotes', { params, body: { markdown: 'this will FAIL\n', baseVersion: 1 } })
    const failed = await enhanceAll(c, t.id, { templateId: 'general' })
    expect(failed.at(-1)).toMatchObject({ type: 'error', error: { code: 'unavailable' } })
    const { versions } = await c.call('listNoteVersions', { params })
    expect(versions.map((v) => v.kind)).toEqual(['user', 'user'])
    expect((await c.call('getNotes', { params })).note.pendingEnhancement).toBeNull()
  })

  it('refuses before streaming: unknown template, empty session, unknown session', async () => {
    expect(await status(enhanceAll(c, s.id, { templateId: 'nope' }))).toBe(404)
    const empty = await c.call('createSession', { body: { title: 'empty' } })
    expect(await status(enhanceAll(c, empty.id))).toBe(400)
    expect(await status(enhanceAll(c, 'ses_000000000000000000000'))).toBe(404)
  })

  it('keeps private notes out of reads without includePrivate', async () => {
    const params = { id: priv.id }
    await c.call('putNotes', { params, body: { markdown: 'compensation talk\n', baseVersion: 0 } })
    expect(await status(c.call('getNotes', { params }))).toBe(404)
    expect(await status(c.call('listNoteVersions', { params }))).toBe(404)
    expect(await status(c.call('getActionItems', { params }))).toBe(404)
    expect(await status(c.call('listTemplates', { query: { sessionId: priv.id } }))).toBe(404)
    expect(await status(enhanceAll(c, priv.id))).toBe(404)
    expect((await c.call('getNotes', { params, query: { includePrivate: true } })).note.markdown).toBe(
      'compensation talk\n',
    )
    // private means never sent to the cloud: a typed 409 with the default (cloud) provider…
    const refused = await enhanceAll(c, priv.id, { includePrivate: true }).catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(GnomeolaApiError)
    expect((refused as GnomeolaApiError).status).toBe(409)
    expect((refused as GnomeolaApiError).detail.reason).toBe('private-meeting')
    // …and allowed with Ollama on this computer
    await c.call('updateSettings', { body: { llm: { provider: 'ollama' } } })
    try {
      const events = await enhanceAll(c, priv.id, { includePrivate: true })
      expect(events.at(-1)?.type).toBe('done')
    } finally {
      await c.call('updateSettings', { body: { llm: { provider: 'anthropic' } } })
    }
  })

  it('custom templates: built-ins are protected, custom ones win the keyword match', async () => {
    expect(
      await status(
        c.call('putTemplate', { params: { id: 'standup' }, body: { name: 'x', keywords: [], body: 'x' } }),
      ),
    ).toBe(409)
    expect(await status(c.call('deleteTemplate', { params: { id: 'general' } }))).toBe(409)
    expect(await status(c.call('deleteTemplate', { params: { id: 'nope' } }))).toBe(404)
    expect(
      await status(
        c.call('putTemplate', { params: { id: 'Bad Id' }, body: { name: 'x', keywords: [], body: 'x' } }),
      ),
    ).toBe(400)
    await c.call('putTemplate', {
      params: { id: 'team-daily' },
      body: { name: 'Team daily', keywords: ['daily'], body: '## Yesterday\n## Today' },
    })
    expect((await c.call('listTemplates', { query: { sessionId: s.id } })).suggested.templateId).toBe(
      'team-daily',
    )
    await c.call('deleteTemplate', { params: { id: 'team-daily' } })
    expect((await c.call('listTemplates', { query: { sessionId: s.id } })).suggested.templateId).toBe(
      'standup',
    )
  })

  it('every notes change is a durable event on a gap-free log', async () => {
    const health = await c.call('health')
    const events = durable(await readEvents(c, { since: 0, untilSeq: health.lastSeq }))
    assertNoViolations(checkEventLog(events))
    const types = new Set(events.map((e) => e.data.type))
    for (const t of ['note.version', 'template.upserted', 'template.deleted']) expect(types).toContain(t)
    // deleting the session takes its notes with it
    await c.call('deleteSession', { params: { id: s.id } })
    expect(await status(c.call('getNotes', { params: { id: s.id } }))).toBe(404)
  })
})
