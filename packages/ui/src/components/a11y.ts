import * as GObject from '@gtkx/gi/gobject'
import * as Gtk from '@gtkx/gi/gtk'

// Accessible names for widgets we do not create ourselves (libadwaita internals), set the same way
// GTKX applies an `accessibleLabel` prop: gtk_accessible_update_property with a GValue string.

export function setAccessibleName(widget: Gtk.Widget, name: string): void {
  const value = new GObject.Value()
  value.init(GObject.TYPE_STRING)
  value.setString(name)
  widget.updateProperty([Gtk.AccessibleProperty.LABEL], [value])
}

/** Depth-first search of a widget's descendants. */
export function findDescendant<T extends Gtk.Widget>(
  root: Gtk.Widget,
  test: (w: Gtk.Widget) => w is T,
): T | null {
  for (let c = root.getFirstChild(); c !== null; c = c.getNextSibling()) {
    if (test(c)) return c
    const found = findDescendant(c, test)
    if (found) return found
  }
  return null
}

/**
 * AdwPreferencesGroup's rows live in an internal GtkListBox that has no accessible name, so a screen
 * reader announces an anonymous "list" (docs/gtkx.md §5, gotcha 7). Give it the group's title. Use as
 * the group's `ref`.
 */
export const nameGroupList =
  (name: string) =>
  (group: Gtk.Widget | null): void => {
    if (!group) return
    const list = findDescendant(group, (w): w is Gtk.ListBox => w instanceof Gtk.ListBox)
    if (list) setAccessibleName(list, name)
  }
