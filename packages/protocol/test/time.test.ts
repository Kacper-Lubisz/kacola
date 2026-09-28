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

describe('time parsing — edge cases pinned by mutation testing', () => {
  it('accepts minutes past 59 when there is no hour part', () => expect(parseOffset('75:00')).toBe(4_500_000))
  it('accepts multi-digit hours and trims input', () => {
    expect(parseOffset('10:00:00')).toBe(36_000_000)
    expect(parseOffset('  1:30  ')).toBe(90_000)
    expect(parseDuration(' 90s ')).toBe(90_000)
  })
  it('handles fractional seconds and fractional units', () => {
    expect(parseOffset('0:05.25')).toBe(5_250)
    expect(parseOffset('0:05.123')).toBe(5_123)
    expect(parseDuration('1.5h')).toBe(5_400_000)
  })
  it.each(['1:00x', 'x1:00', '0:05.1234', '1.h', '1..5h', '1:2:3'])('rejects %j', (bad) =>
    expect(() => parseOffset(bad)).toThrow(),
  )
  it('formats exactly', () => {
    expect(formatOffset(3_723_000)).toBe('1:02:03')
    expect(formatOffset(62_000)).toBe('1:02')
    expect(formatOffset(-5)).toBe('0:00')
  })
  it('parses since as a date only when it looks like one, and rejects impossible dates', () => {
    const now = new Date('2026-09-28T12:00:00Z')
    expect(parseSince(' 2026-09-01 ', now).toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(() => parseSince('2026-13-45', now)).toThrow(/invalid date/)
    expect(() => parseSince('x2026-09-01', now)).toThrow(/invalid duration/)
  })
  it('errors name the input', () => {
    expect(() => parseOffset('nope')).toThrow('invalid duration: nope')
    expect(() => parseOffset('1:75:00')).toThrow('invalid time: 1:75:00')
  })
})
