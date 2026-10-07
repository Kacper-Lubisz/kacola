// Side-effect module, imported FIRST by every entry point (daemon, CLI, window, agent, hosted server):
// GNOMEOLA_* environment variables from before the rename are adopted as KACOLA_* before any other
// module reads the environment, with one warning on stderr. Child processes inherit the KACOLA_ names, so
// they adopt nothing and stay quiet. Removed with the rest of legacy.ts in the release after 0.2.
import { adoptLegacyEnv, legacyEnvWarning } from './legacy.ts'

type Proc = { env: Record<string, string | undefined>; stderr?: { write(s: string): unknown } }
const proc = (globalThis as { process?: Proc }).process
if (proc?.env) {
  const warning = legacyEnvWarning(adoptLegacyEnv(proc.env))
  if (warning) proc.stderr?.write(`${warning}\n`)
}
