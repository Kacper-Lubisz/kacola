---
description: "Communicates with platform-specific assistive technologies API."
---

# GtkATContext

Communicates with platform-specific assistive technologies API.

Each platform supported by GTK implements a `GtkATContext` subclass, and
is responsible for updating the accessible state in response to state
changes in `GtkAccessible`.

```tsx
import { GtkATContext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkATContext**

## Props

`ref` receives the `Gtk.ATContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessible`

`Gtk.Accessible` · construct-only

The `GtkAccessible` that created the `GtkATContext` instance.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE`

The accessible role used by the AT context.

Depending on the given role, different states and properties can be
set or retrieved.

### `display`

`Gdk.Display | ReactElement`

The `GdkDisplay` for the `GtkATContext`.

### `realized`

`boolean` · default `false` · read-only, observe with `onNotifyRealized`

Whether the `GtkATContext` has been realized or not.

_Available since 4.24._

## Signals

### `onStateChange`

```ts
(self: Gtk.ATContext) => void
```

Emitted when the attributes of the accessible for the
`GtkATContext` instance change.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ATContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAccessible`

```ts
getAccessible(): Gtk.Accessible
```

Retrieves the `GtkAccessible` using this context.

**Returns** a `GtkAccessible`

### `getAccessibleRole`

```ts
getAccessibleRole(): Gtk.AccessibleRole
```

Retrieves the accessible role of this context.

**Returns** a `GtkAccessibleRole`
