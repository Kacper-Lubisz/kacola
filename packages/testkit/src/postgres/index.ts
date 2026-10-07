// @kacola/testkit/postgres — a throwaway real Postgres in podman, for the int tier's dialect tests.
// Everything that needs it skips cleanly (with the reason) when podman or the image is unavailable, so
// the tier stays green on machines without containers; PGlite covers Postgres there.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/**
 * podman keeps its image store and config under XDG_DATA_HOME / XDG_CONFIG_HOME. The hermetic tiers
 * point those at a temp dir (scripts/test-env.ts) and keep the real ones in KACOLA_TEST_REAL_XDG_*:
 * podman gets the real ones back, or every run would pull Postgres into an empty store.
 */
function podmanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const k of ['DATA', 'CONFIG', 'STATE']) {
    const realDir = process.env[`KACOLA_TEST_REAL_XDG_${k}_HOME`]
    if (realDir) env[`XDG_${k}_HOME`] = realDir
  }
  return env
}

const run = (cmd: string, args: string[], o: { timeout?: number } = {}) =>
  exec(cmd, args, { ...o, env: podmanEnv() })

export const POSTGRES_IMAGE = process.env.KACOLA_TEST_PG_IMAGE ?? 'docker.io/library/postgres:17'

export type PostgresContainer = {
  /** Superuser URL of the `postgres` database. */
  url: string
  /** URL of another database on the same server. */
  urlFor(db: string): string
  stop(): Promise<void>
}

/** null + reason when podman (or the image, without network) is not available. */
export async function podmanPostgresAvailable(): Promise<string | null> {
  if (process.env.KACOLA_SKIP_PODMAN === '1') return 'KACOLA_SKIP_PODMAN=1'
  try {
    await run('podman', ['--version'])
  } catch {
    return 'podman is not installed'
  }
  try {
    await run('podman', ['image', 'exists', POSTGRES_IMAGE])
  } catch {
    try {
      await run('podman', ['pull', '-q', POSTGRES_IMAGE], { timeout: 180_000 })
    } catch (err) {
      return `cannot pull ${POSTGRES_IMAGE}: ${(err as Error).message.split('\n')[0]}`
    }
  }
  return null
}

export async function startPostgres(): Promise<PostgresContainer> {
  const password = 'kacola-test'
  const { stdout } = await run('podman', [
    'run',
    '-d',
    '--rm',
    '-p',
    '127.0.0.1::5432',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    // fsync off: a test database, destroyed afterwards
    POSTGRES_IMAGE,
    '-c',
    'fsync=off',
    '-c',
    'max_connections=200',
  ])
  const id = stdout.trim()
  const stop = async () => {
    await run('podman', ['rm', '-f', id]).catch(() => {})
  }
  try {
    const port = (await run('podman', ['port', id, '5432/tcp'])).stdout.trim().split(':').pop()
    const deadline = Date.now() + 60_000
    for (;;) {
      try {
        // pg_isready alone passes during the image's init restart; a real query does not.
        await run('podman', ['exec', id, 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-c', 'select 1'])
        break
      } catch (err) {
        if (Date.now() > deadline) throw new Error(`postgres did not become ready: ${(err as Error).message}`)
        await new Promise((r) => setTimeout(r, 250))
      }
    }
    const urlFor = (db: string) => `postgres://postgres:${password}@127.0.0.1:${port}/${db}`
    return { url: urlFor('postgres'), urlFor, stop }
  } catch (err) {
    await stop()
    throw err
  }
}
