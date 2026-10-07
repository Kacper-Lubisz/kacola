import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { LEGACY_APP_ID, LEGACY_AUTOSTART_MARKER } from '@kacola/protocol'
import type { AutostartState } from '../shared/bridge.ts'

// Background mode (docs/desktop-app.md, "Background mode"): closing the window keeps main and the
// daemon running; this is the opt-in to also start that way at login (Preferences → "Start in the
// background at login"), so recording from the top bar, the CLI or auto-record works from boot.
//
//   Flatpak  the Background portal (org.freedesktop.portal.Background.RequestBackground, autostart +
//            commandline `kacola-app --background`): the portal writes the autostart entry on the host,
//            and GNOME lists the app under "Background Apps". The sandbox cannot see that entry, so the
//            choice is remembered in ${XDG_CONFIG_HOME}/kacola/autostart.json.
//   Linux    ${XDG_CONFIG_HOME:-~/.config}/autostart/com.kacperlubisz.Kacola.desktop, Exec = this binary.
//   macOS    a login item (app.setLoginItemSettings, args --background), wired in index.ts.

export const APP_ID = 'com.kacperlubisz.Kacola'

export function autostartPath(env: Record<string, string | undefined>): string {
  return join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config'), 'autostart', `${APP_ID}.desktop`)
}

/** Quote one Exec argument per the Desktop Entry spec. */
export function execArg(s: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `"${s.replace(/(["`$\\])/g, '\\$1')}"`
}

export function autostartEntry(exec: string[]): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=kacola',
    'Comment=Record, transcribe and search your meetings (in the background)',
    `Exec=${exec.map(execArg).join(' ')}`,
    `Icon=${APP_ID}`,
    'Terminal=false',
    'NoDisplay=true',
    'X-GNOME-Autostart-enabled=true',
    // written by kacola's Preferences; turning the switch off removes this file
    'X-Kacola-Autostart=1',
    '',
  ].join('\n')
}

/** The portal's options vardict, in GVariant text form (for `gdbus call`). */
export function backgroundRequestOptions(o: { autostart: boolean; reason: string; token: string }): string {
  const str = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return (
    `{'handle_token': <${str(o.token)}>, 'reason': <${str(o.reason)}>, 'autostart': <${o.autostart}>, ` +
    `'commandline': <['kacola-app', '--background']>, 'dbus-activatable': <false>}`
  )
}

export type AutostartDeps = {
  env: Record<string, string | undefined>
  /** The command a login starts (Linux outside Flatpak): this binary with --background. */
  exec: string[]
  /** gdbus call …: resolves with stdout (tests replace it). */
  gdbus?: (args: string[]) => Promise<string>
}

const runGdbus = (args: string[]) =>
  new Promise<string>((resolve, reject) =>
    execFile('gdbus', args, { timeout: 10_000 }, (err, out) => (err ? reject(err) : resolve(String(out)))),
  )

const choiceFile = (env: Record<string, string | undefined>) =>
  join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config'), 'kacola', 'autostart.json')

/** Ask the Background portal (Flatpak): with autostart, or just "may run with no window". */
export async function requestBackground(d: AutostartDeps, autostart: boolean): Promise<void> {
  const token = `kacola${process.pid}${Date.now()}`
  await (d.gdbus ?? runGdbus)([
    'call',
    '--session',
    '--dest',
    'org.freedesktop.portal.Desktop',
    '--object-path',
    '/org/freedesktop/portal/desktop',
    '--method',
    'org.freedesktop.portal.Background.RequestBackground',
    '',
    backgroundRequestOptions({
      autostart,
      token,
      reason: autostart
        ? 'Start in the background at login, to record meetings from the top bar and the command line'
        : 'Keep recording and answering the command line after the window is closed',
    }),
  ])
}

export function autostartStatus(d: AutostartDeps): AutostartState {
  if (d.env.FLATPAK_ID) {
    try {
      return {
        enabled:
          (JSON.parse(readFileSync(choiceFile(d.env), 'utf8')) as { enabled?: boolean }).enabled === true,
      }
    } catch {
      return { enabled: false }
    }
  }
  const p = autostartPath(d.env)
  return { enabled: existsSync(p) && readFileSync(p, 'utf8').includes('X-Kacola-Autostart=1') }
}

export async function setAutostart(d: AutostartDeps, enabled: boolean): Promise<AutostartState> {
  if (d.env.FLATPAK_ID) {
    await requestBackground(d, enabled)
    const f = choiceFile(d.env)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, `${JSON.stringify({ enabled })}\n`)
    return { enabled }
  }
  const p = autostartPath(d.env)
  if (enabled) {
    mkdirSync(dirname(p), { recursive: true })
    const tmp = `${p}.tmp-${process.pid}`
    writeFileSync(tmp, autostartEntry(d.exec))
    renameSync(tmp, p)
  } else if (existsSync(p) && readFileSync(p, 'utf8').includes('X-Kacola-Autostart=1')) {
    // only ever remove our own entry
    rmSync(p, { force: true })
  }
  return autostartStatus(d)
}

/**
 * The autostart entry a gnomeola window wrote (org.gnome.Gnomeola.desktop, X-Gnomeola-Autostart=1) starts
 * a binary the upgrade removed: replace it with ours, keeping the choice (one release after the rename).
 * Never touches an entry the old window did not write. Returns whether it moved one.
 */
export function migrateLegacyAutostart(d: AutostartDeps): boolean {
  if (d.env.FLATPAK_ID) return false
  const legacy = join(dirname(autostartPath(d.env)), `${LEGACY_APP_ID}.desktop`)
  if (!existsSync(legacy) || !readFileSync(legacy, 'utf8').includes(LEGACY_AUTOSTART_MARKER)) return false
  if (!autostartStatus(d).enabled) {
    const p = autostartPath(d.env)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(`${p}.tmp-${process.pid}`, autostartEntry(d.exec))
    renameSync(`${p}.tmp-${process.pid}`, p)
  }
  rmSync(legacy, { force: true })
  return true
}
