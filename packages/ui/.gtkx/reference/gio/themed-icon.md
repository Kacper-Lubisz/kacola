---
description: "GThemedIcon is an implementation of Gio.Icon that supports icon themes."
---

# GThemedIcon

`GThemedIcon` is an implementation of `Gio.Icon` that supports icon
themes.

`GThemedIcon` contains a list of all of the icons present in an icon
theme, so that icons can be looked up quickly. `GThemedIcon` does
not provide actual pixmaps for icons, just the icon names.
Ideally something like `Gtk.IconTheme.chooseIcon()` should be used to
resolve the list of names so that fallback icons work nicely with
themes that inherit other themes.

```tsx
import { GThemedIcon } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GThemedIcon**

Implements `GIcon`.

## Props

`ref` receives the `Gio.ThemedIcon` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `name`

`string` · default `null` · construct-only

The icon name.

### `names`

`string[]` · construct-only

A `null`-terminated array of icon names.

### `useDefaultFallbacks`

`boolean` · default `false` · construct-only

Whether to use the default fallbacks found by shortening the icon name
at '-' characters. If the "names" array has more than one element,
ignores any past the first.

For example, if the icon name was "gnome-dev-cdrom-audio", the array
would become
```c
{
  "gnome-dev-cdrom-audio",
  "gnome-dev-cdrom",
  "gnome-dev",
  "gnome",
  NULL
};
```

## Methods

Methods are called on the `Gio.ThemedIcon` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `appendName`

```ts
appendName(iconname: string): void
```

Append a name to the list of icons from within `icon`.

Note that doing so invalidates the hash computed by prior calls
to `g_icon_hash()`.

**Parameters**

- `iconname`: name of icon to append to list of icons from within `icon`.

### `getNames`

```ts
getNames(): string[]
```

Gets the names of icons from within `icon`.

**Returns** a list of icon names.

### `prependName`

```ts
prependName(iconname: string): void
```

Prepend a name to the list of icons from within `icon`.

Note that doing so invalidates the hash computed by prior calls
to `g_icon_hash()`.

**Parameters**

- `iconname`: name of icon to prepend to list of icons from within `icon`.

_Available since 2.18._
