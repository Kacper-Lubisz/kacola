---
description: "Tracks the pointer position."
---

# GtkEventControllerMotion

Tracks the pointer position.

The event controller offers `Gtk.EventControllerMotion.enter`
and `Gtk.EventControllerMotion.leave` signals, as well as
`Gtk.EventControllerMotion.isPointer` and
`Gtk.EventControllerMotion.containsPointer` properties
which are updated to reflect changes in the pointer position as it
moves over the widget.

```tsx
import { GtkEventControllerMotion } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkEventControllerMotion**

## Props

`ref` receives the `Gtk.EventControllerMotion` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `containsPointer`

`boolean` · default `false` · read-only, observe with `onNotifyContainsPointer`

Whether the pointer is in the controllers widget or a descendant.

See also `Gtk.EventControllerMotion.isPointer`.

When handling crossing events, this property is updated
before `Gtk.EventControllerMotion.enter`, but after
`Gtk.EventControllerMotion.leave` is emitted.

### `isPointer`

`boolean` · default `false` · read-only, observe with `onNotifyIsPointer`

Whether the pointer is in the controllers widget itself,
as opposed to in a descendent widget.

See also `Gtk.EventControllerMotion.containsPointer`.

When handling crossing events, this property is updated
before `Gtk.EventControllerMotion.enter`, but after
`Gtk.EventControllerMotion.leave` is emitted.

## Signals

### `onEnter`

```ts
(x: number, y: number, self: Gtk.EventControllerMotion) => void
```

Signals that the pointer has entered the widget.

**Parameters**

- `x`: coordinates of pointer location
- `y`: coordinates of pointer location
- `self`: The instance the signal was emitted on.

### `onLeave`

```ts
(self: Gtk.EventControllerMotion) => void
```

Signals that the pointer has left the widget.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMotion`

```ts
(x: number, y: number, self: Gtk.EventControllerMotion) => void
```

Emitted when the pointer moves inside the widget.

**Parameters**

- `x`: the x coordinate
- `y`: the y coordinate
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.EventControllerMotion` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `containsPointer`

```ts
containsPointer(): boolean
```

Returns if a pointer is within `self` or one of its children.

**Returns** `true` if a pointer is within `self` or one of its children

### `isPointer`

```ts
isPointer(): boolean
```

Returns if a pointer is within `self`, but not one of its children.

**Returns** `true` if a pointer is within `self` but not one of its children
