---
description: "Renders a pixbuf in the gutter."
---

# GtkSourceGutterRendererPixbuf

Renders a pixbuf in the gutter.

A `GtkSourceGutterRendererPixbuf` can be used to render an image in a cell of
`Gutter`.

```tsx
import { GtkSourceGutterRendererPixbuf } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkSourceGutterRenderer](.gtkx/reference/gtksource/gutter-renderer.md) → **GtkSourceGutterRendererPixbuf**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.GutterRendererPixbuf` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gicon`

`Gio.Icon | ReactElement`

### `iconName`

`string` · default `null`

### `paintable`

`Gdk.Paintable | ReactElement`

### `pixbuf`

`GdkPixbuf.Pixbuf | ReactElement`

## Methods

Methods are called on the `GtkSource.GutterRendererPixbuf` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getGicon`

```ts
getGicon(): Gio.Icon
```

Get the gicon of the renderer

**Returns** a `GIcon`

### `getIconName`

```ts
getIconName(): string
```

### `getPaintable`

```ts
getPaintable(): Gdk.Paintable | null
```

Gets a `Gdk.Paintable` that was set with
`GutterRendererPixbuf.setPaintable()`

**Returns** a `GdkPaintable` or `null`

### `getPixbuf`

```ts
getPixbuf(): GdkPixbuf.Pixbuf
```

Get the pixbuf of the renderer.

**Returns** a `GdkPixbuf`

### `overlayPaintable`

```ts
overlayPaintable(paintable: Gdk.Paintable): void
```

Allows overlaying a paintable on top of any other image that
has been set for the pixbuf. This will be applied when the
widget is next snapshot.

**Parameters**

- `paintable`: a `GdkPaintable`

### `setGicon`

```ts
setGicon(icon: Gio.Icon | null): void
```

**Parameters**

- `icon`: the icon, or `null`.

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

**Parameters**

- `iconName`: the icon name, or `null`.

### `setPaintable`

```ts
setPaintable(paintable: Gdk.Paintable | null): void
```

**Parameters**

- `paintable`: the paintable, or `null`.

### `setPixbuf`

```ts
setPixbuf(pixbuf: GdkPixbuf.Pixbuf | null): void
```

**Parameters**

- `pixbuf`: the pixbuf, or `null`.
