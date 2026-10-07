import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildMacos, type MacArch } from '../../../scripts/build-macos.ts'
import { electronBinary, REPO, testRuntime } from '../src/runtime.ts'

// P-6/P-7: the macOS zips of the real desktop app, inspected from Linux (nothing here can run a Mach-O). For each architecture:
// every native binary in the bundle is a Mach-O for that architecture (no Linux ELF slipped in), the
// Info.plist carries the privacy usage strings, the fuses are what the security baseline says, the
// runtime and the in-app CLI shim are there, and the framework symlinks survived zipping. The in-app
// shim and an install-cli macOS shim are then executed against a copy of the layout with this machine's
// Electron and natives swapped in — the scripts are the same ones a Mac runs.
//
// KACOLA_MACOS_ZIPS=dir skips the build and inspects the zips in that directory.

const ARCHS: MacArch[] = ['arm64', 'x64']
const CPU = { arm64: 0x0100000c, x64: 0x01000007 } as const
/** @electron/fuses' FuseState (not exported from its entry point): the sentinel bytes '1' / '0'. */
const FuseState = { ENABLE: 49, DISABLE: 48 } as const
let zips: Record<MacArch, string>
const apps = {} as Record<MacArch, string>
const tmp = mkdtempSync(join(tmpdir(), 'kacola-macos-'))

function head(path: string, n = 8): Buffer {
  const fd = openSync(path, 'r')
  const b = Buffer.alloc(n)
  readSync(fd, b, 0, n, 0)
  closeSync(fd)
  return b
}
const kind = (path: string): 'macho64' | 'elf' | 'fat' | 'other' => {
  const b = head(path)
  if (b.readUInt32LE(0) === 0xfeedfacf) return 'macho64'
  if (b.readUInt32BE(0) === 0xcafebabe) return 'fat'
  if (b.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return 'elf'
  return 'other'
}
const cpuOf = (path: string) => head(path).readUInt32LE(4)

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isSymbolicLink()) return []
    return e.isDirectory() ? walk(p) : [p]
  })
}

/** Keys of an XML plist's top-level dict (electron-builder writes XML). */
function plist(path: string): Record<string, string> {
  const xml = readFileSync(path, 'utf8')
  const out: Record<string, string> = {}
  for (const m of xml.matchAll(/<key>([^<]+)<\/key>\s*<(string|true|false)\s*\/?>(?:([^<]*)<\/string>)?/g))
    out[m[1]!] = m[2] === 'string' ? m[3]! : m[2]!
  return out
}

type AsarEntry = { files?: Record<string, AsarEntry>; offset?: string; size?: number }
function asarHeader(b: Buffer): AsarEntry {
  return JSON.parse(b.subarray(16, 16 + b.readUInt32LE(12)).toString('utf8')) as AsarEntry
}

/** File names at the top of an asar archive. */
function asarFiles(path: string): string[] {
  return Object.keys(asarHeader(readFileSync(path)).files ?? {})
}

/** One file's bytes out of an asar archive (data starts after the header pickle). */
function asarRead(path: string, file: string): Buffer {
  const b = readFileSync(path)
  let e: AsarEntry | undefined = asarHeader(b)
  for (const part of file.split('/')) e = e?.files?.[part]
  if (e?.offset === undefined || e.size === undefined) throw new Error(`${file} is not in ${path}`)
  const base = 8 + b.readUInt32LE(4)
  return b.subarray(base + Number(e.offset), base + Number(e.offset) + e.size)
}

