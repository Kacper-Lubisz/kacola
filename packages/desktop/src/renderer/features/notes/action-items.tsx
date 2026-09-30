import { type ActionItem, extractActionItems } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useMemo } from 'react'
import { Icon, IconButton } from '../../design/primitives/index.ts'

// N-5 — action items parsed live from the notes as they are typed (the same deterministic parser the
// daemon, CLI and skill use): task-list items anywhere, list items under an action-items heading, with
// the owner and due date only where the notes state them.

/** The items as a markdown task list (what "Copy Action Items" puts on the clipboard). */
export function actionItemsMarkdown(items: readonly ActionItem[]): string {
  const lines = items.map(
    (i) =>
      `- [${i.done ? 'x' : ' '}] ${i.text}${i.owner ? ` — ${fmt(_('owner: {owner}'), { owner: i.owner })}` : ''}${i.due ? ` — ${fmt(_('due: {due}'), { due: i.due })}` : ''}`,
  )
  return `${lines.join('\n')}\n`
}

export function ActionItems({ markdown, onCopy }: { markdown: string; onCopy: (text: string) => void }) {
  const items = useMemo(() => extractActionItems(markdown), [markdown])
  if (!items.length) return null
  return (
    <section
      aria-labelledby="notes-action-items"
      className="mx-auto mb-4 flex w-[calc(100%-48px)] max-w-[672px] flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface px-4 pt-3 pb-2 shadow-e1"
    >
      <div className="flex items-center gap-2">
        <h2 id="notes-action-items" className="m-0 flex-1 font-display text-[15px] font-semibold">
          {_('Action Items')}
        </h2>
        <IconButton
          icon="copy"
          label={_('Copy Action Items')}
          onPress={() => onCopy(actionItemsMarkdown(items))}
        />
      </div>
      <ul aria-label={_('Action items')} className="m-0 flex max-h-48 list-none flex-col overflow-y-auto p-0">
        {items.map((i, n) => {
          const meta = [
            i.owner ? fmt(_('Owner: {owner}'), { owner: i.owner }) : null,
            i.due ? fmt(_('Due: {due}'), { due: i.due }) : null,
          ].filter((x): x is string => x !== null)
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: items are derived positionally from the text
              key={n}
              aria-label={i.text}
              aria-description={[i.done ? _('Done') : _('Open'), ...meta].join(' · ')}
              className="flex items-start gap-2.5 border-t border-border-subtle py-2 first:border-t-0"
            >
              {i.done ? (
                <Icon name="success" size={18} className="mt-0.5 shrink-0 text-status-success" />
              ) : (
                <Icon name="task" size={18} className="mt-0.5 shrink-0 text-text-tertiary" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className={`text-body ${i.done ? 'text-text-secondary line-through' : ''}`}>
                  {i.text}
                </span>
                {meta.length ? (
                  <span className="text-caption text-text-secondary">{meta.join(' · ')}</span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
