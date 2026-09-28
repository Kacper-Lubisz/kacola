import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { pipeline } from 'node:stream/promises'
import type { ModelInfo } from '@gnomeola/protocol'
import { CATALOG, type CatalogEntry, catalogEntry } from './catalog.ts'
import { defaultModelsDir } from './paths.ts'

// T-1 — the model manager.
//
// Layout under the models dir:
//   <id>/                       an installed model (archive's top-level directory stripped)
//   <id>/.gnomeola-model.json   install manifest: archive sha256 + size and sha256 of every file
//   .downloads/<id>.part        a partial download, resumed with an HTTP Range request
//   .downloads/<id>.lock        held (with our pid) while a process downloads the model
//   .downloads/<id>.corrupt     the last attempt failed verification; reason inside
//
// State detection is cheap (stat + manifest) so it can run on every health check; `verify()` re-hashes
// every file for the paranoid path (startup after a crash, or a user-triggered check).

export type ModelState = ModelInfo['state']

export type ModelStatus = {
  id: string
  role: CatalogEntry['role']
  title: string
  sizeBytes: number
  state: ModelState
  /** 0..1 while downloading, else null. */
  progress: number | null
  /** Bytes of a resumable partial download on disk (0 if none). */
  partialBytes: number
  /** Why a model is corrupt, or null. */
  detail: string | null
  dir: string
}

export type ProgressPhase = 'download' | 'verify' | 'extract'
export type ModelProgress = {
  id: string
  phase: ProgressPhase
  receivedBytes: number
  totalBytes: number
  /** 0..1 over the download; verify/extract report 1. */
  fraction: number
}

export type ManifestFile = { size: number; sha256: string }
export type Manifest = {
  id: string
  sha256: string
  sizeBytes: number
  installedAt: string
  files: Record<string, ManifestFile>
}

export class ModelError extends Error {
  readonly code: 'checksum' | 'missing-files' | 'http' | 'extract' | 'not-ready' | 'busy'
  readonly modelId: string
  constructor(code: ModelError['code'], modelId: string, message: string) {
    super(message)
    this.name = 'ModelError'
    this.code = code
    this.modelId = modelId
  }
}

export type ModelManagerOptions = {
  dir?: string
  catalog?: readonly CatalogEntry[]
  fetch?: typeof fetch
  /** Minimum interval between download progress callbacks (ms). */
  progressIntervalMs?: number
}

export type EnsureOptions = {
  onProgress?: (p: ModelProgress) => void
  signal?: AbortSignal
}

const MANIFEST = '.gnomeola-model.json'

export class ModelManager {
  readonly dir: string
  readonly catalog: readonly CatalogEntry[]
  private readonly fetchImpl: typeof fetch
  private readonly progressIntervalMs: number
  private readonly active = new Map<string, { promise: Promise<string>; received: number }>()

  constructor(opts: ModelManagerOptions = {}) {
    this.dir = opts.dir ?? defaultModelsDir()
    this.catalog = opts.catalog ?? CATALOG
    this.fetchImpl = opts.fetch ?? fetch
    this.progressIntervalMs = opts.progressIntervalMs ?? 200
  }

  entry(id: string): CatalogEntry {
    return catalogEntry(id, this.catalog)
  }

  /** Directory of an installed model. */
  path(id: string): string {
    return join(this.dir, this.entry(id).id)
  }

  /** Absolute path of a file inside an installed model. */
  file(id: string, rel: string): string {
    return join(this.path(id), rel)
  }

  private dl(id: string, ext: 'part' | 'lock' | 'corrupt'): string {
    return join(this.dir, '.downloads', `${id}.${ext}`)
  }

  async status(id: string): Promise<ModelStatus> {
    return this.statusOf(id, true)
  }

