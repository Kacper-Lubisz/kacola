import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

// The window's dialogs, opened from anywhere (the primary menu, keyboard shortcuts, the Ask pane's
// "Open Preferences", the models banner). One at a time; each dialog's own close clears the state.
// B/C panes: `useDialogs().open('preferences')`.

export type DialogKind = 'preferences' | 'about' | 'onboarding' | 'shortcuts'

export type Dialogs = { current: DialogKind | null; open: (d: DialogKind) => void; close: () => void }

const Ctx = createContext<Dialogs>({ current: null, open: () => {}, close: () => {} })

export const useDialogs = (): Dialogs => useContext(Ctx)

export function DialogsProvider({
  children,
  initial = null,
}: {
  children?: ReactNode
  initial?: DialogKind | null
}) {
  const [current, setCurrent] = useState<DialogKind | null>(initial)
  const value = useMemo<Dialogs>(
    () => ({ current, open: setCurrent, close: () => setCurrent(null) }),
    [current],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
