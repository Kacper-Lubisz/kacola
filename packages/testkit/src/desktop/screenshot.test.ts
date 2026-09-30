import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { comparePng, decodePng, encodePng, matchBaseline, type Rgba } from './screenshot.ts'

const img = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): Rgba => {
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...f(x, y), 255], (y * w + x) * 4)
  return { width: w, height: h, data }
}

describe('screenshot baselines', () => {
  afterEach(() => {
    delete process.env.GNOMEOLA_UPDATE_SCREENSHOTS
  })

  it('encodes and decodes a PNG losslessly', () => {
    const a = img(37, 11, (x, y) => [x * 7, y * 20, (x * y) % 256])
    const b = decodePng(encodePng(a))
    expect(b.width).toBe(37)
    expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true)
  })

  it('counts pixels over the threshold', () => {
    const a = img(10, 10, () => [100, 100, 100])
    const b = img(10, 10, (x) => (x < 2 ? [200, 100, 100] : [105, 100, 100]))
    const c = comparePng(a, b, 0.1)
    expect(c.diffPixels).toBe(20)
    expect(c.ratio).toBeCloseTo(0.2)
    expect(
      comparePng(
        a,
        img(5, 5, () => [0, 0, 0]),
      ).sizeMismatch,
    ).toBe(true)
  })

  it('records a missing baseline, passes a match, fails a change with a diff image, and updates on request', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-shots-'))
    const actual = join(dir, 'a.png')
    const base = join(dir, 'base', 'a.png')
    writeFileSync(actual, encodePng(img(20, 20, () => [10, 20, 30])))
    expect(matchBaseline(actual, base)).toBeNull() // recorded
    expect(matchBaseline(actual, base)).toBeNull() // identical
    writeFileSync(actual, encodePng(img(20, 20, (x) => (x < 5 ? [250, 0, 0] : [10, 20, 30]))))
    const f = matchBaseline(actual, base)
    expect(f).toMatch(/100 pixels \(25\.00%\) differ/)
    expect(decodePng(readFileSync(join(dir, 'a.diff.png'))).width).toBe(20)
    process.env.GNOMEOLA_UPDATE_SCREENSHOTS = '1'
    expect(matchBaseline(actual, base)).toBeNull()
    delete process.env.GNOMEOLA_UPDATE_SCREENSHOTS
    expect(matchBaseline(actual, base)).toBeNull()
  })
})
