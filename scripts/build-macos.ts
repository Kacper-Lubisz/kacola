#!/usr/bin/env node
// P-6: build gnomeola.app for macOS as unsigned zips (arm64 + x64) with electron-builder, from Linux.
//
//   node scripts/build-macos.ts [--app-dir DIR] [--out DIR] [--arch arm64,x64]
//
//   --app-dir DIR   the app's main process: a directory with package.json + its main (packages/desktop's
//                   build output once it lands). Default: packaging/placeholder, which runs the daemon.
//   --out DIR       default dist/macos: stage/ (the electron-builder project) and out/ (the zips)
//
// Per architecture, scripts/build-runtime.ts produces the runtime with that architecture's natives
// (better-sqlite3's darwin N-API prebuild, sherpa-onnx-darwin-<arch> from the registry); electron-builder
// (packaging/macos/electron-builder.yml) puts it at Contents/Resources/runtime. Signing and a dmg need a
// Mac: the zips are ad-hoc unsigned, so Gatekeeper asks users to right-click → Open the first time.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildRuntime, REPO, type Target } from './build-runtime.ts'

export type MacArch = 'arm64' | 'x64'
export type MacBuild = { zips: { arch: MacArch; path: string; bytes: number }[] }

export async function buildMacos(o: {
  outDir: string
  appDir?: string
  archs?: MacArch[]
}): Promise<MacBuild> {
  const out = resolve(o.outDir)
  const archs = o.archs ?? ['arm64', 'x64']
  const stage = join(out, 'stage')
  rmSync(stage, { recursive: true, force: true })
  rmSync(join(out, 'out'), { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })

  const app = o.appDir ?? join(REPO, 'packaging', 'placeholder')
  for (const f of readdirSync(app)) cpSync(join(app, f), join(stage, f), { recursive: true })
  for (const arch of archs)
    await buildRuntime({ outDir: join(stage, `runtime-${arch}`), targets: [`darwin-${arch}` as Target] })
  mkdirSync(join(stage, 'bin'))
  cpSync(join(REPO, 'packaging', 'macos', 'gnomeola-cli.sh'), join(stage, 'bin', 'gnomeola'))
  cpSync(join(REPO, 'THIRD_PARTY_NOTICES.md'), join(stage, 'THIRD_PARTY_NOTICES.md'))
  cpSync(join(REPO, 'packaging', 'icons', 'org.gnome.Gnomeola-1024.png'), join(stage, 'icon.png'))
  // Chromium's licences ship with every Electron build; the Linux dist has the same file
  cpSync(
    join(REPO, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html'),
    join(stage, 'LICENSES.chromium.html'),
  )

  const config = join(REPO, 'packaging', 'macos', 'electron-builder.yml')
  const electron = (
    JSON.parse(readFileSync(join(REPO, 'node_modules', 'electron', 'package.json'), 'utf8')) as {
      version: string
    }
  ).version
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
        const dest = join(ctx.appOutDir, 'gnomeola.app', 'Contents', 'Resources', 'runtime', 'node_modules')
        cpSync(join(stage, `runtime-${arch}`, 'node_modules'), dest, { recursive: true, dereference: true })
      },
    },
    publish: 'never',
    targets: Platform.MAC.createTarget('dir', ...archs.map((a) => Arch[a])),
  })
  // Zip each .app keeping symlinks (-y): the Electron framework's Versions/Current links must survive
  const outDir = join(out, 'out')
  const version = (JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8')) as { version: string })
    .version
  const zips = archs.map((arch) => {
    const appParent = join(outDir, arch === 'x64' ? 'mac' : `mac-${arch}`)
    if (!existsSync(join(appParent, 'gnomeola.app'))) throw new Error(`no ${arch} app in ${appParent}`)
    const path = join(outDir, `gnomeola-${version}-mac-${arch}.zip`)
    execFileSync('zip', ['-qry', path, 'gnomeola.app'], { cwd: appParent })
    return { arch, path, bytes: statSync(path).size }
  })
  return { zips }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { 'app-dir': { type: 'string' }, out: { type: 'string' }, arch: { type: 'string' } },
  })
  const r = await buildMacos({
    outDir: values.out ?? join(REPO, 'dist', 'macos'),
    appDir: values['app-dir'],
    archs: values.arch ? (values.arch.split(',') as MacArch[]) : undefined,
  })
  for (const z of r.zips) console.log(`${z.arch}: ${z.path} (${(z.bytes / 1024 / 1024).toFixed(1)} MiB)`)
}
