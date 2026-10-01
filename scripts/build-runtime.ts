#!/usr/bin/env node
// P-1: bundle the daemon and the CLI into self-contained ESM files that run on any Node 24 — including
// Electron 44's (ELECTRON_RUN_AS_NODE=1), which is how the desktop app, the Flatpak and the macOS .app run
// them: one runtime for the window, gnomeolad and gnomeola(1), like VS Code's `code` CLI.
//
//   node scripts/build-runtime.ts [--out DIR] [--target linux-x64,darwin-arm64,…]
//
// Output (default dist/runtime):
//   daemon.mjs  cli.mjs  diarize-worker.mjs      the bundles (workspace TS + pure-JS deps inlined)
//   root/…                                       files the code opens at runtime, at their repo paths
//                                                (gjs helpers, the D-Bus interface XML)
//   node_modules/better-sqlite3                  natives, external to the bundle: N-API builds, so the
//   node_modules/sherpa-onnx-node                same binary loads in Node and in Electron (no rebuild)
//   node_modules/sherpa-onnx-<platform>-<arch>   one per --target (darwin ones fetched with `npm pack`)
//   node_modules/onnxruntime-node (+ -common)    the decisions embedder's runtime, binaries for --target only
//   runtime.json                                 what was built, for packaging and the tests
//
// Paths: source files find their assets with `import.meta.dirname`, which in a bundle is the bundle's
// directory. A load-time rewrite turns each file's `import.meta.dirname` into `<bundle>/root/<that file's
// repo-relative dir>`, and the assets are copied to the same repo-relative places under root/, so the
// source keeps one spelling for dev and release. The diarization worker is its own entry point.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { type BuildOptions, build, type Plugin } from 'esbuild'

export const REPO = resolve(import.meta.dirname, '..')
export type Target = `${'linux' | 'darwin'}-${'x64' | 'arm64'}`
export const HOST_TARGET = `${process.platform}-${process.arch}` as Target

/** Natives that stay outside the bundle and ship as packages beside it. */
export const EXTERNAL = ['better-sqlite3', 'sherpa-onnx-node', 'onnxruntime-node']
/** Runtime assets, repo-relative (directories are copied whole). */
const ASSETS = ['packages/daemon/gjs', 'packages/daemon/dbus', 'packages/decisions/assets']

const SHERPA_VERSION = (): string =>
  (JSON.parse(readFileSync(require_('sherpa-onnx-node/package.json'), 'utf8')) as { version: string }).version

function require_(spec: string): string {
  // resolve from the stt package, where the dependency is declared (pnpm does not hoist it)
  const from = join(REPO, 'packages', 'stt', 'node_modules', ...spec.split('/'))
  if (existsSync(from)) return from
  const fromStore = join(REPO, 'packages', 'store', 'node_modules', ...spec.split('/'))
  if (existsSync(fromStore)) return fromStore
  const fromDecisions = join(REPO, 'packages', 'decisions', 'node_modules', ...spec.split('/'))
  if (existsSync(fromDecisions)) return fromDecisions
  throw new Error(`cannot find ${spec}`)
}

const assetDirs: Plugin = {
  name: 'gnomeola-asset-dirs',
  setup(b) {
    b.onLoad({ filter: /[\\/]packages[\\/].*\.ts$/ }, (args) => {
      let src = readFileSync(args.path, 'utf8')
      const rel = relative(REPO, dirname(args.path)).split('\\').join('/')
      if (src.includes('import.meta.dirname'))
        src = src.replaceAll('import.meta.dirname', `__gnomeolaAssetDir(${JSON.stringify(rel)})`)
      // the worker is bundled as a sibling entry point
      src = src.replace(
        "new URL('./diarize-worker.ts', import.meta.url)",
        "new URL('./diarize-worker.mjs', import.meta.url)",
      )
      return { contents: src, loader: 'ts' }
    })
  },
}

// CJS dependencies inside an ESM bundle need `require`; the asset helper resolves under ./root.
const BANNER = [
  "import { createRequire as __gnomeolaCreateRequire } from 'node:module';",
  "import { fileURLToPath as __gnomeolaFileURLToPath } from 'node:url';",
  "import { dirname as __gnomeolaDirname, join as __gnomeolaJoin } from 'node:path';",
  'const require = __gnomeolaCreateRequire(import.meta.url);',
  // CJS deps that locate files next to themselves (tiktoken's WASM) look beside the bundle instead
  'const __filename = __gnomeolaFileURLToPath(import.meta.url);',
  'const __dirname = __gnomeolaDirname(__filename);',
  'const __gnomeolaAssetDir = (rel) => __gnomeolaJoin(__gnomeolaDirname(__gnomeolaFileURLToPath(import.meta.url)), "root", rel);',
].join('\n')

export type RuntimeInfo = {
  outDir: string
  targets: Target[]
  files: Record<string, number>
  electron: string | null
  builtAt: string
}

