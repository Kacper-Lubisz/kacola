import { run } from '@gnomeola/cli'

export type CliResult = { code: number; stdout: string; stderr: string }

/** Run the real CLI in-process against a daemon URL, as a non-TTY (agent) caller unless told otherwise. */
export async function gnomeola(
  argv: string[],
  url: string,
  opts: { tty?: boolean; stdin?: string } = {},
): Promise<CliResult> {
  let stdout = ''
  let stderr = ''
  const code = await run(argv, {
    stdout: (s) => {
      stdout += s
    },
    stderr: (s) => {
      stderr += s
    },
    isTTY: opts.tty ?? false,
    env: { GNOMEOLA_URL: url },
    ...(opts.stdin !== undefined ? { stdin: async () => opts.stdin! } : {}),
  })
  return { code, stdout, stderr }
}
