// @vitest-environment jsdom
import type { Session } from '@kacola/protocol'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  backgroundDownloads,
  downloadProgress,
  shouldOnboard,
} from '../src/renderer/features/onboarding/onboarding-state.ts'
import { applyPatch } from '../src/renderer/features/preferences/settings-data.ts'
import { matches, SHORTCUTS } from '../src/renderer/features/shell/shortcuts.tsx'
import type { PermissionKind, PermissionsState } from '../src/shared/bridge.ts'
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
  await within(prefs).findByRole('region', { name: 'Auto-record' })
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

  it('applies a switch at once (optimistic)', async () => {
    const app = renderApp()
    const prefs = await openPreferences()
    fireEvent.click(within(prefs).getByRole('switch', { name: 'When another app uses the microphone' }))
    await until(() => app.daemon.calls.includes('updateSettings'))
    expect(app.daemon.log.find((c) => c.name === 'updateSettings')!.opts.body).toEqual({
      autoRecord: { micActivity: true },
    })
    app.stop()
  })

  it('keeps providers, models and keys out of sight: one line of status, and the config file', async () => {
    const fb = fakeBridge({
      openConfigFile: vi.fn(async () => ({ path: '/home/u/.config/kacola/kacola.env', error: null })),
    })
    const app = renderApp({
      bridge: fb,
      handlers: {
        ...shellHandlers(),
        health: () => ({
          lastSeq: 1,
          llm: { provider: 'anthropic', ready: false },
          decisions: { provider: 'jev', model: 'jev-1', ready: true, detail: null },
        }),
      },
    })
    const prefs = await openPreferences()
    for (const gone of ['Questions and answers', 'Agenda during meetings'])
      expect(within(prefs).queryByRole('region', { name: gone })).toBeNull()
    expect(within(prefs).queryByLabelText(/API key/)).toBeNull()
    expect(within(prefs).queryByRole('switch', { name: 'Recognise people across meetings' })).toBeNull()
    await within(prefs).findByText('Answers: Anthropic, needs an API key · Decisions: TypeSafe Jev')
    fireEvent.click(within(prefs).getByRole('button', { name: 'Open config file' }))
    await until(() => fb.bridge.openConfigFile.mock.calls.length === 1)
    await screen.findByText('Changes apply a few seconds after you save the file')
    app.stop()
  })

  it('sync: signs in through the browser, shows who, and signs out', async () => {
    let state: { state: string; email: string | null } = { state: 'signed-out', email: null }
    const fb = fakeBridge({
      signInToSync: vi.fn(async () => {
        state = { state: 'syncing', email: 'me@example.com' }
        return { ok: true as const, email: 'me@example.com' }
      }),
    })
    const app = renderApp({
      bridge: fb,
      handlers: {
        ...shellHandlers(),
        syncStatus: () => ({
          ...state,
          server: 'https://kacola.example.com',
          deviceId: 'dev_test0000',
          issuer: 'https://accounts.example.com',
          detail: null,
        }),
        clearSyncAccount: () => {
          state = { state: 'signed-out', email: null }
          return {}
        },
      },
    })
    const prefs = await openPreferences()
    await within(prefs).findByText('Not signed in. Syncs meetings and notes with kacola.example.com')
    fireEvent.click(within(prefs).getByRole('button', { name: 'Sign in' }))
    await within(prefs).findByText('Syncing as me@example.com')
    expect(fb.bridge.signInToSync).toHaveBeenCalledTimes(1)
    fireEvent.click(within(prefs).getByRole('button', { name: 'Sign out' }))
    await within(prefs).findByText(/Not signed in/)
    app.stop()
  })

  it('installs the command-line tool from Integration and shows the state', async () => {
    const fb = fakeBridge()
    const app = renderApp({ bridge: fb })
    const prefs = await openPreferences()
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(await within(prefs).findByRole('button', { name: 'Install' }))
    await within(prefs).findByText('Installed at /home/u/.local/bin/kacola')
    expect(fb.bridge.installCli).toHaveBeenCalledWith(false)
    app.stop()
  })

  it('a foreign kacola is replaced only after confirming', async () => {
    const fb = fakeBridge()
    fb.setCli({ state: 'foreign', path: '/usr/bin/kacola', detail: 'x' })
    const app = renderApp({ bridge: fb })
    const prefs = await openPreferences()
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    await within(prefs).findByText('A different kacola command is already installed at /usr/bin/kacola')
    fireEvent.click(within(prefs).getByRole('button', { name: 'Replace…' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Replace the other kacola command?' })
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
  it('is due on first run only (later missing models download by themselves)', () => {
    const missing = [model('whisper', { state: 'missing' })]
    expect(shouldOnboard({ version: 1, onboardingDone: false, skippedMissing: [] }, missing)).toBe(true)
    expect(shouldOnboard({ version: 1, onboardingDone: true, skippedMissing: [] }, missing)).toBe(false)
    expect(shouldOnboard({ version: 1, onboardingDone: false, skippedMissing: [] }, null)).toBe(false)
    expect(
      backgroundDownloads({ version: 1, onboardingDone: true, skippedMissing: [] }, [
        ...missing,
        model('busy', { state: 'downloading' }),
      ]).map((m) => m.id),
    ).toEqual(['whisper'])
    // skipped in the old setup dialog: still the user's to start
    expect(
      backgroundDownloads({ version: 1, onboardingDone: true, skippedMissing: ['whisper'] }, missing),
    ).toEqual([])
    expect(backgroundDownloads({ version: 1, onboardingDone: false, skippedMissing: [] }, missing)).toEqual(
      [],
    )
  })

  it('measures download progress by size', () => {
    const p = downloadProgress([
      model('a', { sizeBytes: 300, state: 'ready' }),
      model('b', { sizeBytes: 100, state: 'downloading', progress: 0.5 }),
      model('c', { sizeBytes: 600, state: 'missing' }),
    ])
    expect(p).toEqual({ totalBytes: 1000, fraction: 0.35, done: false })
    expect(downloadProgress([]).done).toBe(true)
  })

  it('opens by itself on first run, downloads only the required models without asking, and walks its steps', async () => {
    const fb = fakeBridge()
    fb.setUi({ version: 1, onboardingDone: false, skippedMissing: [] })
    const app = renderApp({
      bridge: fb,
      handlers: {
        ...shellHandlers({
          models: [
            model('live', { required: true }),
            model('whisper', { role: 'final', state: 'missing', required: true, sizeBytes: 211_000_000 }),
            model('whisper-big', { role: 'final', state: 'missing', required: false }),
          ],
        }),
        downloadModel: ({ params }) =>
          model(params!.id!, { role: 'final', state: 'downloading', progress: 0.1 }),
        health: () => ({ lastSeq: 1, capture: { available: true, backend: 'fake', detail: null } }),
      },
    })
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to kacola' }, { timeout: 3000 })
    await until(() => app.daemon.calls.includes('downloadModel'))
    expect(app.daemon.log.filter((c) => c.name === 'downloadModel').map((c) => c.opts.params?.id)).toEqual([
      'whisper',
    ])
    expect(within(welcome).queryByRole('button', { name: /^Download/ })).toBeNull()
    await within(welcome).findByText(/Downloading 212 MB/)
    // Linux: capture needs no grant, it either works or says why
    await within(welcome).findByText('Working')
    fireEvent.click(within(welcome).getByRole('button', { name: 'Continue' }))
    await within(welcome).findByText(/Step 2 of 3/)
    fireEvent.click(within(welcome).getByRole('button', { name: 'Continue' }))
    await within(welcome).findByText(/Step 3 of 3/)
    expect(
      (
        within(welcome).getByRole('switch', {
          name: 'Install command-line tool and Claude skill',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true)
    fireEvent.click(within(welcome).getByRole('button', { name: 'Done' }))
    await until(() => fb.bridge.setUiState.mock.calls.length === 1)
    expect(fb.bridge.setUiState).toHaveBeenCalledWith({
      version: 1,
      onboardingDone: true,
      skippedMissing: [],
    })
    await until(() => fb.bridge.installCli.mock.calls.length === 1)
    app.stop()
  })

  it('on macOS asks for each permission, and sends a refused one to System Settings', async () => {
    let perms: PermissionsState = {
      microphone: 'not-determined',
      'system-audio': 'denied',
      calendar: 'not-determined',
    }
    const fb = fakeBridge({
      permissions: vi.fn(async () => perms),
      requestPermission: vi.fn(async (kind: PermissionKind) => {
        perms = { ...perms, [kind]: 'granted' }
        return perms
      }),
    })
    fb.setUi({ version: 1, onboardingDone: false, skippedMissing: [] })
    const app = renderApp({
      bridge: fb,
      info: { platform: 'darwin' },
      handlers: shellHandlers({ models: [model('live', { required: true, state: 'missing' })] }),
    })
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to kacola' }, { timeout: 3000 })
    fireEvent.click(await within(welcome).findByRole('button', { name: 'Allow Microphone' }))
    await until(() => fb.bridge.requestPermission.mock.calls.length === 1)
    expect(fb.bridge.requestPermission).toHaveBeenCalledWith('microphone')
    await within(welcome).findByText('Allowed · Your side of the meeting')
    fireEvent.click(within(welcome).getByRole('button', { name: 'Open System Settings' }))
    expect(fb.bridge.openSettingsPane).toHaveBeenCalledWith('system-audio')
    fireEvent.click(within(welcome).getByRole('button', { name: 'Continue' }))
    fireEvent.click(await within(welcome).findByRole('button', { name: 'Allow Calendars' }))
    await until(() => fb.bridge.requestPermission.mock.calls.length === 2)
    expect(fb.bridge.requestPermission).toHaveBeenLastCalledWith('calendar')
    fireEvent.click(within(welcome).getByRole('button', { name: 'Open Internet Accounts' }))
    expect(fb.bridge.openSettingsPane).toHaveBeenLastCalledWith('internet-accounts')
    app.stop()
  })

  it('after setup, a newly missing model downloads in the background and setup stays closed', async () => {
    const app = renderApp({
      handlers: {
        ...shellHandlers({ models: [model('live', { required: true, state: 'missing' })] }),
        downloadModel: ({ params }) => model(params!.id!, { state: 'downloading', progress: 0 }),
      },
    })
    await until(() => app.daemon.calls.includes('downloadModel'))
    expect(screen.queryByRole('dialog', { name: 'Welcome to kacola' })).toBeNull()
    // the banner still offers setup, for the permissions
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
