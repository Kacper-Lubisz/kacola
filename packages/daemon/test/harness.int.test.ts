import { existsSync } from 'node:fs'
import { startDaemon } from '@gnomeola/testkit/daemon'
import { describe, expect, it } from 'vitest'

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('startDaemon harness', () => {
  it('runs the real daemon on a random loopback port in a temp dir, and cleans both up', async () => {
    const d = await startDaemon()
    const pid = d.pid
    expect(alive(pid)).toBe(true)
    expect(d.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(d.baseUrl).not.toBe('http://127.0.0.1:8787')
    expect((await d.client.call('health')).ok).toBe(true)
    expect(existsSync(d.dataDir)).toBe(true)
    expect(await d.stop()).toBe(0)
    expect(alive(pid)).toBe(false)
    expect(existsSync(d.dataDir)).toBe(false)
  })

  it('kill() keeps the data dir; restart() comes back on it with state intact', async () => {
    const d = await startDaemon()
    try {
      const s = await d.client.call('createSession', { body: { title: 'survives' } })
      const first = d.baseUrl
      expect(await d.kill('SIGKILL')).toEqual({ code: null, signal: 'SIGKILL' })
      expect(existsSync(d.dataDir)).toBe(true)
      await expect(d.client.call('health')).rejects.toThrow(/not reachable/)
      await d.restart()
      expect(d.baseUrl).not.toBe(first)
      expect((await d.client.call('getSession', { params: { id: s.id } })).title).toBe('survives')
    } finally {
      await d.stop()
    }
  })

  it('surfaces a daemon that fails to start, with its output', async () => {
    await expect(startDaemon({ args: ['--host', '0.0.0.0'] })).rejects.toThrow(
      /refusing to listen on 0\.0\.0\.0/,
    )
  })

  it('serves devices, models (with download progress on the event stream) and diagnostics', async () => {
    const d = await startDaemon()
    try {
      const c = d.client
      expect((await c.call('listDevices')).devices.map((x) => x.kind).sort()).toEqual(['sink', 'source'])
      const models = (await c.call('listModels')).models
      const missing = models.find((m) => m.state === 'missing')!
      const progress: number[] = []
      const ac = new AbortController()
      const sub = c.subscribe({
        signal: ac.signal,
        onEvent: (e) => {
          if (e.data.type === 'model.progress' && e.data.model.id === missing.id)
            progress.push(e.data.model.progress ?? -1)
        },
      })
      await new Promise((r) => setTimeout(r, 100))
      expect((await c.call('downloadModel', { params: { id: missing.id } })).state).toBe('downloading')
      await expect(c.call('downloadModel', { params: { id: 'no-such-model' } })).rejects.toMatchObject({
        status: 404,
      })
      for (let i = 0; i < 100 && progress.at(-1) !== 1; i++) await new Promise((r) => setTimeout(r, 20))
      ac.abort()
      await sub
      expect(progress.at(-1)).toBe(1)
      expect([...progress].sort()).toEqual(progress)
      expect((await c.call('listModels')).models.find((m) => m.id === missing.id)?.state).toBe('ready')

      const diag = await c.call('diagnostics')
      expect(diag.health.ok).toBe(true)
      expect(diag.logTail.some((l) => l.includes('"msg":"listening"'))).toBe(true)
      for (const l of diag.logTail) expect(() => JSON.parse(l)).not.toThrow()
    } finally {
      await d.stop()
    }
  })
})
