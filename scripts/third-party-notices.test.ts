import { describe, expect, it } from 'vitest'
import { licenceAllowed, render } from './third-party-notices.ts'

describe('licence allow-list', () => {
  it.each(['MIT', 'Apache-2.0', 'MPL-2.0', '(MIT OR GPL-2.0-only)', 'MIT AND ISC', 'BSD-3-Clause'])(
    'allows %s',
    (l) => expect(licenceAllowed(l)).toBe(true),
  )
  it.each([
    'GPL-2.0-only',
    'AGPL-3.0-only',
    'SSPL-1.0',
    'UNLICENSED',
    'Commercial',
    'MIT AND SSPL-1.0',
    'CC-BY-NC-4.0',
    '',
  ])('rejects %j', (l) => expect(licenceAllowed(l)).toBe(false))
})

describe('render', () => {
  it('lists packages and credits Granola without claiming affiliation', () => {
    const md = render([{ name: 'zod', versions: ['4.1.0'], license: 'MIT', homepage: 'https://zod.dev' }])
    expect(md).toContain('| zod | 4.1.0 | MIT | https://zod.dev |')
    expect(md).toMatch(/inspired by \[Granola\]/)
    expect(md).toMatch(/not affiliated with or endorsed by Granola/)
  })
})
