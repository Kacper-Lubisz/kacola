import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUDGET, countTokens } from '@kacola/cli'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { kacola } from '../src/cli.ts'

// Agendas from the CLI, through the REAL daemon (its calendar fed by a calendar file, like
// cli-meetings.int.test.ts): every verb's JSON is compared to a reviewed golden file (ids and times
// normalised), every output stays under its token budget, and the exit codes are the contract's.

const box = mkdtempSync(join(tmpdir(), 'kacola-e2e-agenda-'))
const calFile = join(box, 'calendar.json')
let d: DaemonHandle

const now = Date.now()
const t = (min: number) => new Date(now + min * 60_000).toISOString()
const WEEK = 7 * 24 * 60
const occ = (o: Record<string, unknown>) => ({
  sourceUid: 'cal-work',
  calendarName: 'Work',
  recurrenceId: null,
  description: '',
  location: '',
  url: '',
  allDay: false,
  startDate: null,
  endDate: null,
  timezone: 'Europe/Warsaw',
  status: 'CONFIRMED',
  myPartstat: null,
  organizer: 'mailto:me@example.com',
  attendees: 2,
  recurring: false,
  xprops: {},
  ...o,
})
const weekly = (week: number) =>
  occ({
    uid: 'one-on-one@x',
    summary: '1:1 with Ana',
    recurring: true,
    recurrenceId: t(30 + week * WEEK),
    start: t(30 + week * WEEK),
    end: t(60 + week * WEEK),
  })

beforeAll(async () => {
  writeFileSync(
    calFile,
    JSON.stringify({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        weekly(0),
        weekly(1),
        occ({ uid: 'review@x', summary: 'Design review', start: t(120), end: t(150) }),
      ],
    }),
  )
  d = await startDaemon({
    env: { KACOLA_CALENDAR: `file:${calFile}`, KACOLA_AGENDA_WEB_BASE: 'https://kacola.example' },
  })
  await waitFor(async () => (await d.client.call('nextMeeting')).next !== null, 10_000, 'the calendar file')
}, 60_000)
afterAll(async () => {
  await d?.stop()
  rmSync(box, { recursive: true, force: true })
})

const golden = (name: string) => join(import.meta.dirname, '__golden__', `${name}.json`)

