import { GtkButton, GtkLabel } from '@gtkx/jsx/gtk'
import type { ComponentProps } from 'react'

/**
 * A text button whose accessible name differs from its visible text ("Download 466 MB" on screen,
 * "Download all models" to a screen reader). `<GtkButton label=… accessibleLabel=…>` cannot do this:
 * GTK points a label button's labelled-by relation at its internal label, and labelled-by beats
 * accessible-label — the same trap as AdwButtonContent (docs/gtkx.md §5). A child GtkLabel is not
 * wired that way, so the explicit name wins.
 */
export function NamedButton({
  text,
  name,
  ...props
}: { text: string; name: string } & Omit<
  ComponentProps<typeof GtkButton>,
  'label' | 'accessibleLabel' | 'children'
>) {
  return (
    <GtkButton {...props} accessibleLabel={name}>
      <GtkLabel label={text} />
    </GtkButton>
  )
}
