import { escapeMarkup } from '@gnomeola/ui-core/format'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwHeaderBar, AdwSpinner, AdwStatusPage, AdwToolbarView } from '@gtkx/jsx/adw'
import { GtkBox, GtkButton, GtkLabel } from '@gtkx/jsx/gtk'

// Whole-window states shown instead of the split view.

export function Connecting({ origin }: { origin: string }) {
  return (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
      <AdwStatusPage
        vexpand
        title={_('Connecting…')}
        description={escapeMarkup(fmt(_('Reaching gnomeola at {origin}'), { origin }))}
      >
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
        title={_('Can’t Reach gnomeola')}
        description={escapeMarkup(
          fmt(
            _(
              'The gnomeola daemon is not answering at {origin}. Start it with “gnomeolad”; this window tries again every {seconds} seconds.',
            ),
            { origin, seconds: Math.round(retryInMs / 1000) },
          ),
        )}
      >
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} halign={Gtk.Align.CENTER}>
          <GtkButton
            label={_('Try Again')}
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
