import { describe, expect, it } from 'vitest'
import { buildPath, matchPath, type RouteDef, routes } from '../src/routes.ts'

// T1 contract: the route table itself is well-formed. Handlers and the client both derive from it, so
// a malformed entry would break both in the same way — this catches it before either does.
describe('route table', () => {
  const entries = Object.entries(routes) as [string, RouteDef][]

  it('has no two routes with the same method + path', () => {
    const keys = entries.map(([, d]) => `${d.method} ${d.path}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('only puts bodies on methods that carry one', () => {
    for (const [name, d] of entries) if (d.body) expect(['POST', 'PATCH', 'PUT'], name).toContain(d.method)
  })

  it('round-trips every path through buildPath and matchPath', () => {
    for (const [name, d] of entries) {
      const names = [...d.path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]!)
      const params = Object.fromEntries(names.map((n) => [n, `ses_x/${n} ü`]))
      const built = buildPath(d.path, params)
      expect(matchPath(d.path, built), name).toEqual(params)
    }
  })

  it('does not let one template match another route', () => {
    expect(matchPath('/sessions/:id', '/sessions/abc/start')).toBeNull()
    expect(matchPath('/sessions/:id/start', '/sessions/abc/stop')).toBeNull()
  })

  it('refuses to build a path with a missing param', () => {
    expect(() => buildPath('/sessions/:id', {})).toThrow(/missing path param/)
  })

  it('parses query strings as they arrive on the wire (strings) into typed values', () => {
    const q = routes.getTranscript.query.parse({ fromMs: '1000', toMs: '5000', includePrivate: 'false' })
    expect(q).toEqual({ fromMs: 1000, toMs: 5000, includePrivate: false, quality: 'best' })
    expect(routes.search.query.parse({ q: 'x' }).limit).toBe(20)
    expect(() => routes.search.query.parse({ q: 'x', limit: '1000' })).toThrow()
    expect(routes.events.query.parse({}).ephemeral).toBe(true)
  })
})
