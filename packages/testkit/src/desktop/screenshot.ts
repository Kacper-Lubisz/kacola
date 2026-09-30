import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'

// Screenshot baselines for the desktop e2e (Playwright's toHaveScreenshot, for vitest): decode two PNGs,
// count pixels whose colour differs by more than `threshold` (0..1 of the max channel distance), and
// fail when more than `maxDiffRatio` of the image differs. A missing baseline — or
// GNOMEOLA_UPDATE_SCREENSHOTS=1 — writes the current image as the new baseline. On a mismatch a diff
// image (changed pixels in red over a dimmed copy) is written next to the actual one.

export type Rgba = { width: number; height: number; data: Uint8Array }

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** 8-bit, non-interlaced RGB / RGBA / grey PNGs (what Chromium writes). */
export function decodePng(buf: Buffer): Rgba {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let off = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat: Buffer[] = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[12] !== 0) throw new Error('only 8-bit non-interlaced PNGs')
      colorType = body[9]!
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    off += 12 + len
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const cur = new Uint8Array(stride)
  let prev = new Uint8Array(stride)
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels]! : 0
      const b = prev[x]!
      const c = x >= channels ? prev[x - channels]! : 0
      const v = line[x]!
      cur[x] =
        (f === 0
          ? v
          : f === 1
            ? v + a
            : f === 2
              ? v + b
              : f === 3
                ? v + ((a + b) >> 1)
                : v + paeth(a, b, c)) & 255
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const i = x * channels
      if (channels >= 3) {
        out[o] = cur[i]!
        out[o + 1] = cur[i + 1]!
        out[o + 2] = cur[i + 2]!
        out[o + 3] = channels === 4 ? cur[i + 3]! : 255
      } else {
        out[o] = out[o + 1] = out[o + 2] = cur[i]!
        out[o + 3] = channels === 2 ? cur[i + 1]! : 255
      }
    }
    prev = Uint8Array.from(cur)
  }
  return { width, height, data: out }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b: Buffer) => {
  let c = 0xffffffff
  for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, body: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length)
  const tb = Buffer.concat([Buffer.from(type, 'latin1'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(tb))
  return Buffer.concat([len, tb, crc])
}

export function encodePng(img: Rgba): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.width, 0)
  ihdr.writeUInt32BE(img.height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height)
  for (let y = 0; y < img.height; y++)
    Buffer.from(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4)).copy(
      raw,
      y * (img.width * 4 + 1) + 1,
    )
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export type Comparison = { diffPixels: number; ratio: number; sizeMismatch: boolean; diff: Rgba | null }

export function comparePng(a: Rgba, b: Rgba, threshold = 0.1): Comparison {
  if (a.width !== b.width || a.height !== b.height)
    return { diffPixels: -1, ratio: 1, sizeMismatch: true, diff: null }
  const max = threshold * 255
  const diff = new Uint8Array(a.data.length)
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(
      Math.abs(a.data[i]! - b.data[i]!),
      Math.abs(a.data[i + 1]! - b.data[i + 1]!),
      Math.abs(a.data[i + 2]! - b.data[i + 2]!),
    )
    if (d > max) {
      n++
      diff.set([255, 0, 0, 255], i)
    } else {
      const g = (a.data[i]! + a.data[i + 1]! + a.data[i + 2]!) / 3
      diff.set([g, g, g, 60], i)
    }
  }
  return {
    diffPixels: n,
    ratio: n / (a.width * a.height),
    sizeMismatch: false,
    diff: { width: a.width, height: a.height, data: diff },
  }
}

/**
 * Compare `actualPath` with `baselinePath`. Returns null when it matches (or the baseline was just
 * written), else a human-readable failure (and writes `<actual>.diff.png`).
 */
export function matchBaseline(
  actualPath: string,
  baselinePath: string,
  o: { maxDiffRatio?: number; threshold?: number } = {},
): string | null {
  if (!existsSync(baselinePath) || process.env.GNOMEOLA_UPDATE_SCREENSHOTS === '1') {
    mkdirSync(dirname(baselinePath), { recursive: true })
    copyFileSync(actualPath, baselinePath)
    return null
  }
  const c = comparePng(
    decodePng(readFileSync(actualPath)),
    decodePng(readFileSync(baselinePath)),
    o.threshold,
  )
  if (c.sizeMismatch) return `${actualPath}: size differs from the baseline ${baselinePath}`
  if (c.ratio <= (o.maxDiffRatio ?? 0.005)) return null
  const diffPath = actualPath.replace(/\.png$/, '.diff.png')
  if (c.diff) writeFileSync(diffPath, encodePng(c.diff))
  return `${actualPath}: ${c.diffPixels} pixels (${(c.ratio * 100).toFixed(2)}%) differ from ${baselinePath}; diff at ${diffPath} (GNOMEOLA_UPDATE_SCREENSHOTS=1 to accept)`
}
