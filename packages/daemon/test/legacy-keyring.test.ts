import { describe, expect, it } from 'vitest'
import type { KeyAccount, Keyring } from '../src/interfaces.ts'
import { LegacyMigratingKeyring, MemoryKeyring } from '../src/keyring.ts'

// Keys stored under the gnomeola service before the rename (src/keyring.ts LegacyMigratingKeyring) are
// re-stored under kacola's on first read; the old entry is removed only once the new one reads back.

class BrokenWrites implements Keyring {
  readonly inner = new MemoryKeyring()
  get(a?: KeyAccount) {
    return this.inner.get(a)
  }
  async set(): Promise<void> {
    throw new Error('keyring store failed')
  }
  clear(a?: KeyAccount) {
    return this.inner.clear(a)
  }
}

describe('keys from the gnomeola keyring entry', () => {
  it('move to the kacola entry on first read, and the old entry goes once the new one reads back', async () => {
    const current = new MemoryKeyring()
    const legacy = new MemoryKeyring('sk-ant-old', { openai: 'sk-openai-old' })
    const log: string[] = []
    const k = new LegacyMigratingKeyring(current, legacy, (m) => log.push(m))
    expect(await k.get('anthropic')).toBe('sk-ant-old')
    expect(await current.get('anthropic')).toBe('sk-ant-old')
    expect(await legacy.get('anthropic')).toBeNull()
    // the other account is untouched until it is read
    expect(await legacy.get('openai')).toBe('sk-openai-old')
    expect(await k.get('openai')).toBe('sk-openai-old')
    expect(await legacy.get('openai')).toBeNull()
    expect(await k.get('typesafe')).toBeNull()
    expect(log).toHaveLength(2)
  })

  it('keeps the old entry when the new one cannot be written, and still answers with the key', async () => {
    const current = new BrokenWrites()
    const legacy = new MemoryKeyring('sk-ant-old')
    const log: string[] = []
    const k = new LegacyMigratingKeyring(current, legacy, (m) => log.push(m))
    expect(await k.get()).toBe('sk-ant-old')
    expect(await legacy.get()).toBe('sk-ant-old')
    expect(log.join()).toMatch(/could not move/)
  })

  it('a kacola key wins, and clearing clears both so the old key never comes back', async () => {
    const current = new MemoryKeyring('sk-new')
    const legacy = new MemoryKeyring('sk-old')
    const k = new LegacyMigratingKeyring(current, legacy)
    expect(await k.get()).toBe('sk-new')
    expect(await legacy.get()).toBe('sk-old')
    await k.clear()
    expect(await k.get()).toBeNull()
    expect(await legacy.get()).toBeNull()
    await k.set('sk-set')
    expect(await current.get()).toBe('sk-set')
  })
})
