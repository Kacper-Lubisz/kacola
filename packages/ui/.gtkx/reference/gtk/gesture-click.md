---
description: "Recognizes click gestures."
---

# GtkGestureClick

Recognizes click gestures.

It is able to recognize multiple clicks on a nearby zone, which
can be listened for through the `Gtk.GestureClick.pressed`
signal. Whenever time or distance between clicks exceed the GTK
defaults, `Gtk.GestureClick.stopped` is emitted, and the
click counter is reset.

```tsx
import { GtkGestureClick } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkGestureClick**

## Props

`ref` receives the `Gtk.GestureClick` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onPressed`

```ts
(nPress: number, x: number, y: number, self: Gtk.GestureClick) => void
```

Emitted whenever a button or touch press happens.

**Parameters**

- `nPress`: how many touch/button presses happened with this one
- `x`: The X coordinate, in widget allocation coordinates
- `y`: The Y coordinate, in widget allocation coordinates
- `self`: The instance the signal was emitted on.

### `onReleased`

```ts
(nPress: number, x: number, y: number, self: Gtk.GestureClick) => void
```

Emitted when a button or touch is released.

`n_press` will report the number of press that is paired to
this event, note that `Gtk.GestureClick.stopped` may
have been emitted between the press and its release, `n_press`
will only start over at the next press.

**Parameters**

- `nPress`: number of press that is paired with this release
- `x`: The X coordinate, in widget allocation coordinates
- `y`: The Y coordinate, in widget allocation coordinates
- `self`: The instance the signal was emitted on.

### `onStopped`

```ts
(self: Gtk.GestureClick) => void
```

Emitted whenever any time/distance threshold has been exceeded.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnpairedRelease`

```ts
(x: number, y: number, button: number, sequence: Gdk.EventSequence | null, self: Gtk.GestureClick) => void
```

Emitted whenever the gesture receives a release
event that had no previous corresponding press.

Due to implicit grabs, this can only happen on situations
where input is grabbed elsewhere mid-press or the pressed
widget voluntarily relinquishes its implicit grab.

**Parameters**

- `x`: X coordinate of the event
- `y`: Y coordinate of the event
- `button`: Button being released
- `sequence`: Sequence being released
- `self`: The instance the signal was emitted on.
