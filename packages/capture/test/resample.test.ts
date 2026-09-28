import { goertzel } from '@gnomeola/testkit/rig'
import { describe, expect, it } from 'vitest'
import { floatToInt16, resample } from '../src/index.ts'

const tone = (hz: number, rate: number, seconds: number, amp = 0.5) => {
  const n = Math.round(rate * seconds)
  const s = new Float32Array(n)
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate)
  return s
}

// Power of a tone at `hz` in a 16 kHz float signal, via the testkit Goertzel (which expects Int16).
const power16k = (x: Float32Array, hz: number) => goertzel(floatToInt16(x), hz, 800, x.length - 800)

describe('resample', () => {
  for (const from of [48000, 44100, 22050, 8000]) {
    it(`${from} Hz → 16 kHz keeps a 1 kHz tone's level (±0.2 dB) and length`, () => {
      const out = resample(tone(1000, from, 1), from, 16000)
      expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(1)
      const ref = power16k(tone(1000, 16000, 1), 1000)
      const db = 10 * Math.log10(power16k(out, 1000) / ref)
      expect(Math.abs(db)).toBeLessThan(0.2)
    })
  }

  it('suppresses content above the new Nyquist (a 10 kHz tone at 48 kHz does not alias to 6 kHz)', () => {
    const out = resample(tone(10000, 48000, 1), 48000, 16000)
    const alias = power16k(out, 6000)
    const ref = power16k(tone(6000, 16000, 1), 6000)
    expect(10 * Math.log10((alias + 1e-20) / ref)).toBeLessThan(-40)
  })

  it('is the identity at equal rates and rejects bad rates', () => {
    const x = tone(440, 16000, 0.1)
    expect(resample(x, 16000, 16000)).toEqual(x)
    expect(() => resample(x, 0, 16000)).toThrow()
  })
})

describe('floatToInt16', () => {
  it('scales, rounds and clamps', () => {
    expect(Array.from(floatToInt16(Float32Array.from([0, 0.5, -0.5, 1, -1, 2, -2])))).toEqual([
      0, 16384, -16384, 32767, -32768, 32767, -32768,
    ])
  })
})
