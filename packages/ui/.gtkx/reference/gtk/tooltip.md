---
description: "Represents a widget tooltip."
---

# GtkTooltip

Represents a widget tooltip.

Basic tooltips can be realized simply by using
`Gtk.Widget.setTooltipText()` or
`Gtk.Widget.setTooltipMarkup()` without
any explicit tooltip object.

When you need a tooltip with a little more fancy contents,
like adding an image, or you want the tooltip to have different
contents per `GtkTreeView` row or cell, you will have to do a
little more work:

- Set the `Gtk.Widget.hasTooltip` property to `true`.
  This will make GTK monitor the widget for motion and related events
  which are needed to determine when and where to show a tooltip.

- Connect to the `Gtk.Widget.query-tooltip` signal.
  This signal will be emitted when a tooltip is supposed to be shown.
  One of the arguments passed to the signal handler is a `GtkTooltip`
  object. This is the object that we are about to display as a tooltip,
  and can be manipulated in your callback using functions like
  `Gtk.Tooltip.setIcon()`. There are functions for setting
  the tooltip’s markup, setting an image from a named icon, or even
  putting in a custom widget.

- Return `true` from your ::query-tooltip handler. This causes the tooltip
  to be show. If you return `false`, it will not be shown.

```tsx
import { GtkTooltip } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTooltip**

## Props

`ref` receives the `Gtk.Tooltip` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.Tooltip` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setCustom`

```ts
setCustom(customWidget: Gtk.Widget | null): void
```

Replaces the widget packed into the tooltip with
`custom_widget`. `custom_widget` does not get destroyed when the tooltip goes
away.
By default a box with a `GtkImage` and `GtkLabel` is embedded in
the tooltip, which can be configured using `gtk_tooltip_set_markup()`
and `gtk_tooltip_set_icon()`.

**Parameters**

- `customWidget`: a `GtkWidget`, or `null` to unset the old custom widget.

### `setIcon`

```ts
setIcon(paintable: Gdk.Paintable | null): void
```

Sets the icon of the tooltip (which is in front of the text) to be
`paintable`.  If `paintable` is `null`, the image will be hidden.

**Parameters**

- `paintable`: a `GdkPaintable`

### `setIconFromGicon`

```ts
setIconFromGicon(gicon: Gio.Icon | null): void
```

Sets the icon of the tooltip (which is in front of the text)
to be the icon indicated by `gicon` with the size indicated
by `size`. If `gicon` is `null`, the image will be hidden.

**Parameters**

- `gicon`: a `GIcon` representing the icon

### `setIconFromIconName`

```ts
setIconFromIconName(iconName: string | null): void
```

Sets the icon of the tooltip (which is in front of the text) to be
the icon indicated by `icon_name` with the size indicated
by `size`.  If `icon_name` is `null`, the image will be hidden.

**Parameters**

- `iconName`: an icon name

### `setMarkup`

```ts
setMarkup(markup: string | null): void
```

Sets the text of the tooltip to be `markup`.

The string must be marked up with Pango markup.
If `markup` is `null`, the label will be hidden.

**Parameters**

- `markup`: a string with Pango markup or `NLL`

### `setText`

```ts
setText(text: string | null): void
```

Sets the text of the tooltip to be `text`.

If `text` is `null`, the label will be hidden.
See also `Gtk.Tooltip.setMarkup()`.

**Parameters**

- `text`: a text string

### `setTipArea`

```ts
setTipArea(rect: Gdk.Rectangle): void
```

Sets the area of the widget, where the contents of this tooltip apply,
to be `rect` (in widget coordinates).  This is especially useful for
properly setting tooltips on `GtkTreeView` rows and cells, `GtkIconViews`,
etc.

For setting tooltips on `GtkTreeView`, please refer to the convenience
functions for this: `gtk_tree_view_set_tooltip_row()` and
`gtk_tree_view_set_tooltip_cell()`.

**Parameters**

- `rect`: a `GdkRectangle`
