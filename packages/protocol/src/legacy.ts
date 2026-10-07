// Compatibility with installs from before the product was renamed gnomeola → kacola (0.1 → 0.2).
// Everything here exists for one release so an existing install keeps working across the upgrade, and
// is removed in the release after: every remaining "gnomeola" in the tree is one of these, or the data
// migration (legacy-dirs.ts, the daemon's legacy-data-dir.ts) and the installer's upgrade path.
//
// Pure (no node: imports): the env adoption takes the env object, and the names are plain constants.

/** The old product name: directory names, the libsecret service, the keychain service. */
export const LEGACY_NAME = 'gnomeola'
/** The old environment-variable prefix (GNOMEOLA_URL …), read as a fallback for KACOLA_*. */
export const LEGACY_ENV_PREFIX = 'GNOMEOLA_'
export const ENV_PREFIX = 'KACOLA_'
/** The old app id: D-Bus name, desktop file, icons, autostart entry. */
export const LEGACY_APP_ID = 'org.gnome.Gnomeola'
/** The old D-Bus object path (the daemon still exports it so an old top-bar extension keeps working). */
export const LEGACY_OBJECT_PATH = '/org/gnome/Gnomeola'
/** The old GNOME Shell extension UUID. */
export const LEGACY_EXTENSION_UUID = 'gnomeola@gnomeola.org'
/** The old marker an autostart entry written by the window carried. */
export const LEGACY_AUTOSTART_MARKER = 'X-Gnomeola-Autostart=1'
/** The old participant header, sent beside the new one to hosted servers that predate the rename. */
export const LEGACY_PARTICIPANT_HEADER = 'x-gnomeola-participant'

export type AdoptedEnv = {
  /** GNOMEOLA_X copied to KACOLA_X (KACOLA_X was unset). */
  adopted: string[]
  /** GNOMEOLA_X ignored because KACOLA_X is set to something else. */
  shadowed: string[]
}

/**
 * Read GNOMEOLA_* as a fallback for KACOLA_*: each GNOMEOLA_X whose KACOLA_X is unset is copied over (so
 * child processes see the new name too, and adopt nothing again). Mutates `env`.
 */
export function adoptLegacyEnv(env: Record<string, string | undefined>): AdoptedEnv {
  const adopted: string[] = []
  const shadowed: string[] = []
  for (const key of Object.keys(env)) {
    if (!key.startsWith(LEGACY_ENV_PREFIX)) continue
    const value = env[key]
    if (value === undefined) continue
    const next = ENV_PREFIX + key.slice(LEGACY_ENV_PREFIX.length)
    if (env[next] === undefined) {
      env[next] = value
      adopted.push(key)
    } else if (env[next] !== value) shadowed.push(key)
  }
  return { adopted: adopted.sort(), shadowed: shadowed.sort() }
}

/** The one-line warning for what adoptLegacyEnv did, or null when it did nothing. */
export function legacyEnvWarning(r: AdoptedEnv): string | null {
  const parts: string[] = []
  if (r.adopted.length)
    parts.push(
      `${r.adopted.join(', ')} ${r.adopted.length === 1 ? 'is' : 'are'} deprecated: rename to ${r.adopted
        .map((k) => ENV_PREFIX + k.slice(LEGACY_ENV_PREFIX.length))
        .join(', ')} (the old names are read for one more release)`,
    )
  if (r.shadowed.length) parts.push(`ignoring ${r.shadowed.join(', ')}: the KACOLA_ name is set too and wins`)
  return parts.length ? `kacola: ${parts.join('; ')}` : null
}
