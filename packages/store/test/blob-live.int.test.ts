import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { VercelBlobStore } from '../src/blob/index.ts'

// Opt-in: the real @vercel/blob SDK against a real Blob store. Set BLOB_READ_WRITE_TOKEN (a throwaway
// store's token) to run it. Everything it writes lives under a random prefix and is deleted afterwards.
const token = process.env.BLOB_READ_WRITE_TOKEN

describe.skipIf(!token)('VercelBlobStore against Vercel Blob (live)', () => {
  it('round-trips, lists and deletes private blobs', async () => {
    const b = new VercelBlobStore({
      token: token!,
      prefix: `kacola-test-${randomBytes(4).toString('hex')}/`,
    })
    const data = new Uint8Array(randomBytes(4096))
    try {
      await b.put('audio/s/0.pcm', data)
      await b.put('audio/s/1.pcm', data.subarray(0, 10))
      expect(await b.get('audio/s/0.pcm')).toEqual(data)
      expect(await b.list('audio/s/')).toEqual([
        { key: 'audio/s/0.pcm', size: 4096 },
        { key: 'audio/s/1.pcm', size: 10 },
      ])
      expect(await b.get('audio/s/missing')).toBeNull()
    } finally {
      await b.delete(['audio/s/0.pcm', 'audio/s/1.pcm'])
    }
    expect(await b.list('audio/s/')).toEqual([])
  })
})
