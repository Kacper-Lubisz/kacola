import { LlmError, type LlmProvider, type RecapResult, recapItem } from '@gnomeola/llm'
import type { AgendaItem, Session } from '@gnomeola/protocol'
import { type AgendaStore, type Store, StoreError } from '@gnomeola/store'
import { toWireError } from '../engines/llm.ts'
import type { Logger } from '../logger.ts'
import type { RecapHook } from './service.ts'
import type { AgendaTracker } from './tracker.ts'

// Agendas wave 2 — the recap: when a recording linked to an agenda stops, the text LLM writes each item's
// recap (outcome, decisions, actions) and it is stored as the item's `outcome` (agenda.item.upserted by
// `tracker`). Per item, one call, through the M7 enhancement plumbing (@gnomeola/llm recapItem: the
// transcript is the byte-stable cached prefix, the item the volatile tail — item 2..n re-read the cache).
//
// Where it is stored, and why not as a notes version: M7's notes are the user's document. `user` versions
// are their own words, and an `enhanced` version only exists as the pending review of an enhancement the
// user asked for (one pending slot: writing one would replace a review they have open, or put a review
// they never asked for over their notes). So the recap lives on the agenda items — the window's recap
// view, the markdown export (`> ` outcome lines), carry-over and the invitee page read it there.
//
// Rules: an outcome the USER wrote is never replaced (manual wins, as for statuses); the answer the tracker
// heard for an info-to-get item stays the first line; the recap's own status never moves an item — when
// it says "covered" for an item still open, a "looks covered?" suggestion is posted for the user to accept.
// No LLM (switched off, no key) → recap `unavailable`; a refusal or failure on an item leaves it as it was.

export type RecapDeps = {
  store: Store
  agendas: AgendaStore
  tracker: AgendaTracker | null
  logger: Logger
  /** The text LLM for this recording, or null with the reason it cannot run (a private one: no cloud). */
  llm: (session: Session) => Promise<{ provider: LlmProvider | null; reason: string | null }>
}

const STOP_CODES = new Set(['auth', 'quota', 'permission', 'aborted'])

/** The outcome text stored for one item. */
export function formatOutcome(
  item: Pick<AgendaItem, 'kind' | 'outcome' | 'changedBy'>,
  r: RecapResult,
): string {
  const lines: string[] = []
  const heard = item.kind === 'info-to-get' && item.changedBy === 'tracker' ? item.outcome : null
  if (heard) lines.push(heard)
  if (r.outcome && r.outcome !== heard) lines.push(r.outcome)
  if (r.decisions.length) lines.push('Decisions:', ...r.decisions.map((d) => `- ${d}`))
  if (r.actions.length) lines.push('Actions:', ...r.actions.map((a) => `- ${a}`))
  if (!lines.length) lines.push(r.text.trim())
  return lines.join('\n').slice(0, 4000)
}

/** Whose outcome it is: the user's is left alone. */
function userOutcome(it: AgendaItem): boolean {
  return it.outcome !== null && !(it.changedBy === 'tracker' || it.changedBy.startsWith('agent:'))
}

export function agendaRecapHook(d: RecapDeps): RecapHook {
  return async ({ agenda, session }) => {
    const agendaId = agenda.agenda.id
    await d.tracker?.idle(session.id)
    const set = (state: Parameters<AgendaTracker['setRecap']>[1]) => d.tracker?.setRecap(agendaId, state)
    set({ state: 'running' })
    const { provider, reason } = await d.llm(d.store.getSession(session.id) ?? session)
    if (!provider) {
      set({ state: 'unavailable', detail: reason ?? 'no text LLM is configured' })
      d.logger.info('agenda recap unavailable', { agendaId, reason })
      return
    }
    const fresh = d.store.getSession(session.id) ?? session
    const segments = d.store.segments(session.id)
    if (!segments.some((s) => s.text.trim())) {
      set({ state: 'done', detail: 'nothing was said in the recording', items: 0 })
      return
    }
    let written = 0
    let refused = 0
    let failed = 0
    let lastError: string | null = null
    for (const it of d.agendas.items(agendaId)) {
      if (userOutcome(it) || it.status === 'skipped') continue
      let r: RecapResult
      try {
        r = await recapItem({
          provider,
          transcript: { session: fresh, segments },
          item: { text: it.text, kind: it.kind, outcome: it.outcome },
        })
      } catch (err) {
        failed++
        // the provider's words, not its raw body ("Anthropic is busy right now…", not a JSON 529)
        const wire = toWireError(err, provider.id, 'The recap')
        lastError = wire instanceof Error ? wire.message : String(err)
        d.logger.warn('agenda recap failed for an item', {
          agendaId,
          itemId: it.id,
          err: err instanceof Error ? err.message : String(err),
        })
        if (err instanceof LlmError && STOP_CODES.has(err.code)) break
        continue
      }
      if (r.refusal || !r.text) {
        refused++
        continue
      }
      try {
        // re-read: the user may have edited it while the model was writing
        const cur = d.agendas.item(agendaId, it.id)
        if (!cur || userOutcome(cur)) continue
        d.agendas.updateItem(agendaId, it.id, { outcome: formatOutcome(cur, r) }, 'tracker')
        written++
        if (r.status === 'covered' && (cur.status === 'open' || cur.status === 'in-progress'))
          d.agendas.addSuggestion(agendaId, {
            kind: 'looks-covered',
            text: `Recap: looks covered — ${it.text}${r.outcome ? `: ${r.outcome.slice(0, 300)}` : ''}`,
            itemId: it.id,
            source: 'tracker',
          })
      } catch (err) {
        if (err instanceof StoreError && err.code === 'not_found') return // the agenda went meanwhile
        throw err
      }
    }
    const notes = [
      refused ? `${refused} item(s) refused by the model` : null,
      failed ? `${failed} item(s) failed${lastError ? `: ${lastError.slice(0, 200)}` : ''}` : null,
    ].filter(Boolean)
    set({
      state: written || (!refused && !failed) ? 'done' : 'failed',
      detail: notes.length ? notes.join('; ') : null,
      items: written,
    })
    d.logger.info('agenda recap written', { agendaId, items: written, refused, failed })
  }
}
