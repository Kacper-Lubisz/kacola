import { describe, it } from 'vitest'
import { assertCaptureRun, runScenario } from './scenario.ts'

// Level 1: the shared scenario through FileCaptureSource — no sound server, runs anywhere. The level-2
// twin (same fixtures, same assertions, real PipeWire) is capture-paths.e2e.test.ts.
describe('capture paths — level 1 (FileCaptureSource)', () => {
  it('separates, times, aligns and meters both tracks', async () => {
    const run = await runScenario('file')
    const m = assertCaptureRun(run)
    console.log(`[level 1] ${JSON.stringify(m)}`)
  })
})
