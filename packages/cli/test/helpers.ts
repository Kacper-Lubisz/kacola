import { run } from '../src/main.ts'
import type { Io } from '../src/output.ts'

export type RunResult = {
  code: number
  stdout: string
  stderr: string
  // biome-ignore lint/suspicious/noExplicitAny: parsed CLI output is asserted field-by-field in each test
  json: () => any
}

export async function cli(
  argv: string[],
  o: { url: string; tty?: boolean; env?: Record<string, string> },
): Promise<RunResult> {
  let stdout = ''
  let stderr = ''
  const io: Io = {
    stdout: (s) => {
      stdout += s
    },
    stderr: (s) => {
      stderr += s
    },
    isTTY: o.tty ?? false,
    env: { HOME: '/nonexistent', ...o.env, KACOLA_URL: o.url },
  }
  const code = await run(argv, io)
  return { code, stdout, stderr, json: () => JSON.parse(stdout) }
}
