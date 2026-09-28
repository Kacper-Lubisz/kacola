import * as Gtk from '@gtkx/gi/gtk'
import { AdwHeaderBar, AdwSpinner, AdwStatusPage, AdwToolbarView } from '@gtkx/jsx/adw'
import { GtkBox, GtkButton, GtkLabel } from '@gtkx/jsx/gtk'
import { escapeMarkup } from '../data/format.ts'

// Whole-window states shown instead of the split view.

export function Connecting({ origin }: { origin: string }) {
  return (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
      <AdwStatusPage vexpand title="Connecting…" description={escapeMarkup(`Reaching gnomeola at ${origin}`)}>
        <AdwSpinner widthRequest={32} heightRequest={32} halign={Gtk.Align.CENTER} />
      </AdwStatusPage>
    </AdwToolbarView>
  )
}

export function Unreachable({
  origin,
  error,
  retryInMs,
  onRetry,
}: {
  origin: string
  error: string
  retryInMs: number
  onRetry: () => void
}) {
  return (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
      <AdwStatusPage
        vexpand
        iconName="network-offline-symbolic"
        title="Can’t Reach gnomeola"
        description={escapeMarkup(
          `The gnomeola daemon is not answering at ${origin}. Start it with “gnomeolad”; ` +
            `this window tries again every ${Math.round(retryInMs / 1000)} seconds.`,
        )}
      >
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} halign={Gtk.Align.CENTER}>
          <GtkButton
            label="Try Again"
            cssClasses={['pill', 'suggested-action']}
            halign={Gtk.Align.CENTER}
            onClicked={onRetry}
          />
          <GtkLabel label={error} cssClasses={['dim-label', 'caption']} wrap selectable />
        </GtkBox>
      </AdwStatusPage>
    </AdwToolbarView>
  )
}
