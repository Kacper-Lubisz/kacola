#!/usr/bin/env node
// P-7: package the real desktop app (packages/desktop) for Linux: electron-builder's unpacked `dir`
// target, executable `gnomeola`, with the runtime (scripts/build-runtime.ts) at resources/runtime. The
// Flatpak is built from this (scripts/build-flatpak.ts), and the macOS zips from the same staged app
// (scripts/build-macos.ts).
//
//   node scripts/build-desktop.ts [--out DIR] [--skip-vite]
//
//   --out DIR     default dist/desktop: stage/ (the electron-builder project) and linux-unpacked/
//   --skip-vite   reuse packages/desktop/out (already built by `pnpm --filter @gnomeola/desktop build`)
//
// The staged project is only package.json + out/ (main, preload, renderer: electron-vite bundles them
// completely, so the asar carries no node_modules). extraResources: runtime/ (daemon.mjs, cli.mjs and
// their natives), icon.png (the window icon), THIRD_PARTY_NOTICES.md, extension/ (the GNOME Shell
// top-bar extension, schema compiled, for Preferences' "Install" — Linux) and tray*.png (the macOS
// menu-bar icon). Fuses come from
// packages/desktop/fuses.config.ts, flipped in afterPack (RunAsNode on: the same binary runs the daemon
// and the CLI).
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { applyFuses } from '../packages/desktop/fuses.config.ts'
import { buildRuntime, REPO } from './build-runtime.ts'

export const APP_ID = 'org.gnome.Gnomeola'
export const DESKTOP = join(REPO, 'packages', 'desktop')
export const BRAND_ICONS = join(REPO, 'brand', 'icons')
export const EXTENSION_UUID = 'gnomeola@gnomeola.org'

export function electronVersion(): string {
  return (
    JSON.parse(readFileSync(join(REPO, 'node_modules', 'electron', 'package.json'), 'utf8')) as {
      version: string
    }
  ).version
}

/** electron-vite build of packages/desktop (main, preload, renderer → packages/desktop/out). */
export function viteBuild(): void {
  execFileSync('pnpm', ['run', 'build'], {
    cwd: DESKTOP,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  })
}

/**
 * Stage the app as an electron-builder project: a package.json with no dependencies (everything is
 * bundled) and packages/desktop/out. Returns the app's version.
 */
export function stageDesktopApp(stage: string, o: { skipVite?: boolean } = {}): string {
  if (!o.skipVite) viteBuild()
  const out = join(DESKTOP, 'out')
  for (const f of ['main/index.js', 'preload/index.cjs', 'renderer/index.html'])
    if (!existsSync(join(out, f)))
      throw new Error(`packages/desktop/out/${f} is missing (build the desktop app)`)
  const pkg = JSON.parse(readFileSync(join(DESKTOP, 'package.json'), 'utf8')) as Record<string, string>
  mkdirSync(stage, { recursive: true })
  writeFileSync(
    join(stage, 'package.json'),
    `${JSON.stringify(
      {
        name: 'gnomeola',
        productName: 'gnomeola',
        version: pkg.version,
        description: 'Record, transcribe and search your meetings',
        license: pkg.license,
        author: 'The gnomeola contributors',
        homepage: 'https://github.com/kacperlubisz/gnomeola',
        type: 'module',
        main: 'out/main/index.js',
        desktopName: pkg.desktopName,
      },
      null,
      2,
    )}\n`,
  )
  rmSync(join(stage, 'out'), { recursive: true, force: true })
  cpSync(out, join(stage, 'out'), { recursive: true })
  cpSync(join(REPO, 'THIRD_PARTY_NOTICES.md'), join(stage, 'THIRD_PARTY_NOTICES.md'))
  cpSync(join(BRAND_ICONS, 'png', '512.png'), join(stage, 'icon.png'))
  cpSync(join(BRAND_ICONS, 'png', '16.png'), join(stage, 'tray.png'))
  cpSync(join(BRAND_ICONS, 'png', '32.png'), join(stage, 'tray@2x.png'))
  // the top-bar extension as the app installs it: its GSettings schema compiled (the Shell needs
  // gschemas.compiled for an extension copied into place by hand)
  const ext = join(stage, 'extension', EXTENSION_UUID)
  rmSync(join(stage, 'extension'), { recursive: true, force: true })
  cpSync(join(REPO, 'extensions', EXTENSION_UUID), ext, { recursive: true })
  execFileSync('glib-compile-schemas', ['--strict', join(ext, 'schemas')])
  return pkg.version!
}

