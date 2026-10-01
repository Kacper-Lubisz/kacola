---
description: "Contains information found when looking up an icon in GtkIconTheme or loading it from a file."
---

# GtkIconPaintable

Contains information found when looking up an icon in `GtkIconTheme`
or loading it from a file.

`GtkIconPaintable` implements `GdkPaintable` and `GtkSymbolicPaintable`.

```tsx
import { GtkIconPaintable } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkIconPaintable**

Implements `GdkPaintable`, `GtkSymbolicPaintable`.

## Props

`ref` receives the `Gtk.IconPaintable` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `file`

`Gio.File` · construct-only

The file representing the icon, if any.

### `iconName`

`string` · default `null` · construct-only · deprecated since 4.20

The icon name that was chosen during lookup.

> **Deprecated since 4.20.**

### `isSymbolic`

`boolean` · default `false` · deprecated since 4.20

Whether the icon is symbolic or not.

> **Deprecated since 4.20.**

### `scale`

`number` · default `1`

### `size`

`number` · default `16`

## Signals

### `onInvalidateContents`

```ts
(self: Gtk.IconPaintable) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Gtk.IconPaintable) => void
```

From `GdkPaintable`.

Emitted when the intrinsic size of the `paintable` changes.

This means the values reported by at least one of
`Gdk.Paintable.getIntrinsicWidth()`,
`Gdk.Paintable.getIntrinsicHeight()` or
`Gdk.Paintable.getIntrinsicAspectRatio()`
has changed.

Examples for such an event would be a paintable displaying
the contents of a toplevel surface being resized.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.IconPaintable` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getFile`

```ts
getFile(): Gio.File | null
```

Gets the `GFile` that was used to load the icon.

Returns `null` if the icon was not loaded from a file.

**Returns** the `GFile` for the icon

### `getIconName`

```ts
getIconName(): string | null
```

Get the icon name being used for this icon.

When an icon looked up in the icon theme was not available, the
icon theme may use fallback icons - either those specified to
`gtk_icon_theme_lookup_icon()` or the always-available
"image-missing". The icon chosen is returned by this function.

If the icon was created without an icon theme, this function
returns `null`.

**Returns** the themed icon-name for the
  icon, or `null` if its not a themed icon.

> **Deprecated since 4.20.**

### `isSymbolic`

```ts
isSymbolic(): boolean
```

Checks if the icon is symbolic or not.

This currently uses only the file name and not the file contents
for determining this. This behaviour may change in the future.

**Returns** true if the icon is symbolic, false otherwise

> **Deprecated since 4.20.**
