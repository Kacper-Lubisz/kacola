import { type PcmFrame, INGEST_SAMPLE_RATE as SAMPLE_RATE_HZ } from '@kacola/protocol'

// A stand-in for the desktop app's capture on macOS: plays a fixture track into the daemon's ingest route
// in real time, as 16 kHz s16 frames — the same wire format the app's AudioWorklet feeds.

export type PacedOptions = {
  /** Frame length (default 40 ms). */
  frameMs?: number
  epoch: number
  /** performance.now() at sample 0 of this epoch: frame k is released when its last sample is "captured". */
  t0: number
  from?: number
  to?: number
  signal?: AbortSignal
}

export async function* pacedFrames(pcm: Int16Array, o: PacedOptions): AsyncGenerator<PcmFrame> {
  const n = Math.round(((o.frameMs ?? 40) * SAMPLE_RATE_HZ) / 1000)
  const end = Math.min(o.to ?? pcm.length, pcm.length)
  for (let s = o.from ?? 0; s < end; s += n) {
    const e = Math.min(end, s + n)
    const due = o.t0 + (e * 1000) / SAMPLE_RATE_HZ
    const wait = due - performance.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    if (o.signal?.aborted) return
    yield { epoch: o.epoch, sample: s, samples: pcm.slice(s, e) }
  }
}
