import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  type BlobStore,
  blobStoreFromEnv,
  checkBlobKey,
  FsBlobStore,
  MemoryBlobStore,
  type VercelBlobClient,
  VercelBlobStore,
} from '../src/blob/index.ts'

// H-1 BlobStore: one contract, three backends. The Vercel adapter runs against a fake of the SDK slice
// it uses, with the SDK's real result shapes (pathname/size/cursor/hasMore, a stream for get, null for
// a missing blob) and a small page size so pagination is exercised; the live SDK is exercised by
// blob-live.int.test.ts when BLOB_READ_WRITE_TOKEN is set.

/** An in-memory stand-in for @vercel/blob that enforces what the adapter must always send. */
export function fakeVercelBlob(pageSize = 2) {
  const blobs = new Map<string, Buffer>()
  const calls: string[] = []
  const client: VercelBlobClient = {
    async put(pathname, body, opts) {
      if (opts.access !== 'private') throw new Error('audio must never be a public blob')
      if (opts.addRandomSuffix !== false || opts.allowOverwrite !== true)
        throw new Error('keys must be stable')
      calls.push(`put ${pathname}`)
      blobs.set(pathname, Buffer.from(body))
      return { pathname }
    },
    async get(pathname, opts) {
      if (opts.access !== 'private') throw new Error('private access expected')
      calls.push(`get ${pathname}`)
      const b = blobs.get(pathname)
      if (!b) return null
      return { statusCode: 200, stream: new Blob([new Uint8Array(b)]).stream() }
    },
    async del(pathnames) {
      calls.push(`del ${pathnames.join(',')}`)
      for (const p of pathnames) blobs.delete(p)
    },
    async list({ prefix, cursor, limit }) {
      calls.push(`list ${prefix} ${cursor ?? ''}`)
      const all = [...blobs.keys()].filter((k) => k.startsWith(prefix)).sort()
      const start = cursor ? Number(cursor) : 0
      const n = Math.min(limit ?? 1000, pageSize)
      const page = all.slice(start, start + n)
      const hasMore = start + n < all.length
      return {
        blobs: page.map((pathname) => ({ pathname, size: blobs.get(pathname)!.length })),
        hasMore,
        ...(hasMore ? { cursor: String(start + n) } : {}),
      }
    },
  }
  return { client, blobs, calls }
}

const dirs: string[] = []
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'gnomeola-blob-'))
  dirs.push(d)
  return d
}

const backends: [string, () => BlobStore][] = [
  ['memory', () => new MemoryBlobStore()],
  ['fs', () => new FsBlobStore(tmp())],
  ['vercel (fake SDK)', () => new VercelBlobStore({ token: 't', client: fakeVercelBlob().client })],
]

const bytes = (...xs: number[]) => new Uint8Array(xs)

for (const [name, make] of backends) {
  describe(`BlobStore contract: ${name}`, () => {
    it('puts, gets, overwrites and deletes', async () => {
      const b = make()
      expect(await b.get('audio/s1/0.pcm')).toBeNull()
      await b.put('audio/s1/0.pcm', bytes(1, 2, 3))
      expect(await b.get('audio/s1/0.pcm')).toEqual(bytes(1, 2, 3))
      await b.put('audio/s1/0.pcm', bytes(9))
      expect(await b.get('audio/s1/0.pcm')).toEqual(bytes(9))
      await b.delete('audio/s1/0.pcm')
      expect(await b.get('audio/s1/0.pcm')).toBeNull()
      await b.delete('audio/s1/never-existed') // deleting nothing is fine
    })

    it('lists by prefix, sorted, with sizes, across pages', async () => {
      const b = make()
      for (const k of ['audio/s2/3', 'audio/s1/1', 'audio/s1/0', 'audio/s10/0', 'other/x', 'audio/s1/2'])
        await b.put(k, new Uint8Array(k.length))
      expect(await b.list('audio/s1/')).toEqual([
        { key: 'audio/s1/0', size: 10 },
        { key: 'audio/s1/1', size: 10 },
        { key: 'audio/s1/2', size: 10 },
      ])
      expect((await b.list('audio/')).map((x) => x.key)).toEqual([
        'audio/s1/0',
        'audio/s1/1',
        'audio/s1/2',
        'audio/s10/0',
        'audio/s2/3',
      ])
      expect(await b.list('nothing/')).toEqual([])
      await b.delete(['audio/s1/0', 'audio/s1/1'])
      expect((await b.list('audio/s1/')).map((x) => x.key)).toEqual(['audio/s1/2'])
    })

    it('refuses keys that could escape the store', async () => {
      const b = make()
      for (const k of ['../etc/passwd', '/abs', 'a/../b', 'a//b', '', 'a/./b', 'sp ace'])
        await expect(b.put(k, bytes(1)), k).rejects.toThrow(/invalid blob key/)
    })

    it('returns copies: mutating what you got or gave does not change the store', async () => {
      const b = make()
      const src = bytes(1, 2)
      await b.put('k', src)
      src[0] = 7
      const got = (await b.get('k'))!
      got[1] = 7
      expect(await b.get('k')).toEqual(bytes(1, 2))
    })
  })
}

describe('VercelBlobStore specifics', () => {
  it('namespaces every key under its prefix and never asks for a public or suffixed blob', async () => {
    const fake = fakeVercelBlob()
    const b = new VercelBlobStore({ token: 't', prefix: 'env-a/', client: fake.client })
    await b.put('audio/x', bytes(1))
    expect([...fake.blobs.keys()]).toEqual(['env-a/audio/x'])
    expect(await b.list('')).toEqual([{ key: 'audio/x', size: 1 }])
    expect(fake.calls[0]).toBe('put env-a/audio/x')
  })

  it('is chosen from the environment when a Blob token is present', () => {
    expect(blobStoreFromEnv({ BLOB_READ_WRITE_TOKEN: 'x' }, '/tmp/x').kind).toBe('vercel')
    expect(blobStoreFromEnv({}, tmp()).kind).toBe('fs')
    expect(checkBlobKey('audio/ses_1/000001.pcm')).toBe('audio/ses_1/000001.pcm')
  })
})
