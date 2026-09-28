import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { AboutDialog } from './about.tsx'
import { OnboardingDialog } from './onboarding.tsx'
import { PreferencesDialog } from './preferences.tsx'

// The window's dialogs, opened from anywhere (header menu, keyboard shortcuts, the Ask pane's "Open
// Preferences", the models banner). Only one is open at a time; mounting presents it and the
// dialog's own close (Escape, close button) clears the state through onClosed.

export type DialogKind = 'preferences' | 'about' | 'onboarding'

type Dialogs = { open: (d: DialogKind) => void; close: () => void; current: DialogKind | null }

const DialogsContext = createContext<Dialogs>({ open: () => {}, close: () => {}, current: null })

export const useDialogs = (): Dialogs => useContext(DialogsContext)

export function DialogsProvider({ initial, children }: { initial: DialogKind | null; children?: ReactNode }) {
  const [current, setCurrent] = useState<DialogKind | null>(initial)
  const value = useMemo<Dialogs>(
    () => ({ open: (d) => setCurrent(d), close: () => setCurrent(null), current }),
    [current],
  )
  return <DialogsContext.Provider value={value}>{children}</DialogsContext.Provider>
}

/** Rendered inside the window (dialogs need a parent window to present on). */
export function DialogHost({
  onOnboardingDone,
}: {
  onOnboardingDone: (skippedMissing: string[] | null) => void
}) {
  const { current, close } = useDialogs()
  if (current === 'preferences') return <PreferencesDialog onClosed={close} />
  if (current === 'about') return <AboutDialog onClosed={close} />
  if (current === 'onboarding') {
    return (
      <OnboardingDialog
        onFinished={(skippedMissing) => {
          onOnboardingDone(skippedMissing)
          close()
        }}
      />
    )
  }
  return null
}
