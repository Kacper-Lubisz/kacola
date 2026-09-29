import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultChoices,
  diffNoteBlocks,
  isChoice,
  type MergeChoice,
  mergeNoteBlocks,
  type NoteVersion,
} from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { type AppHandle, type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'
import {
  APP,
  buildUi,
  capture,
  launchUi,
  logTail,
  markOnboarded,
  unnamedInteractive,
  waitForWindow,
} from '../src/ui.ts'

// V-7 / N-1…N-5 in the real window: type notes with the real keyboard into the GtkSourceView editor,
// watch them autosave, enhance them through the real daemon + @gnomeola/llm + SDK against a replayed
// Anthropic stream, accept some blocks and revert others in the review, apply — and then prove from the
// daemon's stored versions that the merge is exactly what was chosen and that every word typed is still
// recoverable. Plus export (clipboard and file), action items, a refusal, and leaving mid-typing.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const KEY = 'sk-ant-e2e-ui-notes-key-000111222333'
/** What the user types: a line the enhancement will rewrite (typos and all), two it keeps verbatim. */
const TYPED = '- retry budgt three attmpts\n- migration thursday\n- Ana dashboard\n'

async function openTab(d: HeadlessDisplay, name: 'Transcript' | 'Notes' | 'Ask' | 'Details') {
  const tab = await d.findOne({ app: APP, role: 'page tab', name, states: ['showing'] })
  await d.click(tab)
  await d.waitFor(async () => (await d.describe(tab)).states.includes('selected'), 5000, `the ${name} tab`)
}

async function openSession(d: HeadlessDisplay, title: string) {
  await d.click(await d.findOne({ app: APP, role: 'list item', name: title }))
  await d.findOne({ app: APP, role: 'heading', name: title })
}

const editor = (d: HeadlessDisplay) =>
  d.findOne({ app: APP, role: 'text', name: 'Notes', states: ['showing'] })
const editorText = async (d: HeadlessDisplay) => (await d.describe(await editor(d))).text ?? ''

describe('Notes in the real window: type, enhance, review, apply', () => {
  let d: HeadlessDisplay
  let daemon: DaemonHandle
  let api: FakeAnthropic
  let app: AppHandle
  let dataDir: string

  const versions = async (id: string): Promise<NoteVersion[]> =>
    (await daemon.client.call('listNoteVersions', { params: { id }, query: { includePrivate: true } }))
      .versions
  const head = async (id: string) =>
    (await daemon.client.call('getNotes', { params: { id }, query: { includePrivate: true } })).note

  beforeAll(async () => {
    buildUi()
    api = await startFakeAnthropic({ eventDelayMs: 120 })
    dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-notes-'))
    seedMeetings(dataDir)
    daemon = await startDaemon({ dataDir, env: { ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: api.url } })
    d = await startHeadlessDisplay({ size: '1280x800' })
    markOnboarded(d)
    app = launchUi(d, { GNOMEOLA_URL: daemon.baseUrl })
    await waitForWindow(d, app)
  })

  afterEach(() => {
    if (app?.hasExited()) throw new Error(`gnomeola exited:\n${logTail(app)}`)
  })

  afterAll(async () => {
    await d?.close()
    await daemon?.stop()
    await api?.close()
    if (dataDir) rmSync(dataDir, { recursive: true, force: true })
  })

  it('types notes into the markdown editor and autosaves them as a version', async () => {
    await openSession(d, 'Sprint retro')
    await openTab(d, 'Notes')
    const ed = await editor(d)
    expect(await editorText(d)).toBe('')
    await d.focus(ed)
    await d.typeText(TYPED)
    await d.waitFor(async () => (await head(SEED.retro)).markdown === TYPED, 10_000, 'the typed notes saved')
    await d.findOne({ app: APP, role: 'label', name: 'Saved', states: ['showing'] }, 5000)
    // the editor is a GtkSourceView (markdown highlighting) exposed as an ordinary named text
    expect(await editorText(d)).toBe(TYPED)
    const vs = await versions(SEED.retro)
    expect(vs.every((v) => v.kind === 'user')).toBe(true)
    expect(vs.at(-1)!.markdown).toBe(TYPED)
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'notes-typed')
  })

  it('enhances through the real LLM chain, streaming, without touching the notes', async () => {
    api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    const before = await head(SEED.retro)
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Enhance Notes', states: ['showing'] }))
    await d.findOne({ app: APP, name: 'Enhancing', states: ['showing'] }, 10_000)
    await capture(d, 'notes-enhancing')
    await d.findOne({ app: APP, role: 'heading', name: 'Review Enhanced Notes', states: ['showing'] }, 20_000)
    // the request: effort high, the typed notes last, the key from the environment
    const req = api.seen.at(-1)!
    expect(req.headers['x-api-key']).toBe(KEY)
    const body = req.body as {
      output_config: { effort: string }
      messages: { content: { text: string }[] }[]
    }
    expect(body.output_config.effort).toBe('high')
    expect(body.messages[0]!.content.at(-1)!.text).toContain(`<my_notes>\n${TYPED.trimEnd()}\n</my_notes>`)
    // stored beside the head, never over it
    const after = await head(SEED.retro)
    expect(after).toMatchObject({ version: before.version, markdown: TYPED })
    expect(after.pendingEnhancement).not.toBeNull()
    const enhanced = (await versions(SEED.retro)).find((v) => v.version === after.pendingEnhancement)!
    expect(enhanced.kind).toBe('enhanced')
    expect(enhanced.enhancement?.templateId).toBe('general')
    expect(await unnamedInteractive(d)).toEqual([])
    await capture(d, 'notes-review')
  })

  it('accepts some blocks, reverts others, applies — and the stored merge is exactly that', async () => {
    const note = await head(SEED.retro)
    const enhanced = (await versions(SEED.retro)).find((v) => v.version === note.pendingEnhancement)!
    const hunks = diffNoteBlocks(note.markdown, enhanced.markdown)
    const changes = hunks.map((h, i) => ({ h, i })).filter((x) => isChoice(x.h))
    expect(changes.length).toBeGreaterThanOrEqual(4)
    // the typo'd line is offered as rewritten, the verbatim lines are unchanged context
    expect(changes.some((c) => c.h.kind === 'changed')).toBe(true)
    // revert the rewrite of the user's own line and the first addition; accept everything else
    const choices: MergeChoice[] = defaultChoices(hunks)
    const revert = [changes.find((c) => c.h.kind === 'changed')!, changes.find((c) => c.h.kind === 'added')!]
    for (const r of revert) {
      const n = changes.indexOf(r) + 1
      const sw = await d.findOne({
        app: APP,
        role: 'switch',
        name: `Use enhanced text for change ${n}`,
        states: ['showing'],
      })
      expect((await d.describe(sw)).states).toContain('checked')
      await d.click(sw)
      await d.waitFor(
        async () => !(await d.describe(sw)).states.includes('checked'),
        5000,
        `change ${n} reverted`,
      )
      choices[r.i] = 'mine'
    }
    // toggle one more on and off again: a round trip leaves its choice where it was
    const last = changes.length
    const sw = await d.findOne({
      app: APP,
      role: 'switch',
      name: `Use enhanced text for change ${last}`,
      states: ['showing'],
    })
    await d.click(sw)
    await d.waitFor(async () => !(await d.describe(sw)).states.includes('checked'), 5000, 'toggled off')
    await d.click(sw)
    await d.waitFor(async () => (await d.describe(sw)).states.includes('checked'), 5000, 'toggled back on')
    await capture(d, 'notes-review-choices')

    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Apply', states: ['showing'] }))
    const merged = await d.waitFor(
      async () => (await versions(SEED.retro)).find((v) => v.kind === 'merge'),
      10_000,
      'the merge version',
    )
    expect(merged.merge).toEqual({ enhancedVersion: enhanced.version, choices })
    expect(merged.markdown).toBe(mergeNoteBlocks(hunks, choices))
    // the reverted rewrite kept the user's words, typos included
    expect(merged.markdown).toContain('- retry budgt three attmpts\n')
    const now = await head(SEED.retro)
    expect(now).toMatchObject({
      version: merged.version,
      markdown: merged.markdown,
      pendingEnhancement: null,
    })
    // the editor shows the merged notes
    await d.waitFor(
      async () => (await editorText(d)) === merged.markdown,
      10_000,
      'the editor to show the merge',
    )
    await capture(d, 'notes-merged')
  })

  it('never lost a word: every version is still there, the typed text verbatim', async () => {
    const vs = await versions(SEED.retro)
    expect(vs.map((v) => v.kind)).toEqual([
      ...vs.filter((v) => v.kind === 'user').map(() => 'user'),
      'enhanced',
      'merge',
    ])
    expect(vs.filter((v) => v.kind === 'user').at(-1)!.markdown).toBe(TYPED)
    // and each autosave was a prefix of what was being typed, so every intermediate state is kept too
    for (const v of vs.filter((x) => x.kind === 'user')) expect(TYPED.startsWith(v.markdown)).toBe(true)
  })

  it('lists the action items the notes contain, with owners', async () => {
    const list = await d.findOne({ app: APP, role: 'list', name: 'Action items', states: ['showing'] }, 5000)
    const rows = (await d.describe(list, true)).children ?? []
    expect(rows.map((r) => r.name)).toEqual([
      'Add an alert on the dead-letter queue',
      'Share the new dashboard link',
    ])
    const items = await daemon.client.call('getActionItems', { params: { id: SEED.retro } })
    expect(items.items.map((i) => [i.owner, i.due])).toEqual([
      ['Bruno', 'Friday'],
      ['Ana', null],
    ])
  })

  it('copies the notes to the clipboard as markdown', async () => {
    await d.click(
      await d.findOne({ app: APP, role: 'button', name: 'Copy Notes as Markdown', states: ['showing'] }),
    )
    await d.findOne({ app: APP, role: 'label', name: 'Notes copied as Markdown' }, 5000)
    const pasted = await d.waitFor(
      () => {
        try {
          return execFileSync('wl-paste', ['--no-newline'], { env: d.env, timeout: 5000 }).toString()
        } catch {
          return null
        }
      },
      10_000,
      'the clipboard contents',
    )
    const note = await head(SEED.retro)
    expect(pasted).toMatch(/^# Sprint retro\n\n\d{4}-\d{2}-\d{2}\n\n/)
    expect(`${pasted}\n`.endsWith(note.markdown) || pasted.endsWith(note.markdown)).toBe(true)
    expect(pasted).toContain('## Action items')
  })

  it('exports the notes to a markdown file through the file dialog', async () => {
    const out = join(dataDir, 'exported-notes.md')
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Export Notes', states: ['showing'] }))
    const dialog = await d.findOne({ app: APP, role: 'dialog', nameContains: 'Export Notes' }, 10_000)
    await capture(d, 'notes-export-dialog')
    const name = await d.findOne({ app: APP, role: 'text', within: dialog, states: ['showing'] }, 5000)
    await d.setText(name, out)
    await d.focus(name)
    await d.pressKeys('Return')
    await d.waitFor(() => existsSync(out), 10_000, 'the exported file')
    const note = await head(SEED.retro)
    expect(readFileSync(out, 'utf8')).toMatch(/^# Sprint retro\n\n\d{4}-\d{2}-\d{2}\n\n/)
    expect(readFileSync(out, 'utf8').endsWith(note.markdown)).toBe(true)
  })

  it('a refusal leaves the notes exactly as they were and says so', async () => {
    const before = await versions(SEED.retro)
    api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await d.click(await d.findOne({ app: APP, role: 'button', name: 'Enhance Notes', states: ['showing'] }))
    await d.findOne(
      { app: APP, role: 'label', nameContains: 'Your notes were not enhanced', states: ['showing'] },
      20_000,
    )
    expect(await versions(SEED.retro)).toEqual(before)
    expect(await editorText(d)).toBe(before.at(-1)!.markdown)
    await capture(d, 'notes-refused')
  })

  it('saves what was typed even when the session is left before the autosave fires', async () => {
    await openSession(d, 'Quarterly planning')
    await openTab(d, 'Notes')
    await d.focus(await editor(d))
    await d.typeText('left in a hurry')
    // straight to another session: the pane's unmount flushes the draft
    await openSession(d, 'Sprint retro')
    await d.waitFor(
      async () => (await head(SEED.long)).markdown === 'left in a hurry',
      10_000,
      'the flushed draft',
    )
  })
})
