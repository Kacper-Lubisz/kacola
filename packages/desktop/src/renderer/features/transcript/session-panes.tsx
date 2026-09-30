import { _ } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { AskPane } from '../ask/ask-pane.tsx'
import { KTabs } from './local-primitives.tsx'
import type { Pane, SessionSearch } from './search-params.ts'
import { TranscriptPane } from './transcript-pane.tsx'

// INTERIM (phase 2B): the session page's Transcript / Ask panes as tabs, driven by the route's `pane`
// search param, until the session-detail frame (phase 2A) hosts TranscriptPane and AskPane itself (and
// the Notes pane, 2C). Whatever frame hosts them must keep `?pane=transcript&seg=…` meaning "show the
// transcript at this line": that is how an Ask citation jumps.

export function SessionPanes({ sessionId, search }: { sessionId: string; search: SessionSearch }) {
  const navigate = useNavigate()
  const pane: Pane = search.pane === 'ask' ? 'ask' : 'transcript'
  return (
    <KTabs
      // a new session is a new pane: no selection, search or scroll position carried over
      key={sessionId}
      label={_('Session views')}
      selected={pane}
      onSelect={(k) =>
        void navigate({
          to: '/sessions/$sessionId',
          params: { sessionId },
          search: { pane: k as Pane },
          replace: true,
        })
      }
      tabs={[
        {
          id: 'transcript',
          label: _('Transcript'),
          content: <TranscriptPane sessionId={sessionId} target={search} />,
        },
        { id: 'ask', label: _('Ask'), content: <AskPane sessionId={sessionId} /> },
      ]}
    />
  )
}
