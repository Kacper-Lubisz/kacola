import * as Adw from '@gtkx/gi/adw'
import { AdwToastOverlay } from '@gtkx/jsx/adw'
import { createContext, type ReactNode, useCallback, useContext, useRef } from 'react'

// Toasts, imperatively: AdwToastOverlay has no declarative "toasts" prop, so we keep a ref to the
// overlay and call addToast. (@gtkx/components/adw ships a ToastProvider doing the same; this avoids
// the extra dependency for four lines.)

type ShowToast = (title: string, opts?: { timeoutS?: number }) => void

const ToastContext = createContext<ShowToast>(() => {})

export const useToast = (): ShowToast => useContext(ToastContext)

export function ToastHost({ children }: { children?: ReactNode }) {
  const overlay = useRef<Adw.ToastOverlay | null>(null)
  const show = useCallback<ShowToast>((title, opts) => {
    const toast = Adw.Toast.new(title)
    // Adw.Toast titles are Pango markup; our strings are plain text (they may contain '&' or '<').
    toast.setUseMarkup(false)
    if (opts?.timeoutS !== undefined) toast.setTimeout(opts.timeoutS)
    overlay.current?.addToast(toast)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      <AdwToastOverlay ref={overlay}>{children}</AdwToastOverlay>
    </ToastContext.Provider>
  )
}
