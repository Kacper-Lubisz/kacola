import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appBundleOf } from '../src/commands/install-cli.ts'
import {
  type Fs,
  InstallError,
  installCli,
  nodeFs,
  renderShim,
  SHIM_MARKER,
  shimSpec,
  uninstallCli,
  whichAll,
} from '../src/install.ts'
import { run } from '../src/main.ts'

// P-4 in temp homes: idempotent, never clobbers a foreign `gnomeola`, reports PATH shadowing, and
// removes exactly what it wrote.

const SKILL = '---\nname: meeting-context\n---\nuse gnomeola\n'
const tempHome = () => mkdtempSync(join(tmpdir(), 'gnomeola-home-'))
const dev = (entry = '/opt/gnomeola/cli.mjs') => shimSpec('dev', { node: '/usr/bin/node', entry })
const exe = (p: string, text = '#!/bin/sh\necho other\n') => {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, text)
  chmodSync(p, 0o755)
}

describe('shim content per packaging mode', () => {
  it('flatpak: runs the CLI inside the sandbox, launches the app with --background', () => {
    const s = renderShim(shimSpec('flatpak'))
    expect(s.startsWith('#!/bin/sh\n')).toBe(true)
    expect(s).toContain(SHIM_MARKER)
    expect(s).toContain(`'flatpak' 'run' '--command=gnomeola' 'org.gnome.Gnomeola' "$@"`)
    expect(s).toContain('flatpak run org.gnome.Gnomeola --background')
  })

  it('macos: the app’s Electron as Node + Resources/runtime/cli.mjs; open -g to launch', () => {
    const s = renderShim(shimSpec('macos', { appPath: "/Applications/gno meola's.app" }))
    expect(s).toContain(
      `ELECTRON_RUN_AS_NODE='1' '/Applications/gno meola'\\''s.app/Contents/MacOS/gnomeola' '/Applications/gno meola'\\''s.app/Contents/Resources/runtime/cli.mjs' "$@"`,
    )
    expect(s).toContain(`open -g -a '/Applications/gno meola'\\''s.app' --args --background`)
    expect(appBundleOf('/Applications/gnomeola.app/Contents/MacOS/gnomeola')).toBe(
      '/Applications/gnomeola.app',
    )
    expect(appBundleOf('/usr/bin/node')).toBeNull()
  })

  it('dev without a launch command never autostarts; a launch command is pluggable', () => {
    expect(renderShim(dev())).toMatch(/\|\| exit 3\n/)
    expect(
      renderShim(shimSpec('dev', { node: 'n', entry: 'e', launch: 'systemctl --user start gnomeolad' })),
    ).toContain('systemctl --user start gnomeolad')
    expect(renderShim(shimSpec('dev', { node: '/e', entry: '/c.mjs', asElectron: true }))).toContain(
      `ELECTRON_RUN_AS_NODE='1' '/e' '/c.mjs'`,
    )
  })
})

describe('installCli', () => {
  it('installs shim + skill, then is idempotent, then updates its own shim', () => {
    const home = tempHome()
    const bin = join(home, '.local', 'bin')
    const r = installCli({ spec: dev(), home, path: '/usr/bin', skill: { source: SKILL } })
    expect(r.shim).toEqual({ path: join(bin, 'gnomeola'), action: 'installed' })
    expect(statSync(r.shim.path).mode & 0o777).toBe(0o755)
    expect(r.skill).toEqual({
      path: join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'),
      action: 'installed',
    })
    expect(readFileSync(r.skill!.path, 'utf8')).toBe(SKILL)
    expect(r.onPath).toBe(false)
    expect(r.warnings.join('\n')).toMatch(/not on your PATH/)

    const again = installCli({ spec: dev(), home, path: bin, skill: { source: SKILL } })
    expect(again.shim.action).toBe('unchanged')
    expect(again.skill!.action).toBe('unchanged')
    expect(again.onPath).toBe(true)
    expect(again.warnings).toEqual([])

    const moved = installCli({
      spec: dev('/new/cli.mjs'),
      home,
      path: bin,
      skill: { source: `${SKILL}v2\n` },
    })
    expect(moved.shim.action).toBe('updated')
    expect(moved.skill!.action).toBe('updated')
    expect(readFileSync(moved.shim.path, 'utf8')).toContain('/new/cli.mjs')
  })

  it('never clobbers a gnomeola it did not write (unless --force), and says so', () => {
    const home = tempHome()
    const target = join(home, '.local', 'bin', 'gnomeola')
    exe(target, '#!/bin/sh\n# the install.sh launcher\nexec node cli.ts "$@"\n')
    expect(() => installCli({ spec: dev(), home, path: '', skill: null })).toThrow(InstallError)
    expect(readFileSync(target, 'utf8')).toContain('install.sh launcher')
    const r = installCli({ spec: dev(), home, path: '', skill: null, force: true })
    expect(r.shim.action).toBe('replaced')
    expect(r.warnings.join()).toMatch(/not written by gnomeola install-cli/)
  })

  it('reports another gnomeola earlier on PATH, and the ones it now hides', () => {
    const home = tempHome()
    const other = join(home, 'opt', 'bin')
    exe(join(other, 'gnomeola'))
    const bin = join(home, '.local', 'bin')
    const behind = installCli({ spec: dev(), home, path: `${other}:${bin}`, skill: null })
    expect(behind.shadowedBy).toBe(join(other, 'gnomeola'))
    expect(behind.warnings.join()).toMatch(/comes first on PATH/)
    const ahead = installCli({ spec: dev(), home, path: `${bin}:${other}`, skill: null })
    expect(ahead.shadowedBy).toBeNull()
    expect(ahead.shadows).toEqual([join(other, 'gnomeola')])
    expect(whichAll(`${bin}:${other}:${bin}`)).toEqual([join(bin, 'gnomeola'), join(other, 'gnomeola')])
  })

  it('macos: /usr/local/bin needs admin rights → falls back to ~/.local/bin and reports it', () => {
    const home = tempHome()
    const fs: Fs = {
      ...nodeFs,
      exists: (p) => (p === '/usr/local/bin' ? true : nodeFs.exists(p)),
      writable: (d) => (d === '/usr/local/bin' ? false : nodeFs.writable(d)),
    }
    const r = installCli(
      { spec: shimSpec('macos', { appPath: '/Applications/gnomeola.app' }), home, path: '', skill: null },
      fs,
    )
    expect(r.needsAdmin).toBe('/usr/local/bin')
    expect(r.shim.path).toBe(join(home, '.local', 'bin', 'gnomeola'))
    // and never creates a system directory that does not exist
    const fs2: Fs = { ...nodeFs, exists: (p) => (p === '/usr/local/bin' ? false : nodeFs.exists(p)) }
    const r2 = installCli(
      { spec: shimSpec('macos', { appPath: '/A.app' }), home: tempHome(), path: '', skill: null },
      fs2,
    )
    expect(r2.needsAdmin).toBeNull()
    expect(r2.shim.path).toMatch(/\.local\/bin\/gnomeola$/)
  })

  it('keeps a skill the user edited', () => {
    const home = tempHome()
    installCli({ spec: dev(), home, path: '', skill: { source: SKILL } })
    const md = join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md')
    writeFileSync(md, `${SKILL}my own notes\n`)
    const r = installCli({ spec: dev(), home, path: '', skill: { source: `${SKILL}v2\n` } })
    expect(r.skill!.action).toBe('kept-edited')
    expect(readFileSync(md, 'utf8')).toContain('my own notes')
  })
})