  private async statusOf(id: string, includeActive: boolean): Promise<ModelStatus> {
    const e = this.entry(id)
    const base = {
      id: e.id,
      role: e.role,
      title: e.title,
      sizeBytes: e.sizeBytes,
      dir: this.path(id),
    }
    const partialBytes = (await fileSize(this.dl(id, 'part'))) ?? 0
    const active = includeActive ? this.active.get(e.id) : undefined
    if (active)
      return {
        ...base,
        state: 'downloading',
        progress: Math.min(1, active.received / e.sizeBytes),
        partialBytes,
        detail: null,
      }
    if (await lockHeldByLiveProcess(this.dl(id, 'lock')))
      return {
        ...base,
        state: 'downloading',
        progress: Math.min(1, partialBytes / e.sizeBytes),
        partialBytes,
        detail: null,
      }
    const marker = await readText(this.dl(id, 'corrupt'))
    if (marker !== null) return { ...base, state: 'corrupt', progress: null, partialBytes, detail: marker }
    const problem = await this.installProblem(e)
    if (problem === 'absent') return { ...base, state: 'missing', progress: null, partialBytes, detail: null }
    if (problem) return { ...base, state: 'corrupt', progress: null, partialBytes, detail: problem }
    return { ...base, state: 'ready', progress: null, partialBytes, detail: null }
  }

  async list(role?: CatalogEntry['role']): Promise<ModelStatus[]> {
    const entries = this.catalog.filter((e) => !role || e.role === role)
    return Promise.all(entries.map((e) => this.status(e.id)))
  }

  /** Protocol view. TTS voices are fixture tooling, not runtime models, so they have no ModelInfo. */
  static toModelInfo(s: ModelStatus): ModelInfo {
    if (s.role === 'tts') throw new Error(`${s.id} is a TTS voice; ModelInfo covers live|final|vad`)
    return {
      id: s.id,
      role: s.role,
      title: s.title,
      sizeBytes: s.sizeBytes,
      state: s.state,
      progress: s.progress,
    }
  }

  /** Returns the model dir if ready; never downloads. */
  async require(id: string): Promise<string> {
    const s = await this.status(id)
    if (s.state !== 'ready')
      throw new ModelError('not-ready', id, `model ${id} is ${s.state}${s.detail ? `: ${s.detail}` : ''}`)
    return s.dir
  }

  /**
   * Download (resuming any partial), verify the sha256, extract, and record a manifest. Idempotent: a
   * ready model returns immediately with no network traffic; concurrent calls share one download.
   */
  ensure(id: string, opts: EnsureOptions = {}): Promise<string> {
    const running = this.active.get(id)
    if (running) return running.promise
    const slot = { received: 0, promise: Promise.resolve('') }
    slot.promise = this.install(this.entry(id), opts, slot).finally(() => this.active.delete(id))
    this.active.set(id, slot)
    return slot.promise
  }

  /** Re-hash every installed file against the manifest. Marks the model corrupt on any mismatch. */
  async verify(id: string): Promise<ModelStatus> {
    const e = this.entry(id)
    const s = await this.status(id)
    if (s.state !== 'ready') return s
    const manifest = (await readManifest(this.path(id)))!
    for (const [rel, f] of Object.entries(manifest.files)) {
      const p = join(this.path(id), rel)
      const size = await fileSize(p)
      const problem =
        size === null
          ? `${rel} is missing`
          : size !== f.size
            ? `${rel} has size ${size}, expected ${f.size}`
            : (await sha256File(p)) !== f.sha256
              ? `${rel} checksum mismatch`
              : null
      if (problem) {
        await this.markCorrupt(e.id, problem)
        return this.status(id)
      }
    }
    return s
  }

  async remove(id: string): Promise<void> {
    const e = this.entry(id)
    await rm(this.path(e.id), { recursive: true, force: true })
    for (const ext of ['part', 'corrupt'] as const) await rm(this.dl(e.id, ext), { force: true })
  }

  // ------------------------------------------------------------------------------------ internals

  private async installProblem(e: CatalogEntry): Promise<string | null | 'absent'> {
    const dir = this.path(e.id)
    if ((await fileSize(dir, true)) === null) return 'absent'
    const manifest = await readManifest(dir)
    if (!manifest) return 'install manifest missing or unreadable (interrupted install?)'
    if (manifest.sha256 !== e.sha256)
      return `installed from archive ${manifest.sha256.slice(0, 12)}…, catalog pins ${e.sha256.slice(0, 12)}…`
    for (const rel of e.requiredFiles) {
      const size = await fileSize(join(dir, rel))
      if (size === null) return `required file ${rel} is missing`
      const expected = manifest.files[rel]?.size
      if (expected === undefined) return `required file ${rel} is not in the install manifest`
      if (size !== expected) return `required file ${rel} has size ${size}, expected ${expected}`
    }
    return null
  }

