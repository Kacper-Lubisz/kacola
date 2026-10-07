import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { adoptLegacyEnv, legacyEnvWarning } from '../src/legacy.ts'
import { chromiumProfileInUse, migrateLegacyUserDirs } from '../src/legacy-dirs.ts'

// Compatibility with gnomeola installs (src/legacy.ts, src/legacy-dirs.ts): GNOMEOLA_* is read as
// KACOLA_* for one release, and the config and state dirs move to their kacola names.

describe('GNOMEOLA_* environment variables', () => {
  it('are adopted as KACOLA_* when those are unset, and a set KACOLA_* wins', () => {
    const env: Record<string, string | undefined> = {
      GNOMEOLA_URL: 'http://127.0.0.1:9999',
      GNOMEOLA_DATA_DIR: '/d',
      GNOMEOLA_TOKEN: 'old',
      KACOLA_TOKEN: 'new',
      GNOMEOLA_FAKES: '1',
      KACOLA_FAKES: '1',
      PATH: '/bin',
    }
    const r = adoptLegacyEnv(env)
    expect(r).toEqual({ adopted: ['GNOMEOLA_DATA_DIR', 'GNOMEOLA_URL'], shadowed: ['GNOMEOLA_TOKEN'] })
    expect(env.KACOLA_URL).toBe('http://127.0.0.1:9999')
    expect(env.KACOLA_DATA_DIR).toBe('/d')
    expect(env.KACOLA_TOKEN).toBe('new')
    expect(legacyEnvWarning(r)).toBe(
      'kacola: GNOMEOLA_DATA_DIR, GNOMEOLA_URL are deprecated: rename to KACOLA_DATA_DIR, KACOLA_URL ' +
        '(the old names are read for one more release); ignoring GNOMEOLA_TOKEN: the KACOLA_ name is set too and wins',
    )
    // a second pass (a child process inheriting the result) adopts nothing and says nothing
    expect(legacyEnvWarning(adoptLegacyEnv(env))).toContain('ignoring GNOMEOLA_TOKEN')
    expect(legacyEnvWarning(adoptLegacyEnv({ KACOLA_URL: 'x', GNOMEOLA_URL: 'x' }))).toBeNull()
  })

  it('the side-effect module adopts them before anything else runs, warning once on stderr', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(join(import.meta.dirname, '..', 'src', 'legacy-env.ts'))}); console.log(process.env.KACOLA_URL)`,
      ],
      { env: { PATH: process.env.PATH, GNOMEOLA_URL: 'http://127.0.0.1:1234' }, encoding: 'utf8' },
    )
    expect(r.stdout.trim()).toBe('http://127.0.0.1:1234')
    expect(r.stderr.trim().split('\n')).toEqual([
      'kacola: GNOMEOLA_URL is deprecated: rename to KACOLA_URL (the old names are read for one more release)',
    ])
  })
})

const roots: string[] = []
afterEach(() => {
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true })
})
const home = () => {
  const d = mkdtempSync(join(tmpdir(), 'kacola-legacy-home-'))
  roots.push(d)
  return d
}

describe('the config and state dirs', () => {
  it('move to their kacola names, leaving symlinks', () => {
    const h = home()
    mkdirSync(join(h, '.config', 'gnomeola'), { recursive: true })
    writeFileSync(join(h, '.config', 'gnomeola', 'hosts.json'), '{"h":1}')
    mkdirSync(join(h, '.local', 'state', 'gnomeola'), { recursive: true })
    writeFileSync(join(h, '.local', 'state', 'gnomeola', 'ui-state.json'), '{"onboarded":true}')
    migrateLegacyUserDirs({ platform: 'linux', env: {}, home: h })
    expect(readFileSync(join(h, '.config', 'kacola', 'hosts.json'), 'utf8')).toBe('{"h":1}')
    expect(readFileSync(join(h, '.local', 'state', 'kacola', 'ui-state.json'), 'utf8')).toBe(
      '{"onboarded":true}',
    )
    expect(lstatSync(join(h, '.config', 'gnomeola')).isSymbolicLink()).toBe(true)
    // idempotent
    migrateLegacyUserDirs({ platform: 'linux', env: {}, home: h })
    expect(existsSync(join(h, '.config', 'kacola', 'hosts.json'))).toBe(true)
  })

  it('wait while the old window runs, and when both exist copy only the missing files that matter', () => {
    const h = home()
    const old = join(h, '.config', 'gnomeola')
    mkdirSync(old, { recursive: true })
    writeFileSync(join(old, 'hosts.json'), '{"h":1}')
    writeFileSync(join(old, 'Preferences'), 'chromium')
    symlinkSync(`${hostname()}-${process.pid}`, join(old, 'SingletonLock'))
    expect(chromiumProfileInUse(old)).toContain(String(process.pid))
    migrateLegacyUserDirs({ platform: 'linux', env: {}, home: h })
    expect(existsSync(join(h, '.config', 'kacola'))).toBe(false)
    // the window closed; meanwhile the new one created its own profile
    rmSync(join(old, 'SingletonLock'))
    mkdirSync(join(h, '.config', 'kacola'))
    writeFileSync(join(h, '.config', 'kacola', 'Preferences'), 'new chromium')
    migrateLegacyUserDirs({ platform: 'linux', env: {}, home: h })
    expect(readFileSync(join(h, '.config', 'kacola', 'hosts.json'), 'utf8')).toBe('{"h":1}')
    expect(readFileSync(join(h, '.config', 'kacola', 'Preferences'), 'utf8')).toBe('new chromium')
    expect(readFileSync(join(old, 'hosts.json'), 'utf8')).toBe('{"h":1}')
  })
})
