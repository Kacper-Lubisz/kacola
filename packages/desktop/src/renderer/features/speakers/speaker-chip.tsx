import { ME, THEM } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import '../transcript/transcript.css'
import { speakerName } from '../transcript/rows.ts'

// Speaker chips (brand spec: pill 24px, 14% tint of speaker.N, 8px dot, caption 600). The colour is the
// daemon's palette slot (Speaker.colour, assigned at creation and never reused), so a chip keeps its
// colour through renames and merges whatever order the list is in. The daemon has 8 slots, the brand
// six colours: slot n shows speaker.((n mod 6) + 1). `me` is ink; `them` (unattributed) is neutral.

const BRAND_COLOURS = 6

export function slotOf(colour: number | null, speaker: string): string | undefined {
  if (speaker === ME) return 'me'
  if (colour === null || speaker === THEM) return undefined
  return String((((colour % BRAND_COLOURS) + BRAND_COLOURS) % BRAND_COLOURS) + 1)
}

/** The chip's colour in words, for screen readers and the e2e tests (the daemon's slot, 1-based). */
export const colourDescription = (colour: number | null, speaker: string): string =>
  speaker === ME
    ? _('your colour')
    : colour === null
      ? _('no colour')
      : fmt(_('colour {n}'), { n: colour + 1 })

export function SpeakerChip({ speaker, colour }: { speaker: string; colour: number | null }) {
  return (
    <span
      data-slot={slotOf(colour, speaker)}
      aria-description={colourDescription(colour, speaker)}
      className="k-speaker k-speaker-chip inline-flex h-6 max-w-full items-center gap-1.5 rounded-pill pr-2.5 pl-2 type-caption font-semibold text-text-primary"
    >
      <span aria-hidden className="k-speaker-dot size-2 shrink-0 rounded-pill" />
      <span className="truncate">{speakerName(speaker)}</span>
    </span>
  )
}

/** A round swatch (dialog rows): the speaker's colour, with an accessible "Name, colour N". */
export function SpeakerSwatch({
  speaker,
  colour,
  label,
}: {
  speaker: string
  colour: number | null
  label: string
}) {
  // an unnamed voice ("Speaker 2") shows its number: every one of them starting with S says nothing
  const name = speakerName(label).trim()
  const initial = speaker === ME ? '' : (/^\S+\s+(\d{1,2})$/.exec(name)?.[1] ?? name.charAt(0).toUpperCase())
  return (
    <span
      role="img"
      aria-label={fmt(_('{speaker}, {colour}'), {
        speaker: speakerName(label),
        colour: colourDescription(colour, speaker),
      })}
      data-slot={slotOf(colour, speaker)}
      className="k-speaker k-speaker-swatch inline-flex size-8 shrink-0 items-center justify-center rounded-pill font-display text-[14px] font-bold"
    >
      {speaker === ME ? (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19v3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3" />
        </svg>
      ) : (
        initial
      )}
    </span>
  )
}
