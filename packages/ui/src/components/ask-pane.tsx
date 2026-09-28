import { type Citation, formatOffset } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwClamp, AdwSpinner, AdwStatusPage } from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkEntry,
  GtkEventControllerKey,
  GtkEventControllerScroll,
  GtkImage,
  GtkLabel,
  GtkScrolledWindow,
  GtkSeparator,
} from '@gtkx/jsx/gtk'
import { useProperty, useSignal } from '@gtkx/react'
import { type ReactNode, useRef, useState } from 'react'
import { Follow } from '../data/follow.ts'
import { escapeMarkup } from '../data/format.ts'
import {
  type AskError,
  isUnavailable,
  type QaFeed,
  type QaFeedState,
  type QaTurn,
  splitCitations,
  viewTurn,
} from '../data/qa.ts'
import { _, fmt } from '../i18n/index.ts'
import { NamedButton } from './named-button.tsx'
import { speakerName } from './transcript-view.tsx'

// Q-5: ask questions about this session. History comes from the daemon (and from any other client,
// live, via qa.message); this window's own question streams in from POST /ask. Citation markers
// `[n]` in an answer are emphasised in the text and offered as chips below it: activating a chip
// shows the Transcript page scrolled to that segment, selected.

export type AskPaneProps = {
  state: QaFeedState
  feed: QaFeed
  onCite: (c: Citation) => void
  onOpenPreferences: () => void
}

export const citationName = (n: number, c: Citation): string =>
  fmt(_('Citation {n}: {speaker} at {time}'), {
    n,
    speaker: speakerName(c.speaker),
    time: formatOffset(c.startMs),
  })

function answerMarkup(text: string, count: number): string {
  return splitCitations(text, count)
    .map((p) => (p.kind === 'text' ? escapeMarkup(p.text) : `<b><sup>[${p.n}]</sup></b>`))
    .join('')
}

function Notice({
  kind,
  icon,
  text,
  children,
}: {
  kind: string
  icon: string
  text: string
  children?: ReactNode
}) {
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={['qa-notice', kind]}>
      <GtkBox spacing={8}>
        <GtkImage iconName={icon} valign={Gtk.Align.START} accessibleHidden />
        <GtkLabel label={text} wrap xalign={0} hexpand />
      </GtkBox>
      {children}
    </GtkBox>
  )
}

function ErrorNotice({ error, onOpenPreferences }: { error: AskError; onOpenPreferences: () => void }) {
  if (isUnavailable(error)) {
    return (
      <Notice
        kind="qa-info"
        icon="dialog-information-symbolic"
        text={fmt(
          _(
            'Questions are not available right now: {reason}. Choose a language model provider and add an API key in Preferences.',
          ),
          { reason: error.message },
        )}
      >
        <GtkButton label={_('Open Preferences')} halign={Gtk.Align.START} onClicked={onOpenPreferences} />
      </Notice>
    )
  }
  return (
    <Notice
      kind="qa-error"
      icon="dialog-warning-symbolic"
      text={fmt(_('The question could not be answered: {reason}'), { reason: error.message })}
    />
  )
}

function Turn({ turn, onCite, onOpenPreferences }: { turn: QaTurn } & Omit<AskPaneProps, 'state' | 'feed'>) {
  const view = viewTurn(turn)
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      {turn.question ? <GtkLabel label={turn.question} cssClasses={['qa-question']} wrap xalign={0} /> : null}
      {view.kind === 'streaming' ? (
        <GtkBox spacing={8}>
          <AdwSpinner valign={Gtk.Align.START} accessibleLabel={_('Answering')} />
          <GtkLabel
            label={view.text || _('Thinking…')}
            cssClasses={view.text ? ['qa-answer'] : ['qa-answer', 'dim-label']}
            wrap
            xalign={0}
            hexpand
          />
        </GtkBox>
      ) : null}
      {view.kind === 'answer' ? (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          <GtkLabel
            label={answerMarkup(view.text, view.citations.length)}
            useMarkup
            cssClasses={['qa-answer']}
            wrap
            xalign={0}
            accessibleLabel={view.text}
          />
          {view.citations.length ? (
            <GtkBox spacing={6} accessibleLabel={_('Sources')}>
              {view.citations.map((c, i) => (
                <NamedButton
                  // biome-ignore lint/suspicious/noArrayIndexKey: citations are positional ([n] = index + 1)
                  key={i}
                  text={`[${i + 1}] ${speakerName(c.speaker)} · ${formatOffset(c.startMs)}`}
                  name={citationName(i + 1, c)}
                  tooltipText={_('Show this line in the transcript')}
                  cssClasses={['citation-chip']}
                  onClicked={() => onCite(c)}
                />
              ))}
            </GtkBox>
          ) : null}
        </GtkBox>
      ) : null}
      {view.kind === 'refusal' ? (
        <Notice
          kind="qa-refusal"
          icon="action-unavailable-symbolic"
          text={_('The model declined to answer this question. Nothing it wrote before declining is shown.')}
        />
      ) : null}
      {view.kind === 'error' ? (
        <ErrorNotice error={view.error} onOpenPreferences={onOpenPreferences} />
      ) : null}
      {view.kind === 'unanswered' ? (
        <GtkLabel label={_('No answer was recorded.')} cssClasses={['dim-label']} xalign={0} />
      ) : null}
    </GtkBox>
  )
}

