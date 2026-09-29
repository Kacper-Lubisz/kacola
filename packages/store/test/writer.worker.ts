// Worker for concurrency.int.test.ts: its own SQLite connection, hammering commits on a shared file.
import { parentPort, workerData } from 'node:worker_threads'
import { Store } from '../src/index.ts'

const { path, sessionId, count, worker, barrier, progress, workers } = workerData as {
  path: string
  sessionId: string
  count: number
  worker: number
  barrier: SharedArrayBuffer
  /** One Int32 per worker: writes committed so far. */
  progress: SharedArrayBuffer
  workers: number
}
const store = Store.open(path, { busyTimeoutMs: 30_000 })
const seqs: number[] = []
store.onCommit((e) => seqs.push(e.seq))
const sleeper = new Int32Array(new SharedArrayBuffer(4))
const done = new Int32Array(progress)
const LAG = 10
const behind = (mine: number) => {
  for (let w = 0; w < workers; w++) {
    const theirs = Atomics.load(done, w)
    if (theirs < count && theirs < mine - LAG) return true
  }
  return false
}
// start together, so the writers genuinely contend
const gate = new Int32Array(barrier)
Atomics.add(gate, 0, 1)
while (Atomics.load(gate, 0) < workers) Atomics.wait(gate, 0, Atomics.load(gate, 0), 5)
for (let i = 0; i < count; i++) {
  const g = store.upsertSegment({
    id: `seg_w${worker}_${i}`,
    sessionId,
    track: worker % 2 ? 'mic' : 'system',
    speaker: worker % 2 ? 'me' : `speaker-${worker}`,
    startMs: i * 10,
    endMs: i * 10 + 5,
    text: `worker ${worker} line ${i}`,
    quality: 'live',
    confidence: null,
  })
  if (g.revision !== 1) throw new Error('unexpected revision')
  Atomics.store(done, worker, i + 1)
  // Lockstep: never run more than LAG writes ahead of the slowest writer. On a loaded machine the
  // scheduler would otherwise let one thread drain its whole batch, and the test would prove nothing.
  while (behind(i + 1)) Atomics.wait(sleeper, 0, 0, 1)
}
store.close()
parentPort!.postMessage(seqs)
