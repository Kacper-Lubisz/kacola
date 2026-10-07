import { createClient, isDurable, KacolaApiError, type KacolaClient } from '@kacola/protocol'
import {
  esc,
  hrefFor,
  parseRoute,
  renderPairing,
  renderSearch,
  renderSession,
  renderSessions,
  TOKEN_KEY,
  viewerData,
} from './data.ts'

// The viewer in the browser: a hash router over ./data.ts, a pairing screen for a browser without a
// token (the same device-code flow as `kacola pair`), and live refresh from the resumable event
// stream (it reconnects with its cursor whenever the host's function cap ends a stream).

// The protocol client reads streams with `for await`; browsers without async-iterable ReadableStream
// (older Safari) get the few lines it needs.
const rsProto = ReadableStream.prototype as unknown as Record<symbol, unknown>
if (!rsProto[Symbol.asyncIterator]) {
  rsProto[Symbol.asyncIterator] = async function* (this: ReadableStream<Uint8Array>) {
    const reader = this.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
}

const main = document.querySelector<HTMLElement>('#app')!
const status = document.querySelector<HTMLElement>('#status')!
const searchForm = document.querySelector<HTMLFormElement>('#search')!
const signOut = document.querySelector<HTMLButtonElement>('#signout')!

const store = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {}
  },
}

let token = store.get()
let client: KacolaClient = makeClient()
let data = viewerData(client)
let navigation = new AbortController()
let live: AbortController | null = null

function makeClient(): KacolaClient {
  return createClient({ baseUrl: location.origin, timeoutMs: 20_000, ...(token ? { token } : {}) })
}

function setToken(t: string | null) {
  token = t
  store.set(t)
  client = makeClient()
  data = viewerData(client)
  signOut.hidden = !t
  startLive()
}

const show = (html: string) => {
  main.innerHTML = html
}

async function render(): Promise<void> {
  navigation.abort()
  navigation = new AbortController()
  const signal = navigation.signal
  const route = parseRoute(location.hash)
  try {
    if (route.view === 'pair' && route.code && token) return approve(route.code)
    if (!token || route.view === 'pair') return pairThisBrowser(signal)
    if (route.view === 'sessions') {
      show('<p class="meta">Loading your meetings…</p>')
      show(renderSessions(await data.sessions(signal)))
    } else if (route.view === 'session') {
      show(renderSession(await data.session(route.id, signal)))
    } else if (route.view === 'search') {
      ;(searchForm.elements.namedItem('q') as HTMLInputElement).value = route.q
      show(route.q ? renderSearch(route.q, await data.search(route.q, signal)) : '')
    }
  } catch (err) {
    if (signal.aborted) return
    if (err instanceof KacolaApiError && err.status === 401) {
      setToken(null)
      return render()
    }
    show(`<p class="error">${esc((err as Error).message)}</p>`)
  }
}

/** Device-code pairing for this browser: show a code, wait for a trusted device to approve it. */
async function pairThisBrowser(signal: AbortSignal): Promise<void> {
  show(renderPairing(null))
  const start = await client.call('pairStart', {
    body: { name: `Browser (${navigator.userAgent.slice(0, 60)})` },
  })
  show(
    `${renderPairing(start)}<details class="token"><summary>Have an access token instead?</summary><form id="paste"><input name="t" aria-label="Access token" autocomplete="off"><button>Use token</button></form></details>`,
  )
  document.querySelector<HTMLFormElement>('#paste')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const t = ((e.target as HTMLFormElement).elements.namedItem('t') as HTMLInputElement).value.trim()
    if (t) {
      setToken(t)
      location.hash = '#/'
      void render()
    }
  })
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, start.intervalMs))
    if (signal.aborted) return
    const r = await client.call('pairToken', { body: { deviceCode: start.deviceCode } }).catch(() => null)
    if (r === null) return show(renderPairing({ error: 'This code expired. Reload to get a new one.' }))
    if (r.status === 'approved') {
      setToken(r.token)
      if (parseRoute(location.hash).view === 'pair') location.hash = '#/'
      return render()
    }
  }
}

/** A signed-in browser approving someone else's code (the verification link `kacola pair` prints). */
function approve(code: string): void {
  show(
    `<div class="pairing"><h1>Approve a device</h1><p>Only approve it if this code is showing on your own screen:</p><p class="code">${esc(code)}</p><button id="approve">Approve</button></div>`,
  )
  document.querySelector('#approve')?.addEventListener('click', async () => {
    try {
      const r = await client.call('pairApprove', { body: { userCode: code } })
      show(
        `<p>Approved “${esc(r.name)}”.</p><p><a href="${hrefFor({ view: 'sessions' })}">Back to meetings</a></p>`,
      )
    } catch (err) {
      show(`<p class="error">${esc((err as Error).message)}</p>`)
    }
  })
}

/**
 * Re-render when the archive changes (debounced), following the event stream across reconnects. The
 * subscription starts from an explicit cursor (the server's lastSeq): with a cursor every reconnect —
 * and on a hosted server they are constant, the function cap ends each stream — resumes exactly, so a
 * change committed while the browser was between two streams is still seen.
 */
function startLive(): void {
  live?.abort()
  if (!token) return
  const ac = new AbortController()
  live = ac
  let timer: ReturnType<typeof setTimeout> | null = null
  void client
    .call('health', { signal: ac.signal })
    .then((h) => (ac.signal.aborted ? undefined : follow(h.lastSeq)))
    .catch(() => {
      if (!ac.signal.aborted) setTimeout(startLive, 2000)
    })
  const follow = (since: number) =>
    client.subscribe({
      since,
      signal: ac.signal,
      ephemeral: false,
      reconnectDelayMs: 250,
      onConnect: () => {
        status.textContent = 'live'
      },
      onDisconnect: () => {
        status.textContent = 'reconnecting…'
      },
      onEvent: (e) => {
        if (!isDurable(e)) return
        const route = parseRoute(location.hash)
        if (route.view === 'session' && e.sessionId !== route.id) return
        if (route.view === 'pair' || route.view === 'search') return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void render(), 300)
      },
    })
}

searchForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const q = (searchForm.elements.namedItem('q') as HTMLInputElement).value.trim()
  location.hash = hrefFor({ view: 'search', q })
})
signOut.addEventListener('click', () => {
  setToken(null)
  void render()
})
window.addEventListener('hashchange', () => void render())
signOut.hidden = !token
startLive()
void render()
