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

describe('route schemas — the bounds are the contract', () => {
  it('bounds titles, questions and queries', () => {
    expect(routes.createSession.body.safeParse({ title: 'x'.repeat(200) }).success).toBe(true)
    expect(routes.createSession.body.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
    expect(routes.createSession.body.parse({})).toEqual({})
    expect(routes.updateSession.body.safeParse({ title: '' }).success).toBe(false)
    expect(routes.updateSession.body.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
    expect(routes.updateSession.body.safeParse({ private: true }).success).toBe(true)
    expect(routes.ask.body.safeParse({ question: '' }).success).toBe(false)
    expect(routes.ask.body.safeParse({ question: 'x'.repeat(4000) }).success).toBe(true)
    expect(routes.ask.body.safeParse({ question: 'x'.repeat(4001) }).success).toBe(false)
    expect(routes.search.query.safeParse({ q: '' }).success).toBe(false)
    expect(routes.search.query.safeParse({ q: 'x'.repeat(500) }).success).toBe(true)
    expect(routes.search.query.safeParse({ q: 'x'.repeat(501) }).success).toBe(false)
    expect(routes.search.query.safeParse({ q: 'x', limit: '0' }).success).toBe(false)
    expect(routes.listSessions.query.parse({}).limit).toBe(50)
    expect(routes.listSessions.query.parse({ limit: '500' }).limit).toBe(500)
  })
  it('defaults ask effort to low and constrains it', () => {
    expect(routes.ask.body.parse({ question: 'q' }).effort).toBe('low')
    for (const e of ['low', 'medium', 'high'])
      expect(routes.ask.body.parse({ question: 'q', effort: e }).effort).toBe(e)
    expect(routes.ask.body.safeParse({ question: 'q', effort: 'max' }).success).toBe(false)
  })
  it('transcript quality defaults to best and accepts only known values', () => {
    for (const q of ['live', 'final', 'best'])
      expect(routes.getTranscript.query.parse({ quality: q }).quality).toBe(q)
    expect(routes.getTranscript.query.safeParse({ quality: 'good' }).success).toBe(false)
  })
})

describe('refreshCalendar: re-read the calendars now', () => {
  const status = {
    state: 'ok',
    provider: 'eds',
    detail: null,
    calendars: [{ id: 'work', name: 'Work' }],
    updatedAt: '2026-10-01T09:00:00.000Z',
  }
  it('is a body-less POST at /calendar/refresh', () => {
    expect(routes.refreshCalendar.method).toBe('POST')
    expect(routes.refreshCalendar.path).toBe('/calendar/refresh')
    expect('body' in routes.refreshCalendar).toBe(false)
  })
  it('answers the status, the occurrence count and whether a new snapshot came', () => {
    const ok = { calendar: status, occurrences: 12, refreshed: true }
    expect(routes.refreshCalendar.response.parse(ok)).toEqual(ok)
    expect(routes.refreshCalendar.response.safeParse({ ...ok, occurrences: -1 }).success).toBe(false)
    expect(routes.refreshCalendar.response.safeParse({ calendar: status, occurrences: 1 }).success).toBe(
      false,
    )
  })
  it('names calendars that could not be brought up to date, and why (optional for older daemons)', () => {
    const offline = [
      { id: 'g1', name: 'Team', reason: 'sign-in' },
      { id: 'g2', name: 'Holidays', reason: 'offline' },
      { id: 'c3', name: 'CalDAV', reason: 'failed' },
    ]
    expect(routes.calendarStatus.response.parse({ ...status, offline }).offline).toEqual(offline)
    expect(routes.calendarStatus.response.parse(status).offline).toBeUndefined()
    const bad = { ...status, offline: [{ id: 'x', name: 'X', reason: 'gone' }] }
    expect(routes.calendarStatus.response.safeParse(bad).success).toBe(false)
  })
})
