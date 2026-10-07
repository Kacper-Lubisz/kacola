#!/usr/bin/env node
// P-6: build kacola.app for macOS as unsigned zips (arm64 + x64) with electron-builder, from Linux.
//
//   node scripts/build-macos.ts [--out DIR] [--arch arm64,x64] [--skip-vite]
//
//   --out DIR       default dist/macos: stage/ (the electron-builder project) and out/ (the zips)
//   --skip-vite     reuse packages/desktop/out instead of building the desktop app first
//
// The app is packages/desktop, staged exactly as for Linux (scripts/build-desktop.ts: package.json +
// out/, no node_modules). Fuses: packages/desktop/fuses.config.ts, flipped in afterPack.
//
// Per architecture, scripts/build-runtime.ts produces the runtime with that architecture's natives
// (better-sqlite3's darwin N-API prebuild, sherpa-onnx-darwin-<arch> from the registry); electron-builder
// (packaging/macos/electron-builder.yml) puts it at Contents/Resources/runtime. Signing and a dmg need a
// Mac: the zips are ad-hoc unsigned, so Gatekeeper asks users to right-click → Open the first time.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { applyFuses } from '../packages/desktop/fuses.config.ts'
import { BRAND_ICONS, electronVersion, stageDesktopApp } from './build-desktop.ts'
import { buildRuntime, REPO, type Target } from './build-runtime.ts'

export type MacArch = 'arm64' | 'x64'
export type MacBuild = { zips: { arch: MacArch; path: string; bytes: number }[] }

export async function buildMacos(o: {
  outDir: string
  archs?: MacArch[]
  skipVite?: boolean
}): Promise<MacBuild> {
  const out = resolve(o.outDir)
  const archs = o.archs ?? ['arm64', 'x64']
  const stage = join(out, 'stage')
  rmSync(stage, { recursive: true, force: true })
  rmSync(join(out, 'out'), { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })

  const version = stageDesktopApp(stage, { skipVite: o.skipVite })
  for (const arch of archs)
    await buildRuntime({ outDir: join(stage, `runtime-${arch}`), targets: [`darwin-${arch}` as Target] })
  mkdirSync(join(stage, 'bin'))
  cpSync(join(REPO, 'packaging', 'macos', 'kacola-cli.sh'), join(stage, 'bin', 'kacola'))
  // the kacola brand icon (the window icon, resources/icon.png, is only used on Linux)
  cpSync(join(BRAND_ICONS, 'kacola.icns'), join(stage, 'icon.icns'))
  // Chromium's licences ship with every Electron build; the Linux dist has the same file
  cpSync(
    join(REPO, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html'),
    join(stage, 'LICENSES.chromium.html'),
  )

  const config = join(REPO, 'packaging', 'macos', 'electron-builder.yml')
  const electron = electronVersion()
  if (!readFileSync(config, 'utf8').includes(`electronVersion: ${electron}`))
    throw new Error(
      `packaging/macos/electron-builder.yml must pin electronVersion: ${electron} (the installed Electron)`,
    )

  const { build, Platform, Arch } = await import('electron-builder')
  await build({
    projectDir: stage,
    config: {
      extends: config,
      // electron-builder never copies node_modules as extraResources: put the runtime's natives in by hand,
      // before fuses and signing see the bundle
      afterPack: async (ctx) => {
        const arch = Arch[ctx.arch] as MacArch
        const dest = join(ctx.appOutDir, 'kacola.app', 'Contents', 'Resources', 'runtime', 'node_modules')
        cpSync(join(stage, `runtime-${arch}`, 'node_modules'), dest, { recursive: true, dereference: true })
        // no ad-hoc re-signing from Linux (codesign is macOS-only): see docs/desktop-app.md, "Packaging"
        await applyFuses(join(ctx.appOutDir, 'kacola.app'))
      },
    },
    publish: 'never',
    targets: Platform.MAC.createTarget('dir', ...archs.map((a) => Arch[a])),
  })
  // Zip each .app keeping symlinks (-y): the Electron framework's Versions/Current links must survive
  const outDir = join(out, 'out')
  const zips = archs.map((arch) => {
    const appParent = join(outDir, arch === 'x64' ? 'mac' : `mac-${arch}`)
    if (!existsSync(join(appParent, 'kacola.app'))) throw new Error(`no ${arch} app in ${appParent}`)
    const path = join(outDir, `kacola-${version}-mac-${arch}.zip`)
    execFileSync('zip', ['-qry', path, 'kacola.app'], { cwd: appParent })
    return { arch, path, bytes: statSync(path).size }
  })
  return { zips }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, arch: { type: 'string' }, 'skip-vite': { type: 'boolean' } },
  })
  const r = await buildMacos({
    outDir: values.out ?? join(REPO, 'dist', 'macos'),
    skipVite: values['skip-vite'],
    archs: values.arch ? (values.arch.split(',') as MacArch[]) : undefined,
  })
  for (const z of r.zips) console.log(`${z.arch}: ${z.path} (${(z.bytes / 1024 / 1024).toFixed(1)} MiB)`)
}
