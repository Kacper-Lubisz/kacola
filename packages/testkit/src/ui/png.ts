import { readFileSync } from 'node:fs'

// Just enough PNG to assert a screenshot is real: the signature, the IHDR size, and a crude
// "is it more than one flat colour" check on the compressed payload size.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export type PngInfo = { width: number; height: number; bytes: number }

export function pngInfo(path: string): PngInfo {
  const buf = readFileSync(path)
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${path} is not a PNG`)
  if (buf.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error(`${path}: first chunk is not IHDR`)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length }
}
