// Offline resampling for file-backed sources (fixtures recorded at 44.1/48 kHz). Not on the PipeWire
// path — PipeWire resamples to 16 kHz itself. Windowed-sinc (Hann), band-limited to 95% of the lower
// Nyquist, which keeps tones intact and suppresses aliasing well below anything the tests measure.

export function resample(
  input: Float32Array,
  fromRate: number,
  toRate: number,
  zeroCrossings = 16,
): Float32Array {
  if (fromRate === toRate) return input.slice()
  if (fromRate <= 0 || toRate <= 0) throw new Error('rates must be positive')
  const ratio = toRate / fromRate
  const outLen = Math.floor(input.length * ratio)
  const out = new Float32Array(outLen)
  const cutoff = Math.min(1, ratio) * 0.95 // relative to input Nyquist
  const half = Math.ceil(zeroCrossings / cutoff)
  for (let i = 0; i < outLen; i++) {
    const center = i / ratio
    const lo = Math.max(0, Math.ceil(center - half))
    const hi = Math.min(input.length - 1, Math.floor(center + half))
    let acc = 0
    let norm = 0
    for (let j = lo; j <= hi; j++) {
      const x = j - center
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (half + 1))
      const arg = Math.PI * cutoff * x
      const s = x === 0 ? 1 : Math.sin(arg) / arg
      const k = s * w
      acc += input[j]! * k
      norm += k
    }
    out[i] = norm ? acc / norm : 0
  }
  return out
}

export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const v = Math.round(input[i]! * 32768)
    out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v
  }
  return out
}
