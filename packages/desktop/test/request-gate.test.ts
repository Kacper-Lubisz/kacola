import { describe, expect, it } from 'vitest'
import { createRequestGate, type RequestKind } from '../src/renderer/features/sessions/request-gate.ts'

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const setup = () => {
  const busy: (RequestKind | null)[] = []
  const calls: string[] = []
  const gate = createRequestGate((k) => busy.push(k))
  return { busy, calls, gate }
}

describe('the recorder request gate', () => {
  it('runs a request and reports busy, then idle', async () => {
    const { busy, calls, gate } = setup()
    await gate.run('starting', async () => {
      calls.push('start')
    })
    expect(calls).toEqual(['start'])
    expect(busy).toEqual(['starting', null])
  })

  it('drops a second press while a request is in flight (no double start)', async () => {
    const { calls, gate } = setup()
    const d = deferred()
    const first = gate.run('starting', () => d.promise.then(() => void calls.push('start 1')))
    await gate.run('starting', async () => void calls.push('start 2'))
    await gate.run('pausing', async () => void calls.push('pause'))
    d.resolve()
    await first
    expect(calls).toEqual(['start 1'])
  })

  it('a Stop pressed while a resume is in flight waits for it, then stops (regression: it was dropped)', async () => {
    const { busy, calls, gate } = setup()
    const d = deferred()
    const resume = gate.run('pausing', () => d.promise.then(() => void calls.push('resume')))
    const stop = gate.run('stopping', async () => void calls.push('stop'))
    await Promise.resolve()
    expect(calls).toEqual([])
    d.resolve()
    await Promise.all([resume, stop])
    expect(calls).toEqual(['resume', 'stop'])
    expect(busy).toEqual(['pausing', 'stopping', 'stopping', null])
  })

  it('the queued Stop still runs when the resume fails', async () => {
    const { calls, gate } = setup()
    const d = deferred()
    const resume = gate.run('pausing', () => d.promise)
    const stop = gate.run('stopping', async () => void calls.push('stop'))
    d.reject(new Error('daemon said no'))
    await expect(resume).rejects.toThrow('daemon said no')
    await stop
    expect(calls).toEqual(['stop'])
  })

  it('only one Stop queues behind a resume; a third press is dropped', async () => {
    const { calls, gate } = setup()
    const d = deferred()
    const resume = gate.run('pausing', () => d.promise)
    const stop = gate.run('stopping', async () => void calls.push('stop 1'))
    await gate.run('stopping', async () => void calls.push('stop 2'))
    d.resolve()
    await Promise.all([resume, stop])
    expect(calls).toEqual(['stop 1'])
  })

  it('is free again once everything settles', async () => {
    const { calls, gate } = setup()
    await gate.run('pausing', async () => void calls.push('pause'))
    await gate.run('pausing', async () => void calls.push('resume'))
    await gate.run('stopping', async () => void calls.push('stop'))
    expect(calls).toEqual(['pause', 'resume', 'stop'])
  })
})
