import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { networkInterfaces, tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '@kacola/cli'
import { createClient } from '@kacola/protocol'
import { createHostedApp, serve } from '@kacola/server'
import { SqliteStoreApi } from '@kacola/store'
import { MemoryBlobStore } from '@kacola/store/blob'
import { startDaemon } from '@kacola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'

// H-6 from the command line, end to end: `kacola pair` on a new device, approval on a trusted one,
// the token saved and used transparently afterwards — against the hosted server and against a local
// daemon that accepts remote devices (`kacolad --host 0.0.0.0 --remote`), reached over the LAN.

const cleanup: (() => unknown)[] = []
afterEach(async () => {
  for (const c of cleanup.splice(0).reverse()) await c()
})

type Out = { code: number; stdout: string; stderr: string }
/** The real CLI in-process with its own config dir; `onOutput` sees stdout as it is written. */
function cli(argv: string[], env: Record<string, string>, onOutput?: (all: string) => void): Promise<Out> {
  let stdout = ''
  let stderr = ''
  return run(argv, {
    stdout: (s) => {
      stdout += s
      onOutput?.(stdout)
    },
    stderr: (s) => {
      stderr += s
    },
    isTTY: false,
    env,
  }).then((code) => ({ code, stdout, stderr }))
}

/** `kacola pair` while `approve(code)` happens elsewhere, as soon as the code is printed. */
async function pairWith(
  url: string,
  env: Record<string, string>,
  approve: (code: string) => Promise<unknown>,
) {
  let approving: Promise<unknown> | null = null
  const r = await cli(['pair', '--url', url, '--name', 'test laptop'], env, (all) => {
    const m = /"userCode":"([A-Z]{4}-[A-Z]{4})"/.exec(all)
    if (m && !approving) approving = approve(m[1]!)
  })
  await approving
  return r
}

function configDir(): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'kacola-pair-cli-'))
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  return { XDG_CONFIG_HOME: dir, HOME: dir }
}

describe('kacola pair', () => {
  it('against a hosted server: refused without a token, paired by the owner, then transparent', async () => {
    const admin = 'cli-pair-admin-token-012345'
    const store = SqliteStoreApi.open(':memory:')
    const app = createHostedApp({
      store,
      blobs: new MemoryBlobStore(),
      auth: { secret: 's'.repeat(40), adminToken: admin, pollIntervalMs: 50 },
      trustLoopback: false,
    })
    const served = await serve(app)
    cleanup.push(() => served.close())
    await store.createSession({ title: 'hosted meeting' })
    const env = configDir()

    const before = await cli(['sessions', 'list', '--url', served.url], env)
    expect(before.code).toBe(1)
    expect(before.stderr).toMatch(/kacola pair --url/)

    const paired = await pairWith(served.url, env, (code) =>
      createClient({ baseUrl: served.url, token: admin }).call('pairApprove', { body: { userCode: code } }),
    )
    expect(paired.code).toBe(0)
    expect(paired.stdout).toMatch(/"event":"paired"/)
    const file = join(env.XDG_CONFIG_HOME!, 'kacola', 'hosts.json')
    expect(statSync(file).mode & 0o777).toBe(0o600)
    const hosts = JSON.parse(readFileSync(file, 'utf8'))
    expect(hosts[served.url].token).toMatch(/^gnm1\./)

    const after = await cli(['sessions', 'list', '--url', served.url], env)
    expect(after.code).toBe(0)
    expect(after.stdout).toContain('hosted meeting')
    const tok = await cli(['pair', 'token', '--url', served.url], env)
    expect(tok.stdout.trim()).toBe(hosts[served.url].token)

    // the owner revokes the device: its saved token stops working at once
    const ownerEnv = { ...configDir(), KACOLA_TOKEN: admin }
    const rev = await cli(['pair', 'revoke', hosts[served.url].deviceId, '--url', served.url], ownerEnv)
    expect(rev.code).toBe(0)
    expect((await cli(['sessions', 'list', '--url', served.url], env)).code).toBe(1)
  })

  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address

  it.skipIf(!lan)('against kacolad --remote over the LAN, approved at the machine itself', async () => {
    const d = await startDaemon({ args: ['--host', '0.0.0.0', '--remote'] })
    cleanup.push(() => d.stop())
    const port = new URL(d.baseUrl).port
    const remoteUrl = `http://${lan}:${port}`
    const localUrl = `http://127.0.0.1:${port}`
    await createClient({ baseUrl: localUrl }).call('createSession', { body: { title: 'laptop meeting' } })
    const phone = configDir()
    const owner = configDir()

    expect((await cli(['sessions', 'list', '--url', remoteUrl], phone)).code).toBe(1)
    const paired = await pairWith(remoteUrl, phone, (code) =>
      cli(['pair', 'approve', code, '--url', localUrl], owner),
    )
    expect(paired.code).toBe(0)
    const list = await cli(['sessions', 'list', '--url', remoteUrl], phone)
    expect(list.code).toBe(0)
    expect(list.stdout).toContain('laptop meeting')
    // the daemon kept its token-signing secret beside its database, private
    expect(statSync(join(d.dataDir, 'auth-secret')).mode & 0o777).toBe(0o600)
  })
})
