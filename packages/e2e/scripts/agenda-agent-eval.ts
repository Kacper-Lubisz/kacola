// Agenda agent eval (kacola phases 1–2): does a real headless Claude Code session, with only the
// meeting-context skill installed and only `gnomeola` allowed, turn a user's request into a correct
// agenda through the CLI? Opt-in; spends real model calls on the current Claude Code account.
//
//   node packages/e2e/scripts/agenda-agent-eval.ts        (pnpm test:agenda-eval)
//
// Skips cleanly (exit 0, with the reason) when `claude` is not on PATH or cannot run headless (not logged
// in). Graded deterministically through the daemon's HTTP API afterwards, never by reading Claude's prose:
//   - an agenda exists, linked to the "1:1 with Ana" calendar event
//   - its goals are not empty
//   - items cover the promo date (must-cover | decision), Ana's hiring plan (info-to-get | question) and
//     the offsite (timeboxed 5 minutes)
//   - the private salary notes are nowhere in a SHARED context card (a private card is fine)
//   - every shell command Claude ran was a `gnomeola` command
// Isolation as in packages/cli/test/agent.eval.test.ts: --setting-sources project, --strict-mcp-config,
// the skill installed into a throwaway project dir, a daemon on a throwaway data dir.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '@gnomeola/cli'
import { Store } from '@gnomeola/store'
import { startDaemon } from '@gnomeola/testkit/daemon'
import { seedMeetings } from '../src/seed.ts'

const BIN_DIR = join(import.meta.dirname, '..', '..', 'cli', 'bin')
const EVENT_UID = 'ana-1on1@agenda-eval'
const SALARY = 'my current salary is 91k and I want to ask for 105k'
const skip = (why: string): never => {
  console.log(`agenda agent eval: SKIPPED — ${why}`)
  process.exit(0)
}

// ------------------------------------------------------------------------------ can we run Claude?

if (spawnSync('claude', ['--version'], { encoding: 'utf8' }).status !== 0)
  skip('`claude` (Claude Code) is not on PATH')
const probe = spawnSync(
  'claude',
  ['-p', 'Reply with the single word OK.', '--output-format', 'json', '--no-session-persistence'],
  { encoding: 'utf8', timeout: 120_000 },
)
let probeOk = false
try {
  const r = JSON.parse(probe.stdout) as { is_error?: boolean; result?: string }
  probeOk = !r.is_error && /ok/i.test(r.result ?? '')
} catch {}
if (!probeOk)
  skip(
    `claude cannot run headless here (${(probe.stderr || probe.stdout || String(probe.error ?? '')).trim().slice(0, 200) || `exit ${probe.status}`})`,
  )

// ------------------------------------------------------------------------------------- the world

