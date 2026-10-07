import type { CaptureBridge, CaptureTrack } from '../../shared/capture.ts'
import workletUrl from './pcm-worklet.ts?worker&url'

// The hidden capture window (src/main/capture-window.ts). Main says which tracks to capture; this page
// opens them and streams 16 kHz s16 frames back:
//
//   mic     getUserMedia (the OS default input; echo cancellation, noise suppression and AGC off — the
//           daemon's pipeline wants the raw signal, like pw-record gives it on Linux)
//   system  getDisplayMedia with loopback audio (macOS 13+: main's display-media handler answers with
//           audio: 'loopback'); the video track is stopped at once. Not available on Linux Chromium.
//
// A 16 kHz AudioContext makes Chromium resample; the worklet (pcm-worklet.ts) cuts 40 ms frames. The page
// has no network, no Node, and only this bridge (preload/capture.ts).

const bridge = (globalThis as unknown as { kacolaCapture: CaptureBridge }).kacolaCapture

type Running = { stop: () => void }
const running = new Map<CaptureTrack, Running>()

async function open(track: CaptureTrack): Promise<MediaStream> {
  if (track === 'mic')
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      video: false,
    })
  const s = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
  for (const v of s.getVideoTracks()) v.stop()
  return s
}

async function start(track: CaptureTrack): Promise<void> {
  running.get(track)?.stop()
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  const stop = () => {
    for (const t of stream?.getTracks() ?? []) t.stop()
    void ctx?.close().catch(() => {})
    if (running.get(track) === handle) running.delete(track)
  }
  const handle: Running = { stop }
  running.set(track, handle)
  try {
    stream = await open(track)
    const audio = stream.getAudioTracks()[0]
    if (!audio) throw new Error('no audio track')
    if (running.get(track) !== handle) return stop()
    ctx = new AudioContext({ sampleRate: 16_000, latencyHint: 'interactive' })
    await ctx.audioWorklet.addModule(workletUrl)
    const node = new AudioWorkletNode(ctx, 'kacola-pcm', {
      numberOfInputs: 1,
      // no outputs: an input-only worklet is pulled by the graph without being routed to the speakers
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (running.get(track) === handle) bridge.frame(track, e.data)
    }
    if (ctx.state !== 'running') await ctx.resume()
    // before the first frame: main numbers frames from here
    bridge.state({ track, state: 'running', sampleRate: ctx.sampleRate, label: audio.label })
    ctx.createMediaStreamSource(stream).connect(node)
    audio.addEventListener('ended', () => {
      if (running.get(track) !== handle) return
      stop()
      bridge.state({ track, state: 'error', detail: 'the capture device went away' })
    })
  } catch (err) {
    stop()
    bridge.state({
      track,
      state: 'error',
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
  }
}

bridge.onCommand((c) => {
  if (c.type === 'start') void start(c.track)
  else {
    running.get(c.track)?.stop()
    bridge.state({ track: c.track, state: 'stopped' })
  }
})
