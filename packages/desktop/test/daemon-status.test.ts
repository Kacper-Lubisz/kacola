import { describe, expect, it } from 'vitest'
import { restarting, STARTUP_GRACE_MS, startupState } from '../src/renderer/data/daemon-status.ts'

// The first screen's choice between "Starting kacola…" and "Can’t reach kacola": main's supervisor knows
// whether the daemon is merely coming up.

const down = { kind: 'unreachable', error: 'connect ECONNREFUSED' } as const

describe('startupState', () => {
  it('a daemon being started, or restarted once, is starting, not unreachable', () => {
    expect(startupState(down, null, 0)).toBe('starting')
    expect(startupState(down, { kind: 'stopped' }, 500)).toBe('starting')
    expect(startupState(down, { kind: 'starting' }, 4000)).toBe('starting')
    expect(startupState(down, { kind: 'spawned', pid: 1 }, 4000)).toBe('starting')
    expect(startupState(down, { kind: 'restarting', attempt: 1, inMs: 500, lastError: 'x' }, 4000)).toBe(
      'starting',
    )
  })

  it('main giving up, a daemon that keeps crashing, or a start that takes too long is unreachable', () => {
    expect(startupState(down, { kind: 'unreachable', error: 'refused' }, 0)).toBe('unreachable')
    expect(startupState(down, { kind: 'restarting', attempt: 2, inMs: 1000, lastError: 'x' }, 0)).toBe(
      'unreachable',
    )
    expect(startupState(down, { kind: 'starting' }, STARTUP_GRACE_MS + 1)).toBe('unreachable')
  })

  it('anything but a failed request is starting', () => {
    expect(startupState({ kind: 'connecting' }, { kind: 'unreachable', error: 'x' }, 0)).toBe('starting')
  })

  it('restarting covers every state in which main is bringing the daemon (back) up', () => {
    expect(restarting({ kind: 'restarting', attempt: 0, inMs: 0, lastError: 'restart requested' })).toBe(true)
    expect(restarting({ kind: 'starting' })).toBe(true)
    expect(restarting({ kind: 'spawned', pid: 1 })).toBe(false)
    expect(restarting(null)).toBe(false)
  })
})
