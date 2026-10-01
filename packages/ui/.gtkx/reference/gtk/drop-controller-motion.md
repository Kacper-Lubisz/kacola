---
description: "An event controller tracking the pointer during Drag-and-Drop operations."
---

# GtkDropControllerMotion

An event controller tracking the pointer during Drag-and-Drop operations.

It is modeled after `Gtk.EventControllerMotion` so if you
have used that, this should feel really familiar.

This controller is not able to accept drops, use `Gtk.DropTarget`
for that purpose.

```tsx
import { GtkDropControllerMotion } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkDropControllerMotion**

## Props

`ref` receives the `Gtk.DropControllerMotion` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `containsPointer`

`boolean` · default `false` · read-only, observe with `onNotifyContainsPointer`

Whether the pointer of a Drag-and-Drop operation is in
the controller's widget or a descendant.

See also `Gtk.DropControllerMotion.isPointer`.

When handling crossing events, this property is updated
before `Gtk.DropControllerMotion.enter`, but after
`Gtk.DropControllerMotion.leave` is emitted.

### `drop`

`Gdk.Drop` · read-only, observe with `onNotifyDrop`

The ongoing drop operation over the controller's widget or
its descendant.

If no drop operation is going on, this property returns `null`.

The event controller should not modify the `drop`, but it might
want to query its properties.

When handling crossing events, this property is updated
before `Gtk.DropControllerMotion.enter`, but after
`Gtk.DropControllerMotion.leave` is emitted.

### `isPointer`

`boolean` · default `false` · read-only, observe with `onNotifyIsPointer`

Whether the pointer is in the controllers widget itself,
as opposed to in a descendent widget.

See also `Gtk.DropControllerMotion.containsPointer`.

When handling crossing events, this property is updated
before `Gtk.DropControllerMotion.enter`, but after
`Gtk.DropControllerMotion.leave` is emitted.

## Signals

### `onEnter`

```ts
(x: number, y: number, self: Gtk.DropControllerMotion) => void
```

Signals that the pointer has entered the widget.

**Parameters**

- `x`: coordinates of pointer location
- `y`: coordinates of pointer location
- `self`: The instance the signal was emitted on.

### `onLeave`

```ts
(self: Gtk.DropControllerMotion) => void
```

Signals that the pointer has left the widget.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMotion`

```ts
(x: number, y: number, self: Gtk.DropControllerMotion) => void
```

Emitted when the pointer moves inside the widget.

**Parameters**

- `x`: the x coordinate
- `y`: the y coordinate
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.DropControllerMotion` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `containsPointer`

```ts
containsPointer(): boolean
```

Returns if a Drag-and-Drop operation is within the widget
`self` or one of its children.

**Returns** `true` if a dragging pointer is within `self` or one of its children.

### `getDrop`

```ts
getDrop(): Gdk.Drop | null
```

Returns the `GdkDrop` of a current Drag-and-Drop operation
over the widget of `self`.

**Returns** The `GdkDrop` currently
  happening within `self`

### `isPointer`

```ts
isPointer(): boolean
```

Returns if a Drag-and-Drop operation is within the widget
`self`, not one of its children.

**Returns** `true` if a dragging pointer is within `self` but
  not one of its children
