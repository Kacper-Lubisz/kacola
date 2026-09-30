import { describe, expect, it } from 'vitest'
import { BOOKKEEPING_TABLES, migrations } from '../../src/migrations.ts'
import { pgMigrations } from '../../src/pg/migrations.ts'
import { parseQuery, searchText, snippet, toTsQuery } from '../../src/search-text.ts'

// H-1 migration parity: every SQLite migration has a Postgres twin with the same version and name, so a
// database of either dialect at version N has the same logical schema. A new SQLite migration without a
// twin fails here (add one to src/pg/migrations.ts — an empty `up` if the change is SQLite-only).
describe('migration parity', () => {
  it('Postgres and SQLite migrations have identical versions and names', () => {
    expect(pgMigrations.map((m) => [m.version, m.name])).toEqual(migrations.map((m) => [m.version, m.name]))
  })

  it('every bookkeeping table exists in both schemas', () => {
    for (const t of BOOKKEEPING_TABLES) {
      expect(
        migrations.some((m) => m.up.includes(`CREATE TABLE ${t} (`)),
        t,
      ).toBe(true)
      expect(
        pgMigrations.some((m) => m.up.includes(`CREATE TABLE ${t} (`)),
        t,
      ).toBe(true)
    }
  })
})

describe('FTS5 → Postgres text mapping', () => {
  it('normalises exactly like unicode61 remove_diacritics: fold case and marks, split on non-alphanumerics', () => {
    expect(searchText('Le Café était naïve — on-call, v2.0!')).toBe('le cafe etait naive on call v2 0')
    expect(searchText('ÜNÏCÖDÉ œuvre')).toBe('unicode œuvre')
    expect(searchText('...')).toBe('')
  })

  it('builds tsqueries with the same two affordances as toFtsQuery, and nothing else', () => {
    expect(toTsQuery('retry budget')).toBe("'retry' & 'budget'")
    expect(toTsQuery('"retry budget" dash*')).toBe("('retry' <-> 'budget') & 'dash':*")
    expect(toTsQuery('on-call')).toBe("'on' & 'call'")
    expect(toTsQuery('Café')).toBe("'cafe'")
    expect(toTsQuery("o'brien & !x | y:*")).toBe("'o' & 'brien' & 'x' & 'y':*")
    expect(toTsQuery('  ')).toBeNull()
    expect(toTsQuery('***')).toBeNull()
    expect(toTsQuery('"unterminated phrase')).toBe("('unterminated' <-> 'phrase')")
  })

  it('snippets mark matches in the original text and cut with an ellipsis', () => {
    const q = parseQuery('cafe dash*')
    expect(snippet('Le café était naïve', q)).toBe('Le [café] était naïve')
    const long = `${'word '.repeat(30)}dashboard ${'tail '.repeat(30)}`.trim()
    const s = snippet(long, q)
    expect(s).toMatch(/^….*\[dashboard].*…$/)
    expect(s.split(/\s+/).length).toBeLessThanOrEqual(17)
    expect(snippet('no match here', q)).toBe('no match here')
  })
})
