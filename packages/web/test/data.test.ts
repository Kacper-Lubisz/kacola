import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Segment, type Session } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { buildViewer } from '../scripts/build.ts'
import {
  esc,
  hrefFor,
  markSnippet,
  parseRoute,
  renderMarkdown,
  renderPairing,
  renderSearch,
  renderSession,
  renderSessions,
  viewerData,
} from '../src/data.ts'

// H-9: the viewer's data layer and views, in Node. (The same viewer is driven in a real headless browser
// against the Vercel build in packages/vercel.)

const session = (over: Partial<Session> = {}): Session => ({
  id: 'ses_1',
  title: 'Standup',
  createdAt: '2026-09-01T09:00:00.000Z',
  startedAt: null,
  endedAt: null,
  status: 'stopped',
  private: false,
  durationMs: 65_000,
  tracks: [],
  error: null,
  ...over,
})
const seg = (over: Partial<Segment> = {}): Segment => ({
  id: 'seg_1',
  sessionId: 'ses_1',
  track: 'system',
  speaker: 'Ana',
  startMs: 61_000,
  endMs: 62_000,
  text: 'ship it',
  quality: 'final',
  revision: 1,
  confidence: null,
  ...over,
})

describe('routing', () => {
  it('parses and builds every route, round-trip', () => {
    for (const r of [
      { view: 'sessions' },
      { view: 'session', id: 'ses_a/b c' },
      { view: 'search', q: 'retry budget & "x"' },
      { view: 'pair', code: 'BCDF-GHJK' },
      { view: 'pair', code: null },
    ] as const)
      expect(parseRoute(hrefFor(r))).toEqual(r)
    expect(parseRoute('')).toEqual({ view: 'sessions' })
    expect(parseRoute('#/nonsense/x')).toEqual({ view: 'sessions' })
  })
})

describe('views escape everything user-controlled', () => {
  const evil = '<img src=x onerror=alert(1)>"&\''
  it('session list, transcript, notes, search, pairing', () => {
    const html = [
      renderSessions([session({ title: evil, status: 'recording' })]),
      renderSession({
        transcript: {
          session: session({ title: evil }),
          segments: [seg({ speaker: evil, text: evil, id: evil })],
          window: null,
          total: 1,
        },
        notes: { sessionId: 'ses_1', version: 1, markdown: evil, updatedAt: null, pendingEnhancement: null },
      }),
      renderSearch(evil, {
        total: 1,
        hits: [
          {
            sessionId: 'ses_1',
            sessionTitle: evil,
            segmentId: 'seg_1',
            speaker: evil,
            startMs: 0,
            endMs: 1,
            snippet: `before [${evil}] after <b>`,
            score: 1,
          },
        ],
      }),
      renderSearch(evil, { total: 0, hits: [] }),
      renderPairing({ userCode: evil, expiresAt: '2026-09-01T09:10:00.000Z' }),
      renderPairing({ error: evil }),
    ].join('\n')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&amp;&#39;')
  })

  it('renders the notes as reading text: headings, lists, task boxes; markup in them stays text', () => {
    const html = renderMarkdown(
      '## Decisions\n\n- Retry budget: **three** attempts\n- [ ] Own the dashboard\n- [x] Settle it\n\n1. first\n2. second\n\nA <b>line</b>',
    )
    expect(html).toBe(
      '<h4>Decisions</h4><ul><li>Retry budget: <strong>three</strong> attempts</li>' +
        '<li class="task"><span class="box" role="img" aria-label="To do"></span><span>Own the dashboard</span></li>' +
        '<li class="task done"><span class="box" role="img" aria-label="Done"></span><span>Settle it</span></li></ul>' +
        '<ol><li>first</li><li>second</li></ol><p>A &lt;b&gt;line&lt;/b&gt;</p>',
    )
  })

  it('marks search matches, and only them', () => {
    expect(markSnippet('the [retry] [budget] is <3')).toBe(
      'the <mark>retry</mark> <mark>budget</mark> is &lt;3',
    )
    expect(esc('a&b')).toBe('a&amp;b')
  })

  it('renders the list with durations, badges and links', () => {
    const html = renderSessions([session(), session({ id: 'ses_2', title: 'Live one', status: 'recording' })])
    expect(html).toContain('href="#/s/ses_1"')
    expect(html).toContain('1:05')
    expect(html).toContain('badge-recording')
    expect(renderSessions([])).toMatch(/No meetings/)
  })
})

