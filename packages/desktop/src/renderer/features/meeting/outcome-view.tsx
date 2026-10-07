import type { AgendaView, Session } from '@kacola/protocol'
import { _, fmt, ngettext } from '@kacola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Banner, Button, Card, Dialog, Icon, useToast } from '../../design/primitives/index.ts'
import { ShareBanner, ShareRecapSwitch } from '../agendas/share.tsx'
import { useAgendaShare } from '../agendas/share-data.ts'
import { trackerLine } from '../agendas/tracker-status.tsx'
import { useNotesFeed } from '../notes/notes-data.ts'
import type { NotesEditorHandle } from '../notes/notes-editor.tsx'
import { OutcomeRecap, PrivateContext } from './agenda-rail.tsx'
import { AskBar } from './ask-bar.tsx'
import { OVER_NOTEPAD, RAIL, useMeetingUi } from './meeting-ui.ts'
import { OutcomeNotes } from './notepad.tsx'
import { buildOutcome, type Outcome, ownerLabel, summaryMarkdown } from './outcome.ts'
import { atLine } from './search-params.ts'
import { TranscriptPanel } from './transcript-panel.tsx'

// Outcome, after Stop: the outcome block first — what was decided, who will do what by when (yours
// first), what carries over — then the clean notes. The transcript is the evidence: a side panel that
// opens at a cited line and keeps the page where it was. "Share summary" is one labelled action.

