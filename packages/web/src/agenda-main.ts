import { createClient, GnomeolaApiError, PARTICIPANT_HEADER, type SharedAgendaPage } from '@gnomeola/protocol'
import {
  agendaData,
  occurrenceOf,
  PROMO,
  participantKey,
  renderAgenda,
  renderContribute,
  renderGone,
  shareTokenOf,
  verifyFromHash,
} from './agenda.ts'

// The shared agenda page in the browser (`/a/<token>`): fetch, render, refresh every 20 s and after
// every action, and the invitee flow — email → code (or the magic link's #verify=…) → add an item or a
// comment. The participant token lives in localStorage, per link.

const main = document.querySelector<HTMLElement>('#agenda')!
const side = document.querySelector<HTMLElement>('#contribute')!
const foot = document.querySelector<HTMLElement>('#promo')!
const token = shareTokenOf(location.pathname)

const storage = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string | null): void {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {}
  },
}

let participant = token ? storage.get(participantKey(token)) : null
let page: SharedAgendaPage | null = null
let step: { step: 'email' | 'code' | 'ready'; email?: string; message?: string | null } = { step: 'email' }

const client = () =>
  createClient({
    baseUrl: location.origin,
    timeoutMs: 20_000,
    ...(participant ? { headers: { [PARTICIPANT_HEADER]: participant } } : {}),
  })
const data = () => agendaData(client(), token!)

function draw(): void {
  if (!page) return
  document.title = `${page.occurrence.title} · shared agenda`
  const canContribute = step.step === 'ready' && page.contributions
  main.innerHTML = renderAgenda(page, { canContribute })
  side.innerHTML = renderContribute(page, step)
  foot.innerHTML = PROMO
  wire()
}

async function load(): Promise<void> {
  try {
    page = await data().page(occurrenceOf(location.search))
    if (participant && !page.you) {
      // the token no longer counts (removed by the organiser, or the share was re-made)
      participant = null
      storage.set(participantKey(token!), null)
      page = await data().page(occurrenceOf(location.search))
    }
    if (page.you && step.step !== 'ready') step = { step: 'ready', email: page.you.email }
    draw()
  } catch (err) {
    if (err instanceof GnomeolaApiError && (err.status === 404 || err.status === 410)) {
      main.innerHTML = renderGone(err.status)
      side.innerHTML = ''
      foot.innerHTML = PROMO
      return
    }
    main.innerHTML = `<p class="error" role="alert">Could not load the agenda: ${(err as Error).message.replace(/[<>&]/g, '')}</p>`
  }
}

const value = (f: HTMLFormElement, name: string) =>
  ((f.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '').trim()

function failure(err: unknown): string {
  if (err instanceof GnomeolaApiError) {
    if (err.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

async function confirm(email: string, code: string): Promise<void> {
  try {
    const r = await data().confirm(email, code)
    participant = r.token
    storage.set(participantKey(token!), r.token)
    step = { step: 'ready', email, message: 'Your email is confirmed. You can add items and comments.' }
  } catch (err) {
    step = { step: 'code', email, message: failure(err) }
  }
  await load()
}

function on(sel: string, fn: (f: HTMLFormElement) => Promise<void>): void {
  const f = side.querySelector<HTMLFormElement>(sel) ?? main.querySelector<HTMLFormElement>(sel)
  f?.addEventListener('submit', (e) => {
    e.preventDefault()
    const button = f.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (button) button.disabled = true
    void fn(f).finally(() => {
      if (button) button.disabled = false
    })
  })
}

function wire(): void {
  on('#email-form', async (f) => {
    const email = value(f, 'email')
    const name = value(f, 'name')
    try {
      await data().verify(email, name || undefined)
      step = { step: 'code', email, message: null }
    } catch (err) {
      step = { step: 'email', message: failure(err) }
    }
    draw()
    side.querySelector<HTMLInputElement>('#code')?.focus()
  })
  on('#code-form', (f) => confirm(step.email ?? '', value(f, 'code')))
  side.querySelector('#restart')?.addEventListener('click', () => {
    step = { step: 'email' }
    draw()
  })
  on('#add-item', async (f) => {
    const kind =
      (f.querySelector('input[name="kind"]:checked') as HTMLInputElement | null)?.value === 'question'
        ? 'question'
        : 'topic'
    try {
      await data().addItem(value(f, 'text'), kind)
      step = { ...step, message: 'Added. The organizer sees it in their agenda.' }
    } catch (err) {
      step = { ...step, message: failure(err) }
    }
    await load()
  })
  on('#add-comment', async (f) => {
    try {
      await data().addComment(value(f, 'text'), null)
      step = { ...step, message: 'Comment posted.' }
    } catch (err) {
      step = { ...step, message: failure(err) }
    }
    await load()
  })
  for (const f of main.querySelectorAll<HTMLFormElement>('form.comment-form'))
    f.addEventListener('submit', (e) => {
      e.preventDefault()
      void data()
        .addComment(value(f, 'text'), f.dataset.item ?? null)
        .then(
          () => {
            step = { ...step, message: 'Comment posted.' }
          },
          (err) => {
            step = { ...step, message: failure(err) }
          },
        )
        .then(load)
    })
}

if (!token) {
  main.innerHTML = renderGone(404)
} else {
  const magic = verifyFromHash(location.hash)
  if (magic) {
    history.replaceState(null, '', location.pathname + location.search)
    void confirm(magic.email, magic.code)
  } else void load()
  setInterval(() => {
    // never re-render under someone typing
    const active = document.activeElement
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
      (active as HTMLInputElement).value
    )
      return
    void load()
  }, 20_000)
}
