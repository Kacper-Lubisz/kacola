import { describe, expect, it } from 'vitest'

// The route table and its schemas are built when the module loads, so a malformed schema (say, a
// discriminated-union member without its discriminator) throws at import time. Importing inside a test
// turns that into a failing test rather than a file that never collects — which a test runner, and
// mutation testing, can mistake for a file with nothing to report.
describe('protocol module load', () => {
  it('builds every schema, and the ask stream still tells its four messages apart', async () => {
    const { AskStreamEvent, routes } = await import('../src/routes.ts')
    expect(Object.keys(routes).length).toBeGreaterThan(0)
    expect(AskStreamEvent.parse({ type: 'delta', text: 'hi' })).toEqual({ type: 'delta', text: 'hi' })
    expect(AskStreamEvent.options.map((o) => o.shape.type.value)).toEqual([
      'question',
      'delta',
      'answer',
      'error',
    ])
  })
})
