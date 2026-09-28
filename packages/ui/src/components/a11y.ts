import * as Adw from '@gtkx/gi/adw'
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

/** Every descendant passing `test`, depth-first. */
export function findDescendants<T extends Gtk.Widget>(
  root: Gtk.Widget,
  test: (w: Gtk.Widget) => w is T,
  acc: T[] = [],
): T[] {
  for (let c = root.getFirstChild(); c !== null; c = c.getNextSibling()) {
    if (test(c)) acc.push(c)
    findDescendants(c, test, acc)
  }
  return acc
}

/**
 * Name every GtkListBox inside a composite libadwaita widget (AdwAboutDialog's "Details", "Credits,
 * Legal, Acknowledgements"…) after the titles of its rows, so none is announced as an anonymous list.
 */
export function nameInternalLists(root: Gtk.Widget): void {
  for (const list of findDescendants(root, (w): w is Gtk.ListBox => w instanceof Gtk.ListBox)) {
    const titles: string[] = []
    for (let i = 0; ; i++) {
      const row = list.getRowAtIndex(i)
      if (!row) break
      if (!(row instanceof Adw.PreferencesRow) || !row.getVisible()) continue
      // titles carry mnemonics ("_Legal")
      const title = row.getTitle().replace(/[_](.)/g, '$1')
      if (title) titles.push(title)
    }
    if (titles.length) setAccessibleName(list, titles.join(', '))
  }
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
