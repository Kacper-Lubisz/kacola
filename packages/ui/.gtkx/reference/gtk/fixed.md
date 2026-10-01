---
description: "Places its child widgets at fixed positions and with fixed sizes."
---

# GtkFixed

Places its child widgets at fixed positions and with fixed sizes.

`GtkFixed` performs no automatic layout management.

For most applications, you should not use this container! It keeps
you from having to learn about the other GTK containers, but it
results in broken applications.  With `GtkFixed`, the following
things will result in truncated text, overlapping widgets, and
other display bugs:

- Themes, which may change widget sizes.

- Fonts other than the one you used to write the app will of course
  change the size of widgets containing text; keep in mind that
  users may use a larger font because of difficulty reading the
  default, or they may be using a different OS that provides different fonts.

- Translation of text into other languages changes its size. Also,
  display of non-English text will use a different font in many
  cases.

In addition, `GtkFixed` does not pay attention to text direction and
thus may produce unwanted results if your app is run under right-to-left
languages such as Hebrew or Arabic. That is: normally GTK will order
containers appropriately for the text direction, e.g. to put labels to
the right of the thing they label when using an RTL language, but it can’t
do that with `GtkFixed`. So if you need to reorder widgets depending on
the text direction, you would need to manually detect it and adjust child
positions accordingly.

Finally, fixed positioning makes it kind of annoying to add/remove
UI elements, since you have to reposition all the other elements. This
is a long-term maintenance problem for your application.

If you know none of these things are an issue for your application,
and prefer the simplicity of `GtkFixed`, by all means use the
widget. But you should be aware of the tradeoffs.

```tsx
import { GtkFixed } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFixed**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Fixed` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Methods

Methods are called on the `Gtk.Fixed` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChildPosition`

```ts
getChildPosition(widget: Gtk.Widget): [number, number]
```

Retrieves the translation transformation of the
given child `GtkWidget` in the `GtkFixed`.

See also: `Gtk.Fixed.getChildTransform()`.

**Parameters**

- `widget`: a child of `fixed`

**Returns** Tuple of:

- `x`: the horizontal position of the `widget`
- `y`: the vertical position of the `widget`

### `getChildTransform`

```ts
getChildTransform(widget: Gtk.Widget): Gsk.Transform | null
```

Retrieves the transformation for `widget` set using
`gtk_fixed_set_child_transform()`.

**Parameters**

- `widget`: a `GtkWidget`, child of `fixed`

**Returns** a `GskTransform`

### `move`

```ts
move(widget: Gtk.Widget, x: number, y: number): void
```

Sets a translation transformation to the given `x` and `y`
coordinates to the child `widget` of the `GtkFixed`.

**Parameters**

- `widget`: the child widget
- `x`: the horizontal position to move the widget to
- `y`: the vertical position to move the widget to

### `put`

```ts
put(widget: Gtk.Widget, x: number, y: number): void
```

Adds a widget to a `GtkFixed` at the given position.

**Parameters**

- `widget`: the widget to add
- `x`: the horizontal position to place the widget at
- `y`: the vertical position to place the widget at

### `remove`

```ts
remove(widget: Gtk.Widget): void
```

Removes a child from `fixed`.

**Parameters**

- `widget`: the child widget to remove

### `setChildTransform`

```ts
setChildTransform(widget: Gtk.Widget, transform: Gsk.Transform | null): void
```

Sets the transformation for `widget`.

This is a convenience function that retrieves the
`Gtk.FixedLayoutChild` instance associated to
`widget` and calls `Gtk.FixedLayoutChild.setTransform()`.

**Parameters**

- `widget`: a `GtkWidget`, child of `fixed`
- `transform`: the transformation assigned to `widget` to reset `widget`'s transform
