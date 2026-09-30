import type { Session, TrackKind } from '@gnomeola/protocol'
import { elapsedMs, formatClockTime, formatDuration, statusLabel } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import type { SessionsState } from '@gnomeola/ui-core/sessions'
import { type QueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { optimistic, patchSessionIn, renameSessionMutation } from '../../data/mutations.ts'
import type { Api } from '../../data/queries.ts'
import { useServices } from '../../data/services.tsx'
import { Button, Row, RowGroup, Switch, TextField, useToast } from '../../design/primitives/index.ts'

// The Details tab: what the GTK app's Details page shows (status, started, duration, tracks,
// visibility, error), plus the two things a user may change about a session: its title and whether it
// is private (hidden from the CLI and the Claude skill).

export const TRACK_LABEL: Record<TrackKind, () => string> = {
  mic: () => _('Microphone'),
  system: () => _('System audio'),
}

function privacyMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['setPrivate'],
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.call('updateSession', { params: { id }, body: { private: value } }),
    ...optimistic<{ id: string; value: boolean }>(qc, ({ id, value }) => [
      {
        key: keys.sessions(),
        update: (p) => patchSessionIn(p as SessionsState, id, (s) => ({ ...s, private: value })),
      },
      { key: keys.session(id), update: (p) => ({ ...(p as Session), private: value }) },
    ]),
  }
}

function TitleRow({ session }: { session: Session }) {
  const { api, queryClient } = useServices()
  const toast = useToast()
  const rename = useMutation(renameSessionMutation(api, queryClient))
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? session.title
  const commit = () => {
    const title = value.trim()
    setDraft(null)
    if (!title || title === session.title) return
    rename.mutate(
      { id: session.id, title },
      {
        onError: (e) =>
          toast(
            fmt(_('Could not rename the session: {reason}'), {
              reason: e instanceof Error ? e.message : String(e),
            }),
            { tone: 'error' },
          ),
      },
    )
  }
  return (
    <Row title={_('Title')} stacked>
      <div className="flex items-end gap-2">
        <TextField
          label={_('Title')}
          labelHidden
          className="flex-1"
          value={value}
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
        <Button onPress={commit} isDisabled={draft === null || draft.trim() === session.title}>
          {_('Rename')}
        </Button>
      </div>
    </Row>
  )
}

export function SessionDetails({ session }: { session: Session }) {
  const { api, queryClient } = useServices()
  const toast = useToast()
  const setPrivate = useMutation(privacyMutation(api, queryClient))
  const now = useNow(session.status === 'recording' ? 1000 : 30_000)
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 pt-2 pb-8 sm:px-6">
      <RowGroup title={_('Details')}>
        <Row title={_('Status')} subtitle={statusLabel(session.status)} />
        <Row
          title={_('Started')}
          subtitle={session.startedAt ? formatClockTime(session.startedAt, now) : _('Not started')}
        />
        <Row title={_('Duration')} subtitle={formatDuration(elapsedMs(session, now))} />
        <Row
          title={_('Tracks')}
          subtitle={session.tracks.map((t) => TRACK_LABEL[t.kind]()).join(', ') || _('None')}
        />
        {session.error ? <Row title={_('Error')} subtitle={session.error} /> : null}
      </RowGroup>
      <RowGroup title={_('Session')}>
        <TitleRow key={session.id} session={session} />
        <Row
          title={_('Private')}
          subtitle={_('Hidden from the command-line tool and the Claude skill')}
          labelId={`private-${session.id}`}
        >
          <Switch
            aria-label={_('Private')}
            isSelected={session.private}
            onChange={(value) =>
              setPrivate.mutate(
                { id: session.id, value },
                {
                  onError: (e) =>
                    toast(
                      fmt(_('Could not change the session: {reason}'), {
                        reason: e instanceof Error ? e.message : String(e),
                      }),
                      { tone: 'error' },
                    ),
                },
              )
            }
          />
        </Row>
      </RowGroup>
    </div>
  )
}
