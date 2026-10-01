---
description: "GEmblemedIcon is an implementation of Gio.Icon that supports adding an emblem to an icon."
---

# GEmblemedIcon

`GEmblemedIcon` is an implementation of `Gio.Icon` that supports
adding an emblem to an icon. Adding multiple emblems to an
icon is ensured via `Gio.EmblemedIcon.addEmblem()`.

Note that `GEmblemedIcon` allows no control over the position
of the emblems. See also `Gio.Emblem` for more information.

```tsx
import { GEmblemedIcon } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GEmblemedIcon**

Implements `GIcon`.

## Props

`ref` receives the `Gio.EmblemedIcon` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gicon`

`Gio.Icon` · construct-only

The `Gio.Icon` to attach emblems to.

_Available since 2.18._

## Methods

Methods are called on the `Gio.EmblemedIcon` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addEmblem`

```ts
addEmblem(emblem: Gio.Emblem): void
```

Adds `emblem` to the `GList` of `GEmblems`.

**Parameters**

- `emblem`: a `GEmblem`

_Available since 2.18._

### `clearEmblems`

```ts
clearEmblems(): void
```

Removes all the emblems from `icon`.

_Available since 2.28._

### `getEmblems`

```ts
getEmblems(): Gio.Emblem[]
```

Gets the list of emblems for the `icon`.

**Returns** a `GList` of
    `GEmblems` that is owned by `emblemed`

_Available since 2.18._

### `getIcon`

```ts
getIcon(): Gio.Icon
```

Gets the main icon for `emblemed`.

**Returns** a `GIcon` that is owned by `emblemed`

_Available since 2.18._
