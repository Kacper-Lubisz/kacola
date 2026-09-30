#!/usr/bin/env node
// P-5: build the org.gnome.Gnomeola Flatpak (packaging/flatpak/org.gnome.Gnomeola.yml).
//
//   node scripts/build-flatpak.ts [--app-dir DIR] [--out DIR] [--no-bundle]
//
//   --app-dir DIR   the unpacked Electron app (electron-builder `linux-unpacked` of packages/desktop, its
//                   executable named `gnomeola`: scripts/build-desktop.ts). Default: build it now
//                   (dist/desktop/linux-unpacked).
//   --out DIR       default dist/flatpak: repo/ (an OSTree repo), build/, and gnomeola.flatpak (a single-file
//                   bundle that pulls the runtime and BaseApp from Flathub when installed)
//
// Needs flatpak-builder as the org.flatpak.Builder Flatpak, org.freedesktop.Sdk//25.08 and
// org.electronjs.Electron2.BaseApp//25.08 (user installation is fine):
//   flatpak install --user -y flathub org.flatpak.Builder org.freedesktop.Platform//25.08 \
//     org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08
import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { BRAND_ICONS, buildLinuxApp } from './build-desktop.ts'
import { buildRuntime, REPO } from './build-runtime.ts'

export const APP_ID = 'org.gnome.Gnomeola'
const PKG = join(REPO, 'packaging')
const FLATPAK = join(PKG, 'flatpak')

/**
 * Lay out the unpacked Electron app with the runtime inside: `app/gnomeola` (the Electron binary),
 * `app/resources/app.asar` (packages/desktop) and `app/resources/runtime` (replaced by `runtimeDir`, so
 * the Flatpak always carries the linux-x64 runtime it was built with).
 */
export function assembleLinuxApp(dest: string, runtimeDir: string, appDir: string): void {
  rmSync(dest, { recursive: true, force: true })
  cpSync(appDir, dest, { recursive: true, dereference: true })
  if (!existsSync(join(dest, 'gnomeola')))
    throw new Error(
      `${appDir} has no 'gnomeola' executable (set executableName: gnomeola in electron-builder)`,
    )
  if (!existsSync(join(dest, 'resources', 'app.asar')))
    throw new Error(`${appDir} has no resources/app.asar: not an electron-builder build of packages/desktop`)
  const runtime = join(dest, 'resources', 'runtime')
  rmSync(runtime, { recursive: true, force: true })
  cpSync(runtimeDir, runtime, { recursive: true })
  cpSync(join(REPO, 'THIRD_PARTY_NOTICES.md'), join(dest, 'resources', 'THIRD_PARTY_NOTICES.md'))
  chmodSync(join(dest, 'gnomeola'), 0o755)
}

export type FlatpakBuild = {
  repo: string
  bundle: string | null
  bundleBytes: number | null
  appBytes: number
}

const du = (p: string): number => {
  const s = lstatSync(p)
  if (!s.isDirectory()) return s.size
  return readdirSync(p).reduce((n, f) => n + du(join(p, f)), 0)
}

export async function buildFlatpak(o: {
  outDir: string
  appDir?: string
  bundle?: boolean
}): Promise<FlatpakBuild> {
  const out = resolve(o.outDir)
  mkdirSync(out, { recursive: true })
  const runtime = await buildRuntime({ outDir: join(out, 'runtime'), targets: ['linux-x64'] })

  const input = join(FLATPAK, 'input')
  rmSync(input, { recursive: true, force: true })
  mkdirSync(join(input, 'share'), { recursive: true })
  const appDir = o.appDir ?? (await buildLinuxApp({ outDir: join(REPO, 'dist', 'desktop') })).appDir
  assembleLinuxApp(join(input, 'app'), runtime.outDir, appDir)
  cpSync(join(FLATPAK, 'bin'), join(input, 'bin'), { recursive: true })
  for (const f of [`${APP_ID}.desktop`, `${APP_ID}.metainfo.xml`, 'selftest.mjs'])
    cpSync(join(FLATPAK, f), join(input, 'share', f))
  // the kacola brand icons, renamed to the app id: share/icons/hicolor/<size>/apps/org.gnome.Gnomeola.*
  for (const size of readdirSync(join(BRAND_ICONS, 'hicolor')))
    for (const f of readdirSync(join(BRAND_ICONS, 'hicolor', size, 'apps'))) {
      const dest = join(input, 'share', 'icons', 'hicolor', size, 'apps', f.replace(/^app/, APP_ID))
      mkdirSync(join(dest, '..'), { recursive: true })
      cpSync(join(BRAND_ICONS, 'hicolor', size, 'apps', f), dest)
    }

  const repo = join(out, 'repo')
  execFileSync(
    'flatpak',
    [
      'run',
      '--user',
      'org.flatpak.Builder',
      '--user',
      '--force-clean',
      '--disable-updates',
      `--state-dir=${join(out, 'state')}`,
      `--repo=${repo}`,
      join(out, 'build'),
      join(FLATPAK, `${APP_ID}.yml`),
    ],
    { stdio: 'inherit' },
  )
  let bundle: string | null = null
  if (o.bundle !== false) {
    bundle = join(out, 'gnomeola.flatpak')
    execFileSync(
      'flatpak',
      [
        'build-bundle',
        '--runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo',
        repo,
        bundle,
        APP_ID,
      ],
      { stdio: 'inherit' },
    )
  }
  return {
    repo,
    bundle,
    bundleBytes: bundle ? statSync(bundle).size : null,
    // lib/debug ships separately as the .Debug extension
    appBytes: du(join(out, 'build', 'files')) - du(join(out, 'build', 'files', 'lib', 'debug')),
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { 'app-dir': { type: 'string' }, out: { type: 'string' }, 'no-bundle': { type: 'boolean' } },
  })
  const r = await buildFlatpak({
    outDir: values.out ?? join(REPO, 'dist', 'flatpak'),
    appDir: values['app-dir'],
    bundle: !values['no-bundle'],
  })
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MiB`
  console.log(
    `flatpak repo → ${r.repo}; /app ${mb(r.appBytes)}${r.bundle ? `; bundle ${r.bundle} (${mb(r.bundleBytes!)})` : ''}`,
  )
}