export async function buildRuntime(o: { outDir: string; targets?: Target[] }): Promise<RuntimeInfo> {
  const outDir = resolve(o.outDir)
  const targets = o.targets ?? [HOST_TARGET]
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const skill = readFileSync(join(REPO, 'skills', 'meeting-context', 'SKILL.md'), 'utf8')
  const common: BuildOptions = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: [...EXTERNAL, 'pg-native'],
    banner: { js: BANNER },
    plugins: [assetDirs],
    logLevel: 'warning',
    legalComments: 'linked',
    sourcemap: false,
    metafile: true,
  }
  await build({
    ...common,
    entryPoints: {
      daemon: join(REPO, 'packages/daemon/src/main.ts'),
      'diarize-worker': join(REPO, 'packages/stt/src/sherpa/diarize-worker.ts'),
    },
    outdir: outDir,
    outExtension: { '.js': '.mjs' },
  })
  await build({
    ...common,
    entryPoints: { cli: join(REPO, 'packages/cli/src/main.ts') },
    outdir: outDir,
    outExtension: { '.js': '.mjs' },
    // skill install writes the skill from the bundle (packages/cli/src/commands/skill.ts)
    banner: { js: `${BANNER}\nglobalThis.GNOMEOLA_SKILL_MD = ${JSON.stringify(skill)};` },
  })
  for (const a of ASSETS) cpSync(join(REPO, a), join(outDir, 'root', a), { recursive: true })
  // @anthropic-ai/tokenizer (CLI token budgets) loads tiktoken's WASM from __dirname
  const tiktoken = join(REPO, 'node_modules', '.pnpm', 'node_modules', 'tiktoken', 'lite', 'tiktoken_bg.wasm')
  cpSync(tiktoken, join(outDir, 'tiktoken_bg.wasm'), { dereference: true })
  stageNatives(outDir, targets)
  const files: Record<string, number> = {}
  for (const f of readdirSync(outDir)) if (f.endsWith('.mjs')) files[f] = statSync(join(outDir, f)).size
  const info: RuntimeInfo = {
    outDir,
    targets,
    files,
    electron: electronVersion(),
    builtAt: new Date().toISOString(),
  }
  writeFileSync(join(outDir, 'runtime.json'), `${JSON.stringify(info, null, 2)}\n`)
  writeFileSync(
    join(outDir, 'package.json'),
    `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`,
  )
  return info
}

function electronVersion(): string | null {
  const p = join(REPO, 'node_modules', 'electron', 'package.json')
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version : null
}

/**
 * Copies the native packages beside the bundle. better-sqlite3 13 ships N-API prebuilds for every
 * platform inside its own package; only the ones for `targets` are kept. sherpa-onnx-node is N-API too;
 * its per-platform binaries come as separate packages, fetched from the registry for foreign targets.
 */
export function stageNatives(outDir: string, targets: Target[]): void {
  const nm = join(outDir, 'node_modules')
  const bs = require_('better-sqlite3')
  const bsOut = join(nm, 'better-sqlite3')
  mkdirSync(join(bsOut, 'prebuilds'), { recursive: true })
  for (const f of ['package.json', 'LICENSE', 'lib'])
    cpSync(join(bs, f), join(bsOut, f), { recursive: true, dereference: true })
  for (const t of targets) cpSync(join(bs, 'prebuilds', `${t}.node`), join(bsOut, 'prebuilds', `${t}.node`))

  const sherpa = require_('sherpa-onnx-node')
  cpSync(sherpa, join(nm, 'sherpa-onnx-node'), { recursive: true, dereference: true })
  const version = SHERPA_VERSION()
  for (const t of targets) {
    const name = `sherpa-onnx-${t}`
    const local = join(dirname(sherpa), name)
    const dest = join(nm, name)
    if (existsSync(local)) cpSync(local, dest, { recursive: true, dereference: true })
    else fetchPackage(`${name}@${version}`, dest)
  }

  // onnxruntime-node (the on-device decisions embedder) ships every platform's binary in one package
  // (~300 MB): keep dist/ and only the targets' binaries; its one runtime dependency is pure JS.
  // realpath: pnpm links the package; its dependencies sit next to the real directory in the store
  const ort = realpathSync(require_('onnxruntime-node'))
  const ortOut = join(nm, 'onnxruntime-node')
  mkdirSync(ortOut, { recursive: true })
  for (const f of ['package.json', 'README.md', 'dist'])
    cpSync(join(ort, f), join(ortOut, f), { recursive: true, dereference: true })
  for (const t of targets) {
    const [platform, arch] = t.split('-')
    const bin = join('bin', 'napi-v6', platform!, arch!)
    // onnxruntime-node 1.30 ships no darwin-x64 binary: that build goes without the on-device embedder
    // (it is optional; the decisions layer then picks another provider or none)
    if (!existsSync(join(ort, bin))) {
      console.warn(`onnxruntime-node has no ${t} binary: the ${t} runtime ships without the local embedder`)
      continue
    }
    cpSync(join(ort, bin), join(ortOut, bin), { recursive: true, dereference: true })
  }
  cpSync(join(dirname(ort), 'onnxruntime-common'), join(nm, 'onnxruntime-common'), {
    recursive: true,
    dereference: true,
  })
}

const CACHE = join(REPO, 'node_modules', '.cache', 'gnomeola-natives')

/** `npm pack` a package into a cache (once) and unpack it at `dest`. */
export function fetchPackage(spec: string, dest: string): void {
  mkdirSync(CACHE, { recursive: true })
  const tgz = join(CACHE, `${spec.replace(/[@/]/g, '_')}.tgz`)
  if (!existsSync(tgz)) {
    const name = execFileSync('npm', ['pack', spec, '--silent', '--pack-destination', CACHE], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .at(-1)!
    execFileSync('mv', [join(CACHE, name), tgz])
  }
  mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xzf', tgz, '-C', dest, '--strip-components=1'])
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, target: { type: 'string' } },
  })
  const targets = values.target ? (values.target.split(',') as Target[]) : undefined
  const info = await buildRuntime({ outDir: values.out ?? join(REPO, 'dist', 'runtime'), targets })
  const kib = (n: number) => `${(n / 1024).toFixed(0)} KiB`
  console.log(
    `runtime → ${info.outDir} [${info.targets.join(', ')}]: ${Object.entries(info.files)
      .map(([f, n]) => `${f} ${kib(n)}`)
      .join(', ')}`,
  )
}
