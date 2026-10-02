import { create } from 'zustand'

// The meeting page's window-local UI state (lossy, like the rest of the ephemeral state): whether the
// Ask bar is open, whether private context is revealed, and which recordings this window started (so
// the header can say "Started by you" — the daemon does not record who pressed Record).

type MeetingUi = {
  askOpen: boolean
  /** agendaId → the user pressed Show on its private context this run. */
  revealed: Record<string, boolean>
  startedHere: ReadonlySet<string>
  setAsk: (open: boolean) => void
  toggleAsk: () => void
  reveal: (agendaId: string, shown: boolean) => void
  markStarted: (sessionId: string) => void
}

export const useMeetingUi = create<MeetingUi>((set) => ({
  askOpen: false,
  revealed: {},
  startedHere: new Set(),
  setAsk: (askOpen) => set({ askOpen }),
  toggleAsk: () => set((s) => ({ askOpen: !s.askOpen })),
  reveal: (agendaId, shown) => set((s) => ({ revealed: { ...s.revealed, [agendaId]: shown } })),
  markStarted: (id) => set((s) => ({ startedHere: new Set([...s.startedHere, id]) })),
}))
