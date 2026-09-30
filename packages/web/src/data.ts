import {
  formatOffset,
  type GnomeolaClient,
  type Note,
  type SearchResult,
  type Segment,
  type Session,
  type Transcript,
} from '@gnomeola/protocol'

// H-9 — the read-only web viewer's data layer and views, kept free of the DOM so they are unit-tested in
// Node: routing, the calls it makes through the SAME typed protocol client every other front-end uses,
// and rendering to HTML strings. Everything user-controlled that reaches HTML goes through `esc`.
//
// The viewer is read-only on purpose: the hosted server is a replica (hybrid sync), and a browser is the
// least trusted place to hold write power over a meeting archive.

export type Route =
  | { view: 'sessions' }
  | { view: 'session'; id: string }
  | { view: 'search'; q: string }
  | { view: 'pair'; code: string | null }

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '')
  const [path = '', query = ''] = h.split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 's' && parts[1]) return { view: 'session', id: parts[1] }
  if (parts[0] === 'search') return { view: 'search', q: new URLSearchParams(query).get('q') ?? '' }
  if (parts[0] === 'pair') return { view: 'pair', code: parts[1] ?? null }
  return { view: 'sessions' }
}

export const hrefFor = (r: Route): string => {
  switch (r.view) {
    case 'sessions':
      return '#/'
    case 'session':
      return `#/s/${encodeURIComponent(r.id)}`
    case 'search':
      return `#/search?${new URLSearchParams({ q: r.q })}`
    case 'pair':
      return r.code ? `#/pair/${encodeURIComponent(r.code)}` : '#/pair'
  }
}

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Search snippets mark matches as [like this]: turn exactly those into <mark>, escaping everything else. */
export function markSnippet(snippet: string): string {
  return snippet
    .split(/(\[[^\]]*\])/g)
    .map((part) => (/^\[[^\]]*\]$/.test(part) ? `<mark>${esc(part.slice(1, -1))}</mark>` : esc(part)))
    .join('')
}

const when = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ')

// ----------------------------------------------------------------------------------- data

export type SessionView = { transcript: Transcript; notes: Note | null }

export function viewerData(client: GnomeolaClient) {
  return {
    async sessions(signal?: AbortSignal): Promise<Session[]> {
      return (await client.call('listSessions', { query: { limit: 200 }, signal })).sessions
    },
    async session(id: string, signal?: AbortSignal): Promise<SessionView> {
      const transcript = await client.call('getTranscript', { params: { id }, signal })
      // notes are optional on a server (and absent for most meetings): a failure is not the page's failure
      const notes = await client
        .call('getNotes', { params: { id }, signal })
        .then((n) => (n.note.version > 0 ? n.note : null))
        .catch(() => null)
      return { transcript, notes }
    },
    search(q: string, signal?: AbortSignal): Promise<SearchResult> {
      return client.call('search', { query: { q, limit: 50 }, signal })
    },
  }
}

// ---------------------------------------------------------------------------------- views

const statusLabel: Record<Session['status'], string> = {
  idle: 'not started',
  recording: 'recording',
  paused: 'paused',
  stopped: '',
  recovered: 'recovered',
  failed: 'failed',
}

export function renderSessions(sessions: Session[]): string {
  if (!sessions.length)
    return '<p class="empty">No meetings here yet. Sessions appear once a device syncs them.</p>'
  const rows = sessions.map((s) => {
    const badge = statusLabel[s.status]
      ? ` <span class="badge badge-${s.status}">${statusLabel[s.status]}</span>`
      : ''
    return `<li><a href="${hrefFor({ view: 'session', id: s.id })}"><span class="title">${esc(s.title)}</span>${badge}<span class="meta">${when(s.createdAt)} · ${formatOffset(s.durationMs)}</span></a></li>`
  })
  return `<ul class="sessions" aria-label="Meetings">${rows.join('')}</ul>`
}

function segmentRow(g: Segment): string {
  return `<li class="seg seg-${g.track}${g.quality === 'live' ? ' seg-live' : ''}" id="${esc(g.id)}"><span class="t">${formatOffset(g.startMs)}</span><span class="who">${esc(g.speaker)}</span><span class="text">${esc(g.text)}</span></li>`
}

export function renderSession(v: SessionView): string {
  const { session: s, segments, total } = v.transcript
  const notes = v.notes
    ? `<section class="notes" aria-label="Notes"><h2>Notes</h2><pre>${esc(v.notes.markdown)}</pre></section>`
    : ''
  const body = segments.length
    ? `<ol class="transcript" aria-label="Transcript">${segments.map(segmentRow).join('')}</ol>`
    : '<p class="empty">No transcript yet.</p>'
  return `<article><h1>${esc(s.title)}</h1><p class="meta">${when(s.createdAt)} · ${formatOffset(s.durationMs)} · ${total} segments</p>${notes}${body}</article>`
}

export function renderSearch(q: string, r: SearchResult): string {
  if (!r.hits.length) return `<p class="empty">Nothing matches “${esc(q)}”.</p>`
  const hits = r.hits.map(
    (h) =>
      `<li><a href="${hrefFor({ view: 'session', id: h.sessionId })}"><span class="title">${esc(h.sessionTitle)}</span><span class="meta">${formatOffset(h.startMs)} · ${esc(h.speaker)}</span><span class="snippet">${markSnippet(h.snippet)}</span></a></li>`,
  )
  return `<p class="meta">${r.total} match${r.total === 1 ? '' : 'es'}</p><ul class="hits" aria-label="Search results">${hits.join('')}</ul>`
}

export function renderPairing(
  state: { userCode: string; expiresAt: string } | { error: string } | null,
): string {
  if (state === null) return '<p>Starting pairing…</p>'
  if ('error' in state) return `<p class="error">${esc(state.error)}</p>`
  return `<div class="pairing"><p>Approve this browser from a device that is already paired:</p><p class="code" aria-label="Pairing code">${esc(state.userCode)}</p><pre>gnomeola pair approve ${esc(state.userCode)}</pre><p class="meta">Waiting… (expires ${when(state.expiresAt)} UTC)</p></div>`
}

/** Token storage in the browser: localStorage, under one key. */
export const TOKEN_KEY = 'gnomeola.token'