describe('uninstallCli', () => {
  it('removes exactly what install-cli wrote', () => {
    const home = tempHome()
    installCli({ spec: dev(), home, path: '', skill: { source: SKILL } })
    const r = uninstallCli({ mode: 'dev', home })
    expect(r.removed).toEqual([join(home, '.local', 'bin', 'gnomeola')])
    expect(r.skill!.action).toBe('removed')
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context'))).toBe(false)

    exe(join(home, '.local', 'bin', 'gnomeola'))
    installCli({ spec: dev(), home: tempHome(), path: '', skill: null })
    const r2 = uninstallCli({ mode: 'dev', home })
    expect(r2.removed).toEqual([])
    expect(r2.keptForeign).toEqual([join(home, '.local', 'bin', 'gnomeola')])
    expect(r2.skill!.action).toBe('absent')
  })

  it('keeps an edited skill', () => {
    const home = tempHome()
    installCli({ spec: dev(), home, path: '', skill: { source: SKILL } })
    writeFileSync(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'), 'mine')
    expect(uninstallCli({ mode: 'dev', home }).skill!.action).toBe('kept-edited')
  })
})

describe('gnomeola install-cli / uninstall-cli (the command)', () => {
  const cli = async (argv: string[], env: Record<string, string>) => {
    let stdout = ''
    let stderr = ''
    const code = await run(argv, {
      stdout: (s) => {
        stdout += s
      },
      stderr: (s) => {
        stderr += s
      },
      isTTY: false,
      env,
    })
    return { code, stdout, stderr }
  }

  it('auto mode picks flatpak inside the sandbox; JSON report; refuses a foreign gnomeola with exit 5', async () => {
    const home = tempHome()
    const r = await cli(['install-cli'], { HOME: home, FLATPAK_ID: 'org.gnome.Gnomeola', PATH: '' })
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    expect(out).toMatchObject({
      mode: 'flatpak',
      shim: { action: 'installed' },
      skill: { action: 'installed' },
    })
    expect(readFileSync(out.shim.path, 'utf8')).toContain('--command=gnomeola')
    // the skill comes from the repo (or the bundle's inlined copy)
    expect(readFileSync(out.skill.path, 'utf8')).toMatch(/gnomeola/)

    const home2 = tempHome()
    exe(join(home2, '.local', 'bin', 'gnomeola'))
    const refused = await cli(['install-cli', '--mode', 'dev'], { HOME: home2, PATH: '' })
    expect(refused.code).toBe(5)
    expect(refused.stderr).toMatch(/different gnomeola is already installed/)

    const un = await cli(['uninstall-cli', '--mode', 'flatpak'], { HOME: home, PATH: '' })
    expect(un.code).toBe(0)
    expect(JSON.parse(un.stdout)).toMatchObject({ mode: 'flatpak', skill: { action: 'removed' } })
  })

  it('rejects an unknown mode', async () => {
    expect((await cli(['install-cli', '--mode', 'snap'], { HOME: tempHome() })).code).toBe(2)
  })
})
