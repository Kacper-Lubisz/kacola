import { contextBridge, ipcRenderer } from 'electron'
import {
  type DaemonStatus,
  type GnomeolaBridge,
  IPC,
  type SaveTextRequest,
  type Theme,
  type TunnelRequest,
  type UiState,
  type WindowControl,
} from '../shared/bridge.ts'
import { channelOf, openTunnel } from '../shared/tunnel-port.ts'

// The only door between the renderer and everything privileged: a narrow, typed `window.gnomeola`.
// No ipcRenderer, no generic invoke(channel) — each capability is one named function, and main
// validates its arguments again (a compromised renderer can call these with anything).

function listen<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_e: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const bridge: GnomeolaBridge = {
  fetchStream: (req, onFrame) =>
    openTunnel(
      req,
      onFrame,
      () => channelOf(new MessageChannel()),
      (r: TunnelRequest, port: MessagePort) => ipcRenderer.postMessage(IPC.tunnel, r, [port]),
    ),
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  theme: () => ipcRenderer.invoke(IPC.theme),
  onTheme: (cb) => listen<Theme>(IPC.themeChanged, cb),
  daemonStatus: () => ipcRenderer.invoke(IPC.daemonStatus),
  onDaemonStatus: (cb) => listen<DaemonStatus>(IPC.daemonStatusChanged, cb),
  getUiState: () => ipcRenderer.invoke(IPC.uiStateGet),
  setUiState: (s: UiState) => ipcRenderer.invoke(IPC.uiStateSet, s),
  notices: () => ipcRenderer.invoke(IPC.notices),
  catalogue: () => ipcRenderer.invoke(IPC.i18n),
  windowControl: (c: WindowControl) => ipcRenderer.send(IPC.windowControl, c),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
  copyText: (text: string) => ipcRenderer.invoke(IPC.clipboardWrite, text),
  saveTextFile: (req: SaveTextRequest) => ipcRenderer.invoke(IPC.saveText, req),
  cliStatus: () => ipcRenderer.invoke(IPC.cliStatus),
  installCli: (force: boolean) => ipcRenderer.invoke(IPC.cliInstall, force === true),
  uninstallCli: () => ipcRenderer.invoke(IPC.cliUninstall),
  extensionStatus: () => ipcRenderer.invoke(IPC.extensionStatus),
  installExtension: () => ipcRenderer.invoke(IPC.extensionInstall),
}

contextBridge.exposeInMainWorld('gnomeola', bridge)
