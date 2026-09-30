import { _ } from '@gnomeola/ui-core/i18n'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Icon } from '../icon.tsx'

// Toasts (brand spec): ink fill, text.onInk, radius lg, e2, bottom-centre. Transient messages —
// "Saved", "Could not start recording: …". Plain text only (never markup). One region per window
// (ToastProvider), announced politely; each toast dismisses itself after `timeoutMs` (paused while
// hovered or focused), or by its close button. Anything persistent is a Banner instead.
//
//   const toast = useToast()
//   toast(_('API key saved'))
//   toast(fmt(_('Could not stop recording: {reason}'), { reason }), { tone: 'error' })

export type ToastOptions = {
  tone?: 'neutral' | 'error'
  action?: { label: string; onPress: () => void }
  /** Default 5 s; errors 8 s. 0 keeps it until dismissed. */
  timeoutMs?: number
}
type Toast = ToastOptions & { id: number; text: string }
export type ShowToast = (text: string, opts?: ToastOptions) => void

const Ctx = createContext<ShowToast>(() => {})

/** Show a toast in the window's region. Outside a ToastProvider it is a no-op. */
export const useToast = (): ShowToast => useContext(Ctx)

let seq = 0

export function ToastProvider({ children, max = 3 }: { children?: ReactNode; max?: number }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback<ShowToast>(
    (text, opts = {}) => setToasts((t) => [...t, { ...opts, id: ++seq, text }].slice(-max)),
    [max],
  )
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const value = useMemo(() => show, [show])
  return (
    <Ctx.Provider value={value}>
      {children}
      <section
        aria-label={_('Notifications')}
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </section>
    </Ctx.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [held, setHeld] = useState(false)
  const timeout = toast.timeoutMs ?? (toast.tone === 'error' ? 8000 : 5000)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  useEffect(() => {
    if (held || timeout === 0) return
    const t = setTimeout(() => dismissRef.current(), timeout)
    return () => clearTimeout(t)
  }, [held, timeout])
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-lg bg-ink-primary py-2 pr-2 pl-4 text-text-on-ink shadow-e2"
    >
      {toast.tone === 'error' ? <Icon name="alert" size={18} /> : null}
      <span className="type-callout select-text">{toast.text}</span>
      {toast.action ? (
        <AriaButton
          onPress={() => {
            toast.action?.onPress()
            onDismiss()
          }}
          className="cursor-default rounded-sm px-2 py-1 font-display text-[14px] font-semibold underline-offset-2 focus-ring data-[hovered]:underline"
        >
          {toast.action.label}
        </AriaButton>
      ) : null}
      <AriaButton
        aria-label={_('Dismiss')}
        onPress={onDismiss}
        className="flex size-7 cursor-default items-center justify-center rounded-sm opacity-80 focus-ring data-[hovered]:opacity-100"
      >
        <Icon name="close" size={16} />
      </AriaButton>
    </div>
  )
}
