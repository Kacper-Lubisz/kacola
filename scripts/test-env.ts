import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

// Setup for the unit, int and e2e tiers (vitest.config.ts `hermetic`). Everything set here is inherited
// by the daemons, CLIs and UIs a test spawns, since they get this process's environment.

// 1. Those tiers are hermetic and free, so a real OpenAI key in the developer's shell must never reach
// them. Live calls belong to the eval tier, which keeps the key.
delete process.env.OPENAI_API_KEY
delete process.env.OPENAI_BASE_URL
delete process.env.TYPESAFE_API_KEY
delete process.env.TYPESAFE_AI_API_KEY
delete process.env.TYPESAFE_BASE_URL

// 2. Nothing a test runs may resolve the user's real kacola directories. On 2026-10-01 a daemon that
// had resolved the default data dir ran crash recovery over a meeting that was still being recorded.
// Every default (@kacola/protocol platformPaths: data, config, state — on Linux, in Flatpak, and on
// macOS once XDG_* is set) now points into a temp dir per test worker; a test that wants a real path has
// to pass it explicitly, and the daemon refuses the real data dir outright while VITEST is set
// (packages/daemon/src/data-lock.ts).
//
// Deliberately NOT moved:
//   HOME            mise, podman, git, fontconfig's ~/.fonts and the Shell/EDS harnesses (which build
//                   their own private HOME anyway) rely on it; kacola's defaults never read HOME when
//                   the XDG variables are set
//   XDG_CACHE_HOME  only regenerable test caches live there (fixtures, test models), shared on purpose
//   models          KACOLA_MODELS_DIR stays the user's downloaded speech models (read-mostly, large),
//                   as test daemons always shared them
// The real values are kept in KACOLA_TEST_REAL_XDG_* for the few tools that must see them (podman's
// image store lives under XDG_DATA_HOME: @kacola/testkit/postgres hands them back to podman).
if (!process.env.KACOLA_TEST_HOME) {
  const home = homedir()
  const real = {
    DATA: process.env.XDG_DATA_HOME || join(home, '.local', 'share'),
    CONFIG: process.env.XDG_CONFIG_HOME || join(home, '.config'),
    STATE: process.env.XDG_STATE_HOME || join(home, '.local', 'state'),
  }
  process.env.KACOLA_MODELS_DIR ||= join(real.DATA, 'kacola', 'models')
  const root = mkdtempSync(join(tmpdir(), 'kacola-test-home-'))
  process.env.KACOLA_TEST_HOME = root
  for (const [k, v] of Object.entries(real)) {
    process.env[`KACOLA_TEST_REAL_XDG_${k}_HOME`] = v
    const dir = join(root, k.toLowerCase())
    mkdirSync(dir, { recursive: true })
    process.env[`XDG_${k}_HOME`] = dir
  }
  // a test that sets KACOLA_DATA_DIR means it; one inherited from the developer's shell does not
  if (process.env.KACOLA_DATA_DIR && !process.env.KACOLA_DATA_DIR.startsWith(tmpdir()))
    delete process.env.KACOLA_DATA_DIR
  process.on('exit', () => rmSync(root, { recursive: true, force: true }))
}
