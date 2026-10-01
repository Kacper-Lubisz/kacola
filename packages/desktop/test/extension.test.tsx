// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { extensionView } from '../src/renderer/features/preferences/extension-setup.tsx'
import type { ExtensionState } from '../src/shared/bridge.ts'
import { fakeBridge, renderApp } from './app-harness.tsx'
import { until } from './helpers.ts'

// The top-bar extension in the window: what each state says and offers (extensionView), the sidebar card
// (GNOME only, until on or dismissed — the dismissal kept in ui-state), the "turn GNOME extensions back
// on?" question, the Preferences row's On / Disable / Remove, and the re-check on window focus. Main's
// side (the state machine against a faked Shell) is packages/e2e/test/extension-setup.test.ts.

afterEach(() => cleanup())

const CMD = 'gnome-extensions enable gnomeola@gnomeola.org'
const login = (o: Partial<Extract<ExtensionState, { state: 'needs-login' }>> = {}): ExtensionState => ({
  state: 'needs-login',
  reason: 'new',
  queued: true,
  session: 'wayland',
  command: null,
  userExtensionsOff: false,
  ...o,
})

describe('what each state says and offers', () => {
  const row = (s: ExtensionState | undefined) => {
    const v = extensionView(s)
    return [v.subtitle, v.label || null, v.asks, v.on, v.card, v.command]
  }
  it('one button that does the right thing, and the copy around it', () => {
    expect(row(undefined)).toEqual(['Checking…', null, false, false, false, null])
    expect(row({ state: 'unsupported' })).toEqual(['', null, false, false, false, null])
    expect(row({ state: 'unavailable', detail: 'No copy.' })).toEqual([
      'No copy.',
      null,
      false,
      false,
      false,
      null,
    ])
    expect(row({ state: 'not-installed', userExtensionsOff: false })).toEqual([
      'Shows the recording state and the next meeting in the GNOME top bar',
      'Install & Enable',
      false,
      false,
      true,
      null,
    ])
    expect(row({ state: 'not-installed', userExtensionsOff: true })).toEqual([
      'Shows the recording state and the next meeting in the GNOME top bar. Extensions are turned off in GNOME',
      'Install & Enable',
      true,
      false,
      true,
      null,
    ])
    expect(
      row({ state: 'outdated', installed: '0.0.9', bundled: '0.1.0', userExtensionsOff: false }),
    ).toEqual(['Version 0.0.9 is installed; this app comes with 0.1.0', 'Update', false, false, true, null])
    expect(
      row({ state: 'outdated', installed: '0.1.0', bundled: '0.1.0', userExtensionsOff: false })[0],
    ).toBe('An older copy is installed; this app comes with a newer one')
    expect(row(login())).toEqual([
      'Installed — log out and back in to turn it on',
      null,
      false,
      false,
      true,
      null,
    ])
    expect(row(login({ session: 'x11' }))[0]).toBe(
      'Installed — log out and back in (or restart GNOME Shell with Alt+F2, r) to turn it on',
    )
    expect(row(login({ queued: false }))).toEqual([
      'Installed, but not turned on',
      'Enable',
      false,
      false,
      true,
      null,
    ])
    expect(row(login({ userExtensionsOff: true }))).toEqual([
      'Installed, but not turned on. Extensions are turned off in GNOME',
      'Enable',
      true,
      false,
      true,
      null,
    ])
    expect(row(login({ queued: false, command: CMD }))).toEqual([
      'Installed — log out and back in, then run this in a terminal to turn it on:',
      null,
      false,
      false,
      true,
      CMD,
    ])
    expect(row(login({ reason: 'updated' }))[0]).toBe('Updated — log out and back in to use the new version')
    expect(row({ state: 'disabled', userExtensionsOff: false })).toEqual([
      'Installed, but turned off',
      'Enable',
      false,
      false,
      true,
      null,
    ])
    expect(row({ state: 'disabled', userExtensionsOff: true })).toEqual([
      'Installed, but extensions are turned off in GNOME',
      'Enable',
      true,
      false,
      true,
      null,
    ])
    expect(row({ state: 'enabled' })).toEqual([
      'On — showing in the GNOME top bar',
      null,
      false,
      true,
      false,
      null,
    ])
    expect(row({ state: 'manual', command: CMD })).toEqual([
      'Installed. To turn it on, run this in a terminal:',
      null,
      false,
      false,
      true,
      CMD,
    ])
    expect(row({ state: 'error', reason: 'crashed', detail: 'TypeError: x' })).toEqual([
      'It stopped with an error: TypeError: x',
      'Try Again',
      false,
      false,
      true,
      null,
    ])
    expect(row({ state: 'error', reason: 'shell-version', detail: 'x' })[0]).toBe(
      'The installed copy does not support this version of GNOME Shell',
    )
  })
})

/** A bridge whose extension moves through states as the user presses. */
function extensionBridge(start: ExtensionState, next: ExtensionState) {
  let current = start
  let pressed = 0
  const fb = fakeBridge({
    extensionStatus: async () => current,
    installExtension: async () => {
      pressed++
      current = next
      return current
    },
    disableExtension: async () => {
      current = { state: 'disabled', userExtensionsOff: false }
      return current
    },
    removeExtension: async () => {
      current = { state: 'not-installed', userExtensionsOff: false }
      return current
    },
  })
  return { fb, set: (s: ExtensionState) => (current = s), presses: () => pressed }
}

const card = () => screen.findByRole('region', { name: 'Top-bar extension' })

