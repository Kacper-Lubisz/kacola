import { createHash, randomBytes, randomInt } from 'node:crypto'
import {
  formatShareLink,
  LEGACY_PARTICIPANT_HEADER,
  normalizeUserCode,
  PARTICIPANT_HEADER,
  publicActorLabel,
  type SharedAgendaState,
  USER_CODE_ALPHABET,
} from '@kacola/protocol'
import { type ShareKey, type ShareState, type StoreApi, shares } from '@kacola/store/core'
import type { JsonHandler } from './app.ts'
import type { Principal } from './auth.ts'
import { HttpError } from './errors.ts'
import type { Mailer } from './mailer.ts'

// Team sharing on the hosted server: the routes of protocol/sharing.ts. The rules are the store's
// (store/shares.ts, pure, run inside the writer's transaction); this file is identity and transport.
//
//   owner     any authenticated principal of this server (its own paired devices, the admin token,
//             loopback when trusted) — the hosted server belongs to one person, the one who shares
//   member    a participant token (PARTICIPANT_HEADER) whose email the owner listed
//   invitee   a participant token for any other verified email, if the owner allows invitees
//   anyone    with the link token: the public page, asking for a code, confirming it
//
// Secrets (link token, participant tokens, codes) are random, shown once, stored only as SHA-256.

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const token = () => randomBytes(24).toString('base64url')
// Ids sort in creation order (the merge history is listed by id): time, then a per-process counter for
// ids made in the same millisecond, then randomness so instances never collide.
let lastMs = 0
let seqInMs = 0
const id = (kind: string) => {
  const ms = Math.max(Date.now(), lastMs)
  seqInMs = ms === lastMs ? seqInMs + 1 : 0
  lastMs = ms
  return `${kind}_${ms.toString(36).padStart(9, '0')}${seqInMs.toString(36).padStart(3, '0')}${randomBytes(5).toString('hex')}`
}

/** An 8-letter code like `BDFG-HJKL` (20^8 ≈ 2.6e10; five guesses per code). */
function newCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}
const codeHash = (shareId: string, email: string, code: string) =>
  sha256(`${shareId}:${email}:${normalizeUserCode(code)}`)

export type SharingDeps = {
  store: StoreApi
  mailer: Mailer | null
  /** Base URL the links in emails use; default: the request's origin. */
  publicUrl?: string | null
  log: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void
}

type ShareRoutes =
  | 'createShare'
  | 'updateShare'
  | 'revokeShare'
  | 'pushShare'
  | 'getShareState'
  | 'listShareChanges'
  | 'revokeShareParticipant'
  | 'hideShareComment'
  | 'getSharedPage'
  | 'shareVerify'
  | 'shareConfirm'
  | 'shareAddItem'
  | 'shareAddComment'

/** Routes anyone with the link may reach without a pairing token (they are keyed by the link token). */
export const SHARE_LINK_ROUTES: readonly string[] = [
  'getSharedPage',
  'shareVerify',
  'shareConfirm',
  'shareAddItem',
  'shareAddComment',
]
/** Routes a member's daemon reaches with its participant token instead of a pairing token. */
export const SHARE_PARTICIPANT_ROUTES: readonly string[] = ['pushShare', 'getShareState', 'listShareChanges']

/** Without a pairing token: may this request go on (as `anonymous`, authorized by the handler)? */
export const shareOpen = (route: string, req: Request): boolean =>
  SHARE_LINK_ROUTES.includes(route) ||
  (SHARE_PARTICIPANT_ROUTES.includes(route) && participantToken(req) !== null)

const isOwner = (p: Principal) => p.kind !== 'anonymous'

function requireOwner(p: Principal): void {
  if (!isOwner(p)) throw new HttpError('unauthorized', 'only the owner (a paired device) can do this', 401)
}

/** The participant token: the kacola header, else the gnomeola one an old member's daemon sends (one release). */
const participantToken = (req: Request): string | null =>
  req.headers.get(PARTICIPANT_HEADER) ?? req.headers.get(LEGACY_PARTICIPANT_HEADER)

