// The contract between the three Electron processes: IPC channel names and the `window.gnomeola` API
// the preload exposes. Types and constants only — this file is imported by main (Node), preload
// (sandboxed) and the renderer (DOM), so it must not touch any runtime.

/**
 * The renderer's protocol client uses this as its base URL. It is never dialled: the tunnel strips it
 * and main prefixes the real daemon URL, so the renderer does not even know where the daemon is.
 */
export const TUNNEL_ORIGIN = 'http://daemon.gnomeola.invalid'

export const IPC = {
  /** ipcRenderer.postMessage(IPC.tunnel, TunnelRequest, [port]) — the response streams back on the port. */
  tunnel: 'gnomeola:tunnel',
  appInfo: 'gnomeola:app-info',
  theme: 'gnomeola:theme',
  themeChanged: 'gnomeola:theme-changed',
  daemonStatus: 'gnomeola:daemon-status',
  daemonStatusChanged: 'gnomeola:daemon-status-changed',
  uiStateGet: 'gnomeola:ui-state-get',
  uiStateSet: 'gnomeola:ui-state-set',
  notices: 'gnomeola:notices',
  i18n: 'gnomeola:i18n',
  windowControl: 'gnomeola:window-control',
  openExternal: 'gnomeola:open-external',
  clipboardWrite: 'gnomeola:clipboard-write',
  saveText: 'gnomeola:save-text',
  cliStatus: 'gnomeola:cli-status',
  cliInstall: 'gnomeola:cli-install',
  cliUninstall: 'gnomeola:cli-uninstall',
  extensionStatus: 'gnomeola:extension-status',
  extensionInstall: 'gnomeola:extension-install',
} as const

// ---- fetch tunnel -----------------------------------------------------------------------------------

export type TunnelRequest = {
  method: string
  /** Path and query only ("/sessions?limit=5"); an absolute URL is refused. */
  path: string
  headers: Record<string, string>
  body?: string
}

export type TunnelFrame =
  | { type: 'head'; status: number; statusText: string; headers: [string, string][] }
  | { type: 'chunk'; data: Uint8Array }
  | { type: 'end' }
  /** The daemon could not be reached, or the stream broke. Surfaces as a fetch TypeError. */
  | { type: 'error'; message: string }

export type TunnelControl = { type: 'cancel' }

// ---- everything else the window needs from main -----------------------------------------------------

export type Theme = {
  scheme: 'light' | 'dark'
  contrast: 'normal' | 'high'
  /** "#rrggbb" from the portal's accent-color, or null for the Adwaita default blue. */
  accent: string | null
}

export type DaemonStatus =
  /** A daemon was already answering at the configured URL (systemd, a remote host). */
  | { kind: 'attached' }
  /** We started one and it is healthy. */
  | { kind: 'spawned'; pid: number }
  | { kind: 'starting' }
  | { kind: 'restarting'; attempt: number; inMs: number; lastError: string }
  /** A remote URL that does not answer: we never spawn for a non-loopback URL. */
  | { kind: 'unreachable'; error: string }
  | { kind: 'stopped' }

export type AppInfo = {
  version: string
  electron: string
  platform: string
  /** Where the daemon is, for display ("Connected to …"). The token never crosses. */
  daemonUrl: string
  /** Window buttons, from org.gnome.desktop.wm.preferences button-layout (e.g. "appmenu:close"). */
  buttonLayout: string
}

export type UiState = {
  version: 1
  onboardingDone: boolean
  skippedMissing: string[]
}

export type Catalogue = {
  locale: string
  /** msgid → msgstr, or [one, other, …] plural forms. Empty for English. */
  messages: Record<string, string | string[]>
}

/** A text file to save through the system's "save as" dialog (notes export). */
export type SaveTextRequest = {
  /** The dialog's title. */
  title: string
  /** Suggested file name (one path component; main sanitizes it and starts in Documents). */
  defaultName: string
  text: string
}

export type SaveTextResult = { saved: true; path: string } | { saved: false }
/** The `gnomeola` command (+ Claude skill) that install-cli puts on PATH (Preferences, onboarding). */
export type CliInstallState =
  | {
      state: 'installed' | 'not-installed' | 'outdated'
      /** Where the shim is (or would go). */
      path: string
      skillPath: string | null
      /** Is its directory on PATH? */
      onPath: boolean
      /** Another `gnomeola` that PATH finds first. */
      shadowedBy: string | null
      /** macOS: /usr/local/bin needed admin rights, so it went to ~/.local/bin. */
      needsAdmin: string | null
    }
  /** A `gnomeola` we did not write is in the way; installing again needs an explicit replace. */
  | { state: 'foreign'; path: string | null; detail: string }
  | { state: 'error' | 'unavailable'; detail: string }

/** The GNOME Shell top-bar extension. */
export type ExtensionState =
  | { state: 'installed' | 'not-installed' | 'unsupported' }
  | { state: 'error' | 'unavailable'; detail: string }

export type WindowControl = 'minimize' | 'maximize' | 'close'

export type Unsubscribe = () => void

export interface GnomeolaBridge {
  /** Open a tunnelled request; frames arrive on `onFrame`. Returns a cancel function. */
  fetchStream(req: TunnelRequest, onFrame: (f: TunnelFrame) => void): () => void
  appInfo(): Promise<AppInfo>
  theme(): Promise<Theme>
  onTheme(cb: (t: Theme) => void): Unsubscribe
  daemonStatus(): Promise<DaemonStatus>
  onDaemonStatus(cb: (s: DaemonStatus) => void): Unsubscribe
  getUiState(): Promise<UiState>
  setUiState(s: UiState): Promise<void>
  /** THIRD_PARTY_NOTICES.md as shipped with this build. */
  notices(): Promise<string>
  catalogue(): Promise<Catalogue>
  windowControl(c: WindowControl): void
  /** http(s) only; anything else is refused in main. */
  openExternal(url: string): Promise<boolean>
  /** Put text on the system clipboard. */
  copyText(text: string): Promise<void>
  /** Ask where to save, then write the text there. `{ saved: false }` when the dialog was dismissed. */
  saveTextFile(req: SaveTextRequest): Promise<SaveTextResult>
  cliStatus(): Promise<CliInstallState>
  /** `force` replaces a `gnomeola` we did not write (only after the user said so). */
  installCli(force: boolean): Promise<CliInstallState>
  uninstallCli(): Promise<CliInstallState>
  extensionStatus(): Promise<ExtensionState>
  installExtension(): Promise<ExtensionState>
}
