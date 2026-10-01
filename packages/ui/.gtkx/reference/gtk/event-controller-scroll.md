---
description: "Handles scroll events."
---

# GtkEventControllerScroll

Handles scroll events.

It is capable of handling both discrete and continuous scroll
events from mice or touchpads, abstracting them both with the
`Gtk.EventControllerScroll.scroll` signal. Deltas in
the discrete case are multiples of 1.

In the case of continuous scroll events, `GtkEventControllerScroll`
encloses all `Gtk.EventControllerScroll.scroll` emissions
between two `Gtk.EventControllerScroll.scroll-begin` and
`Gtk.EventControllerScroll.scroll-end` signals.

The behavior of the event controller can be modified by the flags
given at creation time, or modified at a later point through
`Gtk.EventControllerScroll.setFlags()` (e.g. because the scrolling
conditions of the widget changed).

The controller can be set up to emit motion for either/both vertical
and horizontal scroll events through `GTK_EVENT_CONTROLLER_SCROLL_VERTICAL`,
`GTK_EVENT_CONTROLLER_SCROLL_HORIZONTAL` and `GTK_EVENT_CONTROLLER_SCROLL_BOTH_AXES`.
If any axis is disabled, the respective `Gtk.EventControllerScroll.scroll`
delta will be 0. Vertical scroll events will be translated to horizontal
motion for the devices incapable of horizontal scrolling.

The event controller can also be forced to emit discrete events on all
devices through `GTK_EVENT_CONTROLLER_SCROLL_DISCRETE`. This can be used
to implement discrete actions triggered through scroll events (e.g.
switching across combobox options).

The `GTK_EVENT_CONTROLLER_SCROLL_KINETIC` flag toggles the emission of the
`Gtk.EventControllerScroll.decelerate` signal, emitted at the end
of scrolling with two X/Y velocity arguments that are consistent with the
motion that was received.

```tsx
import { GtkEventControllerScroll } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkEventControllerScroll**

## Props

`ref` receives the `Gtk.EventControllerScroll` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `flags`

`Gtk.EventControllerScrollFlags` · default `GTK_EVENT_CONTROLLER_SCROLL_NONE`

The flags affecting event controller behavior.

## Signals

### `onDecelerate`

```ts
(velX: number, velY: number, self: Gtk.EventControllerScroll) => void
```

Emitted after scroll is finished if the
`GTK_EVENT_CONTROLLER_SCROLL_KINETIC` flag is set.

`vel_x` and `vel_y` express the initial velocity that was
imprinted by the scroll events. `vel_x` and `vel_y` are expressed in
pixels/ms.

**Parameters**

- `velX`: X velocity
- `velY`: Y velocity
- `self`: The instance the signal was emitted on.

### `onScroll`

```ts
(dx: number, dy: number, self: Gtk.EventControllerScroll) => boolean | undefined
```

Signals that the widget should scroll by the
amount specified by `dx` and `dy`.

For the representation unit of the deltas, see
`Gtk.EventControllerScroll.getUnit()`.

**Parameters**

- `dx`: X delta
- `dy`: Y delta
- `self`: The instance the signal was emitted on.

**Returns** `true` if the scroll event was handled,
  `false` otherwise.

### `onScrollBegin`

```ts
(self: Gtk.EventControllerScroll) => void
```

Signals that a new scrolling operation has begun.

It will only be emitted on devices capable of it.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onScrollEnd`

```ts
(self: Gtk.EventControllerScroll) => void
```

Signals that a scrolling operation has finished.

It will only be emitted on devices capable of it.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.EventControllerScroll` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getFlags`

```ts
getFlags(): Gtk.EventControllerScrollFlags
```

Gets the flags conditioning the scroll controller behavior.

**Returns** the controller flags.

### `getUnit`

```ts
getUnit(): Gdk.ScrollUnit
```

Gets the scroll unit of the last
`Gtk.EventControllerScroll.scroll` signal received.

Always returns `GDK_SCROLL_UNIT_WHEEL` if the
`GTK_EVENT_CONTROLLER_SCROLL_DISCRETE` flag is set.

**Returns** the scroll unit.

_Available since 4.8._

### `setFlags`

```ts
setFlags(flags: Gtk.EventControllerScrollFlags): void
```

Sets the flags conditioning scroll controller behavior.

**Parameters**

- `flags`: flags affecting the controller behavior
