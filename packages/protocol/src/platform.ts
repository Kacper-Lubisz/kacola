// P-2: where kacola keeps things on each platform, in one place. Pure (no node: imports) so every
// package — the daemon, the CLI, the desktop app's main process — resolves the same directories from the
// same inputs, and tests can ask for any platform on any machine.
//
//   Linux (dev / install.sh)  ${XDG_DATA_HOME:-~/.local/share}/kacola        config ${XDG_CONFIG_HOME:-~/.config}/kacola
//   Flatpak                   the same XDG rule: inside the sandbox XDG_DATA_HOME is
//                             ~/.var/app/com.kacperlubisz.Kacola/data, so data lands in
//                             ~/.var/app/com.kacperlubisz.Kacola/data/kacola without special-casing
//   macOS                     ~/Library/Application Support/kacola          (data, models, config)
//                             logs and state below it; XDG variables are honoured when set explicitly,
//                             as CLI users on macOS sometimes do
//
// KACOLA_DATA_DIR and KACOLA_MODELS_DIR override everything (tests, portable installs).

export type PackagingKind = 'flatpak' | 'macos' | 'linux'

export type PlatformInput = {
  /** process.platform */
  platform: string
  env: Record<string, string | undefined>
  /** os.homedir() */
  home: string
}

export type PlatformPaths = {
  kind: PackagingKind
  /** The database, recordings, logs. */
  dataDir: string
  /** Downloaded speech models. Independent of --data-dir so test daemons share the user's models. */
  modelsDir: string
  /** hosts.json (paired device tokens). */
  configDir: string
  /** UI state (onboarding done, window size). */
  stateDir: string
}

/** The Flatpak app id; also the D-Bus name and the desktop file id. */
export const APP_ID = 'com.kacperlubisz.Kacola'

const join = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')

export function packagingKind(i: Pick<PlatformInput, 'platform' | 'env'>): PackagingKind {
  if (i.platform === 'darwin') return 'macos'
  // flatpak sets FLATPAK_ID for every process in the sandbox
  if (i.env.FLATPAK_ID) return 'flatpak'
  return 'linux'
}

export function platformPaths(i: PlatformInput): PlatformPaths {
  const { env, home } = i
  const kind = packagingKind(i)
  const appSupport = join(home, 'Library', 'Application Support', 'kacola')
  const mac = kind === 'macos'
  const dataRoot = env.XDG_DATA_HOME
    ? join(env.XDG_DATA_HOME, 'kacola')
    : mac
      ? appSupport
      : join(home, '.local', 'share', 'kacola')
  const dataDir = env.KACOLA_DATA_DIR || dataRoot
  return {
    kind,
    dataDir,
    modelsDir: env.KACOLA_MODELS_DIR || join(dataRoot, 'models'),
    configDir: env.XDG_CONFIG_HOME
      ? join(env.XDG_CONFIG_HOME, 'kacola')
      : mac
        ? appSupport
        : join(home, '.config', 'kacola'),
    stateDir: env.XDG_STATE_HOME
      ? join(env.XDG_STATE_HOME, 'kacola')
      : mac
        ? join(appSupport, 'state')
        : join(home, '.local', 'state', 'kacola'),
  }
}
