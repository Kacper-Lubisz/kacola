// @kacola/store/blob — H-1: where audio bytes live, behind one small interface.
//
//   FsBlobStore      the local build (~/.local/share/kacola/blobs), and the hosted server in tests
//   VercelBlobStore  Vercel Blob, private access (never a public URL: this is meeting audio)
//   MemoryBlobStore  tests
//
// Keys are relative, slash-separated paths (`audio/<sessionId>/000042.pcm`). Every put overwrites and is
// all-or-nothing from a reader's point of view (the file store writes a temp file and renames), which
// is what makes a retried chunk upload safe.
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

export interface BlobStore {
  readonly kind: 'fs' | 'vercel' | 'memory'
  put(key: string, data: Uint8Array, opts?: { contentType?: string }): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(keys: string | string[]): Promise<void>
  /** Every blob whose key starts with `prefix`, sorted by key. */
  list(prefix: string): Promise<{ key: string; size: number }[]>
}

const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/

export function checkBlobKey(key: string): string {
  if (!KEY.test(key) || key.split('/').some((p) => p === '..' || p === '.') || key.length > 512)
    throw new Error(`invalid blob key ${JSON.stringify(key)}`)
  return key
}

const asArray = (k: string | string[]) => (Array.isArray(k) ? k : [k])
const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)

// ------------------------------------------------------------------------------------ memory

export class MemoryBlobStore implements BlobStore {
  readonly kind = 'memory' as const
  readonly blobs = new Map<string, Uint8Array>()
  async put(key: string, data: Uint8Array): Promise<void> {
    this.blobs.set(checkBlobKey(key), new Uint8Array(data))
  }
  async get(key: string): Promise<Uint8Array | null> {
    const v = this.blobs.get(checkBlobKey(key))
    return v ? new Uint8Array(v) : null
  }
  async delete(keys: string | string[]): Promise<void> {
    for (const k of asArray(keys)) this.blobs.delete(checkBlobKey(k))
  }
  async list(prefix: string): Promise<{ key: string; size: number }[]> {
    return [...this.blobs]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, v]) => ({ key, size: v.length }))
      .sort(byKey)
  }
}

// ---------------------------------------------------------------------------------------- fs

export class FsBlobStore implements BlobStore {
  readonly kind = 'fs' as const
  readonly root: string
  private tmp = 0
  constructor(root: string) {
    this.root = root
  }

  private path(key: string): string {
    return join(this.root, ...checkBlobKey(key).split('/'))
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const p = this.path(key)
    await mkdir(dirname(p), { recursive: true, mode: 0o700 })
    const t = `${p}.tmp-${process.pid}-${++this.tmp}`
    await writeFile(t, data, { mode: 0o600 })
    await rename(t, p)
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.path(key)))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const k of asArray(keys)) await rm(this.path(k), { force: true })
  }

  async list(prefix: string): Promise<{ key: string; size: number }[]> {
    const out: { key: string; size: number }[] = []
    const walk = async (dir: string): Promise<void> => {
      let entries: string[]
      try {
        entries = await readdir(dir)
      } catch {
        return
      }
      for (const e of entries) {
        if (e.includes('.tmp-')) continue
        const p = join(dir, e)
        const st = await stat(p)
        if (st.isDirectory()) await walk(p)
        else {
          const key = relative(this.root, p).split(sep).join('/')
          if (key.startsWith(prefix)) out.push({ key, size: st.size })
        }
      }
    }
    // Only descend into the directory the prefix names (or the root, for a bare prefix).
    const slash = prefix.lastIndexOf('/')
    await walk(slash === -1 ? this.root : join(this.root, ...prefix.slice(0, slash).split('/')))
    return out.sort(byKey)
  }
}

// ------------------------------------------------------------------------------------ vercel

/** The slice of @vercel/blob this adapter uses — injectable so tests can pin the SDK's shapes. */
export type VercelBlobClient = {
  put(
    pathname: string,
    body: Buffer,
    opts: {
      access: 'private'
      token: string
      addRandomSuffix: false
      allowOverwrite: true
      contentType?: string
    },
  ): Promise<{ pathname: string }>
  get(
    pathname: string,
    opts: { access: 'private'; token: string; useCache?: boolean },
  ): Promise<{ statusCode: number; stream: ReadableStream<Uint8Array> | null } | null>
  del(pathnames: string[], opts: { token: string }): Promise<void>
  list(opts: {
    prefix: string
    cursor?: string
    token: string
    limit?: number
  }): Promise<{ blobs: { pathname: string; size: number }[]; cursor?: string; hasMore: boolean }>
}

export type VercelBlobOptions = {
  /** BLOB_READ_WRITE_TOKEN of the project's Blob store. */
  token: string
  /** Everything this deployment writes goes under this prefix (default `kacola/`). */
  prefix?: string
  client?: VercelBlobClient
}

export class VercelBlobStore implements BlobStore {
  readonly kind = 'vercel' as const
  private readonly token: string
  private readonly prefix: string
  private client: VercelBlobClient | null

  constructor(opts: VercelBlobOptions) {
    this.token = opts.token
    this.prefix = opts.prefix ?? 'kacola/'
    this.client = opts.client ?? null
  }

  private async sdk(): Promise<VercelBlobClient> {
    // Loaded lazily: nothing but a Vercel deployment pays for importing the SDK.
    this.client ??= (await import('@vercel/blob')) as unknown as VercelBlobClient
    return this.client
  }

  private full(key: string): string {
    return this.prefix + checkBlobKey(key)
  }

  async put(key: string, data: Uint8Array, opts: { contentType?: string } = {}): Promise<void> {
    await (await this.sdk()).put(this.full(key), Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
      access: 'private',
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: opts.contentType ?? 'application/octet-stream',
    })
  }

  async get(key: string): Promise<Uint8Array | null> {
    // useCache: false — a chunk just re-uploaded must never be served stale from the CDN.
    const r = await (await this.sdk()).get(this.full(key), {
      access: 'private',
      token: this.token,
      useCache: false,
    })
    if (r?.statusCode !== 200 || !r.stream) return null
    return new Uint8Array(await new Response(r.stream).arrayBuffer())
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = asArray(keys).map((k) => this.full(k))
    if (list.length) await (await this.sdk()).del(list, { token: this.token })
  }

  async list(prefix: string): Promise<{ key: string; size: number }[]> {
    const sdk = await this.sdk()
    const out: { key: string; size: number }[] = []
    let cursor: string | undefined
    do {
      const page = await sdk.list({ prefix: this.prefix + prefix, token: this.token, limit: 1000, cursor })
      for (const b of page.blobs) out.push({ key: b.pathname.slice(this.prefix.length), size: b.size })
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
    return out.sort(byKey)
  }
}

/** Pick the blob store from the environment: Vercel Blob when a token is present, else the file system. */
export function blobStoreFromEnv(env: Record<string, string | undefined>, fallbackDir: string): BlobStore {
  if (env.BLOB_READ_WRITE_TOKEN) return new VercelBlobStore({ token: env.BLOB_READ_WRITE_TOKEN })
  return new FsBlobStore(env.KACOLA_BLOB_DIR || fallbackDir)
}
