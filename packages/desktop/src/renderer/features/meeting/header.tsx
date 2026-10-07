import type { Session, TrackKind } from '@kacola/protocol'
import { elapsedMs, formatDuration } from '@kacola/ui-core/format'
import { useNow } from '@kacola/ui-core/hooks'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef } from 'react'
import { create, useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { Button, HeaderBar, Icon, IconButton } from '../../design/primitives/index.ts'
import { useRecorder } from '../sessions/recorder.ts'
import { useMeetingUi } from './meeting-ui.ts'
import { captureWarning, SILENCE_RMS, type StartedBy, startedBy, type TrackHeard } from './phase.ts'

// The meeting page's header: Back to Today, the title, and the phase's actions (no phase trail: the page
// and the recording pill already say where the meeting is). While live, the recording state lives here and nowhere else: one
// pill (a red dot and the mono clock while recording; no red and "Paused" while paused; who started
// it), Pause / Resume and Stop. A quiet "can't hear you / them" line appears only when capture looks
// broken.

/** Where Back goes: home as it was left (its query, so Back from a search result returns to it). */
export const useHomeQuery = create<{ q: string; set: (q: string) => void }>((set) => ({
  q: '',
  set: (q) => set({ q }),
}))

export function BackButton() {
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      icon="back"
      onPress={() => {
        const q = useHomeQuery.getState().q
        void navigate({ to: '/', search: q ? { q } : {} })
      }}
      aria-label={_('Back to Today')}
    >
      {_('Today')}
    </Button>
  )
}

export function MeetingHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <>
      <HeaderBar start={<BackButton />} />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-border-subtle px-4 pb-4 sm:px-6">
        <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-1">
          {title}
          {meta ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 type-callout text-text-secondary">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </>
  )
}

/** The separator between a header's facts ("14:00–14:30 · Work · Repeats"): its own element, so the space either side is the same. */
export function MetaDot() {
  return (
    <span aria-hidden="true" className="text-text-tertiary">
      ·
    </span>
  )
}

const STARTED: Record<Exclude<StartedBy, null>, () => string> = {
  you: () => _('started by you'),
  calendar: () => _('started by your calendar'),
  mic: () => _('started by the microphone rule'),
}

/** The one recording pill: dot, state, clock, who started it. Paused is plainly different: no red. */
export function RecordingPill({ session }: { session: Session }) {
  const { queries } = useServices()
  const recording = session.status === 'recording'
  const now = useNow(recording ? 1000 : 60_000)
  const startedHere = useMeetingUi((s) => s.startedHere)
  const settings = useQuery(queries.settings()).data
  const by = startedBy(session, { startedHere, calendarRule: settings?.autoRecord.calendar ?? false })
  const time = formatDuration(elapsedMs(session, now))
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-pill border px-3.5 ${
        recording ? 'border-border-default bg-bg-surface' : 'border-transparent bg-bg-sidebar'
      }`}
    >
      <span
        role="timer"
        aria-live="off"
        aria-label={fmt(recording ? _('Recording, {time}') : _('Paused, {time}'), { time })}
        className="inline-flex items-center gap-2"
      >
        <span aria-hidden="true" className="relative flex size-2.5">
          {recording ? (
            <span className="record-pulse absolute inset-0 rounded-full bg-accent-record" />
          ) : null}
          {recording ? (
            <span className="relative size-2.5 rounded-full bg-accent-record" />
          ) : (
            <Icon name="pause" size={12} className="relative text-text-secondary" />
          )}
        </span>
        <span className={`type-body-strong ${recording ? 'text-accent-record-text' : 'text-text-secondary'}`}>
          {recording ? _('Recording') : _('Paused')}
        </span>
        <span className={`type-mono ${recording ? 'text-text-primary' : 'text-text-secondary'}`}>{time}</span>
      </span>
      {by ? <span className="hidden type-caption text-text-secondary md:inline">{STARTED[by]()}</span> : null}
    </span>
  )
}

/** Pause / Resume and Stop for the live recording (the recorder hook: the same as Ctrl+R / Ctrl+Shift+P). */
export function RecordingControls({ session }: { session: Session }) {
  const recorder = useRecorder()
  const mine = recorder.active?.id === session.id
  if (!mine) return null
  return (
    <>
      {recorder.state === 'recording' ? (
        <Button icon="pause" onPress={recorder.pause} aria-label={_('Pause')}>
          <span className="max-sm:hidden">{_('Pause')}</span>
        </Button>
      ) : null}
      {recorder.state === 'paused' ? (
        <Button icon="play" onPress={recorder.resume} aria-label={_('Resume')}>
          <span className="max-sm:hidden">{_('Resume')}</span>
        </Button>
      ) : null}
      <Button
        variant="primary"
        icon="stop"
        onPress={recorder.stop}
        isDisabled={recorder.state === 'stopping'}
        aria-label={recorder.state === 'stopping' ? _('Stopping…') : _('Stop')}
        aria-description={_('Stop recording this meeting')}
      >
        <span className="max-sm:hidden">{recorder.state === 'stopping' ? _('Stopping…') : _('Stop')}</span>
      </Button>
    </>
  )
}

/**
 * Tracks, per capture track, the last level event and the last real sound (above digital silence), and
 * says which tracks look broken (phase.ts captureWarning). Levels are ephemeral store state.
 */
export function useCaptureWarning(session: Session): TrackKind[] {
  const { store } = useServices()
  const levels = useStore(store, (s) => s.levels[session.id])
  const heard = useRef<Partial<Record<TrackKind, TrackHeard>>>({})
  const recording = session.status === 'recording'
  const since = useRef<number | null>(null)
  const now = useNow(5000).getTime()
  if (recording && since.current === null) since.current = Date.now()
  if (!recording) since.current = null
  useEffect(() => {
    for (const t of ['mic', 'system'] as const) {
      const l = levels?.[t]
      if (!l) continue
      const h = heard.current[t] ?? { lastEventAt: null, lastSoundAt: null }
      heard.current[t] = {
        lastEventAt: l.at,
        lastSoundAt: l.rms > SILENCE_RMS ? l.at : h.lastSoundAt,
      }
    }
  }, [levels])
  return captureWarning(
    heard.current,
    session.tracks.map((t) => t.kind),
    since.current,
    now,
  )
}

/** "kacola can't hear you" — only when capture looks broken. */
export function CaptureWarning({ session }: { session: Session }) {
  const broken = useCaptureWarning(session)
  if (!broken.length) return null
  const text =
    broken.length === 2
      ? _('kacola can’t hear anyone. Recording continues; check your microphone and sound output.')
      : broken[0] === 'mic'
        ? _('kacola can’t hear you. Recording continues; check your microphone.')
        : _('kacola can’t hear the other side. Recording continues; check your sound output.')
  return (
    <p role="status" className="m-0 inline-flex items-center gap-1.5 type-callout text-status-warning-text">
      <Icon name="micOff" size={15} />
      {text}
    </p>
  )
}

/** A quiet toggle for an on-demand panel (Ask, Transcript), with its shortcut. */
export function PanelToggle({
  icon,
  label,
  shortcut,
  pressed,
  onPress,
}: {
  icon: 'ask' | 'transcript'
  label: string
  shortcut: string
  pressed: boolean
  onPress: () => void
}) {
  return (
    <IconButton
      icon={icon}
      label={label}
      tooltip={`${label} (${shortcut})`}
      aria-pressed={pressed}
      onPress={onPress}
    />
  )
}
