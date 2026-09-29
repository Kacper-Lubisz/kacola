import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { EXIT } from '../src/errors.ts'
import { BUDGET, countTokens } from '../src/tokens.ts'
import { type FakeDaemon, IDS, SPEAKERS, seed, startFakeDaemon } from './fake-daemon.ts'
import { cli } from './helpers.ts'

let d: FakeDaemon
beforeAll(async () => {
  d = await startFakeDaemon()
})
beforeEach(() => {
  // Each test starts from the same seeded world.
  Object.assign(d.state, seed())
  d.askScript = null
})

// Suite-wide guarantees, checked after every test has run: these are properties of the CLI as a whole,
// not of any one command, so they are asserted over every request any test caused.
afterAll(async () => {
  const everything = d.requests
  expect(everything.length).toBeGreaterThan(30)
  // X-7: the CLI has no way to ask for private sessions.
  expect(everything.filter((r) => 'includePrivate' in r.query)).toEqual([])
  expect(
    everything.filter((r) => (r.body as { includePrivate?: unknown } | null)?.includePrivate !== undefined),
  ).toEqual([])
  // Read-only outside `record`: no DELETE, no PATCH, no PUT, and POSTs only to the record/ask verbs.
  expect(everything.filter((r) => ['DELETE', 'PATCH', 'PUT'].includes(r.method))).toEqual([])
  const posts = everything.filter((r) => r.method === 'POST').map((r) => r.path.replace(/ses_\w+/, ':id'))
  for (const p of posts)
    expect(['/sessions', '/sessions/:id/start', '/sessions/:id/stop', '/ask']).toContain(p)
  await d.close()
})

describe('basics and exit codes', () => {
  it('prints help with exit 0, and help + usage exit for no arguments', async () => {
    expect((await cli(['--help'], { url: d.url })).code).toBe(EXIT.OK)
    const none = await cli([], { url: d.url })
    expect(none.code).toBe(EXIT.USAGE)
    expect(none.stdout).toMatch(/exit codes/)
  })
  it('rejects unknown commands and unknown options as usage errors', async () => {
    expect((await cli(['frobnicate'], { url: d.url })).code).toBe(EXIT.USAGE)
    const bad = await cli(['search', 'x', '--no-such-flag'], { url: d.url })
    expect(bad.code).toBe(EXIT.USAGE)
    expect(bad.stderr).toMatch(/no-such-flag/)
  })
  it('has no destructive verbs at all', async () => {
    for (const argv of [
      ['delete', IDS.standup],
      ['sessions', 'delete', IDS.standup],
      ['sessions', 'rm', IDS.standup],
      ['sessions', 'private', IDS.standup],
    ]) {
      expect((await cli(argv, { url: d.url })).code, argv.join(' ')).toBe(EXIT.USAGE)
    }
  })
  it('reports an unreachable daemon distinctly (exit 3) with a fix', async () => {
    const r = await cli(['sessions', 'list'], { url: 'http://127.0.0.1:9' })
    expect(r.code).toBe(EXIT.UNREACHABLE)
    expect(r.stderr).toMatch(/not running.*\n.*systemctl --user start gnomeolad/)
  })
  it('status reports health', async () => {
    const r = await cli(['status'], { url: d.url })
    expect(r.code).toBe(0)
    expect(r.json()).toMatchObject({ ok: true, llm: { ready: true } })
  })
})

describe('output format', () => {
  it('is compact JSON when piped and text at a terminal', async () => {
    const piped = await cli(['sessions', 'list'], { url: d.url })
    expect(piped.stdout.trim().split('\n')).toHaveLength(1)
    expect(piped.json().sessions[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), title: expect.any(String) }),
    )
    const tty = await cli(['sessions', 'list'], { url: d.url, tty: true })
    expect(() => JSON.parse(tty.stdout)).toThrow()
    expect(tty.stdout).toMatch(/Platform standup/)
  })
  it('--json and --text override the default', async () => {
    const forced = await cli(['sessions', 'list', '--json'], { url: d.url, tty: true })
    expect(() => JSON.parse(forced.stdout)).not.toThrow()
    expect((await cli(['sessions', 'list', '--text'], { url: d.url })).stdout).toMatch(/^ses_/m)
  })
})

