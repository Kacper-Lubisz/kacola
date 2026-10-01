---
description: "An auxiliary object used by GtkNotebook."
---

# GtkNotebookPage

An auxiliary object used by `GtkNotebook`.

```tsx
import { GtkNotebookPage } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkNotebookPage**

## Props

`ref` receives the `Gtk.NotebookPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `child`

`Gtk.Widget` · construct-only

The child for this page.

### `detachable`

`boolean` · default `false`

Whether the tab is detachable.

### `menu`

`Gtk.Widget` · construct-only

The label widget displayed in the child's menu entry.

### `menuLabel`

`string` · default `null`

The text of the menu widget.

### `position`

`number` · default `0`

The index of the child in the parent.

### `reorderable`

`boolean` · default `false`

Whether the tab is reorderable by user action.

### `tab`

`Gtk.Widget` · construct-only

The tab widget for this page.

### `tabExpand`

`boolean` · default `false`

Whether to expand the child's tab.

### `tabFill`

`boolean` · default `true`

Whether the child's tab should fill the allocated area.

### `tabLabel`

`string` · default `null`

The text of the tab widget.

## Methods

Methods are called on the `Gtk.NotebookPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Returns the notebook child to which `page` belongs.

**Returns** the child to which `page` belongs
