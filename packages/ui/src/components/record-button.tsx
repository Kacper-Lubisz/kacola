import { useSessions, useStore } from '@gnomeola/ui-core/hooks'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { activeSession } from '@gnomeola/ui-core/sessions'
import { AdwButtonContent } from '@gtkx/jsx/adw'
import { GtkButton } from '@gtkx/jsx/gtk'
import { useState } from 'react'
import { useToast } from './toasts.tsx'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Record / Stop, in the sidebar header. Starting a recording selects it. */
export function RecordButton({ onStarted }: { onStarted: (id: string) => void }) {
  const store = useStore()
  const toast = useToast()
  const active = activeSession(useSessions())
  const [busy, setBusy] = useState(false)

  const onClicked = async () => {
    setBusy(true)
    try {
      if (active) {
        await store.stopRecording(active.id)
      } else {
        const s = await store.startRecording()
        onStarted(s.id)
      }
    } catch (e) {
      toast(
        fmt(active ? _('Could not stop recording: {reason}') : _('Could not start recording: {reason}'), {
          reason: errorText(e),
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    // No accessibleLabel here: AdwButtonContent points the button's labelled-by relation at its own
    // label, and labelled-by wins over aria-label, so the accessible name is "Record" / "Stop".
    <GtkButton
      accessibleDescription={
        active ? _('Stop recording the current session') : _('Start recording a new session')
      }
      tooltipText={active ? _('Stop recording') : _('Start recording')}
      cssClasses={[active ? 'destructive-action' : 'suggested-action']}
      sensitive={!busy}
      onClicked={() => void onClicked()}
    >
      <AdwButtonContent
        iconName={active ? 'media-playback-stop-symbolic' : 'media-record-symbolic'}
        label={active ? _('Stop') : _('Record')}
      />
    </GtkButton>
  )
}
