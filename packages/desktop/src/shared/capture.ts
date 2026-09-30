// In-app capture: the contract between main and the hidden capture window (docs/desktop-app.md,
// "In-app capture"). Types and constants only — imported by main, the capture preload and the capture page.

export const CAPTURE_IPC = {
  /** main → capture window: CaptureCommand */
  command: 'gnomeola:capture-command',
  /** capture window → main: (track, ArrayBuffer of s16 LE samples at 16 kHz) */
  frame: 'gnomeola:capture-frame',
  /** capture window → main: CaptureState */
  state: 'gnomeola:capture-state',
} as const

export type CaptureTrack = 'mic' | 'system'

export type CaptureCommand = { type: 'start'; track: CaptureTrack } | { type: 'stop'; track: CaptureTrack }

export type CaptureState =
  | { track: CaptureTrack; state: 'running'; sampleRate: number; label: string }
  | { track: CaptureTrack; state: 'stopped' }
  | { track: CaptureTrack; state: 'error'; detail: string }

/** window.gnomeolaCapture, exposed by the capture window's preload only. */
export interface CaptureBridge {
  onCommand(cb: (c: CaptureCommand) => void): () => void
  frame(track: CaptureTrack, samples: ArrayBuffer): void
  state(s: CaptureState): void
}
