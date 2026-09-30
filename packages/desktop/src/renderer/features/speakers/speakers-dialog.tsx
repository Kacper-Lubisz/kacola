import { ME, type SpeakerSummary, THEM } from '@gnomeola/protocol'
import { formatDuration } from '@gnomeola/ui-core/format'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { LIcon } from '../transcript/local-icons.tsx'
import { KDialog, KIconButton, KMenu, KNotice, KTextField } from '../transcript/local-primitives.tsx'
import { speakerName } from '../transcript/rows.ts'
import { mergeSpeakerMutation, renameSpeakerMutation, speakerError } from './mutations.ts'
import { SpeakerSwatch } from './speaker-chip.tsx'

// A-5: the session's speakers. Far-end speakers can be renamed inline and merged into another; a line
// is split off from the transcript (LineActions). `me` (the microphone) is never renamed, merged or
// split. Every change is an optimistic mutation; the daemon's durable echo reconciles it, so another
// window (or the CLI) sees the same — and a refusal (duplicate or reserved name) rolls it back and is
// shown, never swallowed.

const editable = (s: SpeakerSummary) => s.id !== ME && s.id !== THEM

function RenameField({
  sessionId,
  s,
  onDone,
  onError,
}: {
  sessionId: string
  s: SpeakerSummary
  onDone: () => void
  onError: (m: string | null) => void
}) {
  const { api, queryClient } = useServices()
  const [value, setValue] = useState(s.label)
  const rename = useMutation(renameSpeakerMutation(api, queryClient))
  const submit = () => {
    const label = value.trim()
    if (rename.isPending) return
    if (!label || label === s.label) return onDone()
    onError(null)
    rename.mutate(
      { sessionId, speaker: s, label },
      { onSuccess: () => onDone(), onError: (e) => onError(speakerError(e)) },
    )
  }
  return (
    <KTextField
      label={fmt(_('New name for {speaker}'), { speaker: s.label })}
      value={value}
      onChange={setValue}
      onEnter={submit}
      onEscape={onDone}
      autoFocus
      className="w-44"
      isInvalid={rename.isError}
    />
  )
}

function SpeakerRow({
  sessionId,
  s,
  others,
  onError,
}: {
  sessionId: string
  s: SpeakerSummary
  others: SpeakerSummary[]
  onError: (m: string | null) => void
}) {
  const { api, queryClient } = useServices()
  const [editing, setEditing] = useState(false)
  const merge = useMutation(mergeSpeakerMutation(api, queryClient))
  const talk = s.segments
    ? fmt(ngettext('{n} line · {time}', '{n} lines · {time}', s.segments), {
        n: s.segments,
        time: formatDuration(s.talkMs),
      })
    : _('No lines yet')
  const role = s.id === ME ? _('You (microphone)') : s.id === THEM ? _('Far end, not yet told apart') : null
  return (
    <li
      aria-label={speakerName(s.label)}
      className="flex items-center gap-3 border-b border-border-subtle px-1 py-2.5 last:border-b-0"
    >
      <SpeakerSwatch speaker={s.id} colour={s.colour} label={s.label} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-body-strong truncate text-text-primary">{speakerName(s.label)}</span>
        <span className="type-caption flex items-center gap-1.5 text-text-secondary">
          {s.voiceprintId ? (
            <span className="inline-flex items-center gap-1 text-status-success">
              <LIcon name="badgeCheck" size={14} />
              <span>{_('Recognised from an earlier meeting')}</span>
              <span aria-hidden>·</span>
            </span>
          ) : null}
          {role ? (
            <>
              <span>{role}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="font-mono tabular-nums">{talk}</span>
        </span>
      </div>
      {editable(s) ? (
        <div className="flex items-center gap-1">
          {editing ? (
            <RenameField sessionId={sessionId} s={s} onDone={() => setEditing(false)} onError={onError} />
          ) : (
            <KIconButton
              icon="pencil"
              label={fmt(_('Rename {speaker}'), { speaker: s.label })}
              onPress={() => setEditing(true)}
            />
          )}
          {others.length ? (
            <KMenu
              icon="merge"
              label={fmt(_('Merge {speaker} into…'), { speaker: s.label })}
              heading={_('Same person as…')}
              items={others.map((o) => ({
                id: o.id,
                label: o.label,
                name: fmt(_('Merge {speaker} into {other}'), { speaker: s.label, other: o.label }),
              }))}
              onAction={(into) => {
                onError(null)
                merge.mutate(
                  { sessionId, fromId: s.id, intoId: into },
                  { onError: (e) => onError(speakerError(e)) },
                )
              }}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function SpeakersDialog({
  sessionId,
  isOpen,
  onClose,
}: {
  sessionId: string
  isOpen: boolean
  onClose: () => void
}) {
  const { queries } = useServices()
  const q = useQuery(queries.speakers(sessionId))
  const [error, setError] = useState<string | null>(null)
  const list = q.data?.list ?? []
  const far = list.filter(editable)
  return (
    <KDialog
      title={_('Speakers')}
      isOpen={isOpen}
      onClose={() => {
        setError(null)
        onClose()
      }}
    >
      <p className="type-callout mt-0 mb-3 text-text-secondary">
        {_(
          'Your microphone is always you. The other side is told apart by voice: name people, merge two that are the same person, or split a line off from the transcript.',
        )}
      </p>
      {error ? (
        <div className="mb-3">
          <KNotice tone="danger" role="alert">
            {error}
          </KNotice>
        </div>
      ) : null}
      {q.isError ? (
        <div className="mb-3">
          <KNotice tone="danger">{q.error.message}</KNotice>
        </div>
      ) : null}
      <ul
        aria-label={_('Speakers')}
        className="m-0 list-none rounded-lg border border-border-default bg-bg-surface px-3 py-1"
      >
        {list.map((s) => (
          <SpeakerRow
            key={s.id}
            sessionId={sessionId}
            s={s}
            others={far.filter((o) => o.id !== s.id)}
            onError={setError}
          />
        ))}
      </ul>
    </KDialog>
  )
}
