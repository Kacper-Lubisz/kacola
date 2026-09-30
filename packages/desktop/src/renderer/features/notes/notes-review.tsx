import type { Hunk, MergeChoice } from '@gnomeola/protocol'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { type Review, reviewChanges, setAll, setChoice, sideText, startReview } from '@gnomeola/ui-core/notes'
import { useState } from 'react'
import { Button, Switch } from '../../design/primitives/index.ts'

// N-4 — the review of an enhanced version against the head, built on @gnomeola/protocol's notes-diff
// (the daemon recomputes the same hunks, so "change 3" means the same blocks on both sides). One card
// per change: your notes beside the enhanced text, a switch "Use enhanced text for change N". Defaults
// take what enhancement added or rewrote and KEEP every line of yours it left out. Nothing is written
// until Apply; Discard keeps the notes exactly as they are. Both versions stay in history either way.

const KIND_LABEL: Record<Exclude<Hunk['kind'], 'same'>, () => string> = {
  added: () => _('Added'),
  changed: () => _('Rewritten'),
  removed: () => _('Left out'),
}

function Side({ title, text, chosen }: { title: string; text: string | null; chosen: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border px-3 py-2.5 ${
        chosen ? 'border-border-strong bg-bg-surface' : 'border-transparent bg-bg-sidebar'
      }`}
    >
      <span className="type-overline text-text-secondary">
        {title}
        {chosen ? <span className="sr-only"> ({_('kept')})</span> : null}
      </span>
      <p
        className={`m-0 whitespace-pre-wrap break-words text-body ${
          text === null ? 'text-text-secondary italic' : chosen ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        {text ?? _('(nothing)')}
      </p>
    </div>
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
  const title = fmt(_('Change {n} · {kind}'), { n, kind: KIND_LABEL[hunk.kind]() })
  return (
    <article
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-e1"
    >
      <div className="flex items-center gap-3">
        <h3 className="m-0 flex-1 font-display text-[15px] font-semibold">{title}</h3>
        <Switch
          isSelected={useEnhanced}
          onChange={(v) => onChoose(v ? 'enhanced' : 'mine')}
          aria-label={fmt(_('Use enhanced text for change {n}'), { n })}
        >
          <span aria-hidden="true" className="type-callout text-text-secondary">
            {_('Use enhanced')}
          </span>
        </Switch>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Side title={_('Your notes')} text={mine} chosen={!useEnhanced} />
        <Side title={_('Enhanced')} text={enhanced} chosen={useEnhanced} />
      </div>
    </article>
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-2 px-6 pt-5 pb-4">
        <h2 className="m-0 type-title2">{_('Review Enhanced Notes')}</h2>
        <p className="m-0 text-callout text-text-secondary">
          {fmt(
            ngettext(
              '{template} template · {count} change · {accepted} using the enhanced text',
              '{template} template · {count} changes · {accepted} using the enhanced text',
              changes.length,
            ),
            { template: templateName, count: changes.length, accepted },
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" onPress={() => setReview((r) => setAll(r, 'enhanced'))}>
            {_('Use All Enhanced')}
          </Button>
          <Button size="sm" onPress={() => setReview((r) => setAll(r, 'mine'))}>
            {_('Keep All Mine')}
          </Button>
          <span className="flex-1" />
          <Button
            variant="ghost"
            isDisabled={busy}
            aria-describedby="notes-discard-desc"
            onPress={() => onApply(review.hunks.map(() => 'mine'))}
          >
            {_('Discard')}
          </Button>
          <Button
            variant="primary"
            isDisabled={busy}
            aria-describedby="notes-apply-desc"
            onPress={() => onApply(review.choices)}
          >
            {_('Apply')}
          </Button>
          <span id="notes-discard-desc" hidden>
            {_('Close the review and keep your notes exactly as they are')}
          </span>
          <span id="notes-apply-desc" hidden>
            {_('Replace your notes with the reviewed version; the original stays in history')}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border-subtle">
        <section
          aria-label={_('Changes')}
          className="mx-auto flex w-full max-w-[960px] flex-col gap-3 px-6 pt-4 pb-10"
        >
          {changes.length === 0 ? (
            <p className="m-0 text-body text-text-secondary">
              {_('The enhanced notes are the same as yours.')}
            </p>
          ) : null}
          {review.hunks.map((hunk, index) => {
            if (hunk.kind === 'same')
              return (
                <p
                  // biome-ignore lint/suspicious/noArrayIndexKey: hunks are positional and never reorder
                  key={index}
                  className="m-0 whitespace-pre-wrap break-words px-4 text-body text-text-secondary"
                >
                  {sideText(hunk.mine)}
                </p>
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
        </section>
      </div>
    </div>
  )
}
