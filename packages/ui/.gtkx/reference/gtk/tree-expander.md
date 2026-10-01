---
description: "Provides an expander for a tree-like list."
---

# GtkTreeExpander

Provides an expander for a tree-like list.

It is typically placed as a bottommost child into a `GtkListView`
to allow users to expand and collapse children in a list with a
`Gtk.TreeListModel`. `GtkTreeExpander` provides the common UI
elements, gestures and keybindings for this purpose.

On top of this, the "listitem.expand", "listitem.collapse" and
"listitem.toggle-expand" actions are provided to allow adding custom
UI for managing expanded state.

It is important to mention that you want to set the
`Gtk.ListItem.focusable` property to FALSE when using this
widget, as you want the keyboard focus to be in the treexpander, and not
inside the list to make use of the keybindings.

The `GtkTreeListModel` must be set to not be passthrough. Then it
will provide `Gtk.TreeListRow` items which can be set via
`Gtk.TreeExpander.setListRow()` on the expander.
The expander will then watch that row item automatically.
`Gtk.TreeExpander.setChild()` sets the widget that displays
the actual row contents.

`GtkTreeExpander` can be modified with properties such as
`Gtk.TreeExpander.indentForIcon`,
`Gtk.TreeExpander.indentForDepth`, and
`Gtk.TreeExpander.hideExpander` to achieve a different appearance.
This can even be done to influence individual rows, for example by binding
the `Gtk.TreeExpander.hideExpander` property to the item count of
the model of the treelistrow, to hide the expander for rows without children,
even if the row is expandable.

### Shortcuts and Gestures

`GtkTreeExpander` supports the following keyboard shortcuts:

- <kbd>+</kbd> or <kbd>*</kbd> expands the expander.
- <kbd>-</kbd> or <kbd>/</kbd> collapses the expander.
- Left and right arrow keys, when combined with <kbd>Shift</kbd> or
  <kbd>Ctrl</kbd>+<kbd>Shift</kbd>, will expand or collapse, depending on
  the locale's text direction.
- <kbd>Ctrl</kbd>+<kbd>␣</kbd> toggles the expander state.

The row can also expand on drag gestures.

### Actions

`GtkTreeExpander` defines a set of built-in actions:

- `listitem.expand` expands the expander if it can be expanded.
- `listitem.collapse` collapses the expander.
- `listitem.toggle-expand` tries to expand the expander if it was collapsed
  or collapses it if it was expanded.

### CSS nodes

```
treeexpander
├── [indent]*
├── [expander]
╰── <child>
```

`GtkTreeExpander` has zero or one CSS nodes with the name "expander" that
should display the expander icon. The node will be `:checked` when it
is expanded. If the node is not expandable, an "indent" node will be
displayed instead.

For every level of depth, another "indent" node is prepended.

### Accessibility

Until GTK 4.10, `GtkTreeExpander` used the `Gtk.AccessibleRole.group` role.

Since GTK 4.12, `GtkTreeExpander` uses the `Gtk.AccessibleRole.button` role.
Toggling it will change the `GTK_ACCESSIBLE_STATE_EXPANDED` state.

```tsx
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkTreeExpander**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.TreeExpander` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `hideExpander`

`boolean` · default `false`

Whether the expander icon should be hidden in a GtkTreeListRow.
Note that this property simply hides the icon.  The actions and keybinding
(i.e. collapse and expand) are not affected by this property.

A common use for this property would be to bind to the number of children in a
GtkTreeListRow's model in order to hide the expander when a row has no children.

_Available since 4.10._

### `indentForDepth`

`boolean` · default `true`

TreeExpander indents the child according to its depth.

_Available since 4.10._

### `indentForIcon`

`boolean` · default `true`

TreeExpander indents the child by the width of an expander-icon if it is not expandable.

_Available since 4.6._

### `item`

`GObject.Object` · read-only, observe with `onNotifyItem`

The item held by this expander's row.

### `listRow`

`Gtk.TreeListRow | ReactElement`

The list row to track for expander state.

## Methods

Methods are called on the `Gtk.TreeExpander` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget displayed by `self`.

**Returns** The child displayed by `self`

### `getHideExpander`

```ts
getHideExpander(): boolean
```

Gets whether the TreeExpander should be hidden in a GtkTreeListRow.

**Returns** TRUE if the expander icon should be hidden. Otherwise FALSE.

_Available since 4.10._

### `getIndentForDepth`

```ts
getIndentForDepth(): boolean
```

TreeExpander indents each level of depth with an additional indent.

**Returns** TRUE if the child should be indented . Otherwise FALSE.

_Available since 4.10._

### `getIndentForIcon`

```ts
getIndentForIcon(): boolean
```

TreeExpander indents the child by the width of an expander-icon if it is not expandable.

**Returns** TRUE if the child should be indented when not expandable. Otherwise FALSE.

_Available since 4.6._

### `getItem`

```ts
getItem(): GObject.Object | null
```

Forwards the item set on the `GtkTreeListRow` that `self` is managing.

This call is essentially equivalent to calling:

```c
gtk_tree_list_row_get_item (gtk_tree_expander_get_list_row (@self));
```

**Returns** The item of the row

### `getListRow`

```ts
getListRow(): Gtk.TreeListRow | null
```

Gets the list row managed by `self`.

**Returns** The list row displayed by `self`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the content widget to display.

**Parameters**

- `child`: a `GtkWidget`

### `setHideExpander`

```ts
setHideExpander(hideExpander: boolean): void
```

Sets whether the expander icon should be visible in a GtkTreeListRow.

**Parameters**

- `hideExpander`: TRUE if the expander should be hidden. Otherwise FALSE.

_Available since 4.10._

### `setIndentForDepth`

```ts
setIndentForDepth(indentForDepth: boolean): void
```

Sets if the TreeExpander should indent the child according to its depth.

**Parameters**

- `indentForDepth`: TRUE if the child should be indented. Otherwise FALSE.

_Available since 4.10._

### `setIndentForIcon`

```ts
setIndentForIcon(indentForIcon: boolean): void
```

Sets if the TreeExpander should indent the child by the width of an expander-icon when it is not expandable.

**Parameters**

- `indentForIcon`: TRUE if the child should be indented without expander. Otherwise FALSE.

_Available since 4.6._

### `setListRow`

```ts
setListRow(listRow: Gtk.TreeListRow | null): void
```

Sets the tree list row that this expander should manage.

**Parameters**

- `listRow`: a `GtkTreeListRow`
