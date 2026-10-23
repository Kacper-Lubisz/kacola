#!/usr/bin/env node
// The macOS calendar helper (packages/daemon/macos/cal-agent.swift → kacola-cal-agent), compiled with
// swiftc for each macOS architecture asked for and joined into one binary with lipo.
//
//   node scripts/build-cal-agent.ts [--out FILE] [--arch arm64,x64]
//
// Default: the host architecture, at packages/daemon/macos/kacola-cal-agent, where the daemon finds it in
// dev (EVENTKIT_AGENT_PATH). Needs a Mac (swiftc + the macOS SDK): elsewhere it builds nothing, and a
// runtime built there has no macOS calendar (the provider reports it as unavailable).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

export type MacArch = 'arm64' | 'x64'
// not build-runtime's REPO: build-runtime imports this file
const REPO = resolve(import.meta.dirname, '..')
export const CAL_AGENT_SOURCE = join(REPO, 'packages', 'daemon', 'macos', 'cal-agent.swift')
export const CAL_AGENT_DEV_PATH = join(REPO, 'packages', 'daemon', 'macos', 'kacola-cal-agent')
/** Info.plist's LSMinimumSystemVersion (packaging/macos/electron-builder.yml). */
const MIN_MACOS = '12.0'

/** Builds the helper at `out`; false (and nothing written) where there is no Swift toolchain. */
export function buildCalAgent(out: string, archs: readonly MacArch[]): boolean {
  if (process.platform !== 'darwin') return false
  const tmp = mkdtempSync(join(tmpdir(), 'kacola-cal-agent-'))
  try {
    const slices = archs.map((arch) => {
      const slice = join(tmp, arch)
      const triple = `${arch === 'x64' ? 'x86_64' : 'arm64'}-apple-macos${MIN_MACOS}`
      execFileSync('xcrun', ['swiftc', '-O', '-target', triple, '-o', slice, CAL_AGENT_SOURCE], {
        stdio: 'inherit',
      })
      return slice
    })
    mkdirSync(dirname(out), { recursive: true })
    execFileSync('lipo', ['-create', '-output', out, ...slices])
    return true
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, arch: { type: 'string' } } })
  const archs = (values.arch?.split(',') ?? [process.arch === 'x64' ? 'x64' : 'arm64']) as MacArch[]
  const out = values.out ?? CAL_AGENT_DEV_PATH
  if (!buildCalAgent(out, archs)) {
    console.error('kacola-cal-agent needs macOS (swiftc and the macOS SDK)')
    process.exit(1)
  }
  console.log(out)
}
