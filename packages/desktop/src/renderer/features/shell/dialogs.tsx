import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import type { SetupStep } from '../../../shared/bridge.ts'

// The window's dialogs, opened from anywhere (the primary menu, keyboard shortcuts, the Ask pane's
// "Open Preferences", the models banner). One at a time; each dialog's own close clears the state.
// B/C panes: `useDialogs().open('preferences')`.

export type DialogKind = 'preferences' | 'about' | 'onboarding' | 'shortcuts'

export type Dialogs = {
  current: DialogKind | null
  /** The step setup opens on (`open('onboarding', { step })`); null: the first. */
  setupStep: SetupStep | null
  open: (d: DialogKind, o?: { step?: SetupStep }) => void
  close: () => void
}

const Ctx = createContext<Dialogs>({ current: null, setupStep: null, open: () => {}, close: () => {} })

export const useDialogs = (): Dialogs => useContext(Ctx)

export function DialogsProvider({
  children,
  initial = null,
}: {
  children?: ReactNode
  initial?: DialogKind | null
}) {
  const [state, setState] = useState<{ current: DialogKind | null; setupStep: SetupStep | null }>({
    current: initial,
    setupStep: null,
  })
  const value = useMemo<Dialogs>(
    () => ({
      ...state,
      open: (current, o) => setState({ current, setupStep: o?.step ?? null }),
      close: () => setState({ current: null, setupStep: null }),
    }),
    [state],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