describe('the sidebar card', () => {
  it('Install & Enable, then the log-in-again copy; dismissed for good', async () => {
    const { fb } = extensionBridge({ state: 'not-installed', userExtensionsOff: false }, login())
    const app = renderApp({ bridge: fb })
    const c = await card()
    expect(c.textContent).toContain('Shows the recording state and the next meeting in the GNOME top bar')
    fireEvent.click(within(c).getByRole('button', { name: 'Install & Enable' }))
    await within(c).findByText('Installed — log out and back in to turn it on')
    expect(within(c).queryByRole('button', { name: /Enable|Install/ })).toBeNull()
    // and the toast says the same
    expect(screen.getAllByText('Installed — log out and back in to turn it on').length).toBe(2)
    fireEvent.click(within(c).getByRole('button', { name: 'Dismiss' }))
    await until(() => screen.queryByRole('region', { name: 'Top-bar extension' }) === null)
    await until(() => fb.bridge.setUiState.mock.calls.length === 1)
    expect(fb.bridge.setUiState.mock.calls[0]![0]).toMatchObject({
      onboardingDone: true,
      extensionCardDismissed: true,
    })
    app.stop()
    cleanup()
    // a new window remembers
    const again = renderApp({ bridge: fb })
    await screen.findByRole('searchbox', { name: 'Search sessions' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'Top-bar extension' })).toBeNull()
    again.stop()
  })

  it('is not shown off GNOME, or once the extension is on; window focus re-checks', async () => {
    const off = renderApp()
    await screen.findByRole('searchbox', { name: 'Search sessions' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'Top-bar extension' })).toBeNull()
    off.stop()
    cleanup()

    const { fb, set } = extensionBridge(login(), { state: 'enabled' })
    const app = renderApp({ bridge: fb })
    await card()
    // the user logged out and back in: the window regains focus and the card goes
    set({ state: 'enabled' })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await until(() => screen.queryByRole('region', { name: 'Top-bar extension' }) === null)
    app.stop()
  })

  it('asks before turning GNOME’s extensions back on, and says so', async () => {
    const { fb, presses } = extensionBridge(
      { state: 'disabled', userExtensionsOff: true },
      { state: 'enabled' },
    )
    const app = renderApp({ bridge: fb })
    const c = await card()
    expect(c.textContent).toContain('Installed, but extensions are turned off in GNOME')
    fireEvent.click(within(c).getByRole('button', { name: 'Enable' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Turn On GNOME Extensions?' })
    expect(ask.textContent).toContain(
      'Turning on the top-bar extension turns extensions back on, including any others you have enabled.',
    )
    expect(presses()).toBe(0)
    fireEvent.click(within(ask).getByRole('button', { name: 'Turn On Extensions' }))
    await until(() => presses() === 1)
    await screen.findByText('The top-bar extension is on')
    await until(() => screen.queryByRole('region', { name: 'Top-bar extension' }) === null)
    app.stop()
  })

  it('the Flatpak’s command, with Copy', async () => {
    const { fb } = extensionBridge({ state: 'manual', command: CMD }, { state: 'manual', command: CMD })
    const app = renderApp({ bridge: fb })
    const c = await card()
    expect(within(c).getByText(CMD).tagName).toBe('CODE')
    fireEvent.click(within(c).getByRole('button', { name: 'Copy command' }))
    await until(() => fb.bridge.copyText.mock.calls.length === 1)
    expect(fb.bridge.copyText).toHaveBeenCalledWith(CMD)
    app.stop()
  })
})

describe('Preferences › Integration', () => {
  async function integration() {
    await screen.findByRole('searchbox', { name: 'Search sessions' })
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    const prefs = await screen.findByRole('dialog', { name: 'Preferences' })
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    await within(prefs).findByText('Top-bar extension')
    return prefs
  }

  it('On, with Disable; Remove asks first', async () => {
    const { fb } = extensionBridge({ state: 'enabled' }, { state: 'enabled' })
    const app = renderApp({ bridge: fb })
    const prefs = await integration()
    await within(prefs).findByText('On — showing in the GNOME top bar')
    expect(within(prefs).getByText('On')).toBeTruthy()
    fireEvent.click(within(prefs).getByRole('button', { name: 'Disable' }))
    await within(prefs).findByText('Installed, but turned off')
    within(prefs).getByRole('button', { name: 'Enable' })
    fireEvent.click(within(prefs).getByRole('button', { name: 'Remove' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove the Top-Bar Extension?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await within(prefs).findByRole('button', { name: 'Install & Enable' })
    app.stop()
  })

  it('Update for an older copy', async () => {
    const { fb } = extensionBridge(
      { state: 'outdated', installed: '0.0.9', bundled: '0.1.0', userExtensionsOff: false },
      login({ reason: 'updated' }),
    )
    const app = renderApp({ bridge: fb })
    const prefs = await integration()
    fireEvent.click(await within(prefs).findByRole('button', { name: 'Update' }))
    await within(prefs).findByText('Updated — log out and back in to use the new version')
    app.stop()
  })

  it('is not there off GNOME', async () => {
    const app = renderApp()
    await screen.findByRole('searchbox', { name: 'Search sessions' })
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    const prefs = await screen.findByRole('dialog', { name: 'Preferences' })
    fireEvent.mouseDown(within(prefs).getByRole('tab', { name: 'Integration' }))
    fireEvent.click(within(prefs).getByRole('tab', { name: 'Integration' }))
    await within(prefs).findByText('Command-line tool and Claude skill')
    expect(within(prefs).queryByText('Top-bar extension')).toBeNull()
    app.stop()
  })
})
