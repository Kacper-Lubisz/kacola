import { run } from '@gnomeola/cli'

export type CliResult = { code: number; stdout: string; stderr: string }

/** Run the real CLI in-process against a daemon URL, as a non-TTY (agent) caller unless told otherwise. */
export async function gnomeola(
  argv: string[],
  url: string,
  opts: {
    tty?: boolean
    stdin?: string
    /** Extra environment (e.g. GNOMEOLA_LEASE_DIR for the live channel). */
    env?: Record<string, string | undefined>
    /** Stops a long-running command (live attach / wait), like SIGTERM. */
    signal?: AbortSignal
    /** Each chunk of stdout as it is written (a live attach's lines). */
    onStdout?: (s: string) => void
  } = {},
): Promise<CliResult> {
  let stdout = ''
  let stderr = ''
  const code = await run(argv, {
    stdout: (s) => {
      stdout += s
      opts.onStdout?.(s)
    },
    stderr: (s) => {
      stderr += s
    },
    isTTY: opts.tty ?? false,
    env: { GNOMEOLA_URL: url, ...opts.env },
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.stdin !== undefined ? { stdin: async () => opts.stdin! } : {}),
  })
  return { code, stdout, stderr }
}
