import { contextBridge, ipcRenderer } from 'electron'
import { CAPTURE_IPC, type CaptureBridge, type CaptureCommand } from '../shared/capture.ts'

// The capture window's preload: it can receive start/stop and send audio frames and its state — nothing
// else. The main window's bridge (preload/index.ts) is not exposed here, and this one is not exposed there.

const bridge: CaptureBridge = {
  onCommand(cb) {
    const handler = (_e: unknown, c: CaptureCommand) => cb(c)
    ipcRenderer.on(CAPTURE_IPC.command, handler)
    return () => {
      ipcRenderer.removeListener(CAPTURE_IPC.command, handler)
    }
  },
  frame: (track, samples) => ipcRenderer.send(CAPTURE_IPC.frame, track, samples),
  state: (s) => ipcRenderer.send(CAPTURE_IPC.state, s),
}

contextBridge.exposeInMainWorld('gnomeolaCapture', bridge)
