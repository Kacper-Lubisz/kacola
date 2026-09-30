// gnomeola-selftest: run inside the sandbox (`flatpak run --command=gnomeola-selftest org.gnome.Gnomeola`)
// to check what the daemon depends on, as JSON: the native modules load on this Electron's Node, PipeWire's
// tools are there and reach the sound server, and the data and models directories are writable.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const runtime = process.env.GNOMEOLA_RUNTIME_DIR || '/app/main/resources/runtime'
const require = createRequire(join(runtime, 'daemon.mjs'))
const out = {
  node: process.versions.node,
  electron: process.versions.electron ?? null,
  flatpakId: process.env.FLATPAK_ID ?? null,
}
const attempt = (name, fn) => {
  try {
    out[name] = { ok: true, ...fn() }
  } catch (err) {
    out[name] = { ok: false, error: String(err?.message ?? err).slice(0, 300) }
  }
}
attempt('sqlite', () => {
  const Database = require('better-sqlite3')
  const db = new Database(':memory:')
  const { v } = db.prepare('select sqlite_version() as v').get()
  db.close()
  return { version: v }
})
attempt('sherpa', () => {
  const sherpa = require('sherpa-onnx-node')
  return {
    exports: ['OnlineRecognizer', 'OfflineRecognizer', 'Vad'].filter((k) => typeof sherpa[k] === 'function'),
  }
})
attempt('pwRecord', () => {
  const r = spawnSync('pw-record', ['--version'], { encoding: 'utf8' })
  if (r.error) throw r.error
  return { version: r.stdout.trim().split('\n').at(-1) }
})
attempt('pwDump', () => {
  const r = spawnSync('pw-dump', [], { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 * 1024 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`pw-dump exited ${r.status}: ${r.stderr.trim()}`)
  const objs = JSON.parse(r.stdout)
  return { nodes: objs.filter((o) => o.type === 'PipeWire:Interface:Node').length }
})
attempt('ffmpeg', () => {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (r.error) throw r.error
  return { version: r.stdout.split('\n')[0] }
})
attempt('secretTool', () => {
  const r = spawnSync('secret-tool', ['--version'], { encoding: 'utf8' })
  if (r.error) throw r.error
  return { version: (r.stdout || r.stderr).trim() }
})
attempt('gjs', () => {
  // the runtime has no gjs; the Flatpak builds it (modules/gjs.yml) for the D-Bus bridge and cal-agent
  const r = spawnSync(
    'gjs',
    // check_version asks the loaded library (the typelib constants are the runtime's 2.84)
    [
      '-c',
      "const {GLib, Gio} = imports.gi; print(`${GLib.check_version(2, 86, 0) === null ? 'glib>=2.86' : 'glib<2.86'} ${typeof Gio.DBusProxy}`)",
    ],
    { encoding: 'utf8' },
  )
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`gjs exited ${r.status}: ${r.stderr.trim()}`)
  const v = spawnSync('gjs', ['--version'], { encoding: 'utf8' }).stdout.trim()
  return { version: v, glib: r.stdout.trim() }
})
attempt('dirs', () => {
  const data = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'gnomeola')
  const models = process.env.GNOMEOLA_MODELS_DIR || join(data, 'models')
  mkdirSync(models, { recursive: true })
  const probe = join(models, `.selftest-${process.pid}`)
  writeFileSync(probe, 'ok')
  rmSync(probe)
  return { dataDir: data, modelsDir: models, writable: true }
})
process.stdout.write(`${JSON.stringify(out)}\n`)
process.exitCode = Object.values(out).every((v) => typeof v !== 'object' || v === null || v.ok !== false)
  ? 0
  : 1