  private async markCorrupt(id: string, detail: string): Promise<void> {
    await mkdir(join(this.dir, '.downloads'), { recursive: true })
    await writeFile(this.dl(id, 'corrupt'), detail)
  }

  private async install(e: CatalogEntry, opts: EnsureOptions, slot: { received: number }): Promise<string> {
    const before = await this.statusOf(e.id, false)
    if (before.state === 'ready') return before.dir
    if (before.state === 'downloading')
      throw new ModelError('busy', e.id, `model ${e.id} is being downloaded by another process`)

    await mkdir(join(this.dir, '.downloads'), { recursive: true })
    const lock = this.dl(e.id, 'lock')
    await writeFile(lock, String(process.pid))
    try {
      // A previous corrupt install is discarded: we are about to replace it from a verified archive.
      await rm(this.dl(e.id, 'corrupt'), { force: true })
      if (before.state === 'corrupt') await rm(this.path(e.id), { recursive: true, force: true })

      const part = this.dl(e.id, 'part')
      await this.download(e, part, opts, slot)

      opts.onProgress?.({
        id: e.id,
        phase: 'verify',
        receivedBytes: e.sizeBytes,
        totalBytes: e.sizeBytes,
        fraction: 1,
      })
      const actual = await sha256File(part)
      if (actual !== e.sha256) {
        await rm(part, { force: true })
        const detail = `checksum mismatch: expected ${e.sha256}, got ${actual}`
        await this.markCorrupt(e.id, detail)
        throw new ModelError('checksum', e.id, `model ${e.id}: ${detail}`)
      }

      opts.onProgress?.({
        id: e.id,
        phase: 'extract',
        receivedBytes: e.sizeBytes,
        totalBytes: e.sizeBytes,
        fraction: 1,
      })
      await this.extract(e, part)
      return this.path(e.id)
    } finally {
      await rm(lock, { force: true })
    }
  }

