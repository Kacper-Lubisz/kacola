import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diffNoteBlocks, mergeNoteBlocks, type NoteVersion } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop, matchBaseline } from '@kacola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@kacola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/desktop.ts'
import { loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { SEED, seedMeetings } from '../src/seed.ts'

// Phase 2C — the notes pane in the Electron window, the port of ui-notes.e2e.test.ts (the GTK / AT-SPI
// suite) with every assertion kept: type notes with the real keyboard into the CodeMirror editor, watch
// them autosave, enhance them through the real daemon + @kacola/llm + SDK against a replayed Anthropic
// stream, which REPLACES the draft (the Day redesign: no block-by-block review) — then prove from the
// daemon's stored versions that the replacement is the enhanced text, that "Back to my draft" restores
// what was typed, and that every word typed is still recoverable. Plus
// copy (read back from the clipboard), export through the save dialog (stood in for in main), action
// items, a refusal, leaving mid-typing — and what the GTK window never had: history restore and custom
// templates. axe over every state; screenshot baselines (editor, enhancing, merged) light + dark.

const CASSETTES = join(import.meta.dirname, '..', '..', 'llm', 'test', 'fixtures', 'cassettes')
const BASELINES = join(import.meta.dirname, '__screenshots__', 'desktop-notes')
const ARTIFACTS = join(import.meta.dirname, '__artifacts__', 'desktop-notes')
const KEY = 'sk-ant-e2e-desktop-notes-key-000111222'
/** What the user types: a line the enhancement will rewrite (typos and all), two it keeps verbatim. */
const TYPED = '- retry budgt three attmpts\n- migration thursday\n- Ana dashboard\n'

let display: HeadlessDisplay
let markerId = ''

beforeAll(async () => {
  buildDesktop()
  display = await startHeadlessDisplay({ size: '1280x800' })
  markOnboarded(display)
  markerId = display.env.KACOLA_HEADLESS_ID!
}, 300_000)

afterAll(async () => {
  if (!display) return
  await display.close()
  expect(markedPids(markerId)).toEqual([])
})

/** One seeded world: fake Anthropic, a daemon on a temp data dir, the window in `scheme`. */
async function world(scheme: 'light' | 'dark', extraEnv: Record<string, string> = {}) {
  const api = await startFakeAnthropic({ eventDelayMs: 120 })
  const dataDir = mkdtempSync(join(tmpdir(), `kacola-desktop-notes-${scheme}-`))
  seedMeetings(dataDir)
  const daemon = await startDaemon({ dataDir, env: { ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: api.url } })
  const app = await launchDesktop({
    display,
    env: { KACOLA_URL: daemon.baseUrl, KACOLA_COLOR_SCHEME: scheme, ...extraEnv },
  })
  await app.window.getByRole('searchbox', { name: 'Search or ask' }).waitFor({ timeout: 20_000 })
  // still frames for the baselines: the brand's reduced-motion mode stops spinners and progress sweeps
  // (Playwright's own `animations: 'disabled'` injects a <style>, which our CSP rightly refuses)
  await app.window.emulateMedia({ reducedMotion: 'reduce' })
  const close = async () => {
    await app.close()
    await daemon.stop()
    await api.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
  return { api, dataDir, daemon, app, close }
}

function helpers(getApp: () => DesktopApp, getDaemon: () => DaemonHandle, scheme: string) {
  const w = () => getApp().window
  const versions = async (id: string): Promise<NoteVersion[]> =>
    (await getDaemon().client.call('listNoteVersions', { params: { id }, query: { includePrivate: true } }))
      .versions
  const head = async (id: string) =>
    (await getDaemon().client.call('getNotes', { params: { id }, query: { includePrivate: true } })).note
  // a recorded meeting opens on its outcome page: the notes are under the outcome
  const openSession = async (title: string) => {
    const id = await waitFor(
      async () =>
        (await getDaemon().client.call('listSessions', { query: { includePrivate: true } })).sessions.find(
          (s) => s.title === title,
        )?.id,
      10_000,
      `the session ${title}`,
    )
    await w().evaluate(`location.hash = ${JSON.stringify(`#/sessions/${id}`)}`)
    await w().getByRole('heading', { level: 1, name: title }).waitFor()
    await editor().waitFor({ timeout: 10_000 })
  }
  /** A notes action from the notes' menu (history, copy, export). */
  const notesAction = async (name: string) => {
    await w().getByRole('button', { name: 'Notes actions' }).click()
    await w().getByRole('menuitem', { name }).click()
  }
  const editor = () => w().getByRole('textbox', { name: 'Notes' })
  /** The editor's document (from CodeMirror's own state: the screen draws `##` and `-` more quietly). */
  const editorText = async (): Promise<string> =>
    (await w().evaluate(`(() => {
      const content = document.querySelector('[data-notes-pane] [data-notes-editor]').shadowRoot.querySelector('.cm-content')
      return content.cmTile.root.view.state.doc.toString()
    })()`)) as string
  /** A toast in the shell's Notifications region. */
  const toast = (text: string) =>
    w().getByRole('region', { name: 'Notifications' }).getByText(text, { exact: false })
  const status = (text: string) => w().locator('[data-notes-pane] [role="status"]', { hasText: text })
  const shot = async (name: string) => {
    const file = join(ARTIFACTS, `${name}-${scheme}.png`)
    // no caret, no hover: the baseline is the state, not where the pointer or focus happens to be
    await w().evaluate('document.activeElement?.blur()')
    await w().mouse.move(0, 0)
    // the pane only: the session frame around it belongs to another screen (and shows live times)
    await w().locator('[data-notes-pane]').screenshot({ path: file, caret: 'initial' })
    const failure = matchBaseline(file, join(BASELINES, `${name}-${scheme}.png`))
    if (failure) throw new Error(failure)
  }
  const axe = async () => expect(await getApp().axe()).toEqual([])
  /** The held stream shows `text`, and nothing more arrives (the fake server is holding it). */
  const streamedUpTo = async (text: string) => {
    const soFar = w().getByRole('region', { name: 'Enhanced notes so far' })
    await waitFor(
      async () => ((await soFar.textContent()) ?? '').includes(text),
      15_000,
      `"${text}" streamed`,
    )
    let last = ''
    await waitFor(
      async () => {
        const now = (await soFar.textContent()) ?? ''
        const still = now === last
        last = now
        if (!still) await new Promise((r) => setTimeout(r, 300))
        return still
      },
      5000,
      'the held stream to settle',
    )
  }
  return {
    w,
    versions,
    head,
    openSession,
    notesAction,
    editor,
    editorText,
    status,
    toast,
    shot,
    axe,
    streamedUpTo,
  }
}

describe('Notes in the Electron window: type, enhance (replaces), back to my draft (light)', () => {
  let ctx: Awaited<ReturnType<typeof world>>
  const h = helpers(
    () => ctx.app,
    () => ctx.daemon,
    'light',
  )

  beforeAll(async () => {
    ctx = await world('light')
  }, 120_000)

  afterAll(async () => {
    await ctx?.close()
  })

  it('types notes into the markdown editor and autosaves them as a version', async () => {
    await h.openSession('Sprint retro')
    expect(await h.editorText()).toBe('')
    await h.editor().click()
    await h.w().keyboard.type(TYPED, { delay: 15 })
    await waitFor(async () => (await h.head(SEED.retro)).markdown === TYPED, 10_000, 'the typed notes saved')
    await h.status('Saved').waitFor({ timeout: 5000 })
    // typed verbatim: Enter is a bare newline (no list continuation, no auto-indent)
    expect(await h.editorText()).toBe(TYPED)
    const vs = await h.versions(SEED.retro)
    expect(vs.every((v) => v.kind === 'user')).toBe(true)
    expect(vs.at(-1)!.markdown).toBe(TYPED)
    // the editor is themed from the brand tokens: Instrument Sans body
    const font = await h
      .w()
      .evaluate(
        `getComputedStyle(document.querySelector('[data-notes-pane] [data-notes-editor]').shadowRoot.querySelector('.cm-content')).fontFamily`,
      )
    expect(font).toMatch(/Instrument Sans/)
    await h.axe()
    await h.w().mouse.move(0, 0)
    await h.shot('editor')
  })

  it('enhances through the real LLM chain, streaming with progress, then replaces the draft', async () => {
    ctx.api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    // hold the stream after the third text delta: a deterministic mid-stream state to look at
    const release = ctx.api.holdAfter(9)
    const before = await h.head(SEED.retro)
    await h.w().getByRole('button', { name: 'Enhance notes' }).click()
    await h.w().getByRole('progressbar', { name: 'Enhancing' }).waitFor({ timeout: 10_000 })
    try {
      await h.streamedUpTo('migration thursday')
      await h.w().getByText('words written so far', { exact: false }).waitFor()
      // nothing replaced while it streams
      expect(await h.head(SEED.retro)).toMatchObject({ version: before.version, markdown: TYPED })
      await h.axe()
      await h.shot('enhancing')
    } finally {
      release()
    }
    // the request: effort high, the typed notes last, the key from the environment
    const req = ctx.api.seen.at(-1)!
    expect(req.headers['x-api-key']).toBe(KEY)
    const body = req.body as {
      output_config: { effort: string }
      messages: { content: { text: string }[] }[]
    }
    expect(body.output_config.effort).toBe('high')
    expect(body.messages[0]!.content.at(-1)!.text).toContain(`<my_notes>\n${TYPED.trimEnd()}\n</my_notes>`)
    // the enhanced version is stored, then applied whole: the head is a merge taking every change
    const merged = await waitFor(
      async () => (await h.versions(SEED.retro)).find((v) => v.kind === 'merge'),
      20_000,
      'the replacement',
    )
    const enhanced = (await h.versions(SEED.retro)).find((v) => v.kind === 'enhanced')!
    expect(enhanced.enhancement?.templateId).toBe('general')
    const hunks = diffNoteBlocks(TYPED, enhanced.markdown)
    expect(merged.merge).toEqual({ enhancedVersion: enhanced.version, choices: hunks.map(() => 'enhanced') })
    expect(merged.markdown).toBe(
      mergeNoteBlocks(
        hunks,
        hunks.map(() => 'enhanced'),
      ),
    )
    expect(merged.markdown).not.toContain('retry budgt three attmpts')
    expect(await h.head(SEED.retro)).toMatchObject({
      version: merged.version,
      markdown: merged.markdown,
      pendingEnhancement: null,
    })
    await waitFor(async () => (await h.editorText()) === merged.markdown, 10_000, 'the editor to show it')
    await h.status('Tidied from your draft by your AI provider').waitFor()
    await h.w().getByRole('button', { name: 'Back to my draft' }).waitFor()
    await h.axe()
    await h.w().mouse.move(0, 0)
    await h.shot('merged')
  })

  it('never lost a word: every version is still there, the typed text verbatim', async () => {
    const vs = await h.versions(SEED.retro)
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
    // the outcome block's To do, read from the notes
    const list = h.w().getByRole('list', { name: 'Action items' })
    await list.waitFor({ timeout: 5000 })
    const rows = list.getByRole('listitem')
    expect(await rows.count()).toBe(2)
    await list.getByRole('listitem', { name: 'Add an alert on the dead-letter queue', exact: true }).waitFor()
    await list.getByRole('listitem', { name: 'Share the new dashboard link', exact: true }).waitFor()
    expect(await rows.nth(0).textContent()).toContain('Bruno · Friday')
    expect(await rows.nth(1).textContent()).toContain('Ana')
    const items = await ctx.daemon.client.call('getActionItems', { params: { id: SEED.retro } })
    expect(items.items.map((i) => [i.owner, i.due])).toEqual([
      ['Bruno', 'Friday'],
      ['Ana', null],
    ])
  })

  it('updates the action items live as the notes are typed, and the summary carries them', async () => {
    const list = h.w().getByRole('list', { name: 'Action items' })
    await h.editor().click()
    await h.w().keyboard.press('Control+End')
    await h.w().keyboard.type('- [ ] Book the retro room — owner: Carla — due: Monday\n')
    await list.getByRole('listitem', { name: 'Book the retro room', exact: true }).waitFor({ timeout: 5000 })
    expect(await list.getByRole('listitem').count()).toBe(3)
    // Share summary → Copy Summary: the action items as a task list
    await h.w().getByRole('button', { name: 'Share summary' }).click()
    const share = h.w().getByRole('dialog', { name: 'Share summary' })
    await share.getByRole('button', { name: 'Copy summary' }).click()
    await h.toast('Summary copied').waitFor({ timeout: 5000 })
    await share.waitFor({ state: 'detached' })
    const copied = await ctx.app.evaluateMain(({ clipboard }) => clipboard.readText())
    expect(copied).toContain(
      '- [ ] Add an alert on the dead-letter queue — owner: Bruno — due: Friday\n' +
        '- [ ] Share the new dashboard link — owner: Ana\n' +
        '- [ ] Book the retro room — owner: Carla — due: Monday\n',
    )
    const typed = await h.editorText()
    await waitFor(async () => (await h.head(SEED.retro)).markdown === typed, 10_000, 'the addition saved')
  })

  it('copies the notes to the clipboard as markdown', async () => {
    await h.notesAction('Copy notes as markdown')
    await h.toast('Notes copied as Markdown').waitFor({ timeout: 5000 })
    const pasted = await ctx.app.evaluateMain(({ clipboard }) => clipboard.readText())
    const note = await h.head(SEED.retro)
    expect(pasted).toMatch(/^# Sprint retro\n\n\d{4}-\d{2}-\d{2}\n\n/)
    expect(pasted.endsWith(note.markdown)).toBe(true)
    expect(pasted).toContain('## Action items')
    // and the compositor's clipboard agrees, when the window is a Wayland client wl-paste can read
    let wl: string | null = null
    try {
      wl = execFileSync('wl-paste', ['--no-newline'], { env: display.env, timeout: 5000 }).toString()
    } catch {
      wl = null // an X11 (Xwayland) client's selection is not visible to wl-paste
    }
    if (wl !== null && wl !== '') expect(wl).toBe(pasted)
  })

  it('exports the notes to a markdown file through the save dialog', async () => {
    const out = join(ctx.dataDir, 'exported-notes.md')
    // stand in for the native dialog in main (it is looked up per call): answer with `out`, record options
    await ctx.app.evaluateMain(({ dialog }, path) => {
      const g = globalThis as unknown as { saveCalls: unknown[] }
      g.saveCalls = []
      dialog.showSaveDialog = (async (...a: unknown[]) => {
        g.saveCalls.push(a.at(-1))
        return { canceled: false, filePath: path }
      }) as typeof dialog.showSaveDialog
    }, out)
    await h.notesAction('Export notes…')
    await waitFor(() => existsSync(out), 10_000, 'the exported file')
    await h.toast('Notes exported to').waitFor({ timeout: 5000 })
    const note = await h.head(SEED.retro)
    expect(readFileSync(out, 'utf8')).toMatch(/^# Sprint retro\n\n\d{4}-\d{2}-\d{2}\n\n/)
    expect(readFileSync(out, 'utf8').endsWith(note.markdown)).toBe(true)
    const calls = (await ctx.app.evaluateMain(
      () => (globalThis as unknown as { saveCalls: unknown[] }).saveCalls,
    )) as { title: string; defaultPath: string; filters: { extensions: string[] }[] }[]
    expect(calls).toHaveLength(1)
    expect(calls[0]!.title).toBe('Export notes')
    expect(calls[0]!.defaultPath).toMatch(/[/\\]Sprint retro\.md$/)
    expect(calls[0]!.filters[0]!.extensions).toEqual(['md'])
  })

  it('dismissing the save dialog writes nothing and says nothing', async () => {
    await h.toast('Notes exported to').waitFor({ state: 'detached', timeout: 10_000 })
    await ctx.app.evaluateMain(({ dialog }) => {
      dialog.showSaveDialog = (async () => ({ canceled: true, filePath: '' })) as typeof dialog.showSaveDialog
    })
    await h.notesAction('Export notes…')
    await new Promise((r) => setTimeout(r, 500))
    expect(await h.toast('Notes exported to').count()).toBe(0)
  })

  it('a refusal leaves the notes exactly as they were and says so', async () => {
    const before = await h.versions(SEED.retro)
    ctx.api.enqueue(...loadCassette(join(CASSETTES, 'refusal.json')))
    await h.w().getByRole('button', { name: 'Enhance notes' }).click()
    const alert = h.w().getByRole('status', { name: /Your notes were not changed/ })
    await alert.waitFor({ timeout: 20_000 })
    expect(await alert.textContent()).toMatch(/notes were not changed/)
    expect(await h.versions(SEED.retro)).toEqual(before)
    expect(await h.editorText()).toBe(before.at(-1)!.markdown)
    await h.axe()
    await alert.getByRole('button', { name: 'Dismiss' }).click()
    await alert.waitFor({ state: 'detached' })
  })

  it('rate limiting says to try again later, leaves the notes alone; Try again replaces, Back to my draft restores', async () => {
    const before = await h.versions(SEED.retro)
    // every attempt is a 429 (the SDK retries twice); a short retry hint keeps it fast
    const limited = loadCassette(join(CASSETTES, 'rate-limited.json'))[0]!
    ctx.api.always({
      ...limited,
      headers: { ...limited.headers, 'retry-after': '0', 'retry-after-ms': '10' },
    })
    await h.w().getByRole('button', { name: 'Enhance notes' }).click()
    const alert = h.w().getByRole('status', { name: /Your notes were not changed/ })
    await alert.waitFor({ timeout: 20_000 })
    expect(await alert.textContent()).toContain('limiting requests')
    expect(await h.versions(SEED.retro)).toEqual(before)
    await h.axe()
    // the provider recovers: Try again enhances with the same template
    ctx.api.always(null)
    ctx.api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    await alert.getByRole('button', { name: 'Try again' }).click()
    const draft = before.filter((v) => v.kind !== 'enhanced').at(-1)!
    await waitFor(
      async () =>
        (await h.head(SEED.retro)).version > draft.version &&
        (await h.head(SEED.retro)).markdown !== draft.markdown,
      20_000,
      'the replacement',
    )
    // undo: the draft comes back as a new version (restored from the one the enhancement replaced)
    await h.w().getByRole('button', { name: 'Back to my draft' }).click()
    await waitFor(
      async () => (await h.head(SEED.retro)).markdown === draft.markdown,
      10_000,
      'the draft restored',
    )
    expect((await h.versions(SEED.retro)).at(-1)).toMatchObject({
      kind: 'restore',
      restoredFrom: draft.version,
    })
    await waitFor(
      async () => (await h.editorText()) === draft.markdown,
      10_000,
      'the editor to show the draft',
    )
    await h.w().getByRole('button', { name: 'Back to my draft' }).waitFor({ state: 'detached' })
  })

  it('restores an old version from the history: a new version on top, nothing removed', async () => {
    const before = await h.versions(SEED.retro)
    const typed = before.filter((v) => v.kind === 'user' && v.markdown === TYPED).at(-1)!
    await h.notesAction('Version history…')
    const dialog = h.w().getByRole('dialog', { name: 'Version history' })
    await dialog.waitFor()
    const list = dialog.getByRole('listbox', { name: 'Versions' })
    await list.getByRole('option').first().waitFor()
    // newest first, every version listed, the head marked current
    expect(await list.getByRole('option').count()).toBe(before.length)
    expect(await list.getByRole('option').first().textContent()).toContain(
      `Version ${before.at(-1)!.version}`,
    )
    expect(await list.getByRole('option').first().textContent()).toContain('Current')
    await h.axe()
    await list.getByRole('option', { name: new RegExp(`^Version ${typed.version} Typed`) }).click()
    const preview = dialog.getByRole('region', { name: `Text of version ${typed.version}` })
    expect(await preview.textContent()).toContain('retry budgt three attmpts')
    await dialog.getByRole('button', { name: 'Restore this version' }).click()
    await dialog.waitFor({ state: 'detached' })
    await h.toast(`Version ${typed.version} restored`).waitFor({ timeout: 5000 })
    const after = await h.versions(SEED.retro)
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after.at(-1)).toMatchObject({ kind: 'restore', restoredFrom: typed.version, markdown: TYPED })
    expect(await h.head(SEED.retro)).toMatchObject({ version: after.at(-1)!.version, markdown: TYPED })
    await waitFor(async () => (await h.editorText()) === TYPED, 10_000, 'the editor to show the restore')
    // and the restore is itself undoable from the same list
    await h.notesAction('Version history…')
    await dialog.waitFor()
    expect(await dialog.getByRole('option').first().textContent()).toContain(
      `Restored version ${typed.version}`,
    )
    await dialog.getByRole('button', { name: 'Close' }).click()
    await dialog.waitFor({ state: 'detached' })
  })

  it('creates a custom template, is suggested by it, enhances with it, and deletes it', async () => {
    await h.w().getByRole('button', { name: 'Choose a template' }).click()
    await h.w().getByRole('menuitem', { name: 'Manage templates…' }).click()
    const dialog = h.w().getByRole('dialog', { name: 'Notes templates' })
    await dialog.waitFor()
    // the built-ins are listed, read-only
    await dialog.getByRole('option', { name: /General/ }).click()
    await dialog.getByText('Built-in templates cannot be changed').waitFor()
    await dialog.getByRole('button', { name: 'New template' }).click()
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Retrospective')
    await dialog.getByRole('textbox', { name: 'Keywords' }).fill('retro, post-mortem')
    await dialog
      .getByRole('textbox', { name: 'Template' })
      .fill('## Went well\n\n## Went badly\n\n## Action items\n\nOne owner per action.')
    await h.axe()
    await dialog.getByRole('button', { name: 'Save template' }).click()
    const saved = await waitFor(
      async () =>
        (await ctx.daemon.client.call('listTemplates', { query: {} })).templates.find(
          (t) => t.id === 'retrospective',
        ),
      10_000,
      'the saved template',
    )
    expect(saved).toMatchObject({ name: 'Retrospective', builtIn: false, keywords: ['retro', 'post-mortem'] })
    await dialog.getByRole('option', { name: /Retrospective/ }).waitFor()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await dialog.waitFor({ state: 'detached' })

    // "Sprint retro" now matches its keyword: suggested, and the default for Enhance
    await h
      .w()
      .getByText('Retrospective template, suggested by the meeting title (“retro”)')
      .waitFor({ timeout: 10_000 })
    await h.w().getByRole('button', { name: 'Choose a template' }).click()
    await h
      .w()
      .getByRole('menuitem', { name: /Enhance as Retrospective \(suggested\)/ })
      .waitFor()
    await h.w().keyboard.press('Escape')
    ctx.api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
    const headBefore = await h.head(SEED.retro)
    await h.w().getByRole('button', { name: 'Enhance notes' }).click()
    await waitFor(
      async () =>
        (await h.versions(SEED.retro)).some(
          (v) => v.kind === 'enhanced' && v.enhancement?.templateId === 'retrospective',
        ) && (await h.head(SEED.retro)).version > headBefore.version,
      20_000,
      'the retrospective enhancement applied',
    )
    const req = ctx.api.seen.at(-1)!.body as { messages: { content: { text: string }[] }[] }
    const prompt = req.messages[0]!.content.map((c) => c.text).join('\n')
    expect(prompt).toContain('<template id="retrospective"')
    expect(prompt).toContain('One owner per action.')
    // back to the draft: the notes are exactly what they were
    await h.w().getByRole('button', { name: 'Back to my draft' }).click()
    await waitFor(
      async () => (await h.head(SEED.retro)).markdown === headBefore.markdown,
      10_000,
      'the draft restored',
    )

    // delete it again
    await h.w().getByRole('button', { name: 'Choose a template' }).click()
    await h.w().getByRole('menuitem', { name: 'Manage templates…' }).click()
    await dialog.waitFor()
    await dialog.getByRole('option', { name: /Retrospective/ }).click()
    await dialog.getByRole('button', { name: 'Delete template' }).click()
    await waitFor(
      async () =>
        !(await ctx.daemon.client.call('listTemplates', { query: {} })).templates.some(
          (t) => t.id === 'retrospective',
        ),
      10_000,
      'the template deleted',
    )
    await dialog.getByRole('option', { name: /Retrospective/ }).waitFor({ state: 'detached' })
    await dialog.getByRole('button', { name: 'Close' }).click()
    await h.w().getByText('General meeting template', { exact: true }).waitFor({ timeout: 10_000 })
  })

  it('saves what was typed even when the session is left before the autosave fires', async () => {
    await h.openSession('Quarterly planning')
    await h.editor().click()
    await h.w().keyboard.type('left in a hurry')
    // straight to another session: the pane's unmount flushes the draft
    await h.openSession('Sprint retro')
    await waitFor(
      async () => (await h.head(SEED.long)).markdown === 'left in a hurry',
      10_000,
      'the flushed draft',
    )
  })

  it('logged no console errors, page errors or CSP violations', () => {
    expect(ctx.app.problems()).toEqual([])
  })
})

describe('Notes in dark and high contrast', () => {
  it('the same states in dark: accessible, and matching their baselines', async () => {
    const ctx = await world('dark')
    const h = helpers(
      () => ctx.app,
      () => ctx.daemon,
      'dark',
    )
    try {
      await h.openSession('Sprint retro')
      await h.editor().click()
      await h.w().keyboard.type(TYPED)
      await waitFor(async () => (await h.head(SEED.retro)).markdown === TYPED, 10_000, 'saved')
      await h.status('Saved').waitFor()
      await h.axe()
      await h.w().mouse.move(0, 0)
      await h.shot('editor')

      ctx.api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
      const release = ctx.api.holdAfter(9)
      await h.w().getByRole('button', { name: 'Enhance notes' }).click()
      try {
        await h.streamedUpTo('migration thursday')
        await h.axe()
        await h.shot('enhancing')
      } finally {
        release()
      }
      await waitFor(
        async () => (await h.versions(SEED.retro)).some((v) => v.kind === 'merge'),
        10_000,
        'merged',
      )
      await h.editor().waitFor()
      await h.status('Tidied from your draft by your AI provider').waitFor()
      await h.axe()
      await h.w().mouse.move(0, 0)
      await h.shot('merged')
      expect(ctx.app.problems()).toEqual([])
    } finally {
      await ctx.close()
    }
  }, 180_000)

  it('high contrast (dark): the editor and the enhanced notes stay accessible', async () => {
    const ctx = await world('dark', { KACOLA_CONTRAST: 'high' })
    const h = helpers(
      () => ctx.app,
      () => ctx.daemon,
      'dark-hc',
    )
    try {
      await h.openSession('Sprint retro')
      expect(await h.w().evaluate(`document.documentElement.dataset.contrast`)).toBe('high')
      await h.editor().click()
      await h.w().keyboard.type(TYPED)
      await waitFor(async () => (await h.head(SEED.retro)).markdown === TYPED, 10_000, 'saved')
      await h.axe()
      ctx.api.enqueue(...loadCassette(join(CASSETTES, 'enhance-notes.json')))
      await h.w().getByRole('button', { name: 'Enhance notes' }).click()
      await waitFor(
        async () => (await h.versions(SEED.retro)).some((v) => v.kind === 'merge'),
        20_000,
        'the replacement',
      )
      await h.w().getByRole('button', { name: 'Back to my draft' }).waitFor()
      await h.axe()
      await h
        .w()
        .locator('[data-notes-pane]')
        .screenshot({ path: join(ARTIFACTS, 'merged-dark-hc.png') })
      expect(ctx.app.problems()).toEqual([])
    } finally {
      await ctx.close()
    }
  }, 180_000)
})
