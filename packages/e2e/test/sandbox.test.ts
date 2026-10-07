import { describe, expect, it } from 'vitest'
import { meetingId as daemonMeetingId } from '../../daemon/src/calendar/meetings.ts'
import { parseCalendarFile } from '../../daemon/src/calendar/providers.ts'
import {
  CALENDAR_ID,
  meetingId,
  parseDuration,
  renderCalendar,
  seedMeetings,
} from '../src/sandbox/calendar.ts'
import { chooseProviders, SandboxError, sandboxDir } from '../src/sandbox/cli.ts'
import { SCENARIOS, scriptCard, scriptFor } from '../src/sandbox/scenarios.ts'

// The sandbox's pure parts: the mock calendar is what the daemon's file provider reads, the directory
// can never be the everyday kacola's, providers follow the environment, the scenarios fit their meetings.

describe('sandbox', () => {
  it('renders a calendar the daemon reads, with its meeting ids', () => {
    const now = Date.parse('2026-10-02T09:00:00Z')
    const meetings = seedMeetings(now)
    const snap = parseCalendarFile(renderCalendar(meetings))
    expect(snap.occurrences.map((o) => o.summary)).toEqual(meetings.map((m) => m.title))
    for (const m of meetings)
      expect(meetingId(m.uid, m.recurrenceId)).toBe(daemonMeetingId(CALENDAR_ID, m.uid, m.recurrenceId))
    const upcoming = meetings.filter((m) => Date.parse(m.start) > now)
    expect(upcoming.map((m) => [m.title, (Date.parse(m.start) - now) / 60_000])).toEqual([
      ['1:1 with Ana', 2],
      ['Intro call with Sam', 15],
      ['Prototype feedback with the PM', 40],
    ])
  })

  it('parses durations', () => {
    expect(parseDuration('5m')).toBe(300_000)
    expect(parseDuration('1h30m')).toBe(5_400_000)
    expect(parseDuration('-10m')).toBe(-600_000)
    expect(() => parseDuration('soon')).toThrow(/not a duration/)
  })

  it('never uses the everyday data dir, or anything around it', () => {
    const env = { HOME: '/home/u', XDG_DATA_HOME: '' }
    expect(sandboxDir(undefined, env)).toBe('/home/u/.local/share/kacola-sandbox')
    expect(sandboxDir(undefined, { ...env, KACOLA_SANDBOX_DIR: '/tmp/sbx' })).toBe('/tmp/sbx')
    for (const bad of [
      '/home/u/.local/share/kacola',
      '/home/u/.local/share/kacola/x',
      '/home/u/.local',
      '/home/u',
      '/',
    ])
      expect(() => sandboxDir(bad, env), bad).toThrow(SandboxError)
    // KACOLA_DATA_DIR in the shell does not move what "everyday" means
    expect(() =>
      sandboxDir('/home/u/.local/share/kacola', { ...env, KACOLA_DATA_DIR: '/elsewhere' }),
    ).toThrow(SandboxError)
    expect(() => sandboxDir('/elsewhere/sbx', { ...env, KACOLA_DATA_DIR: '/elsewhere' })).toThrow(
      SandboxError,
    )
  })

  it('picks providers from the environment', () => {
    expect(chooseProviders({}, {})).toEqual({ llm: 'fake', decisions: 'local' })
    expect(chooseProviders({ OPENAI_API_KEY: 'k' }, {})).toEqual({ llm: 'openai', decisions: 'openai' })
    expect(chooseProviders({ OPENAI_API_KEY: 'k', TYPESAFE_AI_API_KEY: 't' }, {})).toEqual({
      llm: 'openai',
      decisions: 'jev',
    })
    expect(chooseProviders({ ANTHROPIC_API_KEY: 'a', TYPESAFE_API_KEY: 't' }, {})).toEqual({
      llm: 'anthropic',
      decisions: 'jev',
    })
    expect(chooseProviders({ OPENAI_API_KEY: ' ' }, { llm: 'none', decisions: 'jev' })).toEqual({
      llm: 'none',
      decisions: 'jev',
    })
    expect(() => chooseProviders({}, { llm: 'gpt' })).toThrow(SandboxError)
  })

  it('every scenario belongs to a mock meeting and speaks in order', () => {
    const uids = new Set(seedMeetings().map((m) => m.uid))
    for (const s of SCENARIOS) {
      expect(uids.has(s.meetingUid), s.id).toBe(true)
      const u = scriptFor(s).utterances
      expect(u.length).toBe(s.lines.length)
      for (let i = 1; i < u.length; i++) expect(u[i]!.startMs).toBeGreaterThan(u[i - 1]!.endMs)
      expect(scriptFor(s, 4).utterances.at(-1)!.endMs).toBeLessThan(u.at(-1)!.endMs / 3)
      expect(u.filter((x) => x.track === 'system').every((x) => x.speaker === s.them)).toBe(true)
      expect(scriptCard(s)).toContain(s.lines[0]![1])
      expect(s.agenda.match(/^- \[ \]/gm)?.length).toBe(5)
    }
  })
})
