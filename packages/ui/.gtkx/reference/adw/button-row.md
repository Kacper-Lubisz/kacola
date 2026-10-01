---
description: "A Gtk.ListBoxRow that looks like a button."
---

# AdwButtonRow

A `Gtk.ListBoxRow` that looks like a button.



The `AdwButtonRow` widget has a title and two icons: before and after the
title.

It is convenient for presenting actions like "Delete" at the end of a boxed
list.

`AdwButtonRow` is always activatable.

### CSS nodes

`AdwButtonRow` has a main CSS node with name `row` and the style class
`.button`.

It contains the subnode `box` for its main horizontal box, which contains the
nodes: `image.icon.start` for the start icon, `label.title` for the title,
and `image.icon.end` for the end icon.

### Style classes

The [`.suggested-action`](style-classes.html#suggested-action) style class
makes `AdwButtonRow` use accent color for its background. It should be used
very sparingly to denote important buttons.



The [`.destructive-action`](style-classes.html#destructive-action) style
makes the row use destructive colors. It can be used to draw attention to the
potentially damaging consequences of using it. This style acts as a warning
to the user.

_Available since 1.6._

```tsx
import { AdwButtonRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → **AdwButtonRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ButtonRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `endIconName`

`string`

The icon name to show after the title.

_Available since 1.6._

### `startIconName`

`string`

The icon name to show before the title.

_Available since 1.6._

## Signals

### `onActivated`

```ts
(self: Adw.ButtonRow) => void
```

This signal is emitted after the row has been activated.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.6._

## Methods

Methods are called on the `Adw.ButtonRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getEndIconName`

```ts
getEndIconName(): string | null
```

Gets the end icon name for `self`.

**Returns** the end icon name for `self`

_Available since 1.6._

### `getStartIconName`

```ts
getStartIconName(): string | null
```

Gets the start icon name for `self`.

**Returns** the start icon name for `self`

_Available since 1.6._

### `setEndIconName`

```ts
setEndIconName(iconName: string | null): void
```

Sets the end icon name for `self`.

**Parameters**

- `iconName`: the end icon name

_Available since 1.6._

### `setStartIconName`

```ts
setStartIconName(iconName: string | null): void
```

Sets the start icon name for `self`.

**Parameters**

- `iconName`: the start icon name

_Available since 1.6._
