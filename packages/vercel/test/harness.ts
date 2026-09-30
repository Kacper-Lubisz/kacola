import { type ChildProcess, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildOutput } from '../scripts/build.ts'
import type { FunctionName } from '../src/app.ts'

export type HarnessStats = {
  invocations: Record<string, number>
  kills: Record<string, number>
  open: number
}
export type Harness = {
  url: string
  stats(): Promise<HarnessStats>
  output(): string
  close(): Promise<void>
}

const builds = new Map<string, Promise<string>>()
const dirs: string[] = []
process.on('exit', () => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

/** Build the deployment once per distinct duration set (per test process). */
export function built(maxDuration: Partial<Record<FunctionName, number>> = {}): Promise<string> {
  const key = JSON.stringify(maxDuration)
  let b = builds.get(key)
  if (!b) {
    // Inside the package (under the ignored .vercel/), so the functions' lazy `@gnomeola/store` import —
    // the harness-only SQLite path — resolves from this package's node_modules, as it would in a repo.
    mkdirSync(join(import.meta.dirname, '..', '.vercel'), { recursive: true })
    const dir = mkdtempSync(join(import.meta.dirname, '..', '.vercel', 'test-'))
    dirs.push(dir)
    b = buildOutput({ out: join(dir, 'output'), maxDuration }).then((r) => r.out)
    builds.set(key, b)
  }
  return b
}

/** Serve a build output with the harness, as a separate process with exactly `env`. */
export async function startHarness(out: string, env: Record<string, string>): Promise<Harness> {
  const child: ChildProcess = spawn(process.execPath, [join(import.meta.dirname, 'harness-server.ts'), out], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '/tmp', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stderr!.on('data', (c: Buffer) => {
    log += c.toString()
  })
  const url = await new Promise<string>((resolve, reject) => {
    let buf = ''
    child.stdout!.on('data', (c: Buffer) => {
      buf += c.toString()
      const line = buf.split('\n').find((l) => l.includes('"listening"'))
      if (line) resolve((JSON.parse(line) as { url: string }).url)
    })
    child.once('exit', (code) => reject(new Error(`harness exited ${code}: ${log}`)))
  })
  return {
    url,
    output: () => log,
    stats: async () => (await (await fetch(`${url}/__harness/stats`)).json()) as HarnessStats,
    close: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve()
        child.once('exit', () => resolve())
        child.kill('SIGTERM')
      }),
  }
}