const du = (p: string): number => {
  const s = lstatSync(p)
  if (!s.isDirectory()) return s.size
  return readdirSync(p).reduce((n, f) => n + du(join(p, f)), 0)
}

export type LinuxAppBuild = { appDir: string; bytes: number; version: string }

/** The unpacked Linux app: <out>/linux-unpacked/gnomeola + resources/{app.asar,runtime,icon.png,…}. */
export async function buildLinuxApp(o: { outDir: string; skipVite?: boolean }): Promise<LinuxAppBuild> {
  const out = resolve(o.outDir)
  const stage = join(out, 'stage')
  rmSync(stage, { recursive: true, force: true })
  rmSync(join(out, 'linux-unpacked'), { recursive: true, force: true })
  const version = stageDesktopApp(stage, o)
  await buildRuntime({ outDir: join(stage, 'runtime'), targets: ['linux-x64'] })
  // electron-builder wants NxN.png for a Linux icon set
  mkdirSync(join(stage, 'icons'))
  for (const f of readdirSync(join(BRAND_ICONS, 'png'))) {
    const n = f.replace(/\.png$/, '')
    cpSync(join(BRAND_ICONS, 'png', f), join(stage, 'icons', `${n}x${n}.png`))
  }

  const { build, Platform, Arch } = await import('electron-builder')
  await build({
    projectDir: stage,
    publish: 'never',
    targets: Platform.LINUX.createTarget('dir', Arch.x64),
    config: {
      appId: APP_ID,
      productName: 'gnomeola',
      executableName: 'gnomeola',
      copyright: 'Copyright © 2026 The gnomeola contributors',
      electronVersion: electronVersion(),
      // the installed Electron (no download): its dist is exactly what the dev and test builds run
      electronDist: join(REPO, 'node_modules', 'electron', 'dist'),
      npmRebuild: false,
      asar: true,
      directories: { output: out },
      files: ['package.json', 'out/**/*'],
      extraResources: [
        { from: 'runtime', to: 'runtime' },
        { from: 'icon.png', to: 'icon.png' },
        { from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' },
        { from: 'extension', to: 'extension' },
      ],
      // kacola:// deep links: MimeType=x-scheme-handler/kacola in any desktop entry electron-builder
      // writes (the `dir` target writes none; the Flatpak ships packaging/flatpak's, which declares it)
      protocols: [{ name: 'kacola', schemes: ['kacola'] }],
      linux: {
        target: [{ target: 'dir', arch: ['x64'] }],
        executableName: 'gnomeola',
        icon: 'icons',
        category: 'Office',
        desktop: { entry: { StartupWMClass: 'gnomeola' } },
      },
      afterPack: async (ctx) => {
        // electron-builder never copies node_modules as extraResources: the runtime's natives, by hand
        cpSync(
          join(stage, 'runtime', 'node_modules'),
          join(ctx.appOutDir, 'resources', 'runtime', 'node_modules'),
          { recursive: true, dereference: true },
        )
        // the stock Electron's fallback app, never loaded by a packaged app
        rmSync(join(ctx.appOutDir, 'resources', 'default_app.asar'), { force: true })
        await applyFuses(join(ctx.appOutDir, 'gnomeola'))
      },
    },
  })
  const appDir = join(out, 'linux-unpacked')
  if (!existsSync(join(appDir, 'gnomeola'))) throw new Error(`no gnomeola executable in ${appDir}`)
  return { appDir, bytes: du(appDir), version }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, 'skip-vite': { type: 'boolean' } } })
  const r = await buildLinuxApp({
    outDir: values.out ?? join(REPO, 'dist', 'desktop'),
    skipVite: values['skip-vite'],
  })
  console.log(`linux app ${r.version} → ${r.appDir} (${(r.bytes / 1024 / 1024).toFixed(1)} MiB)`)
}
