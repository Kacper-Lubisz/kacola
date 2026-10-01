---
description: "Presents contextual actions."
---

# GtkActionBar

Presents contextual actions.



`GtkActionBar` is expected to be displayed below the content and expand
horizontally to fill the area.

It allows placing children at the start or the end. In addition, it
contains an internal centered box which is centered with respect to
the full width of the box, even if the children at either side take
up different amounts of space.

## GtkActionBar as GtkBuildable

The `GtkActionBar` implementation of the `GtkBuildable` interface supports
adding children at the start or end sides by specifying “start” or “end” as
the “type” attribute of a `<child>` element, or setting the center widget
by specifying “center” value.

## CSS nodes

```
actionbar
╰── revealer
    ╰── box
        ├── box.start
        │   ╰── [start children]
        ├── [center widget]
        ╰── box.end
            ╰── [end children]
```

A `GtkActionBar`'s CSS node is called `actionbar`. It contains a `revealer`
subnode, which contains a `box` subnode, which contains two `box` subnodes at
the start and end of the action bar, with `start` and `end` style classes
respectively, as well as a center node that represents the center child.

Each of the boxes contains children packed for that side.

```tsx
import { GtkActionBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkActionBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.ActionBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `end`

`ReactNode | null`

Widgets packed at the end of the bar.

### `revealed`

`boolean` · default `true`

Controls whether the action bar shows its contents.

### `start`

`ReactNode | null`

Widgets packed at the start of the bar.

## Methods

Methods are called on the `Gtk.ActionBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getCenterWidget`

```ts
getCenterWidget(): Gtk.Widget | null
```

Retrieves the center bar widget of the bar.

**Returns** the center widget

### `getRevealed`

```ts
getRevealed(): boolean
```

Gets whether the contents of the action bar are revealed.

**Returns** the current value of the `Gtk.ActionBar.revealed`
  property

### `packEnd`

```ts
packEnd(child: Gtk.Widget): void
```

Adds a child to the action bar, packed with reference to the
end of the action bar.

**Parameters**

- `child`: the widget to be added

### `packStart`

```ts
packStart(child: Gtk.Widget): void
```

Adds a child to the action, packed with reference to the
start of the action bar.

**Parameters**

- `child`: the widget to be added

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from the action bar.

**Parameters**

- `child`: the widget to be removed

### `setCenterWidget`

```ts
setCenterWidget(centerWidget: Gtk.Widget | null): void
```

Sets the center widget for the action bar.

**Parameters**

- `centerWidget`: a widget to use for the center

### `setRevealed`

```ts
setRevealed(revealed: boolean): void
```

Reveals or conceals the content of the action bar.

Note: this does not show or hide the action bar in the
`Gtk.Widget.visible` sense, so revealing has
no effect if the action bar is hidden.

**Parameters**

- `revealed`: the new value for the property
