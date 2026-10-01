---
description: "Recognizes pan gestures."
---

# GtkGesturePan

Recognizes pan gestures.

These are drags that are locked to happen along one axis. The axis
that a `GtkGesturePan` handles is defined at construct time, and
can be changed through `Gtk.GesturePan.setOrientation()`.

When the gesture starts to be recognized, `GtkGesturePan` will
attempt to determine as early as possible whether the sequence
is moving in the expected direction, and denying the sequence if
this does not happen.

Once a panning gesture along the expected axis is recognized,
the `Gtk.GesturePan.pan` signal will be emitted as input
events are received, containing the offset in the given axis.

```tsx
import { GtkGesturePan } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → [GtkGestureDrag](.gtkx/reference/gtk/gesture-drag.md) → **GtkGesturePan**

## Props

`ref` receives the `Gtk.GesturePan` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL`

The expected orientation of pan gestures.

## Signals

### `onPan`

```ts
(direction: Gtk.PanDirection, offset: number, self: Gtk.GesturePan) => void
```

Emitted once a panning gesture along the expected axis is detected.

**Parameters**

- `direction`: current direction of the pan gesture
- `offset`: Offset along the gesture orientation
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GesturePan` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getOrientation`

```ts
getOrientation(): Gtk.Orientation
```

Returns the orientation of the pan gestures that this `gesture` expects.

**Returns** the expected orientation for pan gestures

### `setOrientation`

```ts
setOrientation(orientation: Gtk.Orientation): void
```

Sets the orientation to be expected on pan gestures.

**Parameters**

- `orientation`: expected orientation