export function AskPane({ state, feed, onCite, onOpenPreferences }: AskPaneProps) {
  const [question, setQuestion] = useState('')
  const entry = useRef<Gtk.Entry | null>(null)
  const [scrolled, setScrolled] = useState<Gtk.ScrolledWindow | null>(null)
  const adjustment = useProperty(scrolled, 'vadjustment') ?? null
  // keep the newest exchange in view as it streams, unless the user scrolled up to read
  const [follow] = useState(() => new Follow(true))
  useSignal(adjustment, 'value-changed', () => {
    const adj = adjustment
    if (adj) follow.scrolled(adj.getValue(), adj.getUpper(), adj.getPageSize())
  })
  useSignal(adjustment, 'changed', () => {
    const adj = adjustment
    if (!adj) return
    const pin = follow.resized(adj.getValue(), adj.getUpper(), adj.getPageSize())
    if (pin !== null) adj.setValue(pin)
  })

  const asking = state.qa.turns.some((t) => t.pending)
  const canAsk = question.trim().length > 0 && !asking

  const submit = () => {
    const q = question.trim()
    if (!q || asking) return
    setQuestion('')
    entry.current?.setText('')
    follow.attach()
    void feed.ask(q)
  }

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
      {state.qa.turns.length === 0 ? (
        <AdwStatusPage
          vexpand
          iconName="dialog-question-symbolic"
          title={_('Ask About This Meeting')}
          description={escapeMarkup(
            state.status === 'error'
              ? fmt(_('Earlier questions could not be loaded: {reason}'), { reason: state.error ?? '' })
              : _('Answers come from this transcript, with citations you can follow back to the line.'),
          )}
          cssClasses={['compact']}
        />
      ) : (
        <GtkScrolledWindow
          ref={setScrolled}
          vexpand
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          controllers={
            <>
              <GtkEventControllerScroll
                flags={Gtk.EventControllerScrollFlags.VERTICAL}
                propagationPhase={Gtk.PropagationPhase.CAPTURE}
                onScroll={(_dx, dy) => {
                  follow.userScrolled(dy)
                  return false
                }}
              />
              <GtkEventControllerKey
                propagationPhase={Gtk.PropagationPhase.CAPTURE}
                onKeyPressed={(keyval) => {
                  follow.userKey(keyval)
                  return false
                }}
              />
            </>
          }
        >
          <AdwClamp
            maximumSize={760}
            tighteningThreshold={560}
            marginTop={18}
            marginBottom={18}
            marginStart={12}
            marginEnd={18}
          >
            <GtkBox
              orientation={Gtk.Orientation.VERTICAL}
              spacing={24}
              accessibleLabel={_('Questions and answers')}
            >
              {state.qa.turns.map((t) => (
                <Turn key={t.requestId} turn={t} onCite={onCite} onOpenPreferences={onOpenPreferences} />
              ))}
            </GtkBox>
          </AdwClamp>
        </GtkScrolledWindow>
      )}
      <GtkSeparator />
      <AdwClamp
        maximumSize={760}
        tighteningThreshold={560}
        marginTop={12}
        marginBottom={12}
        marginStart={12}
        marginEnd={18}
      >
        <GtkBox spacing={6}>
          <GtkEntry
            ref={entry}
            hexpand
            placeholderText={_('Ask a question about this meeting')}
            accessibleLabel={_('Question')}
            onChanged={(self) => setQuestion(self.getText())}
            onActivate={submit}
          />
          <GtkButton
            label={_('Ask')}
            cssClasses={['suggested-action']}
            sensitive={canAsk}
            accessibleDescription={_('Ask the question about this meeting')}
            onClicked={submit}
          />
        </GtkBox>
      </AdwClamp>
    </GtkBox>
  )
}
