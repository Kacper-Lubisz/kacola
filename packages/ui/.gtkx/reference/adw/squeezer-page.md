---
description: "An auxiliary class used by Squeezer."
---

# AdwSqueezerPage

An auxiliary class used by `Squeezer`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

```tsx
import { AdwSqueezerPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwSqueezerPage**

## Props

`ref` receives the `Adw.SqueezerPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `child`

`Gtk.Widget` · construct-only · deprecated since 1.4

The the squeezer child to which the page belongs.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `enabled`

`boolean` · default `true` · deprecated since 1.4

Whether the child is enabled.

If a child is disabled, it will be ignored when looking for the child
fitting the available size best.

This allows to programmatically and prematurely hide a child even if it
fits in the available space.

This can be used e.g. to ensure a certain child is hidden below a certain
window width, or any other constraint you find suitable.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

## Methods

Methods are called on the `Adw.SqueezerPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Returns the squeezer child to which `self` belongs.

**Returns** the child to which `self` belongs

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getEnabled`

```ts
getEnabled(): boolean
```

Gets whether `self` is enabled.

**Returns** whether `self` is enabled

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setEnabled`

```ts
setEnabled(enabled: boolean): void
```

Sets whether `self` is enabled.

If a child is disabled, it will be ignored when looking for the child
fitting the available size best.

This allows to programmatically and prematurely hide a child even if it fits
in the available space.

This can be used e.g. to ensure a certain child is hidden below a certain
window width, or any other constraint you find suitable.

**Parameters**

- `enabled`: whether `self` is enabled

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)
