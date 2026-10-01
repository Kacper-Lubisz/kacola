---
description: "An auxiliary class used by Leaflet."
---

# AdwLeafletPage

An auxiliary class used by `Leaflet`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

```tsx
import { AdwLeafletPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwLeafletPage**

## Props

`ref` receives the `Adw.LeafletPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `child`

`Gtk.Widget` · construct-only · deprecated since 1.4

The leaflet child to which the page belongs.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `name`

`string` · default `null` · deprecated since 1.4

The name of the child page.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `navigatable`

`boolean` · default `true` · deprecated since 1.4

Whether the child can be navigated to when folded.

If `FALSE`, the child will be ignored by
`Leaflet.getAdjacentChild()`, `Leaflet.navigate()`, and swipe
gestures.

This can be used used to prevent switching to widgets like separators.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

## Methods

Methods are called on the `Adw.LeafletPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget
```

Gets the leaflet child to which `self` belongs.

**Returns** the child to which `self` belongs

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getName`

```ts
getName(): string | null
```

Gets the name of `self`.

**Returns** the name of `self`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getNavigatable`

```ts
getNavigatable(): boolean
```

Gets whether the child can be navigated to when folded.

**Returns** whether `self` can be navigated to when folded

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setName`

```ts
setName(name: string | null): void
```

Sets the name of the `self`.

**Parameters**

- `name`: the new value to set

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setNavigatable`

```ts
setNavigatable(navigatable: boolean): void
```

Sets whether `self` can be navigated to when folded.

If `FALSE`, the child will be ignored by `Leaflet.getAdjacentChild()`,
`Leaflet.navigate()`, and swipe gestures.

This can be used used to prevent switching to widgets like separators.

**Parameters**

- `navigatable`: whether `self` can be navigated to when folded

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)
