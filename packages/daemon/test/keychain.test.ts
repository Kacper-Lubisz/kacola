import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DaemonError } from '../src/errors.ts'
import { KeychainKeyring, keychainAvailable } from '../src/keychain.ts'

// KeychainKeyring against test/fixtures/fake-security.mjs, a stand-in for macOS `security` that
// tokenises `-i` input like the real tool, refuses passwords in argv, and logs every argv it sees.

const FAKE = join(import.meta.dirname, 'fixtures', 'fake-security.mjs')
const ENV_KEYS = ['FAKE_SECURITY_DB', 'FAKE_SECURITY_ARGV_LOG', 'FAKE_SECURITY_MODE', 'PATH'] as const

let dir: string
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  dir = mkdtempSync(join(tmpdir(), 'fake-security-'))
  process.env.FAKE_SECURITY_DB = join(dir, 'db.json')
  process.env.FAKE_SECURITY_ARGV_LOG = join(dir, 'argv.log')
  delete process.env.FAKE_SECURITY_MODE
  // the fake's shebang is `/usr/bin/env node`; make sure it finds this node
  process.env.PATH = `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  rmSync(dir, { recursive: true, force: true })
})

const keyring = (opts: { service?: string; keychain?: string; timeoutMs?: number } = {}) =>
  new KeychainKeyring({ bin: FAKE, service: 'gnomeola-test', ...opts })

const argvLog = (): string[][] =>
  readFileSync(join(dir, 'argv.log'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

async function rejection(p: Promise<unknown>): Promise<DaemonError> {
  const err = await p.then(
    () => {
      throw new Error('expected a rejection')
    },
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(DaemonError)
  return err as DaemonError
}

describe('KeychainKeyring', () => {
  it('round-trips per account, and the accounts are independent', async () => {
    const k = keyring()
    expect(await k.get('anthropic')).toBeNull()
    expect(await k.get('openai')).toBeNull()
    await k.set('sk-ant-api03-abc_DEF.123', 'anthropic')
    expect(await k.get('anthropic')).toBe('sk-ant-api03-abc_DEF.123')
    expect(await k.get('openai')).toBeNull()
    await k.set('sk-proj-xyz', 'openai')
    expect(await k.get('openai')).toBe('sk-proj-xyz')
    expect(await k.get('anthropic')).toBe('sk-ant-api03-abc_DEF.123')
    // default account is anthropic
    expect(await k.get()).toBe('sk-ant-api03-abc_DEF.123')
    // labels as documented
    const db = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'))
    expect(db['<default>']['gnomeola-test\u0000anthropic'].label).toBe('kacola: Anthropic API key')
    expect(db['<default>']['gnomeola-test\u0000openai'].label).toBe('kacola: OpenAI API key')
  })

  it('set replaces an existing key (-U)', async () => {
    const k = keyring()
    await k.set('first-key')
    await k.set('second-key')
    expect(await k.get()).toBe('second-key')
  })

  it('clear removes the key, and clearing a missing key succeeds', async () => {
    const k = keyring()
    await k.clear('openai')
    await k.set('to-be-cleared', 'openai')
    await k.set('stays', 'anthropic')
    await k.clear('openai')
    expect(await k.get('openai')).toBeNull()
    expect(await k.get('anthropic')).toBe('stays')
    await k.clear('openai')
  })

  it('never puts the key in argv', async () => {
    const k = keyring()
    const keys = ['sk-ant-SECRET-one', 'sk-proj-SECRET-two', 'sk-ant-SECRET-three']
    await k.set(keys[0] as string, 'anthropic')
    await k.set(keys[1] as string, 'openai')
    await k.set(keys[2] as string, 'anthropic')
    await k.get('anthropic')
    const log = argvLog()
    expect(log.length).toBeGreaterThanOrEqual(4)
    expect(log.filter((a) => a[0] === '-i')).toHaveLength(3)
    for (const argv of log) for (const key of keys) expect(argv.join(' ')).not.toContain(key)
  })

  it('the fake really refuses a password in argv (guards the test above)', async () => {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync(FAKE, ['add-generic-password', '-a', 'x', '-s', 'y', '-w', 'leak'], {
      encoding: 'utf8',
    })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('REFUSING')
  })

  it('quotes values for the interactive tokenizer', async () => {
    // printable ASCII with quotes and backslashes survives security's split_line()
    const k = keyring({ service: `svc with "quotes" and \\ spaces` })
    const odd = `a"b'c\\d$e`
    await k.set(odd)
    expect(await k.get()).toBe(odd)
    const db = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'))
    expect(Object.keys(db['<default>'])).toEqual([`svc with "quotes" and \\ spaces\u0000anthropic`])
  })

  it('rejects keys with whitespace, control or non-ASCII characters as bad_request', async () => {
    const k = keyring()
    for (const bad of [
      '',
      'sk ant',
      'sk\tant',
      'sk-ant\n',
      'sk-ant\r',
      'sk\u0000x',
      'sk-é',
      'a\nfind-generic-password',
    ]) {
      const err = await rejection(k.set(bad))
      expect(err.code).toBe('bad_request')
    }
    expect(await k.get()).toBeNull()
    // a service that could inject a second command line is refused up front
    expect(() => keyring({ service: 'x\nadd-generic-password' })).toThrow(DaemonError)
  })

  it('a locked keychain is unavailable with a useful message', async () => {
    process.env.FAKE_SECURITY_MODE = 'locked'
    const k = keyring()
    for (const op of [() => k.get(), () => k.set('sk-x'), () => k.clear()]) {
      const err = await rejection(op())
      expect(err.code).toBe('unavailable')
      expect(err.message).toMatch(/locked/)
      expect(err.message).toMatch(/exit 36/)
      expect(err.message).toMatch(/User interaction is not allowed/)
    }
  })

  it('a hung security times out as unavailable', async () => {
    process.env.FAKE_SECURITY_MODE = 'hang'
    const k = keyring({ timeoutMs: 300 })
    const err = await rejection(k.get())
    expect(err.code).toBe('unavailable')
    expect(err.message).toMatch(/did not answer/)
  })

  it('a missing binary is unavailable', async () => {
    const k = new KeychainKeyring({ bin: join(dir, 'no-such-security') })
    const err = await rejection(k.get())
    expect(err.code).toBe('unavailable')
    expect(err.message).toMatch(/ENOENT/)
  })

  it('keychainAvailable probes the binary', () => {
    expect(keychainAvailable(FAKE)).toBe(true)
    expect(keychainAvailable(join(dir, 'no-such-security'))).toBe(false)
  })

  it('passes the keychain option to every command', async () => {
    const kc = join(dir, 'test.keychain-db')
    const k = keyring({ keychain: kc })
    await k.set('in-custom-keychain')
    expect(await k.get()).toBe('in-custom-keychain')
    // not visible in the default keychain
    expect(await keyring().get()).toBeNull()
    await k.clear()
    expect(await k.get()).toBeNull()
    const log = argvLog()
    const find = log.find((a) => a[0] === 'find-generic-password')
    const del = log.find((a) => a[0] === 'delete-generic-password')
    expect(find?.at(-1)).toBe(kc)
    expect(del?.at(-1)).toBe(kc)
    // the add went through -i with the keychain on the stdin line, so the item landed in that keychain
    const db = JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'))
    expect(Object.keys(db)).toContain(kc)
  })
})