describe('sessions + id resolution', () => {
  it('never lists private sessions', async () => {
    const titles = (await cli(['sessions', 'list'], { url: d.url }))
      .json()
      .sessions.map((s: { title: string }) => s.title)
    expect(titles).toContain('Platform standup')
    expect(titles).not.toContain('HR 1:1')
  })
  it('treats a private session id as not found', async () => {
    expect((await cli(['sessions', 'show', IDS.private], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
  })
  it('resolves prefixes, latest and current, and refuses ambiguity', async () => {
    const show = await cli(['sessions', 'show', '000000001'], { url: d.url })
    expect(show.json()).toMatchObject({ id: IDS.standup, segments: 8 })
    expect((await cli(['sessions', 'show', 'latest'], { url: d.url })).json().id).toBeDefined()
    const amb = await cli(['sessions', 'show', '0000000'], { url: d.url })
    expect(amb.code).toBe(EXIT.USAGE)
    expect(amb.stderr).toMatch(/ambiguous/)
    expect((await cli(['sessions', 'show', 'current'], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
    expect((await cli(['sessions', 'show', 'zzz'], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
  })
})

describe('transcript — retrieval, not dumping', () => {
  it('refuses a whole transcript without --full, prints nothing, and says what to do instead', async () => {
    const r = await cli(['transcript', IDS.standup], { url: d.url })
    expect(r.code).toBe(EXIT.REFUSED)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/refusing.*Platform standup.*8 segments/)
    expect(r.stderr).toMatch(/search first/)
  })
  it('--around mm:ss returns only the window, with ids for citation', async () => {
    const r = await cli(['transcript', IDS.standup, '--around', '1:05', '--context', '10s'], { url: d.url })
    expect(r.code).toBe(0)
    const j = r.json()
    expect(j.window).toMatchObject({ from: '0:55', to: '1:15' })
    expect(j.segments.map((s: { text: string }) => s.text)).toEqual([
      'Did we settle the retry budget?',
      'Yes. The retry budget is three attempts, then dead-letter.',
    ])
    expect(j.segments[0].id).toMatch(/^seg_/)
    expect(j.total).toBe(8)
  })
  it('--around <segment-id> centres the window on that segment', async () => {
    const target = d.state.segments.find((s) => s.text.startsWith('Ana owns'))!
    const j = (
      await cli(['transcript', IDS.standup, '--around', target.id, '--context', '5s'], { url: d.url })
    ).json()
    expect(j.segments.map((s: { id: string }) => s.id)).toContain(target.id)
    expect(j.segments.every((s: { startMs: number }) => Math.abs(s.startMs - target.startMs) <= 9000)).toBe(
      true,
    )
  })
  it('--from/--to with a speaker filter', async () => {
    const j = (
      await cli(['transcript', IDS.standup, '--from', '0:00', '--to', '3:10', '--speaker', 'me'], {
        url: d.url,
      })
    ).json()
    expect(j.segments.every((s: { speaker: string }) => s.speaker === 'me')).toBe(true)
    expect(j.segments).toHaveLength(3)
  })
  it('validates windows', async () => {
    expect(
      (await cli(['transcript', IDS.standup, '--from', '5:00', '--to', '1:00'], { url: d.url })).code,
    ).toBe(EXIT.USAGE)
    expect((await cli(['transcript', IDS.standup, '--around', 'soon'], { url: d.url })).code).toBe(EXIT.USAGE)
    expect(
      (await cli(['transcript', IDS.standup, '--around', '1:00', '--from', '0:00'], { url: d.url })).code,
    ).toBe(EXIT.USAGE)
  })
  it('refuses a window over the token ceiling, and says how big it was', async () => {
    const r = await cli(['transcript', IDS.long, '--from', '0:00', '--to', '60:00'], { url: d.url })
    expect(r.code).toBe(EXIT.REFUSED)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/~\d+ tokens, over the 4000-token ceiling/)
  })
  it('lets the caller raise the ceiling deliberately, or take everything with --full', async () => {
    expect(
      (
        await cli(['transcript', IDS.long, '--from', '0:00', '--to', '10:00', '--max-tokens', '20000'], {
          url: d.url,
        })
      ).code,
    ).toBe(0)
    const full = await cli(['transcript', IDS.standup, '--full'], { url: d.url })
    expect(full.code).toBe(0)
    expect(full.json().segments).toHaveLength(8)
    expect(full.json().window).toBeNull()
  })
  it('keeps every default window under the ceiling (counted, not estimated)', async () => {
    const r = await cli(['transcript', IDS.long, '--around', '45:00'], { url: d.url })
    expect(r.code).toBe(0)
    expect(countTokens(r.stdout)).toBeLessThanOrEqual(BUDGET.transcriptWindow)
  })
  it('marks live segments so nobody quotes provisional text as final', async () => {
    const j = (
      await cli(['transcript', IDS.standup, '--around', '7:00', '--context', '5s'], { url: d.url })
    ).json()
    expect(j.segments[0]).toMatchObject({ quality: 'live' })
    const t = await cli(['transcript', IDS.standup, '--around', '7:00', '--context', '5s'], {
      url: d.url,
      tty: true,
    })
    expect(t.stdout).toMatch(/\(live\)/)
  })
})

describe('search', () => {
  it('returns ranked snippets with ids and a ready-made next command', async () => {
    const j = (await cli(['search', 'retry budget'], { url: d.url })).json()
    expect(j.total).toBe(2)
    expect(j.hits[0]).toMatchObject({
      sessionId: IDS.standup,
      session: 'Platform standup',
      t: '1:02',
      speaker: 'me',
    })
    expect(j.hits[0].snippet).toMatch(/\[retry budget\]/)
    expect(j.next).toBe(`gnomeola transcript ${IDS.standup} --around ${j.hits[0].segmentId}`)
  })
  it('never surfaces private sessions', async () => {
    expect((await cli(['search', 'compensation'], { url: d.url })).json().total).toBe(0)
  })
  it('stays under its token ceiling even when the daemon over-delivers', async () => {
    // "planning" matches ~1,300 long segments in the long meeting.
    const r = await cli(['search', 'planning', '--limit', '100'], { url: d.url })
    expect(countTokens(r.stdout)).toBeLessThanOrEqual(BUDGET.search)
    const j = r.json()
    expect(j.truncated).toBe(true)
    expect(j.returned).toBeLessThan(100)
    for (const h of j.hits) expect(h.snippet.length).toBeLessThanOrEqual(BUDGET.snippetChars)
  })
  it('requires a query', async () => {
    expect((await cli(['search'], { url: d.url })).code).toBe(EXIT.USAGE)
  })
})

describe('ask', () => {
  it('returns the answer and citations — never the transcript', async () => {
    const r = await cli(['ask', 'what did we decide about retries?', '--session', IDS.standup], {
      url: d.url,
    })
    expect(r.code).toBe(0)
    const j = r.json()
    expect(j.answer).toMatch(/three attempts/)
    expect(j.citations[0]).toMatchObject({ sessionId: IDS.standup, t: '1:06', speaker: 'Ana' })
    expect(r.stdout).not.toMatch(/Ana owns the dashboard/)
    expect(countTokens(r.stdout)).toBeLessThanOrEqual(BUDGET.ask)
  })
  it('defaults cross-session scope to 7 days and sends it', async () => {
    const r = await cli(['ask', 'who owns the dashboard?'], { url: d.url })
    expect(r.json().scope).toEqual({ since: '7d' })
    const sent = d.requests.filter((x) => x.path === '/ask').at(-1)!.body as { since: string; effort: string }
    expect(sent).toMatchObject({ since: '7d', effort: 'low' })
  })
  it('maps an unconfigured LLM to exit 6 with the reason', async () => {
    d.askScript = [{ type: 'error', error: { code: 'unavailable', message: 'no LLM is configured' } }]
    const r = await cli(['ask', 'anything'], { url: d.url })
    expect(r.code).toBe(EXIT.UNAVAILABLE)
    expect(r.stderr).toMatch(/no LLM is configured/)
  })
  it('streams text to a terminal and lists sources', async () => {
    const r = await cli(['ask', 'retries?', '--session', IDS.standup], { url: d.url, tty: true })
    expect(r.stdout).toMatch(
      /^The retry budget is three attempts, then dead-letter \[s1\]\.\n\nsources:\n {2}\[1\] 1:06 Ana/,
    )
  })
  it('validates its arguments', async () => {
    expect((await cli(['ask'], { url: d.url })).code).toBe(EXIT.USAGE)
    expect((await cli(['ask', 'x', '--session', IDS.standup, '--since', '7d'], { url: d.url })).code).toBe(
      EXIT.USAGE,
    )
    expect((await cli(['ask', 'x', '--effort', 'extreme'], { url: d.url })).code).toBe(EXIT.USAGE)
  })
})

describe('record', () => {
  it('starts, reports and stops a recording', async () => {
    const start = await cli(['record', 'start', '--title', 'Design review'], { url: d.url })
    expect(start.code).toBe(0)
    expect(start.json()).toMatchObject({ title: 'Design review', status: 'recording' })
    expect((await cli(['record', 'status'], { url: d.url })).json().recording).toHaveLength(1)
    expect((await cli(['record', 'start'], { url: d.url })).code).toBe(EXIT.ERROR)
    expect((await cli(['record', 'stop'], { url: d.url })).json()).toMatchObject({ status: 'stopped' })
    expect((await cli(['record', 'status'], { url: d.url })).json().recording).toEqual([])
    expect((await cli(['record', 'stop'], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
  })
})

describe('skill install', () => {
  it('installs, is idempotent, and refuses to clobber local edits without --force', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-skill-'))
    const first = await cli(['skill', 'install', '--dir', dir], { url: d.url })
    expect(first.json()).toMatchObject({
      action: 'installed',
      permissions: ['Skill(meeting-context)', 'Bash(gnomeola:*)'],
    })
    const path = first.json().path as string
    expect(readFileSync(path, 'utf8')).toMatch(/^---\nname: meeting-context/)
    expect((await cli(['skill', 'install', '--dir', dir], { url: d.url })).json().action).toBe('unchanged')
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n<!-- my note -->\n`)
    expect((await cli(['skill', 'install', '--dir', dir], { url: d.url })).code).toBe(EXIT.REFUSED)
    expect((await cli(['skill', 'install', '--dir', dir, '--force'], { url: d.url })).json().action).toBe(
      'updated',
    )
    expect(readFileSync(path, 'utf8')).not.toMatch(/my note/)
  })
})

describe('bug-report', () => {
  it('writes a private (0600) diagnostics file', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'gnomeola-diag-')), 'diag.json')
    const r = await cli(['bug-report', '--out', out], { url: d.url })
    expect(r.code).toBe(0)
    expect(existsSync(out)).toBe(true)
    expect(statSync(out).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(out, 'utf8')).logTail).toEqual(['a', 'b'])
  })
})

describe('speakers (M3)', () => {
  it('lists who spoke — me, each named far-end speaker — with the labels --speaker matches', async () => {
    const r = await cli(['speakers', IDS.standup], { url: d.url })
    expect(r.code).toBe(EXIT.OK)
    const j = r.json()
    expect(j.session).toMatchObject({ id: IDS.standup, title: 'Platform standup' })
    expect(
      j.speakers.map((s: { id: string; label: string; segments: number }) => [s.id, s.label, s.segments]),
    ).toEqual([
      ['me', 'me', 4],
      [SPEAKERS.ana, 'Ana', 2],
      [SPEAKERS.ben, 'Speaker 2', 2],
    ])
    expect(j.speakers[1]).toMatchObject({ track: 'system', named: true, talkMs: 8000, talk: '0:08' })
  })

  it('reads well at a terminal', async () => {
    const r = await cli(['speakers', IDS.standup], { url: d.url, tty: true })
    expect(r.code).toBe(EXIT.OK)
    expect(r.stdout).toMatch(/^Platform standup · ses_\w+ · 3 speakers\n/)
    expect(r.stdout).toMatch(/ {2}me +4 segments +0:16 {2}\(you: the microphone\)/)
    expect(r.stdout).toMatch(/ {2}Ana +2 segments +0:08\n/)
    expect(r.stdout).toMatch(/ {2}Speaker 2 +2 segments +0:08 {2}\(unnamed\)/)
  })

  it('--speaker filters by a far-end name (any case) in transcript and search', async () => {
    const t = await cli(['transcript', IDS.standup, '--from', '0:00', '--to', '10:00', '--speaker', 'ana'], {
      url: d.url,
    })
    expect(t.code).toBe(EXIT.OK)
    const segs = t.json().segments as { speaker: string; text: string }[]
    expect(segs.map((x) => x.speaker)).toEqual(['Ana', 'Ana'])
    expect(segs[1]!.text).toBe('Ana owns the dashboard.')
    const s = await cli(['search', 'retry', '--speaker', 'Ana'], { url: d.url })
    expect(s.code).toBe(EXIT.OK)
    const hits = s.json().hits as { speaker: string }[]
    expect(hits.length).toBeGreaterThan(0)
    expect(new Set(hits.map((h) => h.speaker))).toEqual(new Set(['Ana']))
  })

  it('keeps private sessions invisible, and is read-only', async () => {
    expect((await cli(['speakers', IDS.private], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
    expect((await cli(['speakers', 'ses_nope'], { url: d.url })).code).toBe(EXIT.NOT_FOUND)
    expect((await cli(['speakers'], { url: d.url })).code).toBe(EXIT.USAGE)
    // there is no verb to rename, merge or split from the CLI (the window does that)
    for (const argv of [
      ['speakers', 'rename', IDS.standup, 'x'],
      ['speakers', IDS.standup, '--rename', 'x'],
    ])
      expect((await cli(argv, { url: d.url })).code, argv.join(' ')).not.toBe(EXIT.OK)
  })
})
