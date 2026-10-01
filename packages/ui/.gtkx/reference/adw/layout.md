---
description: "An individual layout in MultiLayoutView."
---

# AdwLayout

An individual layout in `MultiLayoutView`.

_Available since 1.6._

```tsx
import { AdwLayout } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwLayout**

Implements `GtkBuildable`.

## Props

`ref` receives the `Adw.Layout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `content`

`Gtk.Widget` · construct-only

The content widget.

_Available since 1.6._

### `name`

`string` · default `null`

The name of the layout.

_Available since 1.6._

## Methods

Methods are called on the `Adw.Layout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getContent`

```ts
getContent(): Gtk.Widget
```

Gets the content widget.

**Returns** The content

_Available since 1.6._

### `getName`

```ts
getName(): string | null
```

Gets the name of the layout.

**Returns** the name of the layout

_Available since 1.6._

### `setName`

```ts
setName(name: string | null): void
```

Sets the name of the layout.

**Parameters**

- `name`: the layout name

_Available since 1.6._
