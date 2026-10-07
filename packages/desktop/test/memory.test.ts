import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { asciiOnly } from '../electron.vite.config.ts'
import { collectGarbage, IdleCollector } from '../src/main/memory.ts'

// The footprint fixes (docs/desktop-app.md, Footprint): main collects its garbage after bursts, and the
// bundles are ASCII-only so V8 holds their sources one byte a character.

describe('collectGarbage', () => {
  it('runs a full collection on this runtime', () => {
    expect(collectGarbage()).toBe(true)
    expect(collectGarbage()).toBe(true)
  })
})

describe('IdleCollector', () => {
  it('collects settleMs after the last settle (bursts coalesce), and every periodMs', () => {
    vi.useFakeTimers()
    try {
      const collect = vi.fn()
      const c = new IdleCollector({ settleMs: 10_000, periodMs: 300_000, collect }).start()
      c.settle()
      vi.advanceTimersByTime(9_000)
      c.settle() // a second burst restarts the wait
      vi.advanceTimersByTime(9_000)
      expect(collect).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1_000)
      expect(collect).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(300_000 - 19_000)
      expect(collect).toHaveBeenCalledTimes(2) // the period
      vi.advanceTimersByTime(300_000)
      expect(collect).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never collects periodically with periodMs 0', () => {
    vi.useFakeTimers()
    try {
      const collect = vi.fn()
      new IdleCollector({ settleMs: 10, periodMs: 0, collect }).start()
      vi.advanceTimersByTime(3_600_000)
      expect(collect).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('asciiOnly (bundle output)', () => {
  const run = (code: string): string => {
    const bundle = { 'a.js': { type: 'chunk' as const, code } }
    const hook = asciiOnly().generateBundle as unknown as { handler: (o: unknown, b: typeof bundle) => void }
    hook.handler({}, bundle)
    return bundle['a.js'].code
  }

  it('escapes every non-ASCII unit, and the code means the same', () => {
    const src =
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source code under test, not a template
      'const s = "Starting… — ☝️ 😀", t = `kacola — ${1}`, r = /[—–]/u, q = /[—–]/; ' +
      '[s, t, r.test("–"), q.test("—"), "😀".length]'
    const out = run(src)
    expect([...out].filter((c) => c.charCodeAt(0) > 0x7f)).toEqual([])
    expect(runInNewContext(out)).toEqual(runInNewContext(src))
  })
})
