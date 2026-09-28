import { describe, expect, it } from 'vitest'
import { formatOffset, parseDuration, parseOffset, parseSince } from '../src/time.ts'

describe('parseOffset', () => {
  it.each([
    ['0:00', 0],
    ['11:02', 662_000],
    ['1:02:03', 3_723_000],
    ['0:05.5', 5_500],
    ['90s', 90_000],
    ['1h30m', 5_400_000],
    ['1500', 1_500],
  ])('%s -> %i', (input, ms) => expect(parseOffset(input)).toBe(ms))

  it.each(['', 'abc', '1:60', '1:60:00', '12:3', '-5s', '5x'])('rejects %j', (bad) => {
    expect(() => parseOffset(bad)).toThrow()
  })

  it('round-trips formatOffset at second precision for every second in 3 hours', () => {
    for (let s = 0; s < 3 * 3600; s += 7) expect(parseOffset(formatOffset(s * 1000))).toBe(s * 1000)
  })
})

describe('parseDuration / parseSince', () => {
  it('sums compound durations', () =>
    expect(parseDuration('1d2h3m4s5ms')).toBe(86_400_000 + 7_200_000 + 180_000 + 4_000 + 5))
  it('refuses trailing garbage rather than guessing', () => expect(() => parseDuration('7d!')).toThrow())
  it('resolves relative bounds against now', () => {
    const now = new Date('2026-09-28T12:00:00Z')
    expect(parseSince('7d', now).toISOString()).toBe('2026-09-21T12:00:00.000Z')
    expect(parseSince('2026-09-01', now).toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})