  private async download(
    e: CatalogEntry,
    part: string,
    opts: EnsureOptions,
    slot: { received: number },
  ): Promise<void> {
    let have = (await fileSize(part)) ?? 0
    if (have > e.sizeBytes) {
      await rm(part, { force: true })
      have = 0
    }
    slot.received = have
    if (have === e.sizeBytes) return

    const headers: Record<string, string> = {}
    if (have > 0) headers.Range = `bytes=${have}-`
    let res: Response
    try {
      res = await this.fetchImpl(e.url, { headers, signal: opts.signal ?? null, redirect: 'follow' })
    } catch (err) {
      throw new ModelError('http', e.id, `model ${e.id}: download failed: ${(err as Error).message}`)
    }
    let append = false
    if (res.status === 206) append = true
    else if (res.status === 200) have = 0
    else if (res.status === 416 && have > 0) {
      // Server says our range is unsatisfiable — the partial file is the whole thing, or garbage;
      // the checksum decides which.
      await res.body?.cancel()
      return
    } else {
      await res.body?.cancel()
      throw new ModelError('http', e.id, `model ${e.id}: HTTP ${res.status} from ${e.url}`)
    }
    if (!res.body) throw new ModelError('http', e.id, `model ${e.id}: empty response body`)

    slot.received = have
    let lastEmit = 0
    const emit = (force = false) => {
      const now = Date.now()
      if (!force && now - lastEmit < this.progressIntervalMs) return
      lastEmit = now
      opts.onProgress?.({
        id: e.id,
        phase: 'download',
        receivedBytes: slot.received,
        totalBytes: e.sizeBytes,
        fraction: Math.min(1, slot.received / e.sizeBytes),
      })
    }
    emit(true)
    // Each received chunk is written before the next is read, and the file is closed (not destroyed) on
    // failure: so every byte that arrived is on disk when an interruption propagates, and the next
    // ensure() resumes from exactly there. (A stream pipeline destroys its sink on a source error and
    // can discard writes still queued — found as a flaky resume test under load.)
    const fh = await open(part, append ? 'a' : 'w')
    let failure: unknown = null
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        await fh.write(chunk)
        slot.received += chunk.length
        emit()
      }
    } catch (err) {
      failure = err
    } finally {
      await fh.close()
    }
    // Keep the partial file: the next ensure() resumes from it.
    if (failure)
      throw new ModelError('http', e.id, `model ${e.id}: download interrupted: ${(failure as Error).message}`)
    emit(true)
  }

  private async extract(e: CatalogEntry, part: string): Promise<void> {
    const staging = join(this.dir, '.downloads', `${e.id}.staging-${process.pid}`)
    await rm(staging, { recursive: true, force: true })
    await mkdir(staging, { recursive: true })
    try {
      let root = staging
      if (e.format === 'file') {
        await rename(part, join(staging, e.fileName ?? e.id))
      } else {
        await run('tar', ['-xjf', part, '-C', staging]).catch((err: Error) => {
          throw new ModelError('extract', e.id, `model ${e.id}: extraction failed: ${err.message}`)
        })
        const top = await readdir(staging, { withFileTypes: true })
        if (top.length === 1 && top[0]!.isDirectory()) root = join(staging, top[0]!.name)
      }
      const missing: string[] = []
      for (const rel of e.requiredFiles) if ((await fileSize(join(root, rel))) === null) missing.push(rel)
      if (missing.length) {
        const detail = `archive lacks required file(s): ${missing.join(', ')}`
        await this.markCorrupt(e.id, detail)
        await rm(part, { force: true })
        throw new ModelError('missing-files', e.id, `model ${e.id}: ${detail}`)
      }
      const files: Record<string, ManifestFile> = {}
      for (const p of await walk(root)) {
        const st = await stat(p)
        files[relative(root, p)] = { size: st.size, sha256: await sha256File(p) }
      }
      const manifest: Manifest = {
        id: e.id,
        sha256: e.sha256,
        sizeBytes: e.sizeBytes,
        installedAt: new Date().toISOString(),
        files,
      }
      // The manifest is written last, inside the staging dir, and the directory is moved into place
      // atomically — a crash at any point leaves either nothing or an install without a manifest
      // (reported as corrupt), never a half-populated "ready" model.
      await writeFile(join(root, MANIFEST), JSON.stringify(manifest, null, 2))
      await rm(this.path(e.id), { recursive: true, force: true })
      await rename(root, this.path(e.id))
      await rm(part, { force: true })
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
  }
}

// ---------------------------------------------------------------------------------------- helpers

async function fileSize(p: string, allowDir = false): Promise<number | null> {
  try {
    const s = await stat(p)
    if (s.isDirectory()) return allowDir ? 0 : null
    return s.size
  } catch {
    return null
  }
}

async function readText(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8')
  } catch {
    return null
  }
}

async function readManifest(dir: string): Promise<Manifest | null> {
  const raw = await readText(join(dir, MANIFEST))
  if (raw === null) return null
  try {
    const m = JSON.parse(raw) as Manifest
    return typeof m.sha256 === 'string' && m.files && typeof m.files === 'object' ? m : null
  } catch {
    return null
  }
}

async function lockHeldByLiveProcess(lock: string): Promise<boolean> {
  const raw = await readText(lock)
  if (raw === null) return false
  const pid = Number(raw.trim())
  if (!Number.isInteger(pid) || pid <= 0) return false
  if (pid === process.pid) return false // our own stale lock; `active` covers live downloads
  try {
    process.kill(pid, 0)
    return true
  } catch {
    await unlink(lock).catch(() => {})
    return false
  }
}

export async function sha256File(p: string): Promise<string> {
  const h = createHash('sha256')
  await pipeline(createReadStream(p), h)
  return h.digest('hex')
}

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, d.name)
    if (d.isDirectory()) await walk(p, acc)
    else if (d.isFile()) acc.push(p)
  }
  return acc
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(0, 500)}`)),
    )
  })
}
