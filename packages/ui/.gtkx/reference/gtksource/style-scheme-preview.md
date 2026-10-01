---
description: "A preview widget for StyleScheme."
---

# GtkSourceStyleSchemePreview

A preview widget for `StyleScheme`.

This widget provides a convenient `Gtk.Widget` to preview a `StyleScheme`.

The `StyleSchemePreview.selected` property can be used to manage
the selection state of a single preview widget.

_Available since 5.4._

```tsx
import { GtkSourceStyleSchemePreview } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceStyleSchemePreview**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.StyleSchemePreview` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `scheme`

`GtkSource.StyleScheme` · construct-only

### `selected`

`boolean` · default `false`

## Signals

### `onActivate`

```ts
(self: GtkSource.StyleSchemePreview) => void
```

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.StyleSchemePreview` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getScheme`

```ts
getScheme(): GtkSource.StyleScheme
```

Gets the `GtkSourceStyleScheme` previewed by the widget.

**Returns** a `GtkSourceStyleScheme`

_Available since 5.4._

### `getSelected`

```ts
getSelected(): boolean
```

### `setSelected`

```ts
setSelected(selected: boolean): void
```
