import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ExtensionState } from '../shared/bridge.ts'

// "Install top-bar extension" (Preferences → Desktop Integration): copy the GNOME Shell extension
// (extensions/gnomeola@gnomeola.org, shipped as resources/extension/ in packaged builds) into the user's
// extensions directory. Never enabled from here — enabling a Shell extension is the user's decision
// (GNOME Extensions / `gnome-extensions enable`), and on Wayland the Shell only sees a new one after
// logging in again.
//
// Where: ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions. Inside the Flatpak, XDG_DATA_HOME is the
// app's own ~/.var/app/… directory, so the host's is used instead (HOST_XDG_DATA_HOME, else
// ~/.local/share) — the manifest grants exactly xdg-data/gnome-shell/extensions:create for this.

export const EXTENSION_UUID = 'gnomeola@gnomeola.org'

/** The extension to install: packaged resources/extension/<uuid>, else the repo's extensions/<uuid>. */
export function extensionSource(o: { resourcesPath?: string; appDir: string }): string | null {
  const candidates = [
    ...(o.resourcesPath ? [join(o.resourcesPath, 'extension', EXTENSION_UUID)] : []),
    // out/main → packages/desktop → repo
    join(o.appDir, '..', '..', '..', '..', 'extensions', EXTENSION_UUID),
  ]
  return candidates.find((p) => existsSync(join(p, 'metadata.json'))) ?? null
}

export function extensionsDir(env: Record<string, string | undefined>): string {
  const home = env.HOME || homedir()
  const data = env.FLATPAK_ID
    ? env.HOST_XDG_DATA_HOME || join(home, '.local', 'share')
    : env.XDG_DATA_HOME || join(home, '.local', 'share')
  return join(data, 'gnome-shell', 'extensions')
}

const version = (dir: string): string | null => {
  try {
    const m = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8')) as { 'version-name'?: string }
    return m['version-name'] ?? ''
  } catch {
    return null
  }
}

export type ExtensionDeps = {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  source: string | null
}

export function extensionStatus(d: ExtensionDeps): ExtensionState {
  if (d.platform !== 'linux') return { state: 'unsupported' }
  if (!d.source) return { state: 'unavailable', detail: 'This build does not include the top-bar extension.' }
  const have = version(join(extensionsDir(d.env), EXTENSION_UUID))
  // an older copy counts as not installed: Install then updates it
  return { state: have !== null && have === version(d.source) ? 'installed' : 'not-installed' }
}

/**
 * Copy the extension into place (a temp copy renamed over the old one, so the Shell never sees half an
 * extension) and compile its GSettings schema if the copy has none compiled. Does not enable it.
 */
export function installExtension(d: ExtensionDeps): ExtensionState {
  if (d.platform !== 'linux') return { state: 'unsupported' }
  if (!d.source) return { state: 'unavailable', detail: 'This build does not include the top-bar extension.' }
  const dest = join(extensionsDir(d.env), EXTENSION_UUID)
  const tmp = `${dest}.tmp-${process.pid}`
  try {
    mkdirSync(dirname(dest), { recursive: true })
    rmSync(tmp, { recursive: true, force: true })
    cpSync(d.source, tmp, { recursive: true, dereference: true })
    const schemas = join(tmp, 'schemas')
    if (existsSync(schemas) && !existsSync(join(schemas, 'gschemas.compiled'))) {
      const r = spawnSync('glib-compile-schemas', ['--strict', schemas], { encoding: 'utf8' })
      if (r.error || r.status !== 0)
        throw new Error(`could not compile its settings schema: ${r.error?.message ?? r.stderr.trim()}`)
    }
    rmSync(dest, { recursive: true, force: true })
    renameSync(tmp, dest)
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    return { state: 'error', detail: `Could not install the top-bar extension: ${(err as Error).message}` }
  }
  return extensionStatus(d)
}
