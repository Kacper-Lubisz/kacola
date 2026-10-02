import type { AgendaView, Session } from '@gnomeola/protocol'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _ } from '@gnomeola/ui-core/i18n'
import { useRef } from 'react'
import { Button, Kbd } from '../../design/primitives/index.ts'
import { useNotesFeed } from '../notes/notes-data.ts'
import type { NotesEditorHandle } from '../notes/notes-editor.tsx'
import { LiveChecklist, NoAgenda, PrivateContext } from './agenda-rail.tsx'
import { AskBar } from './ask-bar.tsx'
import { useMeetingUi } from './meeting-ui.ts'
import { LiveNotepad, saveStatus } from './notepad.tsx'
import { SuggestionCard } from './suggestion-card.tsx'
import { TranscriptPanel } from './transcript-panel.tsx'

// Live: minimal. A narrow agenda checklist on the left; the notepad is the screen; one suggestion slot,
// drawn only when there is a suggestion, in a strip under the notepad whose height is always reserved —
// so a suggestion arriving or leaving never moves the text being typed. On demand only: Ask (Ctrl+K, a
// bar over the bottom of the notepad), the transcript (Ctrl+T, a side panel), private context (Show).

/** The strip under the notepad that the suggestion card appears in; always this tall. */
const SLOT_HEIGHT = 'min-h-[132px]'

export function LiveView({
  session,
  view,
  transcript,
  onTranscript,
}: {
  session: Session
  view: AgendaView | null
  transcript: boolean
  onTranscript: (open: boolean) => void
}) {
  const { feed, state } = useNotesFeed(session.id)
  const handle = useRef<NotesEditorHandle | null>(null)
  const askOpen = useMeetingUi((s) => s.askOpen)
  const setAsk = useMeetingUi((s) => s.setAsk)
  const now = useNow(15_000).getTime()
  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      <aside
        aria-label={_('Agenda and context')}
        className="flex max-h-[24vh] shrink-0 flex-col gap-4 overflow-y-auto border-b border-border-subtle p-3 md:max-h-none md:w-[272px] md:border-r md:border-b-0"
      >
        {view ? <LiveChecklist view={view} /> : <NoAgenda session={session} />}
        <span className="flex-1" />
        {view ? <PrivateContext view={view} hidden /> : null}
      </aside>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <LiveNotepad state={state} feed={feed} handle={handle} bottomSpace={48} />
        </div>
        <div className={`${SLOT_HEIGHT} shrink-0 px-4 sm:px-6`}>
          <div className="mx-auto flex h-full w-full max-w-[760px] flex-col justify-end">
            {view && !askOpen ? <SuggestionCard view={view} now={now} sessionId={session.id} /> : null}
          </div>
        </div>
        {askOpen ? (
          <div className="absolute inset-x-0 bottom-12 flex justify-center px-4 sm:px-6">
            <div className="w-full max-w-[760px]">
              <AskBar
                askKey={session.id}
                sessionId={session.id}
                label={_('Ask about this meeting')}
                placeholder={_('Ask about this meeting, or what was said earlier')}
                onPin={(text) => handle.current?.append(text)}
                onClose={() => {
                  setAsk(false)
                  handle.current?.focus()
                }}
              />
            </div>
          </div>
        ) : null}
        <div className="flex h-12 shrink-0 items-center gap-2 border-t border-border-subtle px-4 sm:px-6">
          <span className="min-w-0 flex-1 truncate type-caption text-text-tertiary" role="status">
            {state ? saveStatus(state) : ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon="ask"
            aria-pressed={askOpen}
            onPress={() => setAsk(!askOpen)}
          >
            {_('Ask')} <Kbd>Ctrl+K</Kbd>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="transcript"
            aria-pressed={transcript}
            onPress={() => onTranscript(!transcript)}
          >
            {_('Transcript')} <Kbd>Ctrl+T</Kbd>
          </Button>
        </div>
      </div>
      {transcript ? (
        <div className="absolute inset-0 z-10 flex md:static md:z-auto">
          <TranscriptPanel session={session} onClose={() => onTranscript(false)} />
        </div>
      ) : null}
    </div>
  )
}
