import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUDGET, countTokens } from '@gnomeola/cli'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { normalise, SEED, seedMeetings } from '../src/seed.ts'

// V-6a — the CLI against the REAL daemon and a real SQLite/FTS5 store seeded with known meetings.
// Outputs are compared to reviewed golden files (timestamps and scores normalised).

let d: DaemonHandle
beforeAll(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-seed-'))
  seedMeetings(dataDir)
  d = await startDaemon({ dataDir })
}, 60_000)
afterAll(async () => {
  await d?.stop()
})

const golden = (name: string) => join(import.meta.dirname, '__golden__', `${name}.json`)

describe('golden outputs through the real daemon', () => {
  it.each([
    ['sessions-list', ['sessions', 'list']],
    ['sessions-show', ['sessions', 'show', SEED.standup]],
    ['search-retry-budget', ['search', 'retry budget']],
    ['transcript-window', ['transcript', SEED.standup, '--around', '1:05', '--context', '10s']],
    [
      'transcript-around-segment',
      ['transcript', SEED.standup, '--around', 'seg_000000007eeeeeeeeeeee', '--context', '5s'],
    ],
    ['transcript-speaker', ['transcript', SEED.standup, '--from', '0:00', '--to', '3:10', '--speaker', 'me']],
    // N-5: the notes the window left behind (seeded: typed, enhanced, reviewed, merged)
    ['notes-head', ['notes', SEED.standup]],
    ['notes-actions', ['notes', SEED.standup, '--actions']],
    ['notes-versions', ['notes', SEED.standup, '--versions']],
  ])('%s', async (name, argv) => {
    const r = await gnomeola(argv, d.baseUrl)
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    await expect(normalise(r.stdout)).toMatchFileSnapshot(golden(name))
  })
})

describe('retrieval discipline against real data', () => {
  it('refuses a whole transcript, naming its real size', async () => {
    const r = await gnomeola(['transcript', SEED.standup], d.baseUrl)
    expect(r.code).toBe(5)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/refusing to print the whole transcript of "Platform standup" \(8 segments\)/)
  })
  it('refuses an oversized window of the real long meeting', async () => {
    // 901, not 900: windows are inclusive at both ends, so the segment starting exactly at 60:00 counts.
    const r = await gnomeola(['transcript', SEED.long, '--from', '0:00', '--to', '60:00'], d.baseUrl)
    expect(r.code).toBe(5)
    expect(r.stderr).toMatch(/over the 4000-token ceiling \(901 segments\)/)
  })
  it('keeps real FTS5 results under the search budget', async () => {
    const r = await gnomeola(['search', 'planning', '--limit', '100'], d.baseUrl)
    expect(r.code).toBe(0)
    expect(countTokens(r.stdout)).toBeLessThanOrEqual(BUDGET.search)
    const j = JSON.parse(r.stdout)
    expect(j.total).toBeGreaterThan(100)
    expect(j.truncated).toBe(true)
  })
  it('ranks the decision above the question that mentions it', async () => {
    const j = JSON.parse((await gnomeola(['search', 'retry budget dead-letter'], d.baseUrl)).stdout)
    expect(j.hits[0].snippet).toMatch(/three attempts/)
  })
})

describe('privacy through the real stack', () => {
  it.each([
    [['sessions', 'show', SEED.private], 4],
    [['transcript', SEED.private, '--around', '0:10'], 4],
    [['ask', 'q', '--session', SEED.private], 4],
    [['notes', SEED.private], 4],
    [['notes', SEED.private, '--actions'], 4],
    [['notes', SEED.private, '--versions'], 4],
  ])('%j → exit %i', async (argv, code) => {
    expect((await gnomeola(argv as string[], d.baseUrl)).code).toBe(code)
  })
  it('is absent from listings and search', async () => {
    expect((await gnomeola(['sessions', 'list'], d.baseUrl)).stdout).not.toMatch(/HR 1:1/)
    expect(JSON.parse((await gnomeola(['search', 'compensation'], d.baseUrl)).stdout).total).toBe(0)
  })
  it('the daemon itself still has it (the guard is on the client path, not data loss)', async () => {
    const s = await d.client.call('getSession', {
      params: { id: SEED.private },
      query: { includePrivate: true },
    })
    expect(s.title).toBe('HR 1:1')
  })
})