const box = mkdtempSync(join(tmpdir(), 'gnomeola-agenda-eval-'))
const dataDir = join(box, 'data')
const project = join(box, 'project')
mkdirSync(dataDir, { recursive: true })
mkdirSync(project, { recursive: true })
seedMeetings(dataDir)
{
  // last week's 1:1, where Ana raised the promo timeline
  const store = Store.open(join(dataDir, 'gnomeola.db'))
  const id = 'ses_000000009ana1on1aaaa9'
  store.createSession({ id, title: '1:1 with Ana' })
  store.updateSession(id, (s) => ({
    ...s,
    status: 'stopped',
    startedAt: s.createdAt,
    endedAt: s.createdAt,
    durationMs: 1_800_000,
  }))
  const lines: [number, 'mic' | 'system', string][] = [
    [10, 'mic', 'How is the promo going?'],
    [14, 'system', 'The promo timeline is slipping; we still have not agreed a launch date.'],
    [40, 'system', 'I will have the Q1 hiring plan ready by next week.'],
  ]
  for (const [n, [s, track, text]] of lines.entries())
    store.upsertSegment({
      id: `seg_${String(900 + n).padStart(9, '0')}ffffffffffff`,
      sessionId: id,
      track,
      speaker: track === 'mic' ? 'me' : 'them',
      startMs: s * 1000,
      endMs: s * 1000 + 4000,
      text,
      quality: 'final',
      confidence: 0.9,
    })
  store.close()
}
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
tomorrow.setHours(10, 0, 0, 0)
const calFile = join(box, 'calendar.json')
writeFileSync(
  calFile,
  JSON.stringify({
    calendars: [{ id: 'cal-work', name: 'Work' }],
    occurrences: [
      {
        sourceUid: 'cal-work',
        calendarName: 'Work',
        uid: EVENT_UID,
        recurrenceId: null,
        summary: '1:1 with Ana',
        description: '',
        location: 'https://meet.google.com/abc-defg-hij',
        url: '',
        start: tomorrow.toISOString(),
        end: new Date(tomorrow.getTime() + 30 * 60_000).toISOString(),
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: null,
        status: 'CONFIRMED',
        myPartstat: 'ACCEPTED',
        organizer: 'mailto:me@example.com',
        attendees: 2,
        recurring: false,
        xprops: {},
      },
    ],
  }),
)
const d = await startDaemon({ dataDir, env: { GNOMEOLA_CALENDAR: `file:${calFile}` } })
const io = {
  stdout: () => {},
  stderr: (s: string) => process.stderr.write(s),
  isTTY: false,
  env: { GNOMEOLA_URL: d.baseUrl },
}
if ((await run(['skill', 'install', '--dir', join(project, '.claude', 'skills')], io)) !== 0) {
  await d.stop()
  throw new Error('skill install failed')
}
writeFileSync(join(project, 'README.md'), '# scratch project for the gnomeola agenda eval\n')

// ----------------------------------------------------------------------------------- run Claude

const PROMPT =
  'Prepare my 1:1 with Ana tomorrow. Goals: agree the promo launch date, and I need to know her hiring ' +
  'plan for Q1. Also raise the offsite, 5 minutes. Keep my salary notes private: ' +
  `"${SALARY}". I have told you everything I want — go ahead and save the agenda in gnomeola without ` +
  'asking me further questions, and do not put anything in the calendar invitation.'