/** Stable across runs: ids become <kind:n> in order of appearance, instants <iso>. */
function stable(out: string): string {
  const seen = new Map<string, string>()
  const counts = new Map<string, number>()
  const id = (v: string) =>
    v.replace(/\b(agd|itm|ctx|sug|ses|mtg)_[0-9A-Za-z_-]{12,}/g, (m, kind: string) => {
      if (!seen.has(m)) {
        const n = (counts.get(kind) ?? 0) + 1
        counts.set(kind, n)
        seen.set(m, `<${kind}:${n}>`)
      }
      return seen.get(m)!
    })
  const value = JSON.parse(out, (_k, v) => {
    if (typeof v !== 'string') return v
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return '<iso>'
    return id(v).replace(/start%3D[^\s"]+/g, 'start=<iso>')
  })
  return `${JSON.stringify(value, null, 2)}\n`
}

async function ok(argv: string[], opts: { stdin?: string } = {}) {
  const r = await kacola(argv, d.baseUrl, opts)
  expect(r.stderr, argv.join(' ')).toBe('')
  expect(r.code, argv.join(' ')).toBe(0)
  expect(countTokens(r.stdout), argv.join(' ')).toBeLessThanOrEqual(BUDGET.agenda)
  return r
}

const PLAN = `# 1:1 with Ana

## Goals
- agree the promo launch date

## Items
- [ ] Promo timeline (10m, @ana) [must-cover]
- [ ] Q1 hiring plan (@ana) [info-to-get]
`

describe('agenda verbs through the real daemon', () => {
  it('create --meeting next --stdin: the agenda, linked, with its links', async () => {
    const r = await ok(['agenda', 'create', '--meeting', 'next', '--stdin'], { stdin: PLAN })
    const j = JSON.parse(r.stdout)
    expect(j.agenda.meeting).toMatchObject({ eventUid: 'one-on-one@x', recurring: true })
    expect(j.links.app).toBe('kacola://meeting/one-on-one%40x')
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-create'))
    // the occurrence has an agenda now: a second create is refused with the way forward
    const again = await kacola(['agenda', 'create', '--meeting', 'next'], d.baseUrl)
    expect(again.code).toBe(1)
    expect(again.stderr).toMatch(/already has an agenda[\s\S]*--reuse/)
    const reused = await ok(['agenda', 'create', '--meeting', 'next', '--reuse'])
    expect(JSON.parse(reused.stdout).agenda.id).toBe(j.agenda.id)
  })

  it('add: markdown item syntax and flags', async () => {
    const r = await ok(['agenda', 'add', 'next', 'Budget sign-off (5m) [decision]', 'Offsite'])
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-add'))
    const flags = await ok([
      'agenda',
      'add',
      'next',
      'Team morale',
      '--kind',
      'question',
      '--owner',
      'me',
      '--timebox',
      '1h',
      '--before',
      '1',
    ])
    expect(JSON.parse(flags.stdout).added[0]).toMatchObject({
      n: 1,
      text: 'Team morale',
      kind: 'question',
      owner: 'me',
      timeboxMin: 60,
    })
    await ok(['agenda', 'remove', 'next', 'team morale'])
    await ok(['agenda', 'edit', 'next', 'Offsite', '--timebox', '5m', '--owner', 'me'])
    const renamed = await ok([
      'agenda',
      'edit',
      'next',
      'Budget sign-off',
      '--text',
      'Budget sign-off for Q1',
    ])
    expect(JSON.parse(renamed.stdout).item).toMatchObject({
      text: 'Budget sign-off for Q1',
      kind: 'decision',
      timeboxMin: 5,
    })
    await ok(['agenda', 'edit', 'next', 'for Q1', '--text', 'Budget sign-off'])
  })

  it('status: forward for anyone, back only for the user; history records who', async () => {
    const r = await ok([
      'agenda',
      'status',
      'next',
      'promo',
      'covered',
      '--evidence',
      'we agreed on March',
      '--outcome',
      'launch in March',
    ])
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-status'))
    // acting as an agent needs a live lease (agent channel: live-agent.int.test.ts); without one, exit 7
    const asAgent = await kacola(['agenda', 'status', 'next', 'promo', 'open', '--as', 'claude'], d.baseUrl)
    expect(asAgent.code).toBe(7)
    expect(asAgent.stderr).toMatch(/no live lease for "claude"[\s\S]*live attach --as claude/)
    await ok(['agenda', 'status', 'next', '2', 'in-progress'])
    const show = await ok(['agenda', 'show', 'next', '--history'])
    await expect(stable(show.stdout)).toMatchFileSnapshot(golden('agenda-show'))
    const tty = await kacola(['agenda', 'show'], d.baseUrl, { tty: true })
    expect(tty.stdout).toMatch(
      / 1\. \[x\] Promo timeline \(10m, @ana\) \[must-cover\]\n {6}→ launch in March/,
    )
  })

  it('export → import: the same markdown is a no-op; an edited one applies exactly the edits', async () => {
    const md = (await ok(['agenda', 'export', 'next', '--text'])).stdout
    expect(md).toContain('- [x] Promo timeline (10m, @ana) [must-cover]\n  > launch in March')
    const j = JSON.parse((await ok(['agenda', 'export', 'next'])).stdout)
    await expect(stable(JSON.stringify(j))).toMatchFileSnapshot(golden('agenda-export'))
    const same = JSON.parse((await ok(['agenda', 'import', 'next', '--stdin'], { stdin: md })).stdout)
    expect(same.agenda.version).toBe(j.version)
    const edited = md
      .replace('- [ ] Offsite (5m, @me)', '- [>] Offsite (5m, @me)')
      .concat('- [ ] Travel budget [decision]\n')
    const after = JSON.parse((await ok(['agenda', 'import', 'next', '--stdin'], { stdin: edited })).stdout)
    expect(after.items.map((i: { text: string; status: string }) => `${i.text}:${i.status}`)).toEqual([
      'Promo timeline:covered',
      'Q1 hiring plan:in-progress',
      'Budget sign-off:open',
      'Offsite:parked',
      'Travel budget:open',
    ])
  })

  it('context add (private unless --shared); suggest needs a live lease', async () => {
    const c = await ok(['context', 'add', '--title', 'Q3 numbers', '--body=- revenue up 12%\n- churn flat'])
    await expect(stable(c.stdout)).toMatchFileSnapshot(golden('agenda-context'))
    expect(JSON.parse(c.stdout).card.visibility).toBe('private')
    const shared = await ok([
      'context',
      'add',
      '--agenda',
      'next',
      '--title',
      'Launch brief',
      '--body',
      'see doc',
      '--shared',
    ])
    expect(JSON.parse(shared.stdout).card.visibility).toBe('shared')
    // suggestions come from a connected agent (the agenda-suggest golden is live-agent.int.test.ts's)
    const s = await kacola(
      ['suggest', 'ask how the Q1 hiring plan is funded', '--kind', 'question', '--item', 'hiring'],
      d.baseUrl,
    )
    expect(s.code).toBe(7)
    expect(s.stderr).toMatch(/suggest needs a live lease[\s\S]*kacola live attach/)
  })

  it('invite: the invitation block; a read-only calendar hands it back to paste', async () => {
    const r = await ok(['agenda', 'invite', 'next'])
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('agenda-invite'))
    const w = JSON.parse((await ok(['agenda', 'invite', 'next', '--write'])).stdout)
    expect(w).toMatchObject({
      written: false,
      reason: expect.stringMatching(/file calendar provider is read-only/),
    })
    const text = await kacola(['agenda', 'invite', 'next'], d.baseUrl, { tty: true })
    // not shared: the block carries the app link only (team sharing adds `web: <host>/a/<token>`)
    expect(text.stdout).toMatch(/^-- kacola agenda --\nAgenda: kacola:\/\/meeting\/one-on-one%40x\n/)
  })

  it('list, and privacy: a private agenda is invisible here', async () => {
    const p = await ok(['agenda', 'create', '--meeting', 'review@x', '--private'])
    const hidden = JSON.parse(p.stdout).agenda.id as string
    const list = await ok(['agenda', 'list'])
    expect(JSON.parse(list.stdout).agendas.map((a: { id: string }) => a.id)).not.toContain(hidden)
    await expect(stable(list.stdout)).toMatchFileSnapshot(golden('agenda-list'))
    // --meeting takes any meeting ref (next, a meeting id, an event UID): all occurrences of that event
    const { next } = await d.client.call('nextMeeting')
    for (const ref of ['next', next!.id, 'one-on-one@x']) {
      const r = JSON.parse((await ok(['agenda', 'list', '--meeting', ref])).stdout)
      expect(
        r.agendas.map((a: { title: string }) => a.title),
        ref,
      ).toEqual(['1:1 with Ana'])
    }
    expect((await kacola(['agenda', 'show', hidden], d.baseUrl)).code).toBe(4)
  })

  it('exit codes: usage 2, not found 4, over budget 5', async () => {
    const code = async (argv: string[]) => (await kacola(argv, d.baseUrl)).code
    expect(await code(['agenda'])).toBe(2)
    expect(await code(['agenda', 'create'])).toBe(2)
    expect(await code(['agenda', 'status', 'next', '1', 'done'])).toBe(2)
    expect(await code(['agenda', 'add', 'next', 'x', '--kind', 'nope'])).toBe(2)
    expect(await code(['agenda', 'show', 'agd_nope'])).toBe(4)
    expect(await code(['agenda', 'status', 'next', '99', 'covered'])).toBe(4)
    expect(await code(['agenda', 'status', 'next', 'no such item', 'covered'])).toBe(4)
    expect(await code(['agenda', 'create', '--meeting', 'mtg_nope'])).toBe(4)
    expect(await code(['suggest', 'x', '--kind', 'question', '--agenda', 'agd_nope'])).toBe(7) // no lease
    expect(await code(['suggest', 'x', '--kind', 'set-status'])).toBe(2)
    expect(await code(['context', 'add', '--title', 'x'])).toBe(2)
    // a big agenda is refused rather than dumped; --full is the escape hatch
    const big = await ok(['agenda', 'create', '--title', 'Big planning'])
    const id = JSON.parse(big.stdout).agenda.id as string
    const long = Array.from(
      { length: 40 },
      (_, n) => `Item ${n} ${'with a rather long description '.repeat(5)}`,
    )
    await ok(['agenda', 'add', id, ...long.slice(0, 20)])
    await kacola(['agenda', 'add', id, ...long.slice(20)], d.baseUrl)
    const refused = await kacola(['agenda', 'show', id], d.baseUrl)
    expect(refused.code).toBe(5)
    expect(refused.stderr).toMatch(/token ceiling[\s\S]*agenda export/)
    expect((await kacola(['agenda', 'show', id, '--full'], d.baseUrl)).code).toBe(0)
  })
})

describe('agenda verbs without a calendar', () => {
  it('--meeting next is a capability problem (exit 6); an unlinked agenda still works', async () => {
    const off = await startDaemon({ env: { KACOLA_CALENDAR: 'off' } })
    try {
      const r = await kacola(['agenda', 'create', '--meeting', 'next'], off.baseUrl)
      expect(r.code).toBe(6)
      expect(r.stderr).toMatch(/calendar reading is off/)
      const u = await kacola(['agenda', 'create', '--title', 'Standalone', '--stdin'], off.baseUrl, {
        stdin: PLAN,
      })
      expect(u.code).toBe(0)
      expect(JSON.parse(u.stdout)).toMatchObject({ agenda: { title: 'Standalone', meeting: null } })
      expect((await kacola(['agenda', 'show', 'latest'], off.baseUrl)).code).toBe(0)
      expect((await kacola(['agenda', 'show'], off.baseUrl)).code).toBe(4)
    } finally {
      await off.stop()
    }
  }, 60_000)
})
