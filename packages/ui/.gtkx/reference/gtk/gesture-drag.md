---
description: "Recognizes drag gestures."
---

# GtkGestureDrag

Recognizes drag gestures.

The drag operation itself can be tracked throughout the
`Gtk.GestureDrag.drag-begin`,
`Gtk.GestureDrag.drag-update` and
`Gtk.GestureDrag.drag-end` signals, and the relevant
coordinates can be extracted through
`Gtk.GestureDrag.getOffset()` and
`Gtk.GestureDrag.getStartPoint()`.

```tsx
import { GtkGestureDrag } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkGestureDrag**

## Props

`ref` receives the `Gtk.GestureDrag` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onDragBegin`

```ts
(startX: number, startY: number, self: Gtk.GestureDrag) => void
```

Emitted whenever dragging starts.

**Parameters**

- `startX`: X coordinate, relative to the widget allocation
- `startY`: Y coordinate, relative to the widget allocation
- `self`: The instance the signal was emitted on.

### `onDragEnd`

```ts
(offsetX: number, offsetY: number, self: Gtk.GestureDrag) => void
```

Emitted whenever the dragging is finished.

**Parameters**

- `offsetX`: X offset, relative to the start point
- `offsetY`: Y offset, relative to the start point
- `self`: The instance the signal was emitted on.

### `onDragUpdate`

```ts
(offsetX: number, offsetY: number, self: Gtk.GestureDrag) => void
```

Emitted whenever the dragging point moves.

**Parameters**

- `offsetX`: X offset, relative to the start point
- `offsetY`: Y offset, relative to the start point
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureDrag` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getOffset`

```ts
getOffset(): [boolean, number, number]
```

Gets the offset from the start point.

If the `gesture` is active, this function returns `true` and
fills in `x` and `y` with the coordinates of the current point,
as an offset to the starting drag point.

**Returns** Tuple of:

- `result`: `true` if the gesture is active
- `x`: X offset for the current point
- `y`: Y offset for the current point

### `getStartPoint`

```ts
getStartPoint(): [boolean, number, number]
```

Gets the point where the drag started.

If the `gesture` is active, this function returns `true`
and fills in `x` and `y` with the drag start coordinates,
in widget-relative coordinates.

**Returns** Tuple of:

- `result`: `true` if the gesture is active
- `x`: X coordinate for the drag start point
- `y`: Y coordinate for the drag start point
