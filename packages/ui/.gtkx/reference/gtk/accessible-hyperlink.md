---
description: "Represents a link (i.e."
---

# GtkAccessibleHyperlink

Represents a link (i.e. a uri).

A widget that contains one or more links should implement
the `Gtk.AccessibleHypertext` interface and return
`GtkAccessibleHyperlink` objects for each of the links.

_Available since 4.22._

```tsx
import { GtkAccessibleHyperlink } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkAccessibleHyperlink**

Implements `GtkAccessible`.

## Props

`ref` receives the `Gtk.AccessibleHyperlink` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE` · from `GtkAccessible`

The accessible role of the given `GtkAccessible` implementation.

The accessible role cannot be changed once set.

## Methods

Methods are called on the `Gtk.AccessibleHyperlink` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `setPlatformState`

```ts
setPlatformState(state: Gtk.AccessiblePlatformState, enabled: boolean): void
```

Sets a platform state on the accessible.

**Parameters**

- `state`: the platform state to change
- `enabled`: the new value for the platform state

_Available since 4.22._
