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
  idle: 'Not started',
  recording: 'Recording',
  paused: 'Paused',
  stopped: '',
  recovered: 'Recovered',
  failed: 'Failed',
}

/** Inline markdown on already-escaped text: **bold**, *italic*, `code`. */
function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
}

/**
 * The notes' markdown as reading HTML: headings, bullet and numbered lists, task boxes, paragraphs. A
 * small subset on purpose (what Enhance and the editor write); every line is escaped before any tag is
 * added, so nothing in the notes can become markup.
 */
export function renderMarkdown(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let para: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.join(' ')}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (!line.trim()) {
      flushPara()
      closeList()
    } else if (h) {
      flushPara()
      closeList()
      const level = Math.min(h[1]!.length + 2, 4)
      out.push(`<h${level}>${inline(esc(h[2]!))}</h${level}>`)
    } else if (task || bullet || num) {
      flushPara()
      const kind = num && !bullet ? 'ol' : 'ul'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      if (task) {
        const done = task[1] !== ' '
        out.push(
          `<li class="task${done ? ' done' : ''}"><span class="box" role="img" aria-label="${done ? 'Done' : 'To do'}"></span><span>${inline(esc(task[2]!))}</span></li>`,
        )
      } else out.push(`<li>${inline(esc((bullet ?? num)![1]!))}</li>`)
    } else {
      closeList()
      para.push(inline(esc(line.trim())))
    }
  }
  flushPara()
  closeList()
  return out.join('')
}

/** The microphone side is the person reading: "Me", as in the app. */
const speakerName = (g: Pick<Segment, 'track' | 'speaker'>) =>
  g.track === 'mic' && g.speaker.toLowerCase() === 'me' ? 'Me' : g.speaker

export function renderSessions(sessions: Session[]): string {
  if (!sessions.length)
    return '<p class="empty">No meetings here yet. They appear once one of your computers syncs them.</p>'
  const rows = sessions.map((s) => {
    const badge = statusLabel[s.status]
      ? ` <span class="badge badge-${s.status}">${statusLabel[s.status]}</span>`
      : ''
    return `<li><a href="${hrefFor({ view: 'session', id: s.id })}"><span class="title">${esc(s.title)}${badge}</span><span class="meta">${when(s.createdAt)} · ${formatOffset(s.durationMs)}</span></a></li>`
  })
  return `<h1 class="page-title">Meetings</h1><ul class="sessions" aria-label="Meetings">${rows.join('')}</ul>`
}

function segmentRow(g: Segment): string {
  return `<li class="seg seg-${g.track}${g.quality === 'live' ? ' seg-live' : ''}" id="${esc(g.id)}"><span class="t">${formatOffset(g.startMs)}</span><span class="who">${esc(speakerName(g))}</span><span class="text">${esc(g.text)}</span></li>`
}

export function renderSession(v: SessionView): string {
  const { session: s, segments } = v.transcript
  const notes = v.notes
    ? `<section class="notes" aria-labelledby="notes-h"><h2 id="notes-h">Notes</h2><div class="prose">${renderMarkdown(v.notes.markdown)}</div></section>`
    : ''
  const body = segments.length
    ? `<section aria-labelledby="transcript-h"><h2 id="transcript-h">Transcript</h2><ol class="transcript" aria-label="Transcript">${segments.map(segmentRow).join('')}</ol></section>`
    : '<p class="empty">No transcript yet.</p>'
  return `<article><p class="back"><a href="${hrefFor({ view: 'sessions' })}">All meetings</a></p><h1>${esc(s.title)}</h1><p class="meta">${when(s.createdAt)} · ${formatOffset(s.durationMs)}</p>${notes}${body}</article>`
}

export function renderSearch(q: string, r: SearchResult): string {
  if (!r.hits.length) return `<p class="empty">Nothing matches “${esc(q)}”.</p>`
  const hits = r.hits.map(
    (h) =>
      `<li><a href="${hrefFor({ view: 'session', id: h.sessionId })}"><span class="title">${esc(h.sessionTitle)}</span><span class="meta">${formatOffset(h.startMs)} · ${esc(h.speaker)}</span><span class="snippet">${markSnippet(h.snippet)}</span></a></li>`,
  )
  return `<p class="count">${r.total} match${r.total === 1 ? '' : 'es'}</p><ul class="hits" aria-label="Search results">${hits.join('')}</ul>`
}

export function renderPairing(
  state: { userCode: string; expiresAt: string } | { error: string } | null,
): string {
  if (state === null) return '<p class="meta">Getting a code…</p>'
  if ('error' in state) return `<p class="error">${esc(state.error)}</p>`
  return `<div class="pairing"><h1>Sign in to your meetings</h1><p>Approve this code from kacola on a computer that is already signed in:</p><p class="code" aria-label="Pairing code">${esc(state.userCode)}</p><p class="hint">Or run this in a terminal there:</p><pre>gnomeola pair approve ${esc(state.userCode)}</pre><p class="meta">Waiting for approval. The code works until ${when(state.expiresAt)} UTC.</p></div>`
}

/** Token storage in the browser: localStorage, under one key. */
export const TOKEN_KEY = 'gnomeola.token'
