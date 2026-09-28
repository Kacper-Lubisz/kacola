// Run the live agent-behaviour eval (V-6c) against the REAL daemon over the seeded meetings.
//   node packages/e2e/scripts/agent-eval.ts
// Spends real model calls on the current Claude Code account.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startDaemon } from '@gnomeola/testkit/daemon'
import { seedMeetings } from '../src/seed.ts'

const root = join(import.meta.dirname, '..', '..', '..')
const dataDir = mkdtempSync(join(tmpdir(), 'gnomeola-agent-eval-'))
seedMeetings(dataDir)
const d = await startDaemon({ dataDir })
const code = await new Promise<number | null>((resolve) => {
  const c = spawn(
    'pnpm',
    ['exec', 'vitest', 'run', '--project', 'eval', 'packages/cli/test/agent.eval.test.ts'],
    {
      cwd: root,
      env: { ...process.env, GNOMEOLA_AGENT_EVAL: '1', GNOMEOLA_EVAL_URL: d.baseUrl },
      stdio: 'inherit',
    },
  )
  c.on('close', resolve)
})
await d.stop()
process.exit(code ?? 1)
