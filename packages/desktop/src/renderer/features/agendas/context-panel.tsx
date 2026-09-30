import type { AgendaView, SearchHit } from '@gnomeola/protocol'
import { formatDuration } from '@gnomeola/ui-core/format'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, Card, SearchField, Spinner, useToast } from '../../design/primitives/index.ts'
import { refusal } from './agenda-data.ts'
import { ContextCardView } from './context-cards.tsx'
import { addContextMutation } from './mutations.ts'

// The live panel's context: the agenda's cards (the connected agent's first — what it just fetched is
// the likeliest to matter), and the user's own search across past meetings, whose hits open the line or
// become a (private) card with one press.

/** The hit's text without the [match] marks. */
const plain = (snippet: string) => snippet.replace(/\[([^\]]*)\]/g, '$1')

function SearchHitRow({ view, hit }: { view: AgendaView; hit: SearchHit }) {
  const { api } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const add = useMutation({
    ...addContextMutation(api),
    onSuccess: () => toast(_('Added to the context')),
    onError: (err) =>
      toast(fmt(_('Could not add the card: {reason}'), { reason: refusal(err) }), { tone: 'error' }),
  })
  return (
    <li className="flex flex-col gap-1 rounded-md bg-bg-surface px-3 py-2">
      <span className="type-caption text-text-secondary">
        {hit.sessionTitle} · <span className="font-mono tabular-nums">{formatDuration(hit.startMs)}</span> ·{' '}
        {hit.speaker}
      </span>
      <span className="type-callout break-words text-text-primary">{plain(hit.snippet)}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon="transcript"
          onPress={() =>
            void navigate({
              to: '/sessions/$sessionId',
              params: { sessionId: hit.sessionId },
              search: { tab: 'transcript', segment: hit.segmentId },
            })
          }
        >
          {_('Open')}
        </Button>
        <Button
          size="sm"
          icon="add"
          isDisabled={add.isPending || add.isSuccess}
          onPress={() =>
            add.mutate({
              agendaId: view.agenda.id,
              card: {
                title: fmt(_('From “{title}”'), { title: hit.sessionTitle }),
                body: plain(hit.snippet),
                source: { kind: 'session', ref: hit.sessionId },
              },
            })
          }
        >
          {add.isSuccess ? _('Added') : _('Add as Card')}
        </Button>
      </div>
    </li>
  )
}

export function AgendaContextPanel({ view }: { view: AgendaView }) {
  const { queries } = useServices()
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const search = useQuery(queries.search(q))
  const cards = [...view.context].sort(
    (a, b) =>
      Number(b.source.kind === 'agent') - Number(a.source.kind === 'agent') ||
      Number(b.pinned) - Number(a.pinned) ||
      (a.updatedAt < b.updatedAt ? 1 : -1),
  )
  const hits = (search.data?.hits ?? []).filter((h) => h.sessionId !== view.agenda.sessionId).slice(0, 5)
  return (
    <section aria-labelledby="live-context" className="flex flex-col gap-2">
      <h3 id="live-context" className="m-0 type-overline text-text-secondary">
        {_('Context')}
      </h3>
      {cards.length ? (
        <div className="flex flex-col gap-2">
          {cards.map((c) => (
            <ContextCardView key={c.id} agendaId={view.agenda.id} card={c} compact />
          ))}
        </div>
      ) : (
        <p className="m-0 type-callout text-text-secondary">
          {_('No context cards. Your connected agent’s finds appear here.')}
        </p>
      )}
      <Card className="flex flex-col gap-2 p-3">
        <SearchField
          label={_('Search past meetings')}
          placeholder={_('Search past meetings…')}
          value={draft}
          onChange={setDraft}
          onSubmit={(v) => setQ(v.trim())}
        />
        {search.isFetching ? <Spinner label={_('Searching…')} /> : null}
        {q && search.data && !hits.length ? (
          <p className="m-0 type-callout text-text-secondary">{_('Nothing found in other meetings.')}</p>
        ) : null}
        {hits.length ? (
          <ul aria-label={_('Search results')} className="m-0 flex list-none flex-col gap-1 p-0">
            {hits.map((h) => (
              <SearchHitRow key={`${h.sessionId}:${h.segmentId}`} view={view} hit={h} />
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  )
}
