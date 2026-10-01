---
description: "Recognizes swipe gestures."
---

# GtkGestureSwipe

Recognizes swipe gestures.

After a press/move/.../move/release sequence happens, the
`Gtk.GestureSwipe.swipe` signal will be emitted,
providing the velocity and directionality of the sequence
at the time it was lifted.

If the velocity is desired in intermediate points,
`Gtk.GestureSwipe.getVelocity()` can be called in a
`Gtk.Gesture.update` handler.

All velocities are reported in pixels/sec units.

```tsx
import { GtkGestureSwipe } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkGestureSwipe**

## Props

`ref` receives the `Gtk.GestureSwipe` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onSwipe`

```ts
(velocityX: number, velocityY: number, self: Gtk.GestureSwipe) => void
```

Emitted when the recognized gesture is finished.

Velocity and direction are a product of previously recorded events.

**Parameters**

- `velocityX`: velocity in the X axis, in pixels/sec
- `velocityY`: velocity in the Y axis, in pixels/sec
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureSwipe` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getVelocity`

```ts
getVelocity(): [boolean, number, number]
```

Gets the current velocity.

If the gesture is recognized, this function returns `true` and fills
in `velocity_x` and `velocity_y` with the recorded velocity, as per the
last events processed.

**Returns** Tuple of:

- `result`: whether velocity could be calculated
- `velocityX`: return value for the velocity in the X axis, in pixels/sec
- `velocityY`: return value for the velocity in the Y axis, in pixels/sec
