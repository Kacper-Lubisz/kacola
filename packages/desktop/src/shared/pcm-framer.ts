// In-app capture (docs/desktop-app.md, "In-app capture"): Web Audio float samples at the context's rate
// → 16 kHz mono s16 frames of a fixed length, the daemon's ingest format (protocol capture.ts). Runs in
// the capture window's AudioWorklet; pure, so it is unit-tested in Node.
//
// The capture window asks for a 16 kHz AudioContext, so Chromium's own resampler (windowed sinc) does the
// real work and this is a pass-through. If a platform hands back another rate anyway, a streaming linear
// interpolator converts it — adequate for speech recognition, whose features stop well below 8 kHz.

export const TARGET_RATE = 16_000
/** 40 ms at 16 kHz: small enough for live partials, large enough to keep IPC cheap (25 frames/s). */
export const FRAME_SAMPLES = 640

const toS16 = (v: number) => {
  const c = v > 1 ? 1 : v < -1 ? -1 : v
  return c < 0 ? Math.round(c * 32768) : Math.round(c * 32767)
}

export class Pcm16Framer {
  private readonly step: number
  /** Where the next output sample lies, in input samples from the start of the next quantum (≥ −1). */
  private pos = 0
  private prev = 0
  private readonly out: Int16Array
  private fill = 0

  readonly inputRate: number
  readonly frameSamples: number

  constructor(inputRate: number, frameSamples = FRAME_SAMPLES) {
    if (!(inputRate > 0)) throw new Error(`bad input rate ${inputRate}`)
    this.inputRate = inputRate
    this.frameSamples = frameSamples
    this.step = inputRate / TARGET_RATE
    this.out = new Int16Array(frameSamples)
  }

  /** Feed one render quantum (any length); returns the frames completed by it (copies). */
  push(input: Float32Array): Int16Array[] {
    const frames: Int16Array[] = []
    const emit = (v: number) => {
      this.out[this.fill++] = toS16(v)
      if (this.fill === this.frameSamples) {
        frames.push(this.out.slice())
        this.fill = 0
      }
    }
    if (this.step === 1) {
      for (let i = 0; i < input.length; i++) emit(input[i]!)
      return frames
    }
    // the input as x(t), t ≥ −1, where x(−1) is the previous quantum's last sample
    const at = (i: number) => (i < 0 ? this.prev : input[i]!)
    while (this.pos <= input.length - 1) {
      const i = Math.floor(this.pos)
      const f = this.pos - i
      emit(f === 0 ? at(i) : at(i) + (at(i + 1) - at(i)) * f)
      this.pos += this.step
    }
    this.pos -= input.length
    if (input.length) this.prev = input[input.length - 1]!
    return frames
  }

  /** Samples buffered towards the next frame. */
  get pending(): number {
    return this.fill
  }
}