const participantHash = (req: Request): string | null => {
  const t = participantToken(req)
  return t ? sha256(t.trim()) : null
}

export function sharingHandlers(d: SharingDeps): { [N in ShareRoutes]: JsonHandler<N> } {
  const { store } = d

  /** Owner, or a participant (by token) of this share; who the caller is decides what they see. */
  async function who(
    c: { principal: Principal; req: Request },
    shareId: string,
  ): Promise<{ owner: true; state: ShareState } | { owner: false; state: ShareState }> {
    const key: ShareKey = { shareId }
    if (isOwner(c.principal)) {
      const state = await store.shareRead(key, {}, (s) => shares.live(s))
      return { owner: true, state }
    }
    const h = participantHash(c.req)
    if (!h) throw new HttpError('unauthorized', 'a participant token is required', 401)
    const state = await store.shareRead(key, { participantTokenHash: h }, (s) => shares.live(s))
    if (!state.caller) throw new HttpError('unauthorized', 'unknown or revoked participant token', 401)
    return { owner: false, state }
  }

  const linkKey = (t: string): ShareKey => ({ tokenHash: sha256(t) })
  const origin = (req: Request) => (d.publicUrl ?? new URL(req.url).origin).replace(/\/+$/, '')

  return {
    createShare: async ({ principal, body }) => {
      requireOwner(principal)
      const t = token()
      const share = await store.shareWrite(null, {}, (_s, now) =>
        shares.planCreateShare({
          shareId: id('shr'),
          tokenHash: sha256(t),
          ownerName: body.ownerName,
          ownerLabel: body.ownerLabel,
          options: body.options,
          occurrence: body.occurrence,
          now,
        }),
      )
      d.log('info', 'agenda shared', { shareId: share.id })
      return { share, token: t }
    },
    updateShare: async ({ principal, params, body }) => {
      requireOwner(principal)
      return store.shareWrite({ shareId: params.shareId }, {}, (s, now) =>
        shares.planUpdateShare(s, body, now),
      )
    },
    revokeShare: async ({ principal, params }) => {
      requireOwner(principal)
      await store.shareWrite({ shareId: params.shareId }, {}, (s, now) => shares.planRevokeShare(s, now))
      d.log('info', 'agenda unshared', { shareId: params.shareId })
      return { revoked: true as const }
    },
    pushShare: async (c) => {
      const h = isOwner(c.principal) ? null : participantHash(c.req)
      if (!isOwner(c.principal) && !h)
        throw new HttpError('unauthorized', 'a participant token is required', 401)
      return store.shareWrite({ shareId: c.params.shareId }, { participantTokenHash: h }, (s, now) => {
        if (isOwner(c.principal)) return shares.planPush(s, { role: 'owner' }, c.body.ops, now, id)
        const live = shares.live(s)
        if (!live.caller) throw new HttpError('unauthorized', 'unknown or revoked participant token', 401)
        return shares.planPush(live, { role: 'member', participant: live.caller }, c.body.ops, now, id)
      })
    },
    getShareState: async (c) => {
      const w = await who(c, c.params.shareId)
      const you: SharedAgendaState['you'] = w.owner
        ? { participantId: 'owner', role: 'owner', label: w.state.share.ownerLabel }
        : {
            participantId: w.state.caller!.id,
            role: shares.roleOf(w.state.share, w.state.caller!),
            label: w.state.caller!.email,
          }
      return shares.stateView(w.state, you)
    },
    listShareChanges: async (c) => {
      const w = await who(c, c.params.shareId)
      const occ = c.query.occurrence
      return { changes: w.state.changes.filter((x) => !occ || x.occurrence === occ) }
    },
    revokeShareParticipant: async ({ principal, params }) => {
      requireOwner(principal)
      return store.shareWrite({ shareId: params.shareId }, {}, (s, now) =>
        shares.planRevokeParticipant(s, params.participantId, now),
      )
    },
    hideShareComment: async ({ principal, params }) => {
      requireOwner(principal)
      return store.shareWrite({ shareId: params.shareId }, {}, (s) =>
        shares.planHideComment(s, params.commentId),
      )
    },

    // ---- the link
    getSharedPage: async ({ params, query, req }) =>
      store.shareRead(linkKey(params.token), { participantTokenHash: participantHash(req) }, (s) =>
        shares.publicPage(s, { occurrence: query.occurrence, contributions: d.mailer !== null }),
      ),
    shareVerify: async ({ params, body, req }) => {
      if (!d.mailer)
        throw new HttpError('unavailable', 'this server cannot send email, so it takes no contributions', 501)
      const code = newCode()
      let shareId = ''
      let title = ''
      const r = await store.shareWrite(linkKey(params.token), {}, (s, now) => {
        const live = shares.live(s)
        shareId = live.share.id
        title =
          live.share.occurrences.find((o) => o.agendaId === live.share.current)?.title ?? 'a shared agenda'
        return shares.planVerify(live, {
          email: body.email,
          name: body.name ?? null,
          codeHash: codeHash(live.share.id, body.email, code),
          now,
        })
      })
      if (r.send) {
        const link = `${formatShareLink(origin(req), params.token)}#verify=${encodeURIComponent(body.email)}/${code}`
        try {
          await d.mailer.send({
            to: body.email,
            subject: `Your code for “${title}”`,
            text: `Your code is ${code}\n\nOr open this link to confirm your address:\n${link}\n\nIt expires in 15 minutes. If you did not ask for it, ignore this email.\n`,
          })
        } catch (err) {
          d.log('warn', 'magic-link email failed', { shareId, err: (err as Error).message })
          throw new HttpError('unavailable', 'the email could not be sent; try again later', 503)
        }
      }
      return { sent: true as const, expiresAt: r.expiresAt }
    },
    shareConfirm: async ({ params, body }) => {
      const t = token()
      let shareId = ''
      const r = await store.shareWrite(linkKey(params.token), {}, (s, now) => {
        const live = shares.live(s)
        shareId = live.share.id
        return shares.planConfirm(live, {
          email: body.email,
          codeHash: codeHash(live.share.id, body.email, body.code),
          participantId: id('spt'),
          tokenHash: sha256(t),
          now,
        })
      })
      if (!r.ok) throw new HttpError('unauthorized', r.reason)
      return { shareId, participant: r.participant, token: t }
    },
    shareAddItem: async ({ params, body, req }) => {
      const h = participantHash(req)
      if (!h) throw new HttpError('unauthorized', 'verify your email first')
      let ownerName = ''
      const item = await store.shareWrite(linkKey(params.token), { participantTokenHash: h }, (s, now) => {
        ownerName = s?.share.ownerName ?? ''
        return shares.planAddItem(s, { text: body.text, kind: body.kind, itemId: id('itm'), now })
      })
      const label = (a: typeof item.createdBy) => publicActorLabel(a, ownerName)
      return {
        id: item.id,
        text: item.text,
        kind: item.kind,
        owner: item.owner,
        timeboxMin: item.timeboxMin,
        status: item.status,
        outcome: null,
        auto: false,
        changedBy: label(item.changedBy),
        addedBy: label(item.createdBy),
        contributed: true,
        carriedOver: false,
      }
    },
    shareAddComment: async ({ params, body, req }) => {
      const h = participantHash(req)
      if (!h) throw new HttpError('unauthorized', 'verify your email first')
      let ownerName = ''
      const c = await store.shareWrite(linkKey(params.token), { participantTokenHash: h }, (s, now) => {
        ownerName = s?.share.ownerName ?? ''
        return shares.planAddComment(s, {
          itemId: body.itemId ?? null,
          text: body.text,
          commentId: id('scm'),
          now,
        })
      })
      return {
        id: c.id,
        itemId: c.itemId,
        author: publicActorLabel(c.author, ownerName),
        text: c.text,
        at: c.at,
        mine: true,
      }
    },
  }
}
