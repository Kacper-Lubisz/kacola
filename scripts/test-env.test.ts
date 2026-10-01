import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hostsFile } from '../packages/cli/src/hosts.ts'
import { defaultDataDir, parseConfig } from '../packages/daemon/src/config.ts'
import { realDataDirs } from '../packages/daemon/src/data-lock.ts'
import { tokenFor as desktopTokenFor, uiStatePath } from '../packages/desktop/src/main/config.ts'
import { platformPaths } from '../packages/protocol/src/platform.ts'

// The guard on scripts/test-env.ts: in the hermetic tiers every default gnomeola path resolves into the
// per-worker temp home — for this process and for anything it spawns — and the daemon refuses the
// user's real data dir outright while VITEST is set. (2026-10-01: a daemon on the real data dir closed
// out a meeting that was still being recorded.)

const ROOT = resolve(import.meta.dirname, '..')
const testHome = process.env.GNOMEOLA_TEST_HOME!
const realHome = homedir()
const under = (p: string, dir: string) => resolve(p).startsWith(`${resolve(dir)}/`)

describe('test isolation (scripts/test-env.ts)', () => {
  it('points every XDG base dir gnomeola reads at a temp home, and remembers the real ones', () => {
    expect(testHome).toBeTruthy()
    expect(under(testHome, tmpdir())).toBe(true)
    for (const k of ['DATA', 'CONFIG', 'STATE']) {
      expect(under(process.env[`XDG_${k}_HOME`]!, testHome), k).toBe(true)
      expect(process.env[`GNOMEOLA_TEST_REAL_XDG_${k}_HOME`], k).toBeTruthy()
    }
    expect(process.env.VITEST).toBeTruthy()
  })

  it('no default path resolves under the real home, on any platform the code knows', () => {
    const env = process.env
    const paths: string[] = [
      defaultDataDir(env, 'linux'),
      defaultDataDir(env, 'darwin'),
      defaultDataDir({ ...env, FLATPAK_ID: 'org.gnome.Gnomeola' }, 'linux'),
      parseConfig([], env, 'linux').dataDir,
      parseConfig([], { ...env, GNOMEOLA_CALENDAR: 'off', GNOMEOLA_KEYRING: 'memory' }, 'darwin').dataDir,
      hostsFile(env, 'linux'),
      hostsFile(env, 'darwin'),
      uiStatePath(env),
    ]
    for (const platform of ['linux', 'darwin']) {
      const p = platformPaths({ platform, env, home: realHome })
      paths.push(p.dataDir, p.configDir, p.stateDir)
    }
    for (const p of paths) {
      expect(under(p, testHome), p).toBe(true)
      expect(realDataDirs().includes(resolve(p)), p).toBe(false)
    }
    // the speech models stay the user's downloaded ones, on purpose (read-mostly; see test-env.ts)
    expect(platformPaths({ platform: 'linux', env, home: realHome }).modelsDir).toBe(env.GNOMEOLA_MODELS_DIR)
    // the desktop's hosts.json lookup reads the temp config dir too (no token found there)
    expect(desktopTokenFor({ ...env, GNOMEOLA_TOKEN: undefined }, 'http://192.0.2.1:8787')).toBeUndefined()
  })

  it('a spawned daemon process inherits it and resolves its default data dir into the temp home', () => {
    const script = `
      import { parseConfig } from ${JSON.stringify(join(ROOT, 'packages/daemon/src/config.ts'))}
      process.stdout.write(JSON.stringify({ dataDir: parseConfig([]).dataDir, vitest: process.env.VITEST ?? null }))
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' })
    expect(r.status, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout) as { dataDir: string; vitest: string | null }
    expect(under(out.dataDir, testHome)).toBe(true)
    expect(out.vitest).toBeTruthy()
  })

  it('the daemon refuses a data dir that is the real default while VITEST is set, before touching it', () => {
    // a stand-in "real" home (never the user's): the daemon is told this is the real XDG_DATA_HOME
    const fakeReal = mkdtempSync(join(tmpdir(), 'gnomeola-fake-real-'))
    try {
      const r = spawnSync(process.execPath, [join(ROOT, 'packages/daemon/src/main.ts'), '--port', '0'], {
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          XDG_DATA_HOME: fakeReal,
          GNOMEOLA_TEST_REAL_XDG_DATA_HOME: fakeReal,
          GNOMEOLA_FAKES: '1',
          GNOMEOLA_KEYRING: 'memory',
        },
      })
      expect(r.status).not.toBe(0)
      expect(r.stderr).toMatch(/refusing to open the real gnomeola data dir .*fake-real.*gnomeola/)
      expect(existsSync(join(fakeReal, 'gnomeola'))).toBe(false)
      expect(readdirSync(fakeReal)).toEqual([])
    } finally {
      rmSync(fakeReal, { recursive: true, force: true })
    }
  })
})
