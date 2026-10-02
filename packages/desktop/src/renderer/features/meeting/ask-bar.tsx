import type { Citation } from '@gnomeola/protocol'
import { _ } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, IconButton, TextField, useToast } from '../../design/primitives/index.ts'
import { pinText, Turn, useAsk } from '../ask/ask-answer.tsx'
import { atLine } from './search-params.ts'

// Ask, on demand: a command bar (Ctrl+K) laid over the bottom of the notepad — never a screen of its
// own. The latest answer shows above the box with "Pin to notes" (it goes into the notes as a quote,
// citations as times); a citation opens the transcript panel at the line and the answer stays put.
// Inline in Prep, where there are no notes yet: there, pinning keeps the answer as a private card.

export function AskBar({
  askKey,
  sessionId,
  label,
  placeholder,
  onPin,
  pinLabel,
  onClose,
  inline = false,
}: {
  askKey: string
  /** Ask about this recording; null: across recent meetings (private ones left out). */
  sessionId: string | null
  label: string
  placeholder: string
  onPin?: (text: string) => void
  pinLabel?: string
  onClose?: () => void
  inline?: boolean
}) {
  const ask = useAsk(askKey, sessionId)
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const last = ask.turns.at(-1)
  const submit = () => {
    if (!q.trim() || ask.asking) return
    ask.ask(q)
    setQ('')
  }
  const onCite = (c: Citation) =>
    void (c.sessionId === sessionId
      ? // a fresh state makes following the same citation again a new navigation (it re-scrolls)
        navigate({
          to: '.',
          search: atLine(c.segmentId, c.startMs),
          replace: true,
          state: { cite: Date.now() } as never,
        })
      : navigate({
          to: '/sessions/$sessionId',
          params: { sessionId: c.sessionId },
          search: atLine(c.segmentId, c.startMs),
        }))
  const pin = last ? pinText(last) : null
  return (
    <Card
      as="section"
      aria-label={label}
      className={`flex flex-col gap-3 p-4 ${inline ? '' : 'max-h-[60vh] shadow-e3'}`}
    >
      {last ? (
        <div className="min-h-0 overflow-y-auto">
          <Turn
            turn={last}
            onCite={onCite}
            scope={ask.scopeOf(last.requestId)}
            onRetry={() => ask.ask(last.question)}
            actions={
              onPin && pin ? (
                <Button
                  size="sm"
                  icon="add"
                  onPress={() => {
                    onPin(pin)
                    toast(_('Pinned to your notes'))
                  }}
                >
                  {pinLabel ?? _('Pin to notes')}
                </Button>
              ) : null
            }
          />
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <TextField
          label={label}
          labelHidden
          placeholder={placeholder}
          value={q}
          onChange={setQ}
          autoFocus={!inline}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape' && onClose) {
              e.preventDefault()
              onClose()
            }
          }}
        />
        {ask.streaming ? (
          <Button icon="stop" onPress={ask.stop}>
            {_('Stop')}
          </Button>
        ) : (
          <Button variant="primary" icon="arrowUp" isDisabled={!q.trim() || ask.asking} onPress={submit}>
            {_('Ask')}
          </Button>
        )}
        {onClose ? <IconButton icon="close" label={_('Close Ask')} onPress={onClose} /> : null}
      </div>
      <p className="m-0 type-caption text-text-tertiary">
        {sessionId
          ? _('Asking sends the matching parts of this transcript to your AI provider.')
          : _(
              'Asking sends matching parts of your past meetings to your AI provider. Private meetings are left out.',
            )}
      </p>
    </Card>
  )
}
