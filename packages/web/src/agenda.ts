import type {
  AgendaItemStatus,
  KacolaClient,
  PublicComment,
  PublicItem,
  SharedAgendaPage,
  ShareOccurrence,
} from '@kacola/protocol'

// L-19 — the shared agenda page (`https://<host>/a/<token>`): what an invitee without kacola sees.
// DOM-free so it is unit-tested in Node: routing, the calls it makes (the same typed protocol client),
// and rendering to HTML strings. Every user-controlled string goes through `esc`; nothing is rendered
// as markdown or HTML, so an item, a comment or a card cannot inject markup.
//
// It shows the agenda (items, statuses, who set them, the cards the organiser shared), and after the
// meeting the outcome of each item — only when the organiser shared the recap. With a verified email
// (a magic-link code) an invitee adds an item or a comment.

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** The link token from `/a/<token>`, or null (then this is not an agenda page). */
export function shareTokenOf(pathname: string): string | null {
  const m = /^\/a\/([A-Za-z0-9_-]{16,128})\/?$/.exec(pathname)
  return m ? m[1]! : null
}

/** A magic link: `#verify=<email>/<code>`. */
export function verifyFromHash(hash: string): { email: string; code: string } | null {
  const m = /^#verify=([^/]+)\/([A-Za-z-]{4,20})$/.exec(hash)
  if (!m) return null
  try {
    return { email: decodeURIComponent(m[1]!), code: m[2]! }
  } catch {
    return null
  }
}

/** `?o=<agendaId>`: a past occurrence (its recap). */
export const occurrenceOf = (search: string): string | null => new URLSearchParams(search).get('o')

/** Where an invitee's participant token is kept in this browser (per link). */
export const participantKey = (token: string): string => `kacola.share.${token.slice(0, 12)}`

// ----------------------------------------------------------------------------------- data

export function agendaData(client: KacolaClient, token: string) {
  return {
    page(occurrence: string | null, signal?: AbortSignal): Promise<SharedAgendaPage> {
      return client.call('getSharedPage', {
        params: { token },
        query: occurrence ? { occurrence } : {},
        signal,
      })
    },
    verify(email: string, name?: string) {
      return client.call('shareVerify', { params: { token }, body: { email, ...(name ? { name } : {}) } })
    },
    confirm(email: string, code: string) {
      return client.call('shareConfirm', { params: { token }, body: { email, code } })
    },
    addItem(text: string, kind: 'topic' | 'question') {
      return client.call('shareAddItem', { params: { token }, body: { text, kind } })
    },
    addComment(text: string, itemId: string | null) {
      return client.call('shareAddComment', { params: { token }, body: { text, itemId } })
    },
  }
}

// ---------------------------------------------------------------------------------- views

const STATUS: Record<AgendaItemStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  covered: 'Covered',
  skipped: 'Skipped',
  parked: 'Parked',
}
const KIND: Record<PublicItem['kind'], string | null> = {
  topic: null,
  question: 'Question',
  'must-cover': 'Must cover',
  decision: 'Decision',
  'info-to-get': 'To find out',
  competency: 'Competency',
}

