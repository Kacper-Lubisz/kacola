import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModelInfo } from '@gnomeola/protocol'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CatalogEntry } from '../src/models/catalog.ts'
import { ModelError, ModelManager, type ModelProgress } from '../src/models/manager.ts'
import { defaultModelsDir } from '../src/models/paths.ts'

// A fake release server: serves real .tar.bz2 archives with Range support, and can be told to cut a
// response short (to exercise resume) or to ignore Range (to exercise restart-from-zero).

type Served = { body: Buffer; cutAfter?: number; ignoreRange?: boolean }
const files = new Map<string, Served>()
const requests: { url: string; range: string | undefined }[] = []
let server: Server
let base = ''
let work = ''

function makeArchive(name: string, contents: Record<string, string | Buffer>): Buffer {
  const src = mkdtempSync(join(work, 'src-'))
  const top = join(src, name)
  for (const [rel, data] of Object.entries(contents)) {
    const p = join(top, rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, data)
  }
  const out = join(work, `${name}-${Math.random().toString(36).slice(2)}.tar.bz2`)
  execFileSync('tar', ['-cjf', out, '-C', src, name])
  return readFileSync(out)
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

function entry(id: string, body: Buffer, over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id,
    role: 'final',
    title: `Test ${id}`,
    url: `${base}/${id}.tar.bz2`,
    sha256: sha(body),
    sizeBytes: body.length,
    format: 'tar.bz2',
    requiredFiles: ['model.onnx', 'tokens.txt'],
    engine: { kind: 'silero-vad', model: 'model.onnx' },
    license: 'test',
    licenseUrl: 'test',
    ...over,
  }
}

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), 'gnomeola-mm-'))
  server = createServer((req: IncomingMessage, res) => {
    const key = (req.url ?? '').slice(1)
    requests.push({ url: key, range: req.headers.range })
    const f = files.get(key)
    if (!f) {
      res.writeHead(404).end('not found')
      return
    }
    let start = 0
    const m = /^bytes=(\d+)-$/.exec(req.headers.range ?? '')
    if (m && !f.ignoreRange) {
      start = Number(m[1])
      if (start >= f.body.length) {
        res.writeHead(416).end()
        return
      }
      res.writeHead(206, {
        'content-length': f.body.length - start,
        'content-range': `bytes ${start}-${f.body.length - 1}/${f.body.length}`,
      })
    } else res.writeHead(200, { 'content-length': f.body.length })
    const slice = f.body.subarray(start)
    if (f.cutAfter !== undefined) {
      const cut = f.cutAfter
      f.cutAfter = undefined // only the first response is cut
      res.write(slice.subarray(0, cut), () => res.destroy())
    } else res.end(slice)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()))
  rmSync(work, { recursive: true, force: true })
})

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(work, 'models-'))
  requests.length = 0
  files.clear()
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const payload = {
  'model.onnx': Buffer.alloc(200_000, 7),
  'tokens.txt': 'a 0\nb 1\n',
  'sub/extra.bin': Buffer.alloc(1000, 1),
}

