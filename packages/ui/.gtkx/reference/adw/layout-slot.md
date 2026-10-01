---
description: "A child slot within Layout."
---

# AdwLayoutSlot

A child slot within `Layout`.

While it contains a layout child, the `Gtk.Widget.visible` property
of the slot is updated to match that of the layout child.

See `MultiLayoutView`.

_Available since 1.6._

```tsx
import { AdwLayoutSlot } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwLayoutSlot**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.LayoutSlot` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `id`

`string` · default `null` · construct-only

The slot ID.

See `MultiLayoutView.setChild()`.

_Available since 1.6._

## Methods

Methods are called on the `Adw.LayoutSlot` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getSlotId`

```ts
getSlotId(): string
```

Gets the slot id of `self`.

**Returns** the slot ID

_Available since 1.6._
