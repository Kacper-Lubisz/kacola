import type { Hunk, MergeChoice } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import * as Pango from '@gtkx/gi/pango'
import { AdwClamp } from '@gtkx/jsx/adw'
import { GtkBox, GtkButton, GtkLabel, GtkScrolledWindow, GtkSwitch } from '@gtkx/jsx/gtk'
import { useState } from 'react'
import { type Review, reviewChanges, setAll, setChoice, sideText, startReview } from '../data/notes.ts'
import { _, fmt, ngettext } from '../i18n/index.ts'

// N-4 — the review of an enhanced version: the user's notes beside the enhanced text, one change at a
// time, each with a switch "use the enhanced text". Unchanged blocks are shown dimmed for context.
// Defaults (data/notes.ts): take additions and rewrites, keep any of the user's lines that the
// enhancement left out. Nothing is written until Apply; Discard keeps the notes exactly as they are.
// Either way both versions stay in the notes' history.

const KIND_LABEL: Record<Exclude<Hunk['kind'], 'same'>, () => string> = {
  added: () => _('Added'),
  changed: () => _('Rewritten'),
  removed: () => _('Left out'),
}

function Side({ title, text, chosen }: { title: string; text: string | null; chosen: boolean }) {
  return (
    <GtkBox
      orientation={Gtk.Orientation.VERTICAL}
      spacing={4}
      hexpand
      cssClasses={chosen ? ['review-side', 'chosen'] : ['review-side']}
    >
      <GtkLabel label={title} cssClasses={['caption-heading', 'dim-label']} xalign={0} />
      <GtkLabel
        label={text ?? _('(nothing)')}
        cssClasses={text === null ? ['dim-label'] : []}
        wrap
        wrapMode={Pango.WrapMode.WORD_CHAR}
        xalign={0}
        selectable={false}
      />
    </GtkBox>
  )
}

function Change({
  n,
  hunk,
  choice,
  onChoose,
}: {
  n: number
  hunk: Exclude<Hunk, { kind: 'same' }>
  choice: MergeChoice
  onChoose: (c: MergeChoice) => void
}) {
  const mine = hunk.kind === 'added' ? null : sideText(hunk.mine)
  const enhanced = hunk.kind === 'removed' ? null : sideText(hunk.enhanced)
  const useEnhanced = choice === 'enhanced'
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={['card', 'review-change']}>
      <GtkBox spacing={8}>
        <GtkLabel
          label={fmt(_('Change {n} · {kind}'), { n, kind: KIND_LABEL[hunk.kind]() })}
          cssClasses={['heading']}
          xalign={0}
          hexpand
        />
        <GtkLabel label={_('Use enhanced')} cssClasses={['dim-label']} />
        <GtkSwitch
          valign={Gtk.Align.CENTER}
          active={useEnhanced}
          accessibleLabel={fmt(_('Use enhanced text for change {n}'), { n })}
          onNotifyActive={(v) => onChoose(v ? 'enhanced' : 'mine')}
        />
      </GtkBox>
      <GtkBox spacing={12} homogeneous>
        <Side title={_('Your notes')} text={mine} chosen={!useEnhanced} />
        <Side title={_('Enhanced')} text={enhanced} chosen={useEnhanced} />
      </GtkBox>
    </GtkBox>
  )
}

export function NotesReview({
  head,
  enhanced,
  templateName,
  onApply,
  busy,
}: {
  head: string
  enhanced: string
  templateName: string
  onApply: (choices: MergeChoice[]) => void
  busy: boolean
}) {
  const [review, setReview] = useState<Review>(() => startReview(head, enhanced))
  const changes = reviewChanges(review)
  const accepted = changes.filter((c) => c.choice === 'enhanced').length
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
      <AdwClamp maximumSize={960} tighteningThreshold={560} marginTop={12} marginStart={12} marginEnd={18}>
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          <GtkLabel
            label={_('Review Enhanced Notes')}
            cssClasses={['title-3']}
            xalign={0}
            accessibleRole={Gtk.AccessibleRole.HEADING}
            accessibleLevel={2}
          />
          <GtkLabel
            label={fmt(
              ngettext(
                '{template} template · {count} change · {accepted} using the enhanced text',
                '{template} template · {count} changes · {accepted} using the enhanced text',
                changes.length,
              ),
              { template: templateName, count: changes.length, accepted },
            )}
            cssClasses={['dim-label']}
            xalign={0}
            wrap
          />
          <GtkBox spacing={6} marginTop={6}>
            <GtkButton
              label={_('Use All Enhanced')}
              onClicked={() => setReview((r) => setAll(r, 'enhanced'))}
            />
            <GtkButton label={_('Keep All Mine')} onClicked={() => setReview((r) => setAll(r, 'mine'))} />
            <GtkBox hexpand />
            <GtkButton
              label={_('Discard')}
              sensitive={!busy}
              accessibleDescription={_('Close the review and keep your notes exactly as they are')}
              onClicked={() => onApply(review.hunks.map(() => 'mine'))}
            />
            <GtkButton
              label={_('Apply')}
              cssClasses={['suggested-action']}
              sensitive={!busy}
              accessibleDescription={_(
                'Replace your notes with the reviewed version; the original stays in history',
              )}
              onClicked={() => onApply(review.choices)}
            />
          </GtkBox>
        </GtkBox>
      </AdwClamp>
      <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <AdwClamp
          maximumSize={960}
          tighteningThreshold={560}
          marginTop={12}
          marginBottom={24}
          marginStart={12}
          marginEnd={18}
        >
          <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} accessibleLabel={_('Changes')}>
            {changes.length === 0 ? (
              <GtkLabel
                label={_('The enhanced notes are the same as yours.')}
                cssClasses={['dim-label']}
                xalign={0}
              />
            ) : null}
            {review.hunks.map((hunk, index) => {
              if (hunk.kind === 'same')
                return (
                  <GtkLabel
                    // biome-ignore lint/suspicious/noArrayIndexKey: hunks are positional and never reorder
                    key={index}
                    label={sideText(hunk.mine)}
                    cssClasses={['dim-label', 'review-same']}
                    wrap
                    xalign={0}
                  />
                )
              const c = changes.find((x) => x.index === index)!
              return (
                <Change
                  // biome-ignore lint/suspicious/noArrayIndexKey: hunks are positional and never reorder
                  key={index}
                  n={c.n}
                  hunk={hunk}
                  choice={c.choice}
                  onChoose={(choice) => setReview((r) => setChoice(r, index, choice))}
                />
              )
            })}
          </GtkBox>
        </AdwClamp>
      </GtkScrolledWindow>
    </GtkBox>
  )
}
