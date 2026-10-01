---
description: "Recognizes 2-finger pinch/zoom gestures."
---

# GtkGestureZoom

Recognizes 2-finger pinch/zoom gestures.

Whenever the distance between both tracked sequences changes, the
`Gtk.GestureZoom.scale-changed` signal is emitted to report
the scale factor.

```tsx
import { GtkGestureZoom } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → **GtkGestureZoom**

## Props

`ref` receives the `Gtk.GestureZoom` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onScaleChanged`

```ts
(scale: number, self: Gtk.GestureZoom) => void
```

Emitted whenever the distance between both tracked sequences changes.

**Parameters**

- `scale`: Scale delta, taking the initial state as 1:1
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureZoom` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getScaleDelta`

```ts
getScaleDelta(): number
```

Gets the scale delta.

If `gesture` is active, this function returns the zooming
difference since the gesture was recognized (hence the
starting point is considered 1:1). If `gesture` is not
active, 1 is returned.

**Returns** the scale delta
