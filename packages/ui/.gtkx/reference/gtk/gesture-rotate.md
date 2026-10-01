---
description: "Recognizes 2-finger rotation gestures."
---

# GtkGestureRotate

Recognizes 2-finger rotation gestures.

Whenever the angle between both handled sequences changes, the
`Gtk.GestureRotate.angle-changed` signal is emitted.

```tsx
import { GtkGestureRotate } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → **GtkGestureRotate**

## Props

`ref` receives the `Gtk.GestureRotate` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onAngleChanged`

```ts
(angle: number, angleDelta: number, self: Gtk.GestureRotate) => void
```

Emitted when the angle between both tracked points changes.

**Parameters**

- `angle`: Current angle in radians
- `angleDelta`: Difference with the starting angle, in radians
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureRotate` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAngleDelta`

```ts
getAngleDelta(): number
```

Gets the angle delta in radians.

If `gesture` is active, this function returns the angle difference
in radians since the gesture was first recognized. If `gesture` is
not active, 0 is returned.

**Returns** the angle delta in radians
