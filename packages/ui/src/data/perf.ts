// GNOMEOLA_UI_PERF=1: one JSON line per measurement on stderr ({"perf":"transcript.render",…}), so the
// e2e suite can hold rendering to a budget with numbers from inside the app rather than guesses.

const enabled = process.env.GNOMEOLA_UI_PERF === '1'

export function perf(name: string, fields: Record<string, number | string | boolean>): void {
  if (!enabled) return
  process.stderr.write(`${JSON.stringify({ perf: name, ...fields })}\n`)
}

export const perfEnabled = (): boolean => enabled
