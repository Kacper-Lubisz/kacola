---
description: "A page used for empty/error states and similar use-cases."
---

# AdwStatusPage

A page used for empty/error states and similar use-cases.



The `AdwStatusPage` widget can have an icon, a title, a description and a
custom widget which is displayed below them.

### CSS nodes

`AdwStatusPage` has a main CSS node with name `statuspage`.

When setting an `SpinnerPaintable` as `StatusPage.paintable`,
the main nodes gains the `.spinner` style class for a more compact
appearance.

### Style classes

`AdwStatusPage` can use the
[`.compact`](style-classes.html#compact-status-page) style class for when it
needs to fit into a small space such a sidebar or a popover, similar to when
using a spinner as the paintable.

```tsx
import { AdwStatusPage } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwStatusPage**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.StatusPage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `description`

`string`

The description markup to be displayed below the title.

### `iconName`

`string` · default `null`

The name of the icon to be used.

Changing this will set `StatusPage.paintable` to `NULL`.

### `paintable`

`Gdk.Paintable | ReactElement`

The paintable to be used.

Changing this will set `StatusPage.iconName` to `NULL`.

### `title`

`string`

The title to be displayed below the icon.

It is not parsed as Pango markup.

## Methods

Methods are called on the `Adw.StatusPage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `getDescription`

```ts
getDescription(): string | null
```

Gets the description markup for `self`.

**Returns** the description

### `getIconName`

```ts
getIconName(): string | null
```

Gets the icon name for `self`.

**Returns** the icon name

### `getPaintable`

```ts
getPaintable(): Gdk.Paintable | null
```

Gets the paintable for `self`.

**Returns** the paintable

### `getTitle`

```ts
getTitle(): string
```

Gets the title for `self`.

**Returns** the title

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

### `setDescription`

```ts
setDescription(description: string | null): void
```

Sets the description markup for `self`.

The description is displayed below the title. It is parsed as Pango markup.

**Parameters**

- `description`: the description

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon name for `self`.

Changing this will set `StatusPage.paintable` to `NULL`.

**Parameters**

- `iconName`: the icon name

### `setPaintable`

```ts
setPaintable(paintable: Gdk.Paintable | null): void
```

Sets the paintable for `self`.

Changing this will set `StatusPage.iconName` to `NULL`.

**Parameters**

- `paintable`: the paintable

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title for `self`.

The title is displayed below the icon. It is not parsed as Pango markup.

**Parameters**

- `title`: the title
