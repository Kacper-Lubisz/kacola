import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  adminInstallCommand,
  adminRemoveCommand,
  appleString,
  cliEntry,
  cliStateFrom,
  Integration,
  shq,
} from '../src/main/integration.ts'

// Main's desktop-integration logic: which CLI to run, and install-cli's --json report / exit code →
// the state Preferences shows. (The real install-cli run is in the desktop-dialogs e2e.)

const report = (over: object = {}) =>
  JSON.stringify({
    mode: 'dev',
    shim: { path: '/h/.local/bin/kacola', action: 'installed' },
    skill: { path: '/h/.claude/skills/meeting-context/SKILL.md', action: 'installed' },
    onPath: true,
    shadowedBy: null,
    shadows: [],
    needsAdmin: null,
    warnings: [],
    ...over,
  })

describe('cliStateFrom', () => {
  it('a dry run: "unchanged" means installed, "installed" means not yet, "updated" means outdated', () => {
    const at = (action: string) =>
      cliStateFrom(
        { code: 0, stdout: report({ shim: { path: '/h/.local/bin/kacola', action } }), stderr: '' },
        true,
      ).state
    expect(at('unchanged')).toBe('installed')
    expect(at('installed')).toBe('not-installed')
    expect(at('updated')).toBe('outdated')
  })
  it('a real run is installed, with where and PATH problems', () => {
    expect(
      cliStateFrom(
        {
          code: 0,
          stdout: report({ onPath: false, shadowedBy: '/usr/bin/kacola', needsAdmin: '/usr/local/bin' }),
          stderr: '',
        },
        false,
      ),
    ).toEqual({
      state: 'installed',
      path: '/h/.local/bin/kacola',
      skillPath: '/h/.claude/skills/meeting-context/SKILL.md',
      onPath: false,
      shadowedBy: '/usr/bin/kacola',
      needsAdmin: '/usr/local/bin',
    })
  })
  it('exit 5 (refused) is a foreign kacola, with its path', () => {
    expect(
      cliStateFrom(
        {
          code: 5,
          stdout: '',
          stderr:
            'kacola: a different kacola is already installed at /h/.local/bin/kacola; pass --force to replace it\n',
        },
        true,
      ),
    ).toEqual({
      state: 'foreign',
      path: '/h/.local/bin/kacola',
      detail: 'a different kacola is already installed at /h/.local/bin/kacola; pass --force to replace it',
    })
  })
  it('anything else is an error with the CLI’s message', () => {
    expect(cliStateFrom({ code: 1, stdout: '', stderr: 'kacola: boom\n' }, false)).toEqual({
      state: 'error',
      detail: 'boom',
    })
    expect(cliStateFrom({ code: 0, stdout: 'not json', stderr: '' }, false).state).toBe('error')
  })
})

