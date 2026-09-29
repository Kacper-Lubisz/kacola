// Minimal RIFF/WAVE (PCM s16le mono) framing for sending raw PCM to a provider, and back. Kept here, not
// shared with @gnomeola/capture, because the hosted bundle must not depend on the capture package.

export function encodeWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length)
  const v = new DataView(out.buffer)
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i)
  }
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + pcm.length, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  ascii(36, 'data')
  v.setUint32(40, pcm.length, true)
  out.set(pcm, 44)
  return out
}

/** The PCM payload and rate of a canonical 44-byte-header WAV (what encodeWav writes). */
export function decodeWav(wav: Uint8Array): { pcm: Uint8Array; sampleRate: number } {
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
  const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(36) !== 'data') throw new Error('not a canonical PCM WAV')
  const len = Math.min(v.getUint32(40, true), wav.length - 44)
  return { pcm: wav.subarray(44, 44 + len), sampleRate: v.getUint32(24, true) }
}

export function float32ToS16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2)
  const v = new DataView(out.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    v.setInt16(i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true)
  }
  return out
}