export function when(o: Pick<ShareOccurrence, 'meeting'>, locale?: string): string | null {
  if (!o.meeting) return null
  const start = new Date(o.meeting.start)
  const date = start.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const time = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

function comment(c: PublicComment): string {
  return `<li class="comment${c.mine ? ' mine' : ''}"><span class="who">${esc(c.author)}</span> <span class="text">${esc(c.text)}</span></li>`
}

export type ViewState = {
  /** The page can take a contribution from this browser right now (verified). */
  canContribute: boolean
}

function itemRow(i: PublicItem, comments: PublicComment[], recap: boolean, st: ViewState): string {
  const kind = KIND[i.kind]
  const meta = [
    kind ? `<span class="tag">${esc(kind)}</span>` : '',
    i.owner ? `<span class="meta">${esc(i.owner)}</span>` : '',
    i.timeboxMin ? `<span class="meta">${i.timeboxMin} min</span>` : '',
    i.carriedOver ? '<span class="tag tag-quiet">Carried over</span>' : '',
    i.contributed ? `<span class="meta">Added by ${esc(i.addedBy)}</span>` : '',
  ]
    .filter(Boolean)
    .join('')
  const statusBy =
    i.status === 'open'
      ? ''
      : `<span class="meta status-by">${i.auto ? `Checked off by ${esc(i.changedBy)}` : `Set by ${esc(i.changedBy)}`}</span>`
  const outcome =
    recap && i.outcome
      ? `<div class="outcome"><h4>Outcome</h4><p>${esc(i.outcome).replace(/\n/g, '<br>')}</p></div>`
      : ''
  const thread = comments.length
    ? `<ul class="comments" aria-label="Comments">${comments.map(comment).join('')}</ul>`
    : ''
  const reply = st.canContribute
    ? `<details class="reply"><summary>Comment</summary><form class="comment-form" data-item="${esc(i.id)}"><label class="sr" for="c-${esc(i.id)}">Comment on “${esc(i.text)}”</label><textarea id="c-${esc(i.id)}" name="text" required maxlength="1000" rows="2"></textarea><button type="submit">Post</button></form></details>`
    : ''
  return `<li class="item status-${i.status}" data-id="${esc(i.id)}"><div class="item-head"><span class="status" data-status="${i.status}">${STATUS[i.status]}</span><span class="item-text">${esc(i.text)}</span></div><div class="item-meta">${meta}${statusBy}</div>${outcome}${thread}${reply}</li>`
}

export function renderAgenda(p: SharedAgendaPage, st: ViewState, locale?: string): string {
  const occ = p.occurrence
  const time = when(occ, locale)
  const isCurrent = occ.agendaId === p.current
  const recap = occ.recapShared
  const byItem = new Map<string | null, PublicComment[]>()
  for (const c of p.comments) byItem.set(c.itemId, [...(byItem.get(c.itemId) ?? []), c])
  const items = p.items.length
    ? `<ol class="items" aria-label="Agenda items">${p.items.map((i) => itemRow(i, byItem.get(i.id) ?? [], recap, st)).join('')}</ol>`
    : '<p class="empty">Nothing on the agenda yet.</p>'
  const goals = occ.goals.length
    ? `<section aria-labelledby="goals-h"><h2 id="goals-h">Goals</h2><ul class="goals">${occ.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>`
    : ''
  const cards = p.cards.length
    ? `<section aria-labelledby="ctx-h"><h2 id="ctx-h">Context</h2>${p.cards
        .map(
          (c) =>
            `<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.body).replace(/\n/g, '<br>')}</p>${
              c.sourceUrl && /^https?:\/\//.test(c.sourceUrl)
                ? `<p class="meta"><a href="${esc(c.sourceUrl)}" rel="noopener noreferrer nofollow">Source</a></p>`
                : ''
            }</article>`,
        )
        .join('')}</section>`
    : ''
  const general = byItem.get(null) ?? []
  const others = p.occurrences.filter((o) => o.agendaId !== occ.agendaId)
  const nav = others.length
    ? `<nav aria-label="Other meetings in this series"><h2 class="overline">In this series</h2><ul class="series">${others
        .map((o) => {
          const label = o.agendaId === p.current ? 'Next meeting' : (when(o, locale) ?? o.title)
          const href = o.agendaId === p.current ? '?' : `?o=${encodeURIComponent(o.agendaId)}`
          return `<li><a href="${href}">${esc(label)}</a>${o.recapShared ? ' <span class="tag tag-quiet">Recap</span>' : ''}</li>`
        })
        .join('')}</ul></nav>`
    : ''
  const recapNote = recap
    ? '<p class="note">The organizer shared what came of each item.</p>'
    : !isCurrent
      ? '<p class="note">The organizer has not shared a recap of this meeting.</p>'
      : ''
  return `<div class="page-head"><p class="overline">Shared agenda · ${esc(p.ownerName)}</p><h1>${esc(occ.title)}</h1>${time ? `<p class="when">${esc(time)}</p>` : ''}${recapNote}</div>${goals}<section aria-labelledby="items-h"><h2 id="items-h">${recap ? 'Agenda and outcomes' : 'Agenda'}</h2>${items}</section>${cards}${
    general.length
      ? `<section aria-labelledby="gc-h"><h2 id="gc-h">Comments</h2><ul class="comments">${general.map(comment).join('')}</ul></section>`
      : ''
  }${nav}`
}

/** The contribute panel: ask for a code → enter it → add items and comments. */
export function renderContribute(
  p: SharedAgendaPage,
  s: { step: 'email' | 'code' | 'ready'; email?: string; message?: string | null },
): string {
  if (!p.contributions) return ''
  const msg = s.message ? `<p class="feedback" role="status">${esc(s.message)}</p>` : ''
  if (s.step === 'ready')
    return `<section class="contribute" aria-labelledby="add-h"><h2 id="add-h">Add to the agenda</h2><p class="meta">As ${esc(p.you?.name ?? p.you?.email ?? s.email ?? '')}</p><form id="add-item"><label for="new-item">Item</label><input id="new-item" name="text" required maxlength="500" autocomplete="off"><fieldset class="kind"><legend class="sr">Kind</legend><label><input type="radio" name="kind" value="topic" checked> Topic</label><label><input type="radio" name="kind" value="question"> Question</label></fieldset><button type="submit">Add item</button></form><form id="add-comment"><label for="new-comment">Comment on the agenda</label><textarea id="new-comment" name="text" required maxlength="1000" rows="2"></textarea><button type="submit">Post comment</button></form>${msg}</section>`
  if (s.step === 'code')
    return `<section class="contribute" aria-labelledby="add-h"><h2 id="add-h">Check your email</h2><p>We sent a code to ${esc(s.email ?? '')}. It expires in 15 minutes.</p><form id="code-form"><label for="code">Code</label><input id="code" name="code" required autocomplete="one-time-code" inputmode="text" placeholder="ABCD-EFGH" maxlength="20"><button type="submit">Confirm</button></form><p><button type="button" id="restart" class="link">Use another address</button></p>${msg}</section>`
  return `<section class="contribute" aria-labelledby="add-h"><h2 id="add-h">Add an item or a comment</h2><p class="meta">Confirm your email first — we send a one-time code. The organizer sees your address.</p><form id="email-form"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email"><label for="name">Name <span class="meta">(optional, shown to others)</span></label><input id="name" name="name" maxlength="100" autocomplete="name"><button type="submit">Send code</button></form>${msg}</section>`
}

export function renderGone(status: number): string {
  if (status === 410)
    return '<div class="gone"><h1>This agenda is no longer shared</h1><p>The organizer stopped sharing it.</p></div>'
  return '<div class="gone"><h1>No agenda here</h1><p>This link does not lead to a shared agenda. Check that it was copied whole.</p></div>'
}

/** The quiet prompt at the foot of the page. */
export const PROMO =
  '<p>Made with <strong>kacola</strong>: meeting notes and agendas that stay on your own computer.</p>'
