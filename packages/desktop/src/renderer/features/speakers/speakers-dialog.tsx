import { ME, type SpeakerSummary, THEM } from '@kacola/protocol'
import { formatDuration } from '@kacola/ui-core/format'
import { _, fmt, ngettext } from '@kacola/ui-core/i18n'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Menu,
  MenuGroup,
  MenuItem,
  TextField,
} from '../../design/primitives/index.ts'
import { speakerName } from '../transcript/rows.ts'
import { mergeSpeakerMutation, renameSpeakerMutation, speakerError } from './mutations.ts'
import { SpeakerSwatch } from './speaker-chip.tsx'

// A-5: the session's speakers. Far-end speakers can be renamed inline and merged into another; a line
// is split off from the transcript (LineActions). `me` (the microphone) is never renamed, merged or
// split. Every change is an optimistic mutation; the daemon's durable echo reconciles it, so another
// window (or the CLI) sees the same — and a refusal (duplicate or reserved name) rolls it back and is
// shown, never swallowed. A voiceprint link (A-6) shows as "Recognised from an earlier meeting".

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
  // the field replaces the Rename button that was just pressed: take the keyboard straight to it, once
  // the dialog's focus scope has finished reacting to the button going away
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const input = box.current?.querySelector('input')
        input?.focus()
        input?.select()
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])
  return (
    <div ref={box}>
      <TextField
        label={fmt(_('New name for {speaker}'), { speaker: s.label })}
        labelHidden
        value={value}
        onChange={setValue}
        isInvalid={rename.isError}
        className="w-44"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            // end the edit, not the dialog
            e.preventDefault()
            e.stopPropagation()
            onDone()
          }
        }}
      />
    </div>
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
      className="flex min-h-14 items-center gap-3 border-b border-border-subtle py-2 last:border-b-0"
    >
      <SpeakerSwatch speaker={s.id} colour={s.colour} label={s.label} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body-strong text-text-primary">{speakerName(s.label)}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 type-caption text-text-secondary">
          {s.voiceprintId ? (
            <span className="inline-flex items-center gap-1 text-status-success-text">
              <Icon name="recognised" size={14} />
              {_('Recognised from an earlier meeting')}
              <span aria-hidden>·</span>
            </span>
          ) : null}
          {role ? (
            <>
              <span>{role}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="tabular-nums">{talk}</span>
        </span>
      </div>
      {editable(s) ? (
        <div className="flex items-center gap-1">
          {editing ? (
            <RenameField sessionId={sessionId} s={s} onDone={() => setEditing(false)} onError={onError} />
          ) : (
            <IconButton
              icon="edit"
              label={fmt(_('Rename {speaker}'), { speaker: s.label })}
              tooltip={_('Rename')}
              onPress={() => setEditing(true)}
            />
          )}
          {others.length ? (
            <Menu
              label={fmt(_('Merge {speaker} into…'), { speaker: s.label })}
              trigger={
                <IconButton
                  icon="merge"
                  label={fmt(_('Merge {speaker} into…'), { speaker: s.label })}
                  tooltip={_('Merge into another speaker')}
                />
              }
            >
              <MenuGroup title={_('Same person as…')}>
                {others.map((o) => (
                  <MenuItem
                    key={o.id}
                    textValue={o.label}
                    onAction={() => {
                      onError(null)
                      merge.mutate(
                        { sessionId, fromId: s.id, intoId: o.id },
                        { onError: (e) => onError(speakerError(e)) },
                      )
                    }}
                  >
                    {/* the accessible name says the whole action; the menu shows the name */}
                    <span className="sr-only">{fmt(_('Merge {speaker} into'), { speaker: s.label })} </span>
                    {o.label}
                  </MenuItem>
                ))}
              </MenuGroup>
            </Menu>
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
  const q = useQuery({ ...queries.speakers(sessionId), enabled: isOpen })
  const [error, setError] = useState<string | null>(null)
  const list = q.data?.list ?? []
  const far = list.filter(editable)
  return (
    <Dialog
      title={_('Speakers')}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) return
        setError(null)
        onClose()
      }}
    >
      <p className="mt-0 mb-3 type-callout text-text-secondary">
        {_(
          'Your microphone is always you. The other side is told apart by voice: name people, merge two that are the same person, or split a line off from the transcript.',
        )}
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-0 mb-3 rounded-md border border-status-danger bg-bg-surface px-3 py-2 type-callout text-status-danger-text select-text"
        >
          {error}
        </p>
      ) : null}
      {q.isError ? (
        <p role="alert" className="mt-0 mb-3 type-callout text-status-danger-text">
          {q.error.message}
        </p>
      ) : null}
      <ul
        aria-label={_('Speakers')}
        className="m-0 list-none rounded-lg border border-border-default bg-bg-surface px-3 py-0"
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
    </Dialog>
  )
}

/** The session page's header-bar button that opens the dialog. */
export function SpeakersButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="sm" icon="speakers" onPress={() => setOpen(true)}>
        {_('Speakers')}
      </Button>
      <SpeakersDialog sessionId={sessionId} isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
