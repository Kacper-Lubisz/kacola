import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ATLAS } from '../packages/testkit/src/atlas/manifest.ts'
import { checkInventory, parseStories } from './build-atlas.ts'

// The story inventory (docs/user-stories.md) and the atlas manifest must agree: every chart node and
// listed state is a manifest entry, every manifest entry belongs to a story, ids are unique.

const md = readFileSync(join(import.meta.dirname, '..', 'docs', 'user-stories.md'), 'utf8')

describe('the user-story inventory and the atlas manifest', () => {
  const inv = parseStories(md)

  it('agree', () => {
    expect(checkInventory(inv)).toEqual([])
  })

  it('parses every story with a status, a chart and linked screens, plus the overview map', () => {
    expect(inv.stories.length).toBeGreaterThan(30)
    expect(inv.overview).toMatch(/^flowchart/)
    expect(Object.keys(inv.overviewShots).length).toBeGreaterThan(5)
    for (const s of inv.stories) {
      expect(s.fields.Status, s.id).toMatch(/^(built|planned)/)
      expect(s.chart, s.id).toMatch(/^flowchart/)
    }
    const std = inv.stories.find((s) => s.id === 'record-now')!
    expect(std.group).toBe('Start a recording')
    expect(std.shots.C).toBe('record-now__recording__live-transcript')
  })

  it('names every file <story>__<step>__<state>, and planned states only for planned or partly planned stories', () => {
    for (const e of ATLAS) expect(e.id).toBe(`${e.story}__${e.step}__${e.state}`)
    const built = new Set(
      inv.stories.filter((s) => /^built\b(?!.*planned)/.test(s.fields.Status!)).map((s) => s.id),
    )
    expect(ATLAS.filter((e) => e.status === 'planned' && built.has(e.story)).map((e) => e.id)).toEqual([])
  })

  it('reports a chart node linked to an unknown state', () => {
    const bad = parseStories(
      '## G\n\n### x — X\n- **Status:** built\n\n```mermaid\nflowchart LR\n  A --> B\n  %% shot: B = x__y__z\n```\n',
    )
    expect(checkInventory(bad, [])).toEqual([
      'x: chart node B links to x__y__z, which is not in the manifest',
    ])
  })
})
