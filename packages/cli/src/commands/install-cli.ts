import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { Ctx } from '../context.ts'
import { CliError, EXIT, usage } from '../errors.ts'
import {
  InstallError,
  type InstallMode,
  installCli,
  type ShimSpec,
  shimSpec,
  uninstallCli,
} from '../install.ts'
import { renderJson } from '../output.ts'
import { skillSource } from './skill.ts'

// `gnomeola install-cli` / `uninstall-cli` (P-4): the command side of ../install.ts. Run from inside the
// installed app — the Flatpak (`flatpak run --command=gnomeola org.gnome.Gnomeola install-cli`), the macOS
// .app's runtime, or a dev checkout — it works out which kind of install it is from where it runs.

export type InstallCliFlags = {
  mode?: string
  binDir?: string
  app?: string
  launch?: string
  noSkill?: boolean
  skillDir?: string
  force?: boolean
  dryRun?: boolean
}

const home = (ctx: Ctx) => ctx.io.env.HOME || homedir()

function resolveMode(ctx: Ctx, flag: string | undefined): InstallMode {
  const m = flag ?? 'auto'
  if (m === 'flatpak' || m === 'macos' || m === 'dev') return m
  if (m !== 'auto') throw usage(`--mode must be auto, flatpak, macos or dev (got ${m})`)
  if (ctx.io.env.FLATPAK_ID) return 'flatpak'
  if (process.platform === 'darwin') return 'macos'
  return 'dev'
}

/** …/gnomeola.app/Contents/MacOS/gnomeola → …/gnomeola.app, when this runs from inside an app bundle. */
export function appBundleOf(execPath: string): string | null {
  const m = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath)
  return m ? m[1]! : null
}

function specFor(mode: InstallMode, f: InstallCliFlags): ShimSpec {
  const launch = f.launch !== undefined ? f.launch : undefined
  if (mode === 'flatpak') return shimSpec('flatpak', { launch })
  if (mode === 'macos') {
    const appPath = f.app ?? appBundleOf(process.execPath)
    if (!appPath)
      throw usage('not running from a gnomeola.app bundle', 'pass --app /Applications/gnomeola.app')
    return shimSpec('macos', { appPath: resolve(appPath), launch })
  }
  const entry = process.argv[1] ? realpathSync(process.argv[1]) : null
  if (!entry) throw new CliError(EXIT.ERROR, 'cannot tell which CLI entry is running')
  return shimSpec('dev', {
    node: process.execPath,
    entry,
    asElectron: Boolean(process.versions.electron),
    launch: launch ?? null,
  })
}

export function installCliCommand(ctx: Ctx, f: InstallCliFlags): void {
  const mode = resolveMode(ctx, f.mode)
  const spec = specFor(mode, f)
  let report: ReturnType<typeof installCli>
  try {
    report = installCli({
      spec,
      home: home(ctx),
      path: ctx.io.env.PATH ?? '',
      binDir: f.binDir,
      force: f.force,
      skill: f.noSkill ? null : { source: skillSource(), root: f.skillDir },
      dryRun: f.dryRun,
    })
  } catch (err) {
    if (err instanceof InstallError) throw new CliError(EXIT.REFUSED, err.message)
    throw err
  }
  if (ctx.format === 'json') {
    ctx.io.stdout(renderJson(report, ctx.io))
    return
  }
  ctx.io.stdout(`${report.shim.action}: ${report.shim.path} (${mode})\n`)
  if (report.skill) ctx.io.stdout(`skill ${report.skill.action}: ${report.skill.path}\n`)
  for (const w of report.warnings) ctx.io.stdout(`note: ${w}\n`)
}

export function uninstallCliCommand(ctx: Ctx, f: InstallCliFlags & { keepSkill?: boolean }): void {
  const mode = resolveMode(ctx, f.mode)
  const r = uninstallCli({
    mode,
    home: home(ctx),
    binDir: f.binDir,
    skillRoot: f.skillDir,
    keepSkill: f.keepSkill,
  })
  if (ctx.format === 'json') {
    ctx.io.stdout(renderJson({ mode, ...r }, ctx.io))
    return
  }
  for (const p of r.removed) ctx.io.stdout(`removed: ${p}\n`)
  for (const p of r.keptForeign) ctx.io.stdout(`left alone (not ours): ${p}\n`)
  for (const p of r.needsAdmin) ctx.io.stdout(`needs administrator rights to remove: ${p}\n`)
  if (r.skill) ctx.io.stdout(`skill ${r.skill.action}: ${r.skill.path}\n`)
  if (!r.removed.length) ctx.io.stdout('no gnomeola command written by install-cli was found\n')
}
