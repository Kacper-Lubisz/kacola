import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { afterAll, describe, expect, it } from 'vitest'
import { SecretToolKeyring } from '../src/keyring.ts'

// The real libsecret path, exercised only where it works without a prompt: secret-tool installed and
// the default collection already unlocked (checked read-only over D-Bus first, so this never pops an
// unlock dialog on someone's desktop). Uses a unique `service` attribute and always clears it.

function keyringUsable(): { ok: boolean; why: string } {
  if (spawnSync('secret-tool', ['--version'], { stdio: 'ignore' }).error)
    return { ok: false, why: 'secret-tool not installed' }
  const r = spawnSync(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.secrets',
      '--object-path',
      '/org/freedesktop/secrets/aliases/default',
      '--method',
      'org.freedesktop.DBus.Properties.Get',
      'org.freedesktop.Secret.Collection',
      'Locked',
    ],
    { encoding: 'utf8', timeout: 5_000 },
  )
  if (r.status !== 0) return { ok: false, why: `no Secret Service on the session bus (${r.stderr.trim()})` }
  if (!r.stdout.includes('false')) return { ok: false, why: 'default keyring is locked; would prompt' }
  return { ok: true, why: '' }
}

const usable = keyringUsable()
if (!usable.ok) console.warn(`[keyring.int] SKIPPING real-keyring tests: ${usable.why}`)

describe.skipIf(!usable.ok)('real keyring via secret-tool', () => {
  const service = `kacola-test-${randomBytes(6).toString('hex')}`
  const key = `planted-keyring-${randomBytes(12).toString('hex')}`
  /** One lookup. A timed-out or failed secret-tool is an error, never an empty answer: under a loaded
   *  full run a 10 s timeout once surfaced as stdout '' — indistinguishable from "no key". */
  const lookupOnce = () => {
    const r = spawnSync('secret-tool', ['lookup', 'service', service, 'key', 'anthropic'], {
      encoding: 'utf8',
      timeout: 20_000,
    })
    if (r.error) throw new Error(`secret-tool lookup failed: ${r.error.message}`)
    return r
  }
  /** The keyring's answer, retried briefly until it equals `want` (the Secret Service can lag a write). */
  const lookup = (want?: string) => {
    let r = lookupOnce()
    for (let i = 0; want !== undefined && r.stdout !== want && i < 10; i++) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
      r = lookupOnce()
    }
    return r
  }
  let d: DaemonHandle | undefined

  afterAll(async () => {
    await d?.stop()
    spawnSync('secret-tool', ['clear', 'service', service, 'key', 'anthropic'], { timeout: 10_000 })
  })

  it('SecretToolKeyring round-trips set / get / clear', async () => {
    const k = new SecretToolKeyring({ service })
    expect(await k.get()).toBeNull()
    await k.set(key)
    expect(await k.get()).toBe(key)
    await k.clear()
    expect(await k.get()).toBeNull()
    await k.clear() // clearing nothing is fine
  })

  it('the daemon stores the key in the keyring, keeps it across restarts, and nowhere else', async () => {
    d = await startDaemon({ env: { KACOLA_KEYRING: 'secret-tool', KACOLA_KEYRING_SERVICE: service } })
    expect((await d.client.call('getSettings')).llm.apiKeyConfigured).toBe(false)
    expect(await d.client.call('setApiKey', { body: { key } })).toEqual({ configured: true })
    expect(lookup(key).stdout).toBe(key)

    await d.restart()
    expect((await d.client.call('getSettings')).llm.apiKeyConfigured).toBe(true)

    expect(await d.client.call('setApiKey', { body: { key: null } })).toEqual({ configured: false })
    expect(lookup('').stdout).toBe('')
    await d.kill('SIGTERM')

    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) =>
        statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)],
      )
    for (const f of files(d.dataDir)) expect(readFileSync(f, 'latin1').includes(key), f).toBe(false)
    expect(d.output().includes(key)).toBe(false)
  })
})
