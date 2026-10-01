---
description: "A GtkGesture subclass optimized for singe-touch and mouse gestures."
---

# GtkGestureSingle

A `GtkGesture` subclass optimized for singe-touch and mouse gestures.

Under interaction, these gestures stick to the first interacting sequence,
which is accessible through `Gtk.GestureSingle.getCurrentSequence()`
while the gesture is being interacted with.

By default gestures react to both `GDK_BUTTON_PRIMARY` and touch events.
`Gtk.GestureSingle.setTouchOnly()` can be used to change the
touch behavior. Callers may also specify a different mouse button number
to interact with through `Gtk.GestureSingle.setButton()`, or react
to any mouse button by setting it to 0. While the gesture is active, the
button being currently pressed can be known through
`Gtk.GestureSingle.getCurrentButton()`.

```tsx
import { GtkGestureSingle } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → **GtkGestureSingle**

## Props

`ref` receives the `Gtk.GestureSingle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `button`

`number` · default `1`

Mouse button number to listen to, or 0 to listen for any button.

### `exclusive`

`boolean` · default `false`

Whether the gesture is exclusive.

Exclusive gestures only listen to pointer and pointer emulated events.

### `touchOnly`

`boolean` · default `false`

Whether the gesture handles only touch events.

## Methods

Methods are called on the `Gtk.GestureSingle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getButton`

```ts
getButton(): number
```

Returns the button number `gesture` listens for.

If this is 0, the gesture reacts to any button press.

**Returns** The button number, or 0 for any button

### `getCurrentButton`

```ts
getCurrentButton(): number
```

Returns the button number currently interacting
with `gesture`, or 0 if there is none.

**Returns** The current button number

### `getCurrentSequence`

```ts
getCurrentSequence(): Gdk.EventSequence | null
```

Returns the event sequence currently interacting with `gesture`.

This is only meaningful if `Gtk.Gesture.isActive()`
returns `true`.

**Returns** the current sequence

### `getExclusive`

```ts
getExclusive(): boolean
```

Gets whether a gesture is exclusive.

For more information, see `Gtk.GestureSingle.setExclusive()`.

**Returns** Whether the gesture is exclusive

### `getTouchOnly`

```ts
getTouchOnly(): boolean
```

Returns `true` if the gesture is only triggered by touch events.

**Returns** `true` if the gesture only handles touch events

### `setButton`

```ts
setButton(button: number): void
```

Sets the button number `gesture` listens to.

If non-0, every button press from a different button
number will be ignored. Touch events implicitly match
with button 1.

**Parameters**

- `button`: button number to listen to, or 0 for any button

### `setExclusive`

```ts
setExclusive(exclusive: boolean): void
```

Sets whether `gesture` is exclusive.

An exclusive gesture will only handle pointer and "pointer emulated"
touch events, so at any given time, there is only one sequence able
to interact with those.

**Parameters**

- `exclusive`: `true` to make `gesture` exclusive

### `setTouchOnly`

```ts
setTouchOnly(touchOnly: boolean): void
```

Sets whether to handle only touch events.

If `touch_only` is `true`, `gesture` will only handle events of type
`GDK_TOUCH_BEGIN`, `GDK_TOUCH_UPDATE` or `GDK_TOUCH_END`. If `false`,
mouse events will be handled too.

**Parameters**

- `touchOnly`: whether `gesture` handles only touch events