describe('ModelManager', () => {
  it('downloads, verifies, extracts, and reports ready with a ModelInfo the protocol accepts', async () => {
    const body = makeArchive('pkg-a', payload)
    files.set('a.tar.bz2', { body })
    const e = entry('a', body)
    const mm = new ModelManager({ dir, catalog: [e], progressIntervalMs: 0 })

    expect((await mm.status('a')).state).toBe('missing')
    const progress: ModelProgress[] = []
    const path = await mm.ensure('a', { onProgress: (p) => progress.push(p) })

    expect(path).toBe(join(dir, 'a'))
    expect(readFileSync(join(path, 'tokens.txt'), 'utf8')).toBe('a 0\nb 1\n')
    expect(statSync(join(path, 'sub/extra.bin')).size).toBe(1000)
    const s = await mm.status('a')
    expect(s).toMatchObject({ state: 'ready', progress: null, detail: null, partialBytes: 0 })
    expect(ModelInfo.parse(ModelManager.toModelInfo(s))).toEqual({
      id: 'a',
      role: 'final',
      title: 'Test a',
      sizeBytes: body.length,
      state: 'ready',
      progress: null,
    })
    // progress: download fractions never go backwards, end at 1, then verify → extract
    const dl = progress.filter((p) => p.phase === 'download').map((p) => p.fraction)
    expect(dl.length).toBeGreaterThanOrEqual(2)
    expect([...dl].sort((x, y) => x - y)).toEqual(dl)
    expect(dl.at(-1)).toBe(1)
    expect(progress.slice(-2).map((p) => p.phase)).toEqual(['verify', 'extract'])
  })

  it('is idempotent: a ready model makes no network request', async () => {
    const body = makeArchive('pkg-b', payload)
    files.set('b.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('b', body)] })
    await mm.ensure('b')
    requests.length = 0
    await mm.ensure('b')
    await new ModelManager({ dir, catalog: [entry('b', body)] }).ensure('b') // a fresh process, too
    expect(requests).toEqual([])
  })

  it('shares one download between concurrent callers and reports downloading meanwhile', async () => {
    const body = makeArchive('pkg-c', payload)
    files.set('c.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('c', body)] })
    const p1 = mm.ensure('c')
    const p2 = mm.ensure('c')
    expect((await mm.status('c')).state).toBe('downloading')
    expect(await p1).toBe(await p2)
    expect(requests).toHaveLength(1)
  })

  it('a checksum mismatch leaves the model corrupt, deletes the bad download, and never installs it', async () => {
    const body = makeArchive('pkg-d', payload)
    files.set('d.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('d', body, { sha256: 'f'.repeat(64) })] })
    const err = await mm.ensure('d').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ModelError)
    expect((err as ModelError).code).toBe('checksum')
    const s = await mm.status('d')
    expect(s.state).toBe('corrupt')
    expect(s.detail).toMatch(/checksum mismatch: expected f{64}, got [0-9a-f]{64}/)
    expect(s.partialBytes).toBe(0)
    await expect(mm.require('d')).rejects.toThrow(/corrupt/)
    // the model directory was never created
    expect(() => statSync(join(dir, 'd'))).toThrow()
  })

  it('resumes an interrupted download with a Range request', async () => {
    const body = makeArchive('pkg-e', { ...payload, 'model.onnx': Buffer.from(randomBytes(300_000)) })
    files.set('e.tar.bz2', { body, cutAfter: 100_000 })
    const mm = new ModelManager({ dir, catalog: [entry('e', body)] })

    const err = await mm.ensure('e').catch((e: unknown) => e)
    expect((err as ModelError).code).toBe('http')
    const mid = await mm.status('e')
    expect(mid.state).toBe('missing')
    expect(mid.partialBytes).toBeGreaterThan(0)
    expect(mid.partialBytes).toBeLessThan(body.length)

    await mm.ensure('e')
    expect(requests.map((r) => r.range)).toEqual([undefined, `bytes=${mid.partialBytes}-`])
    expect((await mm.status('e')).state).toBe('ready')
    expect((await mm.verify('e')).state).toBe('ready')
  })

  it('restarts from zero when the server ignores Range', async () => {
    const body = makeArchive('pkg-f', { ...payload, 'model.onnx': Buffer.from(randomBytes(300_000)) })
    files.set('f.tar.bz2', { body, cutAfter: 50_000, ignoreRange: true })
    const mm = new ModelManager({ dir, catalog: [entry('f', body)] })
    await mm.ensure('f').catch(() => {})
    await mm.ensure('f')
    expect((await mm.status('f')).state).toBe('ready')
  })

  it('an archive missing a required file is corrupt, not ready', async () => {
    const body = makeArchive('pkg-g', { 'model.onnx': 'x' })
    files.set('g.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('g', body)] })
    const err = await mm.ensure('g').catch((e: unknown) => e)
    expect((err as ModelError).code).toBe('missing-files')
    const s = await mm.status('g')
    expect(s.state).toBe('corrupt')
    expect(s.detail).toMatch(/tokens\.txt/)
  })

  it('detects a deleted or truncated required file cheaply, and a same-size tamper with verify()', async () => {
    const body = makeArchive('pkg-h', payload)
    files.set('h.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('h', body)] })
    const path = await mm.ensure('h')

    rmSync(join(path, 'tokens.txt'))
    expect(await mm.status('h')).toMatchObject({
      state: 'corrupt',
      detail: expect.stringMatching(/tokens\.txt is missing/),
    })

    // ensure() repairs a corrupt model from a fresh, verified download
    await mm.ensure('h')
    expect((await mm.status('h')).state).toBe('ready')

    writeFileSync(join(path, 'model.onnx'), Buffer.alloc(10))
    expect((await mm.status('h')).detail).toMatch(/model\.onnx has size 10, expected 200000/)
    await mm.ensure('h')

    // same size, different bytes: only a deep verify can tell
    writeFileSync(join(path, 'model.onnx'), Buffer.alloc(200_000, 8))
    expect((await mm.status('h')).state).toBe('ready')
    const v = await mm.verify('h')
    expect(v.state).toBe('corrupt')
    expect(v.detail).toMatch(/model\.onnx checksum mismatch/)
    expect((await mm.status('h')).state).toBe('corrupt') // and it sticks
  })

  it('an install without a manifest (crash mid-install) is corrupt', async () => {
    mkdirSync(join(dir, 'i'), { recursive: true })
    writeFileSync(join(dir, 'i', 'model.onnx'), 'x')
    const mm = new ModelManager({ dir, catalog: [entry('i', Buffer.from('whatever'))] })
    expect((await mm.status('i')).state).toBe('corrupt')
  })

  it('installs a single-file model', async () => {
    const body = Buffer.from(randomBytes(5000))
    files.set('vad.onnx', { body })
    const e = entry('vad', body, {
      role: 'vad',
      url: `${base}/vad.onnx`,
      format: 'file',
      fileName: 'silero_vad.onnx',
      requiredFiles: ['silero_vad.onnx'],
    })
    const mm = new ModelManager({ dir, catalog: [e] })
    const path = await mm.ensure('vad')
    expect(readFileSync(join(path, 'silero_vad.onnx')).equals(body)).toBe(true)
    expect(ModelManager.toModelInfo(await mm.status('vad')).role).toBe('vad')
  })

  it('reports HTTP errors and stays missing', async () => {
    const mm = new ModelManager({ dir, catalog: [entry('nope', Buffer.from('x'))] })
    await expect(mm.ensure('nope')).rejects.toThrow(/HTTP 404/)
    expect((await mm.status('nope')).state).toBe('missing')
  })

  it('treats a download lock held by another live process as downloading', async () => {
    const body = makeArchive('pkg-j', payload)
    files.set('j.tar.bz2', { body })
    const mm = new ModelManager({ dir, catalog: [entry('j', body)] })
    mkdirSync(join(dir, '.downloads'), { recursive: true })
    writeFileSync(join(dir, '.downloads', 'j.lock'), String(process.ppid))
    expect((await mm.status('j')).state).toBe('downloading')
    await expect(mm.ensure('j')).rejects.toThrow(/another process/)
    // a lock left by a dead process is stale and ignored
    writeFileSync(join(dir, '.downloads', 'j.lock'), '999999999')
    expect((await mm.status('j')).state).toBe('missing')
  })

  it('resolves the models dir from the environment', () => {
    expect(defaultModelsDir({ GNOMEOLA_MODELS_DIR: '/m' })).toBe('/m')
    expect(defaultModelsDir({ XDG_DATA_HOME: '/x' })).toBe('/x/gnomeola/models')
    expect(defaultModelsDir({})).toMatch(/\.local\/share\/gnomeola\/models$/)
  })
})

/** Deterministic incompressible bytes (bzip2 must not shrink them below the cut point). */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  for (let i = 0, block = 0; i < n; block++) {
    const h = createHash('sha256').update(`block-${block}`).digest()
    out.set(h.subarray(0, Math.min(32, n - i)), i)
    i += 32
  }
  return out
}
