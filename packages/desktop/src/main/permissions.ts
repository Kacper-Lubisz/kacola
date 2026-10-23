import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PermissionKind, PermissionState, PermissionsState, SettingsPane } from '../shared/bridge.ts'

// Setup's permissions (docs/desktop-app.md, "First run"): what macOS has granted this app, asking for it,
// and the System Settings pane to send the user to once a request has been answered "no" (macOS never
// asks twice). Linux needs no grants: PipeWire and Evolution Data Server are the user's own session.
//
//   microphone    getUserMedia in the capture window: systemPreferences' microphone status / askForMediaAccess
//   system-audio  getDisplayMedia loopback goes through Screen & System Audio Recording: there is no "ask"
//                 API, but listing screen sources makes macOS show its prompt
//   calendar      EventKit, through the daemon's helper (kacola-cal-agent --status / --request), so the
//                 grant lands on the app that runs the daemon's agent too

export type MediaStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

export type PermissionDeps = {
  platform: NodeJS.Platform
  mediaStatus: (kind: 'microphone' | 'screen') => MediaStatus
  askMicrophone: () => Promise<boolean>
  /** Lists screen sources (the system's Screen & System Audio Recording prompt, the first time). */
  probeScreen: () => Promise<void>
  /** Runs the calendar helper with one flag and returns what it printed, or null without a helper. */
  calendarHelper: (flag: '--status' | '--request') => Promise<string | null>
  openUrl: (url: string) => Promise<void>
  /** Which permissions this app has asked for before (kept across launches). */
  asked: { has: (kind: PermissionKind) => boolean; add: (kind: PermissionKind) => void }
}

export const SETTINGS_PANES: Record<SettingsPane, string> = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  'system-audio': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  calendar: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
  'internet-accounts': 'x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension',
}

function fromMedia(s: MediaStatus): PermissionState {
  return s === 'unknown' ? 'not-determined' : s
}

function fromHelper(out: string | null): PermissionState {
  switch (out?.trim()) {
    case 'granted':
      return 'granted'
    case 'denied':
    case 'write-only':
      return 'denied'
    case 'restricted':
      return 'restricted'
    case 'not-determined':
      return 'not-determined'
    default:
      return 'unavailable'
  }
}

export class Permissions {
  private readonly d: PermissionDeps
  constructor(d: PermissionDeps) {
    this.d = d
  }

  private get mac(): boolean {
    return this.d.platform === 'darwin'
  }

  async state(): Promise<PermissionsState> {
    if (!this.mac) return { microphone: 'not-needed', 'system-audio': 'not-needed', calendar: 'not-needed' }
    const screen = fromMedia(this.d.mediaStatus('screen'))
    return {
      microphone: fromMedia(this.d.mediaStatus('microphone')),
      // Electron says "denied" for Screen & System Audio Recording before the app ever asked, and System
      // Settings lists an app there only once it has asked: until then, asking is what helps
      'system-audio': screen === 'denied' && !this.d.asked.has('system-audio') ? 'not-determined' : screen,
      calendar: fromHelper(await this.d.calendarHelper('--status')),
    }
  }

  /** Ask for one grant (only when macOS has not been asked yet), then report every state again. */
  async request(kind: PermissionKind): Promise<PermissionsState> {
    if (!this.mac) return this.state()
    const before = (await this.state())[kind]
    if (before === 'not-determined') {
      if (kind === 'microphone') await this.d.askMicrophone()
      else if (kind === 'system-audio') await this.d.probeScreen()
      else await this.d.calendarHelper('--request')
      this.d.asked.add(kind)
    }
    return this.state()
  }

  async openSettings(pane: SettingsPane): Promise<boolean> {
    if (!this.mac) return false
    const url = SETTINGS_PANES[pane]
    if (!url) return false
    await this.d.openUrl(url)
    return true
  }
}

/** PermissionDeps.asked over a small JSON file (a list of kinds); unreadable counts as never asked. */
export function askedPermissions(file: string): PermissionDeps['asked'] {
  const read = (): PermissionKind[] => {
    try {
      const v = JSON.parse(readFileSync(file, 'utf8')) as unknown
      return Array.isArray(v) ? (v as PermissionKind[]) : []
    } catch {
      return []
    }
  }
  return {
    has: (kind) => read().includes(kind),
    add: (kind) => {
      const cur = read()
      if (cur.includes(kind)) return
      try {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, `${JSON.stringify([...cur, kind])}\n`)
      } catch {}
    },
  }
}
