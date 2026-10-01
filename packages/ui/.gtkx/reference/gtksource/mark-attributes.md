---
description: "The source mark attributes object."
---

# GtkSourceMarkAttributes

The source mark attributes object.

`GtkSourceMarkAttributes` is an object specifying attributes used by
a `View` to visually show lines marked with `Mark`s
of a specific category. It allows you to define a background color of a line,
an icon shown in gutter and tooltips.

The background color is used as a background of a line where a mark is placed
and it can be set with `MarkAttributes.setBackground()`. To check
if any custom background color was defined and what color it is, use
`MarkAttributes.getBackground()`.

An icon is a graphic element which is shown in the gutter of a view. An
example use is showing a red filled circle in a debugger to show that a
breakpoint was set in certain line. To get an icon that will be placed in
a gutter, first a base for it must be specified and then
`MarkAttributes.renderIcon()` must be called.
There are several ways to specify a base for an icon:

- `MarkAttributes.setIconName()`
- `MarkAttributes.setGicon()`
- `MarkAttributes.setPixbuf()`

Using any of the above functions overrides the one used earlier. But note
that a getter counterpart of earlier used function can still return some
value, but it is just not used when rendering the proper icon.

To provide meaningful tooltips for a given mark of a category, you should
connect to `MarkAttributes.query-tooltip-text` or
`MarkAttributes.query-tooltip-markup` where the latter
takes precedence.

```tsx
import { GtkSourceMarkAttributes } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceMarkAttributes**

## Props

`ref` receives the `GtkSource.MarkAttributes` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `background`

`Gdk.RGBA`

A color used for background of a line.

### `gicon`

`Gio.Icon | ReactElement`

A `GIcon` that may be a base of a rendered icon.

### `iconName`

`string` · default `null`

An icon name that may be a base of a rendered icon.

### `pixbuf`

`GdkPixbuf.Pixbuf | ReactElement`

A `GdkPixbuf` that may be a base of a rendered icon.

## Signals

### `onQueryTooltipMarkup`

```ts
(mark: GtkSource.Mark, self: GtkSource.MarkAttributes) => string | undefined
```

The code should connect to this signal to provide a tooltip for given
`mark`. The tooltip can contain a markup.

**Parameters**

- `mark`: The `GtkSourceMark`.
- `self`: The instance the signal was emitted on.

**Returns** A tooltip. The string should be freed with
`g_free()` when done with it.

### `onQueryTooltipText`

```ts
(mark: GtkSource.Mark, self: GtkSource.MarkAttributes) => string | undefined
```

The code should connect to this signal to provide a tooltip for given
`mark`. The tooltip should be just a plain text.

**Parameters**

- `mark`: The `GtkSourceMark`.
- `self`: The instance the signal was emitted on.

**Returns** A tooltip. The string should be freed with
`g_free()` when done with it.

## Methods

Methods are called on the `GtkSource.MarkAttributes` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getBackground`

```ts
getBackground(): [boolean, Gdk.RGBA]
```

Stores background color in `background`.

**Returns** Tuple of:

- `result`: whether background color for `attributes` was set.
- `background`: a `GdkRGBA`.

### `getGicon`

```ts
getGicon(): Gio.Icon
```

Gets a `Gio.Icon` to be used as a base for rendered icon.

Note that the icon can be `null` if it wasn't set earlier.

**Returns** An icon. The icon belongs to `attributes` and should
not be unreffed.

### `getIconName`

```ts
getIconName(): string
```

Gets a name of an icon to be used as a base for rendered icon.

Note that the icon name can be `null` if it wasn't set earlier.

**Returns** An icon name. The string belongs to `attributes` and
should not be freed.

### `getPixbuf`

```ts
getPixbuf(): GdkPixbuf.Pixbuf
```

Gets a `GdkPixbuf.Pixbuf` to be used as a base for rendered icon.

Note that the pixbuf can be `null` if it wasn't set earlier.

**Returns** A pixbuf. The pixbuf belongs to `attributes` and
should not be unreffed.

### `getTooltipMarkup`

```ts
getTooltipMarkup(mark: GtkSource.Mark): string
```

Queries for a tooltip by emitting a `MarkAttributes.query-tooltip-markup` signal.

The tooltip may contain a markup.

**Parameters**

- `mark`: a `GtkSourceMark`.

**Returns** A tooltip. The returned string should be freed by
using `g_free()` when done with it.

### `getTooltipText`

```ts
getTooltipText(mark: GtkSource.Mark): string
```

Queries for a tooltip by emitting a `MarkAttributes.query-tooltip-text` signal.

The tooltip is a plain text.

**Parameters**

- `mark`: a `GtkSourceMark`.

**Returns** A tooltip. The returned string should be freed by
using `g_free()` when done with it.

### `renderIcon`

```ts
renderIcon(widget: Gtk.Widget, size: number): Gdk.Paintable
```

Renders an icon of given size.

The base of the icon is set by the last call to one of:

- `MarkAttributes.setPixbuf()`
- `MarkAttributes.setGicon()`
- `MarkAttributes.setIconName()`

`size` cannot be lower than 1.

**Parameters**

- `widget`: widget of which style settings may be used.
- `size`: size of the rendered icon.

**Returns** A `GdkPaintable`. The paintable belongs to `attributes`
and should not be unreffed.

### `setBackground`

```ts
setBackground(background: Gdk.RGBA): void
```

Sets background color to the one given in `background`.

**Parameters**

- `background`: a `GdkRGBA`.

### `setGicon`

```ts
setGicon(gicon: Gio.Icon): void
```

Sets an icon to be used as a base for rendered icon.

**Parameters**

- `gicon`: a `GIcon` to be used.

### `setIconName`

```ts
setIconName(iconName: string): void
```

Sets a name of an icon to be used as a base for rendered icon.

**Parameters**

- `iconName`: name of an icon to be used.

### `setPixbuf`

```ts
setPixbuf(pixbuf: GdkPixbuf.Pixbuf): void
```

Sets a pixbuf to be used as a base for rendered icon.

**Parameters**

- `pixbuf`: a `GdkPixbuf` to be used.