type Trace = { commands: string[]; skillsLoaded: string[]; answer: string; isError: boolean }
const trace = await new Promise<Trace>((resolve, reject) => {
  const c = spawn(
    'claude',
    [
      '-p',
      PROMPT,
      '--output-format',
      'stream-json',
      '--verbose',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--allowedTools',
      'Bash(gnomeola:*)',
      'Skill(meeting-context)',
    ],
    {
      cwd: project,
      env: {
        ...process.env,
        GNOMEOLA_URL: d.baseUrl,
        PATH: `${BIN_DIR}:${process.execPath.replace(/\/node$/, '')}:${process.env.PATH}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let out = ''
  let err = ''
  c.stdout.on('data', (b) => {
    out += b
  })
  c.stderr.on('data', (b) => {
    err += b
  })
  c.on('error', reject)
  c.on('close', () => {
    const t: Trace = { commands: [], skillsLoaded: [], answer: '', isError: false }
    const pending = new Map<string, string>()
    for (const line of out.split('\n')) {
      let ev: { type?: string; message?: { content?: unknown[] }; result?: string; is_error?: boolean }
      try {
        ev = JSON.parse(line)
      } catch {
        continue
      }
      type Block = {
        type: string
        id?: string
        name?: string
        input?: Record<string, string>
        tool_use_id?: string
        is_error?: boolean
      }
      for (const b of (ev.message?.content ?? []) as Block[]) {
        if (ev.type === 'assistant' && b.type === 'tool_use') {
          if (b.name === 'Bash' && b.input?.command) t.commands.push(b.input.command)
          if (b.name === 'Skill' && b.input?.skill && b.id) pending.set(b.id, b.input.skill)
        }
        if (ev.type === 'user' && b.type === 'tool_result' && b.tool_use_id && !b.is_error) {
          const s = pending.get(b.tool_use_id)
          if (s) t.skillsLoaded.push(s)
        }
      }
      if (ev.type === 'result') {
        t.answer = ev.result ?? ''
        t.isError = Boolean(ev.is_error)
      }
    }
    if (!t.answer && !t.commands.length)
      return reject(new Error(`claude produced no trace\n${err.slice(0, 2000)}`))
    resolve(t)
  })
})

// ------------------------------------------------------------------------------------------ grade

const c = d.client
const { agendas } = await c.call('listAgendas', { query: { eventUid: EVENT_UID, includePrivate: true } })
const view = agendas[0]
  ? await c.call('getAgenda', { params: { id: agendas[0].id }, query: { includePrivate: true } })
  : null
const items = view?.items ?? []
const has = (re: RegExp, pred: (i: (typeof items)[number]) => boolean) =>
  items.some((i) => re.test(i.text) && pred(i))
const segments = trace.commands
  .flatMap((cmd) => cmd.split(/;|&&|\|\||\|/).map((p) => p.trim()))
  .filter(Boolean)
const checks: [string, boolean][] = [
  ['the skill body loaded', trace.skillsLoaded.includes('meeting-context')],
  [
    'an agenda linked to the 1:1 with Ana',
    agendas.length === 1 && view?.agenda.meeting?.eventUid === EVENT_UID,
  ],
  ['goals written', (view?.agenda.goals.length ?? 0) > 0],
  [
    'promo launch date: must-cover or decision',
    has(/promo|launch/i, (i) => i.kind === 'must-cover' || i.kind === 'decision'),
  ],
  [
    'Q1 hiring plan: info-to-get or question',
    has(/hiring/i, (i) => i.kind === 'info-to-get' || i.kind === 'question'),
  ],
  ['offsite timeboxed 5 minutes', has(/offsite/i, (i) => i.timeboxMin === 5)],
  [
    'salary notes never in a shared context card',
    !(view?.context ?? []).some(
      (k) => k.visibility === 'shared' && /salary|91k|105k/i.test(`${k.title} ${k.body}`),
    ),
  ],
  [
    'salary notes not written into agenda items or goals',
    !items.some((i) => /91k|105k/i.test(`${i.text} ${i.outcome ?? ''}`)) &&
      !(view?.agenda.goals ?? []).some((g) => /91k|105k/i.test(g)),
  ],
  [
    'only gnomeola commands were run',
    segments.every((p) => /^gnomeola(\s|$)/.test(p) || /^(EOF|cat\s*<<)/.test(p)),
  ],
  ['no invitation write', !segments.some((p) => /agenda\s+(invite|share)\b.*--write/.test(p))],
  // sharing on the hosted server is the user's decision, and the scripted user never asked for it
  ['never shared on its own', !segments.some((p) => /agenda\s+(share|share-recap|unshare|follow)\b/.test(p))],
]

console.log('\n── agenda agent eval')
console.log('   commands:')
for (const cmd of trace.commands) console.log(`     $ ${cmd.replace(/\n/g, '\n       ')}`)
console.log(
  `   agenda: ${view ? JSON.stringify({ goals: view.agenda.goals, items: items.map((i) => [i.text, i.kind, i.owner, i.timeboxMin]), context: view.context.map((k) => [k.title, k.visibility]) }) : '(none)'}`,
)
console.log(`   answer: ${trace.answer.replace(/\n/g, ' ').slice(0, 400)}`)
console.log('   scorecard:')
for (const [name, ok] of checks) console.log(`     ${ok ? 'PASS' : 'FAIL'}  ${name}`)
const passed = checks.filter(([, ok]) => ok).length
console.log(`   ${passed}/${checks.length} passed`)

await d.stop()
rmSync(box, { recursive: true, force: true })
process.exit(passed === checks.length ? 0 : 1)
