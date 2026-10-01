---
description: "Recognizes tablet stylus input."
---

# GtkGestureStylus

Recognizes tablet stylus input.

The provided signals just relay the basic information of the
stylus events.

```tsx
import { GtkGestureStylus } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkGestureStylus**

## Props

`ref` receives the `Gtk.GestureStylus` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `stylusOnly`

`boolean` · default `true`

If this gesture should exclusively react to stylus input devices.

_Available since 4.10._

## Signals

### `onDown`

```ts
(x: number, y: number, self: Gtk.GestureStylus) => void
```

Emitted when the stylus touches the device.

**Parameters**

- `x`: the X coordinate of the stylus event
- `y`: the Y coordinate of the stylus event
- `self`: The instance the signal was emitted on.

### `onMotion`

```ts
(x: number, y: number, self: Gtk.GestureStylus) => void
```

Emitted when the stylus moves while touching the device.

**Parameters**

- `x`: the X coordinate of the stylus event
- `y`: the Y coordinate of the stylus event
- `self`: The instance the signal was emitted on.

### `onProximity`

```ts
(x: number, y: number, self: Gtk.GestureStylus) => void
```

Emitted when the stylus is in proximity of the device.

**Parameters**

- `x`: the X coordinate of the stylus event
- `y`: the Y coordinate of the stylus event
- `self`: The instance the signal was emitted on.

### `onUp`

```ts
(x: number, y: number, self: Gtk.GestureStylus) => void
```

Emitted when the stylus no longer touches the device.

**Parameters**

- `x`: the X coordinate of the stylus event
- `y`: the Y coordinate of the stylus event
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureStylus` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAxes`

```ts
getAxes(axes: number): [boolean, number]
```

Returns the current values for the requested `axes`.

This function must be called from the handler of one of the
`Gtk.GestureStylus.down`, `Gtk.GestureStylus.motion`,
`Gtk.GestureStylus.up` or `Gtk.GestureStylus.proximity`
signals.

**Parameters**

- `axes`: array of requested axes, terminated with `GDK_AXIS_IGNORE`

**Returns** Tuple of:

- `result`: `true` if there is a current value for the axes
- `values`: return location for the axis values

### `getAxis`

```ts
getAxis(axis: Gdk.AxisUse): [boolean, number]
```

Returns the current value for the requested `axis`.

This function must be called from the handler of one of the
`Gtk.GestureStylus.down`, `Gtk.GestureStylus.motion`,
`Gtk.GestureStylus.up` or `Gtk.GestureStylus.proximity`
signals.

**Parameters**

- `axis`: requested device axis

**Returns** Tuple of:

- `result`: `true` if there is a current value for the axis
- `value`: return location for the axis value

### `getBacklog`

```ts
getBacklog(): [boolean, Gdk.TimeCoord[]]
```

Returns the accumulated backlog of tracking information.

By default, GTK will limit rate of input events. On stylus input
where accuracy of strokes is paramount, this function returns the
accumulated coordinate/timing state before the emission of the
current [Gtk.GestureStylus::motion] signal.

This function may only be called within a `Gtk.GestureStylus.motion`
signal handler, the state given in this signal and obtainable through
`Gtk.GestureStylus.getAxis()` express the latest (most up-to-date)
state in motion history.

The `backlog` is provided in chronological order.

**Returns** Tuple of:

- `result`: `true` if there is a backlog to unfold in the current state.
- `backlog`: coordinates and times for the backlog events

### `getDeviceTool`

```ts
getDeviceTool(): Gdk.DeviceTool | null
```

Returns the `GdkDeviceTool` currently driving input through this gesture.

This function must be called from the handler of one of the
`Gtk.GestureStylus.down`, `Gtk.GestureStylus.motion`,
`Gtk.GestureStylus.up` or `Gtk.GestureStylus.proximity`
signals.

**Returns** The current stylus tool

### `getStylusOnly`

```ts
getStylusOnly(): boolean
```

Checks whether the gesture is for styluses only.

Stylus-only gestures will signal events exclusively from stylus
input devices.

**Returns** `true` if the gesture is only for stylus events

_Available since 4.10._

### `setStylusOnly`

```ts
setStylusOnly(stylusOnly: boolean): void
```

Sets the state of stylus-only

If true, the gesture will exclusively handle events from stylus input devices,
otherwise it'll handle events from any pointing device.

**Parameters**

- `stylusOnly`: whether the gesture is used exclusively for stylus events

_Available since 4.10._
