import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliEntry, cliStateFrom, Integration } from '../src/main/integration.ts'

// Main's desktop-integration logic: which CLI to run, and install-cli's --json report / exit code →
// the state Preferences shows. (The real install-cli run is in the desktop-dialogs e2e.)

const report = (over: object = {}) =>
  JSON.stringify({
    mode: 'dev',
    shim: { path: '/h/.local/bin/gnomeola', action: 'installed' },
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
        { code: 0, stdout: report({ shim: { path: '/h/.local/bin/gnomeola', action } }), stderr: '' },
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
          stdout: report({ onPath: false, shadowedBy: '/usr/bin/gnomeola', needsAdmin: '/usr/local/bin' }),
          stderr: '',
        },
        false,
      ),
    ).toEqual({
      state: 'installed',
      path: '/h/.local/bin/gnomeola',
      skillPath: '/h/.claude/skills/meeting-context/SKILL.md',
      onPath: false,
      shadowedBy: '/usr/bin/gnomeola',
      needsAdmin: '/usr/local/bin',
    })
  })
  it('exit 5 (refused) is a foreign gnomeola, with its path', () => {
    expect(
      cliStateFrom(
        {
          code: 5,
          stdout: '',
          stderr:
            'gnomeola: a different gnomeola is already installed at /h/.local/bin/gnomeola; pass --force to replace it\n',
        },
        true,
      ),
    ).toEqual({
      state: 'foreign',
      path: '/h/.local/bin/gnomeola',
      detail:
        'a different gnomeola is already installed at /h/.local/bin/gnomeola; pass --force to replace it',
    })
  })
  it('anything else is an error with the CLI’s message', () => {
    expect(cliStateFrom({ code: 1, stdout: '', stderr: 'gnomeola: boom\n' }, false)).toEqual({
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
  it('without a CLI entry everything is unavailable; the extension is a stub', async () => {
    const i = new Integration(null)
    expect((await i.cliStatus()).state).toBe('unavailable')
    expect((await i.installCli(false)).state).toBe('unavailable')
    expect((await i.installExtension()).state).toBe('unavailable')
  })
})

describe('cliEntry', () => {
  it('prefers GNOMEOLA_CLI_ENTRY, then the packaged runtime, then the checkout', () => {
    expect(cliEntry({ GNOMEOLA_CLI_ENTRY: '/x/cli.mjs' }, { appDir: '/nowhere' })).toBe('/x/cli.mjs')
    const res = mkdtempSync(join(tmpdir(), 'gnomeola-res-'))
    mkdirSync(join(res, 'runtime'))
    writeFileSync(join(res, 'runtime', 'cli.mjs'), '')
    expect(cliEntry({}, { resourcesPath: res, appDir: '/nowhere' })).toBe(join(res, 'runtime', 'cli.mjs'))
    // this checkout: out/main → packages/cli/src/main.ts (or dist/runtime/cli.mjs when built)
    const fromRepo = cliEntry({}, { appDir: join(import.meta.dirname, '..', 'out', 'main') })
    expect(fromRepo).toMatch(/(packages\/cli\/src\/main\.ts|dist\/runtime\/cli\.mjs)$/)
  })
})
