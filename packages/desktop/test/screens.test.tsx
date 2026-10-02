// @vitest-environment jsdom
import type { Session } from '@gnomeola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { shouldOnboard } from '../src/renderer/features/onboarding/onboarding-state.ts'
import { applyPatch } from '../src/renderer/features/preferences/settings-data.ts'
import { matches, SHORTCUTS } from '../src/renderer/features/shell/shortcuts.tsx'
import { fakeBridge, model, renderApp, settings, shellHandlers } from './app-harness.tsx'
import { session, until, upserted } from './helpers.ts'

// The screens through the real router and data layer, over the fake daemon and bridge.

afterEach(() => cleanup())

const writes = (calls: string[]) =>
  calls.filter((c) => /^(update|set|create|start|stop|pause|resume)/.test(c))

async function openPreferences() {
  await screen.findByRole('searchbox', { name: 'Search or ask' })
  fireEvent.keyDown(window, { key: ',', ctrlKey: true })
  const prefs = await screen.findByRole('dialog', { name: 'Preferences' })
  await within(prefs).findByRole('region', { name: 'Questions and answers' })
  return prefs
}

describe('Preferences', () => {
  it('opens on Ctrl+, with the daemon’s values and writes nothing back', async () => {
    const app = renderApp({
      handlers: shellHandlers({
        settings: settings({
          stt: { liveModel: 'l', finalModel: 'f', finalPass: 'off' },
          autoRecord: { calendar: true, micActivity: false },
        }),
      }),
    })
    const prefs = await openPreferences()
    expect(within(prefs).getByRole('button', { name: /Accurate transcript/ }).textContent).toContain(
      'Off (live transcript only)',
    )
    expect(
      (within(prefs).getByRole('switch', { name: 'When a calendar meeting starts' }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    await new Promise((r) => setTimeout(r, 50))
    expect(writes(app.daemon.calls)).toEqual([])
    app.stop()
  })

  it('applies a switch at once (optimistic), and an API key goes to the keyring and is cleared', async () => {
    let stored: string | null = null
    const handlers = shellHandlers()
    const app = renderApp({
      handlers: {
        ...handlers,
        setApiKey: ({ body }) => {
          stored = (body as { key: string | null }).key
          return { configured: stored !== null }
        },
        getSettings: () => {
          const s = handlers.getSettings!({}) as ReturnType<typeof settings>
          return { ...s, llm: { ...s.llm, apiKeyConfigured: stored !== null } }
        },
      },
    })
    const prefs = await openPreferences()
    fireEvent.click(within(prefs).getByRole('switch', { name: 'When another app uses the microphone' }))
    await until(() => app.daemon.calls.includes('updateSettings'))
    expect(app.daemon.log.find((c) => c.name === 'updateSettings')!.opts.body).toEqual({
      autoRecord: { micActivity: true },
    })

    const key = within(prefs).getByLabelText('API key') as HTMLInputElement
    fireEvent.change(key, { target: { value: 'sk-secret-123' } })
    fireEvent.click(within(prefs).getByRole('button', { name: 'Save' }))
    await within(prefs).findByText('Saved in your keyring, never shown')
    expect(stored).toBe('sk-secret-123')
    expect((within(prefs).getByLabelText('Replace API key') as HTMLInputElement).value).toBe('')
    expect(document.body.innerHTML).not.toContain('sk-secret-123')
    await screen.findByText('API key saved')
    app.stop()
  })

  it('shows the Ollama URL for Ollama, and the key rows only for key providers', async () => {
    const app = renderApp({
      handlers: shellHandlers({
        settings: settings({
          llm: { provider: 'ollama', model: 'llama3', ollamaUrl: 'http://h:1', apiKeyConfigured: false },
        }),
      }),
    })
    const prefs = await openPreferences()
    expect((within(prefs).getByRole('textbox', { name: 'Ollama URL' }) as HTMLInputElement).value).toBe(
      'http://h:1',
    )
    expect(within(prefs).queryByLabelText('API key')).toBeNull()
    app.stop()
  })

  it('installs the command-line tool from Integration and shows the state', async () => {
    const fb = fakeBridge()
    const app = renderApp({ bridge: fb })
    const prefs = await openPreferences()
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(await within(prefs).findByRole('button', { name: 'Install' }))
    await within(prefs).findByText('Installed at /home/u/.local/bin/gnomeola')
    expect(fb.bridge.installCli).toHaveBeenCalledWith(false)
    app.stop()
  })

  it('a foreign gnomeola is replaced only after confirming', async () => {
    const fb = fakeBridge()
    fb.setCli({ state: 'foreign', path: '/usr/bin/gnomeola', detail: 'x' })
    const app = renderApp({ bridge: fb })
    const prefs = await openPreferences()
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    await within(prefs).findByText('A different gnomeola command is already installed at /usr/bin/gnomeola')
    fireEvent.click(within(prefs).getByRole('button', { name: 'Replace…' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Replace the other gnomeola command?' })
    expect(fb.bridge.installCli).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Replace' }))
    await until(() => fb.bridge.installCli.mock.calls.length === 1)
    expect(fb.bridge.installCli).toHaveBeenCalledWith(true)
    app.stop()
  })

  it('applyPatch merges each group like the daemon', () => {
    const s = settings()
    expect(applyPatch(s, { retention: { days: 7 } }).retention).toEqual({ ...s.retention, days: 7 })
    expect(applyPatch(s, { llm: { provider: 'openai' } }).llm.apiKeyConfigured).toBe(false)
  })
})

describe('the record flow', () => {
  it('New recording creates, starts and opens a session; Stop stops it; failures are toasts', async () => {
    let live: Session | null = null
    let failStop = true
    const app = renderApp({
      handlers: {
        ...shellHandlers(),
        createSession: () => {
          live = session('ses_new', { title: 'New recording' })
          return live
        },
        startSession: () => ({ ...live!, status: 'recording', startedAt: new Date().toISOString() }),
        getSession: () => live,
        stopSession: () => {
          if (failStop) throw new Error('no daemon today')
          return { ...live!, status: 'stopped' }
        },
      },
    })
    await screen.findByRole('searchbox', { name: 'Search or ask' })
    fireEvent.click(screen.getByRole('button', { name: 'New recording' }))
    await until(() => app.router.state.location.pathname === '/sessions/ses_new')
    expect(app.daemon.calls.filter((c) => c.endsWith('Session')).slice(0, 2)).toEqual([
      'createSession',
      'startSession',
    ])
    // the echo arrives through the bridge
    act(() =>
      app.daemon.emit(upserted(2, { ...live!, status: 'recording', startedAt: new Date().toISOString() })),
    )
    // the live page: the recording state is in its header, and nothing else is red
    await screen.findByRole('timer', { name: /^Recording, / })
    expect(screen.getByText('started by you')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await screen.findByText('Could not stop recording: no daemon today')
    failStop = false
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await until(() => app.daemon.calls.filter((c) => c === 'stopSession').length === 2)
    act(() => app.daemon.emit(upserted(3, { ...live!, status: 'stopped' })))
    // the same page moves on to the outcome
    await screen.findByRole('region', { name: 'Outcome' })
    expect(screen.queryByRole('timer')).toBeNull()
    app.stop()
  })
})

describe('onboarding', () => {
  it('is due on first run and when a newly missing model appears, not for the skipped ones', () => {
    const missing = [model('whisper', { state: 'missing' })]
    expect(shouldOnboard({ version: 1, onboardingDone: false, skippedMissing: [] }, missing)).toBe(true)
    expect(shouldOnboard({ version: 1, onboardingDone: true, skippedMissing: ['whisper'] }, missing)).toBe(
      false,
    )
    expect(shouldOnboard({ version: 1, onboardingDone: true, skippedMissing: [] }, missing)).toBe(true)
    expect(shouldOnboard({ version: 1, onboardingDone: false, skippedMissing: [] }, null)).toBe(false)
  })

  it('opens by itself on first run; Skip remembers the missing models and installs the CLI (default on)', async () => {
    const fb = fakeBridge()
    fb.setUi({ version: 1, onboardingDone: false, skippedMissing: [] })
    const app = renderApp({
      bridge: fb,
      handlers: {
        ...shellHandlers({ models: [model('live'), model('whisper', { role: 'final', state: 'missing' })] }),
        health: () => ({ lastSeq: 1, capture: { available: true, backend: 'fake', detail: null } }),
      },
    })
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to kacola' }, { timeout: 3000 })
    await within(welcome).findByRole('listitem', { name: /whisper/ })
    await within(welcome).findByText('Working')
    expect(
      (
        within(welcome).getByRole('switch', {
          name: 'Install command-line tool and Claude skill',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true)
    fireEvent.click(within(welcome).getByRole('button', { name: 'Skip for now' }))
    await until(() => fb.bridge.setUiState.mock.calls.length === 1)
    expect(fb.bridge.setUiState).toHaveBeenCalledWith({
      version: 1,
      onboardingDone: true,
      skippedMissing: ['whisper'],
    })
    await until(() => fb.bridge.installCli.mock.calls.length === 1)
    // the banner offers to set up again
    const banner = await screen.findByRole('status', {
      name: 'A speech model is not downloaded yet, so recording can’t transcribe',
    })
    fireEvent.click(within(banner).getByRole('button', { name: 'Set up' }))
    await screen.findByRole('dialog', { name: 'Welcome to kacola' })
    app.stop()
  })
})

describe('shell', () => {
  it('matches shortcuts, ⌘ standing in for Ctrl on macOS', () => {
    const k = (key: string, m: Partial<KeyboardEvent> = {}) => ({
      key,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...m,
    })
    expect(matches(k(',', { ctrlKey: true }), 'Ctrl+,')).toBe(true)
    expect(matches(k(',', { metaKey: true }), 'Ctrl+,', true)).toBe(true)
    expect(matches(k(',', { ctrlKey: true }), 'Ctrl+,', true)).toBe(false)
    expect(matches(k('?', { ctrlKey: true, shiftKey: true }), 'Ctrl+?')).toBe(true)
    expect(matches(k('P', { ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+P')).toBe(true)
    expect(matches(k('p', { ctrlKey: true }), 'Ctrl+Shift+P')).toBe(false)
    expect(matches(k('F10'), 'F10')).toBe(true)
    // every shortcut's keys are distinct
    expect(new Set(SHORTCUTS.map((s) => s.keys)).size).toBe(SHORTCUTS.length)
  })

  it('Ctrl+? opens the keyboard shortcuts help', async () => {
    const app = renderApp()
    await screen.findByRole('searchbox', { name: 'Search or ask' })
    fireEvent.keyDown(window, { key: '?', ctrlKey: true, shiftKey: true })
    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(help).getByText('New recording, or stop recording')).toBeTruthy()
    fireEvent.click(within(help).getByRole('button', { name: 'Close' }))
    app.stop()
  })

  it('a meeting’s transcript panel follows the URL and Ctrl+T; Details are in its menu', async () => {
    const s = session('ses_a', { title: 'Standup', status: 'stopped', durationMs: 720_000, tracks: [] })
    const app = renderApp({
      sessions: [s],
      path: '/sessions/ses_a?panel=transcript',
      handlers: {
        ...shellHandlers(),
        getSession: () => s,
        getTranscript: () => ({ segments: [] }),
        listSpeakers: () => ({ speakers: [] }),
        listAgendas: () => ({ agendas: [] }),
      },
    })
    await screen.findByRole('heading', { level: 1, name: 'Standup' })
    await screen.findByRole('heading', { level: 2, name: 'Transcript' })
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    await until(() => screen.queryByRole('heading', { level: 2, name: 'Transcript' }) === null)
    expect(app.router.state.location.search).toEqual({})
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    await screen.findByRole('heading', { level: 2, name: 'Transcript' })
    expect(app.router.state.location.search).toEqual({ panel: 'transcript' })
    // the old ?tab=transcript links still open it
    await app.router.navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: 'ses_a' },
      search: { tab: 'transcript' } as never,
    })
    await until(() => app.router.state.location.search.panel === 'transcript')
    fireEvent.click(screen.getByRole('button', { name: 'Meeting actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Details…' }))
    const details = await screen.findByRole('dialog', { name: 'Details' })
    expect(within(details).getByText('12:00')).toBeTruthy()
    app.stop()
  })
})
