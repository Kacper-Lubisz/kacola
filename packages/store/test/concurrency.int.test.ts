import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { assertNoViolations, checkEventLog } from '@gnomeola/testkit/invariants'
import { afterAll, describe, expect, it } from 'vitest'
import { Store } from '../src/index.ts'

// Several connections (one per worker thread) committing to one database file at once. IMMEDIATE
// transactions + the counter row must keep seq gap-free and unique across all of them, and every
// event must be in the log exactly once with its state row.
describe('concurrent writers on one database file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gnomeola-conc-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('keeps the log gap-free and duplicate-free', async () => {
    const path = join(dir, 'db.sqlite')
    const s = Store.open(path)
    const session = s.createSession({ title: 'concurrency' })
    const WORKERS = 6
    const COUNT = 300
    const barrier = new SharedArrayBuffer(4)
    const results = await Promise.all(
      Array.from(
        { length: WORKERS },
        (_, worker) =>
          new Promise<number[]>((resolve, reject) => {
            const w = new Worker(new URL('./writer.worker.ts', import.meta.url), {
              workerData: { path, sessionId: session.id, count: COUNT, worker, barrier, workers: WORKERS },
            })
            w.once('message', resolve)
            w.once('error', reject)
            w.once('exit', (code) => code !== 0 && reject(new Error(`worker exited ${code}`)))
          }),
      ),
    )
    const events = s.eventsAfter(0)
    // Every assertion carries the run's stats: this test failed once in ~27 runs under a loaded full gate
    // (2026-09-28) with its message lost, so a recurrence must explain itself.
    const writerOfAll = events
      .slice(1)
      .map((e) => (e.data.type === 'segment.upserted' ? e.data.segment.id.split('_')[1] : '?'))
    const switchCount = writerOfAll.filter((w, i) => i > 0 && w !== writerOfAll[i - 1]).length
    const stats = `events=${events.length} lastSeq=${s.lastSeq()} switches=${switchCount} perWorker=${results.map((r) => r.length).join('/')}`
    expect(events, stats).toHaveLength(1 + WORKERS * COUNT)
    assertNoViolations(checkEventLog(events), stats)
    expect(s.lastSeq(), stats).toBe(1 + WORKERS * COUNT)
    // each worker saw its own seqs strictly increasing, and no seq was handed to two workers
    const all = results.flat()
    expect(new Set(all).size, stats).toBe(all.length)
    for (const r of results) expect([...r].sort((a, b) => a - b)).toEqual(r)
    // writers genuinely interleaved (otherwise this test proves nothing)
    const writerOf = events
      .slice(1)
      .map((e) => (e.data.type === 'segment.upserted' ? e.data.segment.id.split('_')[1] : '?'))
    const switches = writerOf.filter((w, i) => i > 0 && w !== writerOf[i - 1]).length
    expect(switches, stats).toBeGreaterThan(WORKERS * 4)
    expect(s.segments(session.id), stats).toHaveLength(WORKERS * COUNT)
    // and the state is exactly what the log says
    const replayed = Store.open(':memory:')
    replayed.replay(events)
    expect(replayed.dump()).toBe(s.dump())
    s.close()
  })
})