function OutcomeBlock({ outcome, sessionId }: { outcome: Outcome; sessionId: string }) {
  const navigate = useNavigate()
  const { decisions, actions, carried, recurring } = outcome
  if (!decisions.length && !actions.length && !carried.length)
    return (
      <Card as="section" aria-label={_('Outcome')} className="flex flex-col gap-1 px-5 py-4">
        <h2 className="m-0 type-overline text-text-secondary">{_('Outcome')}</h2>
        <p className="m-0 type-callout text-text-secondary">
          {_('No decisions or action items yet. Enhance writes them from your notes and the transcript.')}
        </p>
      </Card>
    )
  const cite = (segmentId: string) =>
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId },
      search: atLine(segmentId),
      replace: true,
      // a fresh state makes following the same citation again a new navigation (it re-scrolls)
      state: { cite: Date.now() } as never,
    })
  return (
    <Card as="section" aria-label={_('Outcome')} className="flex flex-col gap-4 px-5 py-4">
      {decisions.length ? (
        <section aria-labelledby="outcome-decided" className="flex flex-col gap-1.5">
          <h2 id="outcome-decided" className="m-0 type-overline text-text-secondary">
            {_('Decided')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {decisions.map((d) => (
              <li key={d.text} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-1 shrink-0 text-status-success" />
                <span className="min-w-0 flex-1 type-body-strong break-words text-text-primary">
                  {d.text}
                </span>
                {d.evidence?.segmentId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="quote"
                    onPress={() => cite(d.evidence!.segmentId!)}
                    aria-label={fmt(_('Show in transcript: “{quote}”'), { quote: d.evidence.quote })}
                  >
                    <span className="max-sm:hidden">{_('Where')}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {actions.length ? (
        <section
          aria-labelledby="outcome-todo"
          className="flex flex-col gap-1.5 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0"
        >
          <h2 id="outcome-todo" className="m-0 type-overline text-text-secondary">
            {_('To do')}
          </h2>
          <ul aria-label={_('Action items')} className="m-0 flex list-none flex-col gap-1 p-0">
            {actions.map((a) => {
              const who = ownerLabel(a.owner)
              return (
                <li
                  key={a.text}
                  aria-label={a.text}
                  aria-description={[a.done ? _('Done') : _('Open'), who, a.due].filter(Boolean).join(' · ')}
                  className="flex items-start gap-2"
                >
                  <Icon
                    name={a.done ? 'success' : 'task'}
                    size={16}
                    className={`mt-1 shrink-0 ${a.done ? 'text-status-success' : 'text-text-tertiary'}`}
                  />
                  <span
                    className={`min-w-0 flex-1 type-body break-words ${a.done ? 'text-text-secondary line-through' : 'text-text-primary'}`}
                  >
                    {a.text}
                  </span>
                  <span className="shrink-0 type-callout text-text-secondary">
                    {who ? (
                      <span className={a.mine ? 'font-semibold text-text-primary' : ''}>{who}</span>
                    ) : null}
                    {who && a.due ? ' · ' : ''}
                    {a.due ?? ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      {carried.length ? (
        <section
          aria-labelledby="outcome-carried"
          className="flex flex-col gap-1.5 border-t border-border-subtle pt-3 first:border-t-0 first:pt-0"
        >
          <h2 id="outcome-carried" className="m-0 type-overline text-text-secondary">
            {recurring ? _('Carried over') : _('Not settled')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {carried.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                <Icon name="carry" size={16} className="mt-1 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1 type-body break-words text-text-primary">{c.text}</span>
                {recurring ? (
                  <span className="type-caption text-text-secondary">{_('next time')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  )
}

/** The recap's state when it is not simply done (writing, unavailable, failed) — one quiet line. */
function RecapState({ agendaId }: { agendaId: string }) {
  const { queries } = useServices()
  const { data: t } = useQuery(queries.agendaTracker(agendaId))
  if (t?.state !== 'stopped') return null
  const line = trackerLine(t)
  if (!line) return null
  return <Banner tone={line.tone === 'danger' ? 'warning' : 'info'} title={line.text} />
}

/** The next occurrence's agenda, once it exists (a recurring meeting's carry-over goes there). */
function NextOccurrence({ view }: { view: AgendaView }) {
  const { queries } = useServices()
  const navigate = useNavigate()
  const next = useQuery(queries.agendas()).data?.find((a) => a.carriedFrom === view.agenda.id)
  if (!next) return null
  return (
    <Button
      size="sm"
      variant="ghost"
      icon="carry"
      className="self-start"
      onPress={() => void navigate({ to: '/agendas/$agendaId', params: { agendaId: next.id } })}
    >
      {_('Open the next meeting')}
    </Button>
  )
}

export function ShareSummaryButton({
  session,
  view,
  outcome,
  notes,
  when,
  title,
}: {
  session: Session
  view: AgendaView | null
  outcome: Outcome
  notes: string
  when: string
  title: string
}) {
  const { bridge } = useServices()
  const toast = useToast()
  const share = useAgendaShare(view?.agenda.id ?? '').data
  const [open, setOpen] = useState(false)
  const text = summaryMarkdown({ title, when, outcome, notes })
  return (
    <>
      <Button variant="primary" icon="send" onPress={() => setOpen(true)}>
        {_('Share summary')}
      </Button>
      <Dialog
        title={_('Share summary')}
        isOpen={open}
        onOpenChange={setOpen}
        size="lg"
        footer={
          <>
            <Button
              icon="exportFile"
              onPress={() =>
                void bridge
                  .saveTextFile({
                    title: _('Save summary'),
                    defaultName: `${title.replace(/[^\p{L}\p{N} ._-]+/gu, ' ').trim() || 'summary'}.md`,
                    text,
                  })
                  .then((r) => r.saved && toast(fmt(_('Summary saved to {path}'), { path: r.path })))
              }
            >
              {_('Save as file…')}
            </Button>
            <Button
              variant="primary"
              icon="copy"
              onPress={() =>
                void bridge.copyText(text).then(() => {
                  toast(_('Summary copied'))
                  setOpen(false)
                })
              }
            >
              {_('Copy summary')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 type-callout text-text-secondary">
            {_(
              'This is exactly what they get: the outcome and your notes. Private context never goes in it.',
            )}
          </p>
          <pre
            // a scrolling preview must be reachable from the keyboard (axe scrollable-region-focusable)
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable preview
            tabIndex={0}
            className="m-0 max-h-[46vh] overflow-y-auto rounded-md border border-border-subtle bg-bg-surface p-4 font-sans type-body whitespace-pre-wrap text-text-primary select-text"
          >
            {text}
          </pre>
          {view && share?.shared ? <ShareRecapSwitch view={view} status={share} /> : null}
          {session.private ? (
            <p className="m-0 type-caption text-text-secondary">
              {_('This meeting is private. Sharing a summary is up to you; kacola never sends it anywhere.')}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}

/** A followed copy whose organiser stopped sharing (or a share that cannot sync) says so after the meeting too. */
function OutcomeShareBanner({ view }: { view: AgendaView }) {
  const { data: share } = useAgendaShare(view.agenda.id)
  return <ShareBanner view={view} status={share} />
}

export function useOutcome(session: Session, view: AgendaView | null) {
  const { feed, state } = useNotesFeed(session.id)
  const notes = state?.draft ?? ''
  return { feed, state, notes, outcome: buildOutcome(view, notes) }
}

export function OutcomeView({
  session,
  view,
  data,
  transcript,
  onTranscript,
}: {
  session: Session
  view: AgendaView | null
  data: ReturnType<typeof useOutcome>
  transcript: boolean
  onTranscript: (open: boolean) => void
}) {
  const handle = useRef<NotesEditorHandle | null>(null)
  const askOpen = useMeetingUi((s) => s.askOpen)
  const setAsk = useMeetingUi((s) => s.setAsk)
  const carried = data.outcome.carried.length
  return (
    // On a narrow window the page is one scrolling column with the outcome first and the agenda recap
    // after the notes (the recap repeats what the outcome says; it must not push it off the screen).
    <div className="relative flex min-h-0 flex-1 flex-col max-md:overflow-y-auto md:flex-row">
      {view ? (
        <aside
          aria-label={_('Agenda and context')}
          className={`${RAIL} max-md:order-last max-md:overflow-visible max-md:border-t max-md:border-b-0`}
        >
          <OutcomeRecap view={view} />
          {carried && view.agenda.meeting?.recurring ? (
            <p className="m-0 type-caption text-text-secondary">
              {fmt(
                ngettext(
                  '{n} item carries over to the next meeting',
                  '{n} items carry over to the next meeting',
                  carried,
                ),
                {
                  n: carried,
                },
              )}
            </p>
          ) : null}
          <NextOccurrence view={view} />
          <span className="flex-1" />
          <PrivateContext view={view} hidden={false} />
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-col md:relative md:min-h-0 md:flex-1">
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-4 py-6 sm:px-8">
            {session.status === 'failed' && session.error ? (
              <Banner tone="danger" title={fmt(_('Recording failed: {reason}'), { reason: session.error })} />
            ) : null}
            {view ? <OutcomeShareBanner view={view} /> : null}
            <OutcomeBlock outcome={data.outcome} sessionId={session.id} />
            {view ? <RecapState agendaId={view.agenda.id} /> : null}
            <OutcomeNotes session={session} feed={data.feed} state={data.state} handle={handle} />
          </div>
        </div>
        {askOpen ? (
          <div className="fixed inset-x-0 bottom-4 z-[1] flex justify-center px-4 sm:px-6 md:absolute">
            <div className={`w-full ${OVER_NOTEPAD}`}>
              <AskBar
                askKey={session.id}
                sessionId={session.id}
                label={_('Ask about this meeting')}
                placeholder={_('Ask about this meeting')}
                onPin={(text) => handle.current?.append(text)}
                onClose={() => setAsk(false)}
              />
            </div>
          </div>
        ) : null}
      </div>
      {transcript ? (
        <div className="absolute inset-0 z-10 flex md:static md:z-auto">
          <TranscriptPanel session={session} onClose={() => onTranscript(false)} />
        </div>
      ) : null}
    </div>
  )
}
