import { formatDuration } from '@kacola/ui-core/format'
import { _, fmt } from '@kacola/ui-core/i18n'
import { Button as AriaButton } from 'react-aria-components'
import { IconButton } from './icon-button.tsx'

// The record control — the brand moment (brand spec, "Record button"). Pure: the screen owns the
// session and passes its state; this only draws it and reports presses.
//
//   idle       record-red pill: white 10px dot + "Record"
//   starting   the same, disabled, "Starting…"
//   recording  a live chip (pulsing red ring + mono elapsed timer), Pause, and Stop (ink pill, white
//              rounded square)
//   paused     the chip with a still dot and "Paused", Resume, Stop
//   stopping   the chip, Stop disabled "Stopping…"
//
// Accessible names stay "Record" / "Stop" / "Pause" / "Resume" (the e2e contract); the chip is a
// role="timer" named "Recording, 3:12".

export type RecordState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping'

const PRESS =
  'app-no-drag inline-flex h-9 shrink-0 cursor-default select-none items-center gap-2 rounded-pill px-3.5 font-display text-[15px] font-semibold leading-none focus-ring transition-[background-color,transform] duration-(--k-duration-fast) ease-out data-[pressed]:translate-y-[0.5px] data-[disabled]:opacity-45'

export function RecordButton({
  state,
  elapsedMs = 0,
  onRecord,
  onStop,
  onPause,
  onResume,
  compact = false,
}: {
  state: RecordState
  elapsedMs?: number
  onRecord?: () => void
  onStop?: () => void
  /** Omit to hide Pause / Resume (a surface too small for three controls). */
  onPause?: () => void
  onResume?: () => void
  /** Icon-only Pause/Resume and a shorter Stop, for narrow header bars. */
  compact?: boolean
}) {
  if (state === 'idle' || state === 'starting') {
    return (
      <AriaButton
        onPress={onRecord}
        isDisabled={state === 'starting'}
        aria-description={_('Start recording a new session')}
        className={`${PRESS} bg-record-fill text-text-on-accent data-[hovered]:bg-record-fill-hover`}
      >
        <span aria-hidden="true" className="size-2.5 rounded-full bg-text-on-accent" />
        {state === 'starting' ? _('Starting…') : _('Record')}
      </AriaButton>
    )
  }
  const live = state === 'recording'
  const time = formatDuration(elapsedMs)
  return (
    <div className="flex items-center gap-1.5">
      <span
        role="timer"
        aria-live="off"
        aria-label={fmt(live ? _('Recording, {time}') : _('Paused, {time}'), { time })}
        className="flex h-9 items-center gap-2 rounded-pill bg-bg-surface px-3 shadow-e1"
      >
        <span aria-hidden="true" className="relative flex size-2.5">
          {live ? <span className="record-pulse absolute inset-0 rounded-full bg-accent-record" /> : null}
          <span
            className={`relative size-2.5 rounded-full ${live ? 'bg-accent-record' : 'bg-text-tertiary'}`}
          />
        </span>
        <span className="type-mono text-text-primary">{time}</span>
        {!live ? <span className="type-caption text-text-secondary">{_('Paused')}</span> : null}
      </span>
      {onPause && state === 'recording' ? (
        <IconButton icon="pause" label={_('Pause')} tooltip={_('Pause recording')} onPress={onPause} />
      ) : null}
      {onResume && state === 'paused' ? (
        <IconButton icon="play" label={_('Resume')} tooltip={_('Resume recording')} onPress={onResume} />
      ) : null}
      <AriaButton
        onPress={onStop}
        isDisabled={state === 'stopping'}
        aria-label={state === 'stopping' ? _('Stopping…') : _('Stop')}
        aria-description={_('Stop recording the current session')}
        className={`${PRESS} bg-ink-primary text-text-on-ink data-[hovered]:bg-[color-mix(in_srgb,var(--k-color-ink-primary)_86%,var(--k-color-bg-window))] ${compact ? 'px-3' : ''}`}
      >
        <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-text-on-ink" />
        {compact ? null : state === 'stopping' ? _('Stopping…') : _('Stop')}
      </AriaButton>
    </div>
  )
}
