// Worker for concurrency.int.test.ts: its own SQLite connection, hammering commits on a shared file.
import { parentPort, workerData } from 'node:worker_threads'
import { Store } from '../src/index.ts'

const { path, sessionId, count, worker, barrier, workers } = workerData as {
  path: string
  sessionId: string
  count: number
  worker: number
  barrier: SharedArrayBuffer
  workers: number
}
const store = Store.open(path, { busyTimeoutMs: 30_000 })
const seqs: number[] = []
store.onCommit((e) => seqs.push(e.seq))
const sleeper = new Int32Array(new SharedArrayBuffer(4))
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
  if (i % 17 === 0) Atomics.wait(sleeper, 0, 0, 1) // jitter so writers interleave
}
store.close()
parentPort!.postMessage(seqs)
