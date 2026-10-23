import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { askedPermissions, type MediaStatus, Permissions } from '../src/main/permissions.ts'

function mac(o: { screen?: MediaStatus; mic?: MediaStatus; calendar?: string | null } = {}) {
  const asked = askedPermissions(join(mkdtempSync(join(tmpdir(), 'kacola-perms-')), 'asked.json'))
  const deps = {
    platform: 'darwin' as const,
    mediaStatus: vi.fn((kind: 'microphone' | 'screen') =>
      kind === 'screen' ? (o.screen ?? 'denied') : (o.mic ?? 'not-determined'),
    ),
    askMicrophone: vi.fn(async () => true),
    probeScreen: vi.fn(async () => {}),
    calendarHelper: vi.fn(async () => (o.calendar === undefined ? 'not-determined\n' : o.calendar)),
    openUrl: vi.fn(async () => {}),
    asked,
  }
  return { p: new Permissions(deps), deps }
}

describe('setup permissions', () => {
  it('reports system audio as not asked yet until the app has asked (Electron says denied before)', async () => {
    const { p, deps } = mac()
    expect((await p.state())['system-audio']).toBe('not-determined')
    expect((await p.request('system-audio'))['system-audio']).toBe('denied')
    expect(deps.probeScreen).toHaveBeenCalledTimes(1)
    // answered: only System Settings helps now, and asking again does nothing
    await p.request('system-audio')
    expect(deps.probeScreen).toHaveBeenCalledTimes(1)
  })

  it('asks for the microphone and the calendar only when macOS has not asked yet', async () => {
    const { p, deps } = mac({ mic: 'granted', calendar: 'denied\n' })
    await p.request('microphone')
    await p.request('calendar')
    expect(deps.askMicrophone).not.toHaveBeenCalled()
    expect(deps.calendarHelper).not.toHaveBeenCalledWith('--request')
    const fresh = mac()
    await fresh.p.request('calendar')
    expect(fresh.deps.calendarHelper).toHaveBeenCalledWith('--request')
  })

  it('a build without the calendar helper cannot ask; Linux needs nothing', async () => {
    expect((await mac({ calendar: null }).p.state()).calendar).toBe('unavailable')
    const { p, deps } = mac()
    const linux = new Permissions({ ...deps, platform: 'linux' })
    expect(await linux.state()).toEqual({
      microphone: 'not-needed',
      'system-audio': 'not-needed',
      calendar: 'not-needed',
    })
    expect(await linux.openSettings('calendar')).toBe(false)
    expect(await p.openSettings('internet-accounts')).toBe(true)
    expect(deps.openUrl).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension',
    )
  })
})