describe('Integration', () => {
  it('runs install-cli with --json (and --dry-run to look, --force only when asked)', async () => {
    const seen: string[][] = []
    const i = new Integration(async (args) => {
      seen.push(args)
      return { code: 0, stdout: report({ shim: { path: '/p', action: 'unchanged' } }), stderr: '' }
    })
    expect((await i.cliStatus()).state).toBe('installed')
    await i.installCli(false)
    await i.installCli(true)
    await i.uninstallCli()
    expect(seen).toEqual([
      ['install-cli', '--json', '--dry-run'],
      ['install-cli', '--json'],
      ['install-cli', '--json', '--force'],
      ['uninstall-cli', '--json'],
      ['install-cli', '--json', '--dry-run'],
    ])
  })
  it('without a CLI entry everything is unavailable; without an extension copy so is its install', async () => {
    const i = new Integration(null)
    expect((await i.cliStatus()).state).toBe('unavailable')
    expect((await i.installCli(false)).state).toBe('unavailable')
    expect((await i.installExtension()).state).toBe('unavailable')
  })

  it('packaged Linux: every install-cli run passes --launch, so the shim starts this binary', async () => {
    const seen: string[][] = []
    const i = new Integration(
      async (args) => {
        seen.push(args)
        return { code: 0, stdout: report(), stderr: '' }
      },
      { platform: 'linux', launch: "'/opt/kacola/kacola' --background" },
    )
    await i.cliStatus()
    await i.installCli(false)
    expect(seen).toEqual([
      ['install-cli', '--json', '--launch', "'/opt/kacola/kacola' --background", '--dry-run'],
      ['install-cli', '--json', '--launch', "'/opt/kacola/kacola' --background"],
    ])
  })

  it('macOS: /usr/local/bin needs an admin → one osascript prompt, then the ~/.local/bin fallback goes', async () => {
    const seen: string[][] = []
    const execs: string[][] = []
    let adminDone = false
    const i = new Integration(
      async (args) => {
        seen.push(args)
        if (args[0] === 'install-cli' && args.includes('--dry-run'))
          return {
            code: 0,
            stdout: report({
              shim: { path: '/usr/local/bin/kacola', action: adminDone ? 'unchanged' : 'installed' },
            }),
            stderr: '',
          }
        if (args[0] === 'install-cli')
          return { code: 0, stdout: report({ needsAdmin: '/usr/local/bin' }), stderr: '' }
        return {
          code: 0,
          stdout: JSON.stringify({ removed: [], keptForeign: [], needsAdmin: [] }),
          stderr: '',
        }
      },
      {
        platform: 'darwin',
        exec: async (argv) => {
          execs.push(argv)
          adminDone = true
          return { code: 0, stdout: '', stderr: '' }
        },
      },
    )
    const st = await i.installCli(false)
    expect(execs).toEqual([adminInstallCommand('/h/.local/bin/kacola', '/usr/local/bin')])
    expect(seen[1]).toEqual(['uninstall-cli', '--json', '--keep-skill', '--bin-dir', '/h/.local/bin'])
    expect(st).toMatchObject({ state: 'installed', path: '/usr/local/bin/kacola' })
  })

  it('macOS: declining the admin prompt keeps the fallback and says admin rights were needed', async () => {
    const i = new Integration(
      async () => ({ code: 0, stdout: report({ needsAdmin: '/usr/local/bin' }), stderr: '' }),
      {
        platform: 'darwin',
        exec: async () => ({ code: 1, stdout: '', stderr: 'execution error: User canceled. (-128)' }),
      },
    )
    expect(await i.installCli(false)).toMatchObject({
      state: 'installed',
      path: '/h/.local/bin/kacola',
      needsAdmin: '/usr/local/bin',
    })
  })

  it('macOS: uninstall removes an admin-installed shim with one prompt', async () => {
    const execs: string[][] = []
    const i = new Integration(
      async (args) =>
        args[0] === 'uninstall-cli'
          ? {
              code: 0,
              stdout: JSON.stringify({
                removed: [],
                keptForeign: [],
                needsAdmin: ['/usr/local/bin/kacola'],
              }),
              stderr: '',
            }
          : { code: 0, stdout: report(), stderr: '' },
      {
        platform: 'darwin',
        exec: async (argv) => {
          execs.push(argv)
          return { code: 0, stdout: '', stderr: '' }
        },
      },
    )
    await i.uninstallCli()
    expect(execs).toEqual([adminRemoveCommand(['/usr/local/bin/kacola'])])
  })

  it('never prompts for admin rights on Linux', async () => {
    const i = new Integration(
      async () => ({ code: 0, stdout: report({ needsAdmin: '/usr/local/bin' }), stderr: '' }),
      {
        platform: 'linux',
        exec: async () => {
          throw new Error('no osascript on Linux')
        },
      },
    )
    expect((await i.installCli(false)).state).toBe('installed')
  })
})

describe('the macOS admin prompt commands', () => {
  it('builds one osascript `do shell script … with administrator privileges`, quoted for sh and AppleScript', () => {
    expect(adminInstallCommand('/Users/a b/.local/bin/kacola', '/usr/local/bin')).toEqual([
      '/usr/bin/osascript',
      '-e',
      `do shell script "/bin/mkdir -p '/usr/local/bin' && /usr/bin/install -m 0755 '/Users/a b/.local/bin/kacola' '/usr/local/bin/kacola'" with administrator privileges`,
    ])
    // a quote in a path: sh-quoted, then AppleScript-escaped
    const [, , script] = adminInstallCommand(`/Users/o"brien's/kacola`, '/usr/local/bin')
    expect(script).toContain(`'/Users/o\\"brien'\\\\''s/kacola'`)
    expect(adminRemoveCommand(['/usr/local/bin/kacola'])[2]).toBe(
      `do shell script "/bin/rm -f '/usr/local/bin/kacola'" with administrator privileges`,
    )
  })
  it('sh and AppleScript quoting round-trip', () => {
    expect(shq("it's")).toBe(`'it'\\''s'`)
    expect(appleString('a"b\\c')).toBe('"a\\"b\\\\c"')
  })
})

describe('cliEntry', () => {
  it('prefers KACOLA_CLI_ENTRY, then the packaged runtime, then the checkout', () => {
    expect(cliEntry({ KACOLA_CLI_ENTRY: '/x/cli.mjs' }, { appDir: '/nowhere' })).toBe('/x/cli.mjs')
    const res = mkdtempSync(join(tmpdir(), 'kacola-res-'))
    mkdirSync(join(res, 'runtime'))
    writeFileSync(join(res, 'runtime', 'cli.mjs'), '')
    expect(cliEntry({}, { resourcesPath: res, appDir: '/nowhere' })).toBe(join(res, 'runtime', 'cli.mjs'))
    // this checkout: out/main → packages/cli/src/main.ts (or dist/runtime/cli.mjs when built)
    const fromRepo = cliEntry({}, { appDir: join(import.meta.dirname, '..', 'out', 'main') })
    expect(fromRepo).toMatch(/(packages\/cli\/src\/main\.ts|dist\/runtime\/cli\.mjs)$/)
  })
})
