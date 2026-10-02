import type { Session } from '@gnomeola/protocol'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, IconButton } from '../../design/primitives/index.ts'
import { SpeakersDialog } from '../speakers/speakers-dialog.tsx'
import { TranscriptPane } from '../transcript/transcript-pane.tsx'

// The transcript, on demand: a panel beside the meeting (Ctrl+T, or any citation, evidence quote or
// search moment, which opens it at the line). It is the evidence, never the focus. After the meeting it
// asks for the other voices' names once there are unnamed ones, so the outcome can say who said what.

export function TranscriptPanel({ session, onClose }: { session: Session; onClose: () => void }) {
  const { queries } = useServices()
  const [naming, setNaming] = useState(false)
  const speakers = useQuery(queries.speakers(session.id)).data
  const ended = session.status !== 'recording' && session.status !== 'paused'
  const unnamed = (speakers?.list ?? []).filter(
    (s) => s.id !== 'me' && s.id !== 'them' && !s.named && s.segments > 0,
  )
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-l border-border-subtle bg-bg-sidebar md:w-[400px]">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <h2 className="m-0 flex-1 type-headline text-text-primary">{_('Transcript')}</h2>
        <Button size="sm" variant="ghost" icon="speakers" onPress={() => setNaming(true)}>
          {_('Speakers')}
        </Button>
        <IconButton
          icon="close"
          label={_('Close the transcript')}
          tooltip={_('Close (Ctrl+T)')}
          onPress={onClose}
        />
      </div>
      {ended && unnamed.length ? (
        <div className="mx-3 mb-2 flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5">
          <p className="m-0 type-callout text-text-primary">
            {fmt(
              ngettext(
                'One voice has no name yet ({labels}). Name it, so notes and answers say who said what.',
                '{n} voices have no name yet ({labels}). Name them, so notes and answers say who said what.',
                unnamed.length,
              ),
              { n: unnamed.length, labels: unnamed.map((s) => s.label).join(', ') },
            )}
          </p>
          <div>
            <Button size="sm" onPress={() => setNaming(true)}>
              {_('Name the voices')}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <TranscriptPane session={session} />
      </div>
      <SpeakersDialog sessionId={session.id} isOpen={naming} onClose={() => setNaming(false)} />
    </div>
  )
}
