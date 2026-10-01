---
description: "Recognizes long press gestures."
---

# GtkGestureLongPress

Recognizes long press gestures.

This gesture is also known as “Press and Hold”.

When the timeout is exceeded, the gesture is triggering the
`Gtk.GestureLongPress.pressed` signal.

If the touchpoint is lifted before the timeout passes, or if
it drifts too far of the initial press point, the
`Gtk.GestureLongPress.cancelled` signal will be emitted.

How long the timeout is before the ::pressed signal gets emitted is
determined by the `Gtk.Settings.gtkLongPressTime` setting.
It can be modified by the `Gtk.GestureLongPress.delayFactor`
property.

```tsx
import { GtkGestureLongPress } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkGestureLongPress**

## Props

`ref` receives the `Gtk.GestureLongPress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `delayFactor`

`number` · default `1.000000`

Factor by which to modify the default timeout.

## Signals

### `onCancelled`

```ts
(self: Gtk.GestureLongPress) => void
```

Emitted whenever a press moved too far, or was released
before `Gtk.GestureLongPress.pressed` happened.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPressed`

```ts
(x: number, y: number, self: Gtk.GestureLongPress) => void
```

Emitted whenever a press goes unmoved/unreleased longer than
what the GTK defaults tell.

**Parameters**

- `x`: the X coordinate where the press happened, relative to the widget allocation
- `y`: the Y coordinate where the press happened, relative to the widget allocation
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.GestureLongPress` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDelayFactor`

```ts
getDelayFactor(): number
```

Returns the delay factor.

**Returns** the delay factor

### `setDelayFactor`

```ts
setDelayFactor(delayFactor: number): void
```

Applies the given delay factor.

The default long press time will be multiplied by this value.
Valid values are in the range [0.5..2.0].

**Parameters**

- `delayFactor`: The delay factor to apply