describe('data layer, through the typed protocol client', () => {
  function fakeServer(routes: Record<string, unknown>) {
    const seen: string[] = []
    const f: typeof fetch = async (input, init) => {
      const url = new URL(String(input))
      seen.push(
        `${init?.method ?? 'GET'} ${url.pathname}${url.search} ${new Headers(init?.headers).get('authorization') ?? ''}`,
      )
      const body = routes[url.pathname]
      if (body === undefined)
        return new Response(JSON.stringify({ error: { code: 'not_found', message: 'nope' } }), {
          status: 404,
        })
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    }
    return { fetch: f, seen }
  }

  it('lists, opens a session with its notes, and searches — sending the token every time', async () => {
    const s = session()
    const srv = fakeServer({
      '/sessions': { sessions: [s] },
      '/sessions/ses_1/transcript': { session: s, segments: [seg()], window: null, total: 1 },
      '/sessions/ses_1/notes': {
        note: {
          sessionId: 'ses_1',
          version: 2,
          markdown: '# notes',
          updatedAt: null,
          pendingEnhancement: null,
        },
        enhanced: null,
      },
      '/search': { hits: [], total: 0 },
    })
    const d = viewerData(
      createClient({ baseUrl: 'https://viewer.test', token: 'gnm1.t.s', fetch: srv.fetch }),
    )
    expect(await d.sessions()).toEqual([s])
    const v = await d.session('ses_1')
    expect(v.notes?.markdown).toBe('# notes')
    expect(renderSession(v)).toContain('ship it')
    expect(await d.search('ship')).toEqual({ hits: [], total: 0 })
    expect(srv.seen).toEqual([
      'GET /sessions?limit=200 Bearer gnm1.t.s',
      'GET /sessions/ses_1/transcript Bearer gnm1.t.s',
      'GET /sessions/ses_1/notes Bearer gnm1.t.s',
      'GET /search?q=ship&limit=50 Bearer gnm1.t.s',
    ])
  })

  it('a session without notes (or a server without the notes route) still opens', async () => {
    const s = session()
    const srv = fakeServer({
      '/sessions/ses_1/transcript': { session: s, segments: [], window: null, total: 0 },
    })
    const v = await viewerData(createClient({ baseUrl: 'https://viewer.test', fetch: srv.fetch })).session(
      'ses_1',
    )
    expect(v.notes).toBeNull()
    expect(renderSession(v)).toMatch(/No transcript yet/)
  })
})

describe('the static build', () => {
  it('bundles one browser module with no Node built-ins, plus the HTML shell', async () => {
    const out = mkdtempSync(join(tmpdir(), 'kacola-viewer-'))
    try {
      const { bytes } = await buildViewer(out)
      const js = readFileSync(join(out, 'app.js'), 'utf8')
      const html = readFileSync(join(out, 'index.html'), 'utf8')
      expect(bytes).toBeGreaterThan(10_000)
      expect(js).not.toMatch(/from\s*["']node:/)
      expect(js).not.toMatch(/require\(["']node:/)
      expect(html).toContain('<script type="module" src="/app.js"></script>')
      expect(html).toContain('id="app"')
      // light, dark and high contrast come from the brand tokens, which the viewer links
      expect(html).toContain('/brand/tokens.css')
      expect(readFileSync(join(out, 'brand', 'tokens.css'), 'utf8')).toContain('prefers-color-scheme: dark')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
