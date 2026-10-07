import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { EXIT } from '../src/errors.ts'
import { BUDGET } from '../src/tokens.ts'
import { type FakeDaemon, IDS, seed, startFakeDaemon } from './fake-daemon.ts'
import { cli } from './helpers.ts'

// N-5 — `kacola notes`: the notes head, action items, the version list, one old version. Read-only,
// private sessions invisible, capped like a transcript window.

let d: FakeDaemon
beforeAll(async () => {
  d = await startFakeDaemon()
})
beforeEach(() => {
  Object.assign(d.state, seed())
})
afterAll(async () => {
  // the notes verb never asks for private sessions and never writes
  expect(d.requests.filter((r) => 'includePrivate' in r.query)).toEqual([])
  expect(d.requests.filter((r) => r.method !== 'GET')).toEqual([])
  await d.close()
})

const brief = { id: IDS.standup, title: 'Platform standup', status: 'stopped' }

describe('kacola notes', () => {
  it('prints the head as JSON: session, version, markdown, and whether an enhancement awaits review', async () => {
    const r = await cli(['notes', IDS.standup], { url: d.url })
    expect(r.code).toBe(EXIT.OK)
    const j = r.json()
    expect(j.session).toMatchObject(brief)
    expect(j).toMatchObject({ version: 2, pendingEnhancement: 3 })
    expect(j.markdown).toMatch(/^## Decisions/)
    expect(Object.keys(j)).toEqual(['session', 'version', 'updatedAt', 'markdown', 'pendingEnhancement'])
  })

  it('prints the markdown as-is on a terminal, and says so when there are no notes', async () => {
    const r = await cli(['notes', IDS.standup], { url: d.url, tty: true })
    expect(r.stdout).toBe(d.state.notes[1]!.markdown)
    const none = await cli(['notes', IDS.retro], { url: d.url, tty: true })
    expect(none.code).toBe(EXIT.OK)
    expect(none.stdout).toBe('no notes for Sprint retro\n')
    const j = (await cli(['notes', IDS.retro], { url: d.url })).json()
    expect(j).toMatchObject({ version: 0, markdown: '', updatedAt: null, pendingEnhancement: null })
  })

  it('--actions: structured items with owner, due and done', async () => {
    const j = (await cli(['notes', IDS.standup, '--actions'], { url: d.url })).json()
    expect(j).toEqual({
      session: expect.objectContaining(brief),
      version: 2,
      actionItems: [
        { text: 'Update the dashboard', owner: 'Ana', due: 'Thursday', done: false },
        { text: 'Confirm the retry budget', owner: 'me', due: null, done: true },
      ],
    })
    const t = await cli(['notes', IDS.standup, '--actions'], { url: d.url, tty: true })
    expect(t.stdout).toContain('- [ ] Update the dashboard (owner: Ana, due: Thursday)\n')
    expect(t.stdout).toContain('- [x] Confirm the retry budget (owner: me)\n')
  })

  it('--versions: metadata only, never the markdown', async () => {
    const r = await cli(['notes', IDS.standup, '--versions'], { url: d.url })
    const j = r.json()
    expect(j.versions.map((v: { version: number; kind: string }) => [v.version, v.kind])).toEqual([
      [1, 'user'],
      [2, 'merge'],
      [3, 'enhanced'],
    ])
    expect(j.versions[0]).toEqual({
      version: 1,
      kind: 'user',
      createdAt: expect.any(String),
      baseVersion: 0,
      chars: 32,
    })
    expect(r.stdout).not.toContain('retry budget')
  })

  it('--version N: one old version, e.g. the user’s original words', async () => {
    const j = (await cli(['notes', IDS.standup, '--version', '1'], { url: d.url })).json()
    expect(j).toMatchObject({ version: 1, markdown: '- retry budget?\n- Ana dashboard\n' })
    expect('pendingEnhancement' in j).toBe(false)
    const missing = await cli(['notes', IDS.standup, '--version', '9'], { url: d.url })
    expect(missing.code).toBe(EXIT.NOT_FOUND)
    expect(missing.stderr).toMatch(/no version 9/)
    expect((await cli(['notes', IDS.standup, '--version', 'x'], { url: d.url })).code).toBe(EXIT.USAGE)
    expect((await cli(['notes', IDS.standup, '--version', '1', '--actions'], { url: d.url })).code).toBe(
      EXIT.USAGE,
    )
  })

  it('keeps private sessions invisible, whatever the flag', async () => {
    for (const extra of [[], ['--actions'], ['--versions'], ['--version', '1']]) {
      const r = await cli(['notes', IDS.private, ...extra], { url: d.url })
      expect(r.code, extra.join(' ')).toBe(EXIT.NOT_FOUND)
      expect(r.stdout).toBe('')
    }
  })

  it('refuses notes over the token ceiling unless --full', async () => {
    d.state.notes.push({
      ...d.state.notes[1]!,
      version: 4,
      kind: 'user',
      markdown: `${'- a long line of notes about capacity and hiring plans\n'.repeat(900)}`,
    })
    const r = await cli(['notes', IDS.standup], { url: d.url })
    expect(r.code).toBe(EXIT.REFUSED)
    expect(r.stderr).toMatch(new RegExp(`over the ${BUDGET.notes}-token ceiling`))
    expect(r.stdout).toBe('')
    expect((await cli(['notes', IDS.standup, '--full'], { url: d.url })).code).toBe(EXIT.OK)
    // action items stay available when the notes themselves are too long
    expect((await cli(['notes', IDS.standup, '--actions'], { url: d.url })).code).toBe(EXIT.OK)
  })

  it('accepts id prefixes and latest, and needs an id', async () => {
    expect((await cli(['notes', '000000001'], { url: d.url })).json().session.id).toBe(IDS.standup)
    expect((await cli(['notes'], { url: d.url })).code).toBe(EXIT.USAGE)
  })
})
