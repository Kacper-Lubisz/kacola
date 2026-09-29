import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { otherMicUsers } from '@gnomeola/daemon'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// C-8 on the REAL PipeWire graph: the daemon's microphone-activity rule watches pw-dump, and "another
// application" is a pw-record stream (application.name set like a browser's) capturing from the rig's
// virtual microphone. Nothing touches the user's real devices or defaults (asserted at the end).
//
// Something else on this desktop may be capturing from a real microphone (a call, a browser tab) — the
// rule would rightly fire for it — so the daemon is told to watch only the rig's microphone
// (GNOMEOLA_MIC_ACTIVITY=pipewire:<rig source>). The unrestricted detection is unit-tested on pw-dump
// shapes (packages/daemon/test/calendar.test.ts); here the real graph, stream states and polling are.

let rig: PipeWireRig
let d: DaemonHandle
let defaults: Awaited<ReturnType<typeof readDefaults>>
let call: ChildProcess | null = null

describe('auto-record when another app uses the microphone (real PipeWire)', () => {
  beforeAll(async () => {
    defaults = await readDefaults()
    rig = await PipeWireRig.create()
    d = await startDaemon({
      env: {
        GNOMEOLA_MIC_ACTIVITY: `pipewire:${rig.mic.captureTarget}`,
        GNOMEOLA_MIC_IDLE_STOP_MS: '1500',
      },
    })
    // the restriction works: whatever else is capturing right now is not what the daemon sees
    const graph = JSON.parse(execFileSync('pw-dump', { encoding: 'utf8', maxBuffer: 64 << 20 }))
    expect(otherMicUsers(graph, { onlyTarget: rig.mic.captureTarget })).toEqual([])
  }, 60_000)
  afterAll(async () => {
    call?.kill('SIGKILL')
    await d?.stop()
    await rig?.teardown()
    if (defaults) await assertDefaultsUnchanged(defaults)
  })

  const live = async () =>
    (await d.client.call('listSessions', { query: { includePrivate: true } })).sessions.filter(
      (s) => s.status === 'recording' || s.status === 'paused',
    )

  it('does nothing while the rule is off', async () => {
    call = startCall()
    await new Promise((r) => setTimeout(r, 4000))
    expect(await live()).toEqual([])
    await stopCall()
  })

  it('records once the call opens the mic, and stops after it has been idle', async () => {
    await d.client.call('updateSettings', { body: { autoRecord: { micActivity: true } } })
    await new Promise((r) => setTimeout(r, 2500)) // the first poll sees no call
    expect(await live()).toEqual([])
    call = startCall()
    const [s] = await waitFor(
      async () => {
        const l = await live()
        return l.length ? l : null
      },
      15_000,
      'a mic-triggered session',
    )
    expect(s!.title).toBe('Call (gnomeola-e2e-call)')
    await stopCall()
    await waitFor(
      async () => (await d.client.call('getSession', { params: { id: s!.id } })).status === 'stopped',
      15_000,
      'the auto stop',
    )
  })
})

function startCall(): ChildProcess {
  // a capture stream from "some other app", on the rig's virtual microphone only
  const c = spawn(
    'pw-record',
    [
      '--target',
      rig.mic.captureTarget,
      '-P',
      '{ application.name=gnomeola-e2e-call node.name=e2e-call }',
      '-',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  )
  return c
}

async function stopCall(): Promise<void> {
  const c = call
  call = null
  if (!c || c.exitCode !== null) return
  const done = new Promise((r) => c.once('exit', r))
  c.kill('SIGTERM')
  await done
}