beforeAll(async () => {
  const dir = process.env.KACOLA_MACOS_ZIPS
  if (dir) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.zip'))
    zips = Object.fromEntries(
      ARCHS.map((a) => [a, join(dir, files.find((f) => f.endsWith(`-${a}.zip`))!)]),
    ) as Record<MacArch, string>
  } else {
    const r = await buildMacos({ outDir: join(REPO, 'dist', 'macos') })
    zips = Object.fromEntries(r.zips.map((z) => [z.arch, z.path])) as Record<MacArch, string>
    for (const z of r.zips) console.log(`[macos] ${z.arch}: ${(z.bytes / 1024 / 1024).toFixed(1)} MiB`)
  }
  for (const a of ARCHS) {
    const into = join(tmp, a)
    mkdirSync(into)
    execFileSync('unzip', ['-q', zips[a], '-d', into]) // Info-ZIP keeps the symlinks
    apps[a] = join(into, 'kacola.app')
  }
}, 1_200_000)

afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe.each(ARCHS)('kacola.app (%s)', (arch) => {
  const app = () => apps[arch]
  const res = () => join(app(), 'Contents', 'Resources')

  it('the main executable and every native binary are Mach-O for this architecture', () => {
    const exe = join(app(), 'Contents', 'MacOS', 'kacola')
    expect(kind(exe)).toBe('macho64')
    expect(cpuOf(exe)).toBe(CPU[arch])
    const natives = walk(res()).filter((p) => /\.(node|dylib)$/.test(p))
    const names = natives.map((p) => p.slice(res().length + 1)).sort()
    // onnxruntime-node (the on-device decisions embedder) ships only an arm64 macOS build; Intel Macs
    // fall back to the hashing embedder, so their bundle has no onnxruntime binaries at all
    const ort =
      arch === 'arm64'
        ? [
            'runtime/node_modules/onnxruntime-node/bin/napi-v6/darwin/arm64/libonnxruntime.1.30.0.dylib',
            'runtime/node_modules/onnxruntime-node/bin/napi-v6/darwin/arm64/libonnxruntime.1.dylib',
            'runtime/node_modules/onnxruntime-node/bin/napi-v6/darwin/arm64/onnxruntime_binding.node',
          ]
        : []
    expect(names).toEqual([
      `runtime/node_modules/better-sqlite3/prebuilds/darwin-${arch}.node`,
      ...ort,
      `runtime/node_modules/sherpa-onnx-darwin-${arch}/libonnxruntime.dylib`,
      `runtime/node_modules/sherpa-onnx-darwin-${arch}/libsherpa-onnx-c-api.dylib`,
      `runtime/node_modules/sherpa-onnx-darwin-${arch}/libsherpa-onnx-cxx-api.dylib`,
      `runtime/node_modules/sherpa-onnx-darwin-${arch}/sherpa-onnx.node`,
    ])
    for (const p of natives) {
      expect(kind(p), p).toBe('macho64')
      expect(cpuOf(p), p).toBe(CPU[arch])
    }
    // nothing built for Linux anywhere in the bundle
    expect(walk(app()).filter((p) => kind(p) === 'elf')).toEqual([])
  })

  it('Info.plist: identity and the privacy usage strings for microphone and system audio', () => {
    const p = plist(join(app(), 'Contents', 'Info.plist'))
    expect(p).toMatchObject({
      CFBundleIdentifier: 'com.kacperlubisz.Kacola',
      CFBundleExecutable: 'kacola',
      CFBundleName: 'kacola',
      CFBundleShortVersionString: '0.1.0',
      LSMinimumSystemVersion: '12.0',
    })
    expect(p.NSMicrophoneUsageDescription).toMatch(/microphone/)
    expect(p.NSAudioCaptureUsageDescription).toMatch(/audio output/)
    expect(p.NSScreenCaptureUsageDescription).toMatch(/audio output \(not the screen\)/)
    expect(p.CFBundleIconFile).toBe('icon.icns')
    // kacola:// deep links (electron-builder `protocols`)
    expect(readFileSync(join(app(), 'Contents', 'Info.plist'), 'utf8')).toMatch(
      /<key>CFBundleURLTypes<\/key>[\s\S]*?<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>kacola<\/string>/,
    )
    expect(existsSync(join(res(), 'icon.icns'))).toBe(true)
  })

  it('fuses: RunAsNode on (one runtime for window, daemon and CLI); code-injection paths off', async () => {
    const wire = await getCurrentFuseWire(app())
    expect(wire[FuseV1Options.RunAsNode]).toBe(FuseState.ENABLE)
    expect(wire[FuseV1Options.EnableNodeCliInspectArguments]).toBe(FuseState.DISABLE)
    expect(wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(FuseState.DISABLE)
    expect(wire[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.ENABLE)
    expect(wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(FuseState.ENABLE)
    expect(wire[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(FuseState.DISABLE)
    // integrity validation needs the asar's hash in the plist
    expect(readFileSync(join(app(), 'Contents', 'Info.plist'), 'utf8')).toContain('ElectronAsarIntegrity')
  })

  it('app.asar holds the desktop app (bundled: no node_modules); the runtime, CLI shim and licences sit beside it', () => {
    expect(asarFiles(join(res(), 'app.asar')).sort()).toEqual(['out', 'package.json'])
    const asar = join(res(), 'app.asar')
    for (const f of ['out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html'])
      expect(asarRead(asar, f).length, f).toBeGreaterThan(0)
    const pkg = JSON.parse(asarRead(asar, 'package.json').toString('utf8'))
    expect(pkg).toMatchObject({ name: 'kacola', main: 'out/main/index.js', type: 'module' })
    expect(pkg.dependencies).toBeUndefined()
    for (const f of [
      'daemon.mjs',
      'cli.mjs',
      'diarize-worker.mjs',
      'tiktoken_bg.wasm',
      'root/packages/daemon/gjs',
    ])
      expect(existsSync(join(res(), 'runtime', f)), f).toBe(true)
    const info = JSON.parse(readFileSync(join(res(), 'runtime', 'runtime.json'), 'utf8'))
    expect(info.targets).toEqual([`darwin-${arch}`])
    const shim = join(res(), 'bin', 'kacola')
    expect(lstatSync(shim).mode & 0o111).not.toBe(0) // executable after unzip
    expect(readFileSync(shim, 'utf8')).toContain(
      'ELECTRON_RUN_AS_NODE=1 exec "$resources/../MacOS/kacola" "$resources/runtime/cli.mjs"',
    )
    expect(existsSync(join(res(), 'LICENSES.chromium.html'))).toBe(true)
    // the menu-bar Tray icon (1x / 2x); no top-bar extension on macOS
    for (const f of ['tray.png', 'tray@2x.png']) expect(existsSync(join(res(), f)), f).toBe(true)
    expect(existsSync(join(res(), 'extension'))).toBe(false)
    expect(existsSync(join(res(), 'THIRD_PARTY_NOTICES.md'))).toBe(true)
  })

  it('the framework symlinks survived zipping (codesign on a Mac needs the real bundle structure)', () => {
    const fw = join(app(), 'Contents', 'Frameworks', 'Electron Framework.framework')
    expect(lstatSync(join(fw, 'Versions', 'Current')).isSymbolicLink()).toBe(true)
    expect(lstatSync(join(fw, 'Electron Framework')).isSymbolicLink()).toBe(true)
  })
})

describe('the macOS CLI shims, executed on a stand-in layout', () => {
  // kacola.app's Contents with this machine's Electron as Contents/MacOS/kacola and the Linux
  // runtime (same bundles, Linux natives): the shims' shell logic is what is under test.
  let fakeApp = ''
  let port = 0
  beforeAll(async () => {
    const runtime = (await testRuntime()).outDir
    fakeApp = join(tmp, 'Stand In.app')
    const contents = join(fakeApp, 'Contents')
    mkdirSync(join(contents, 'MacOS'), { recursive: true })
    symlinkSync(electronBinary(), join(contents, 'MacOS', 'kacola'))
    mkdirSync(join(contents, 'Resources', 'bin'), { recursive: true })
    cpSync(
      join(apps.arm64, 'Contents', 'Resources', 'bin', 'kacola'),
      join(contents, 'Resources', 'bin', 'kacola'),
    )
    cpSync(runtime, join(contents, 'Resources', 'runtime'), { recursive: true })
    port = await new Promise<number>((resolve) => {
      const s = createServer()
      s.listen(0, '127.0.0.1', () => {
        const p = (s.address() as { port: number }).port
        s.close(() => resolve(p))
      })
    })
  }, 120_000)

  const sh = (cmd: string, args: string[], env: Record<string, string>) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const c = spawn(cmd, args, { env: { ...process.env, ...env } })
      let stdout = ''
      let stderr = ''
      c.stdout.on('data', (d) => (stdout += d))
      c.stderr.on('data', (d) => (stderr += d))
      c.on('error', reject)
      c.on('close', (code) => resolve({ code, stdout, stderr }))
    })

  it('Resources/bin/kacola works through a symlink on PATH (it resolves its own location)', async () => {
    const bin = join(tmp, 'pathbin')
    mkdirSync(bin)
    symlinkSync(join(fakeApp, 'Contents', 'Resources', 'bin', 'kacola'), join(bin, 'kacola'))
    const r = await sh('sh', ['-c', 'kacola --version'], { PATH: `${bin}:/usr/bin:/bin` })
    expect(r.code, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^kacola 0\.1\.0/)
  })

  it('install-cli --mode macos writes a shim that starts the app with `open` when the daemon is down', async () => {
    const home = join(tmp, 'home')
    mkdirSync(home)
    const inApp = join(fakeApp, 'Contents', 'Resources', 'bin', 'kacola')
    const binDir = join(home, '.local', 'bin')
    const inst = await sh(inApp, ['install-cli', '--mode', 'macos', '--app', fakeApp, '--no-skill'], {
      HOME: home,
      PATH: '/usr/bin:/bin',
    })
    expect(inst.code, inst.stderr).toBe(0)
    const report = JSON.parse(inst.stdout)
    // /usr/local/bin is not writable here: the fallback, reported
    expect(report.shim.path).toBe(join(binDir, 'kacola'))
    expect(readFileSync(report.shim.path, 'utf8')).toContain(`open -g -a '${fakeApp}' --args --background`)

    // a stand-in for macOS's `open`: records its arguments, starts the bundled daemon like the app would
    const fakeBin = join(tmp, 'fakebin')
    mkdirSync(fakeBin)
    const data = join(tmp, 'mac-data')
    const log = join(tmp, 'open.log')
    writeFileSync(
      join(fakeBin, 'open'),
      `#!/bin/sh\necho "$@" > ${log}\nKACOLA_FAKES=1 KACOLA_KEYRING=memory KACOLA_CALENDAR=off KACOLA_DBUS=off ELECTRON_RUN_AS_NODE=1 exec "${fakeApp}/Contents/MacOS/kacola" "${fakeApp}/Contents/Resources/runtime/daemon.mjs" --port ${port} --data-dir ${data} >/dev/null 2>&1\n`,
    )
    chmodSync(join(fakeBin, 'open'), 0o755)
    const r = await sh('sh', [report.shim.path, 'sessions', 'list'], {
      PATH: `${fakeBin}:/usr/bin:/bin`,
      KACOLA_URL: `http://127.0.0.1:${port}`,
      KACOLA_START_TIMEOUT: '20',
    })
    try {
      expect(r.code, r.stderr).toBe(0)
      expect(JSON.parse(r.stdout)).toEqual({ sessions: [] })
      expect(readFileSync(log, 'utf8').trim()).toBe(`-g -a ${fakeApp} --args --background`)
    } finally {
      spawnSync('pkill', ['-f', '--', `--data-dir ${data}`])
    }
  }, 60_000)
})
