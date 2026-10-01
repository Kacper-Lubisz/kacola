---
description: "A swipe tracker used in Carousel, NavigationView and OverlaySplitView."
---

# AdwSwipeTracker

A swipe tracker used in `Carousel`, `NavigationView` and
`OverlaySplitView`.

The `AdwSwipeTracker` object can be used for implementing widgets with swipe
gestures. It supports touch-based swipes, pointer dragging, and touchpad
scrolling.

The widgets will probably want to expose the `SwipeTracker.enabled`
property. If they expect to use horizontal orientation,
`SwipeTracker.reversed` can be used for supporting RTL text
direction.

```tsx
import { AdwSwipeTracker } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwSwipeTracker**

Implements `GtkOrientable`.

## Props

`ref` receives the `Adw.SwipeTracker` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowLongSwipes`

`boolean` · default `false`

Whether to allow swiping for more than one snap point at a time.

If the value is `FALSE`, each swipe can only move to the adjacent snap
points.

### `allowMouseDrag`

`boolean` · default `false`

Whether to allow dragging with mouse pointer.

### `allowWindowHandle`

`boolean` · default `false`

Whether to allow touchscreen swiping from `GtkWindowHandle`.

This will make dragging the window impossible.

_Available since 1.5._

### `enabled`

`boolean` · default `true`

Whether the swipe tracker is enabled.

When it's not enabled, no events will be processed. Usually widgets will
want to expose this via a property.

### `lowerOvershoot`

`boolean` · default `false`

Whether to allow swiping past the first available snap point.

_Available since 1.4._

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `reversed`

`boolean` · default `false`

Whether to reverse the swipe direction.

If the swipe tracker is horizontal, it can be used for supporting RTL text
direction.

### `swipeable`

`Adw.Swipeable` · construct-only

The widget the swipe tracker is attached to.

### `upperOvershoot`

`boolean` · default `false`

Whether to allow swiping past the last available snap point.

_Available since 1.4._

## Signals

### `onBeginSwipe`

```ts
(self: Adw.SwipeTracker) => void
```

This signal is emitted right before a swipe will be started, after the
drag threshold has been passed.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onEndSwipe`

```ts
(velocity: number, to: number, self: Adw.SwipeTracker) => void
```

This signal is emitted as soon as the gesture has stopped.

The user is expected to animate the deceleration from the current progress
value to `to` with an animation using `velocity` as the initial velocity,
provided in pixels per second. `SpringAnimation` is usually a good
fit for this.

**Parameters**

- `velocity`: the velocity of the swipe
- `to`: the progress value to animate to
- `self`: The instance the signal was emitted on.

### `onPrepare`

```ts
(direction: Adw.NavigationDirection, self: Adw.SwipeTracker) => void
```

This signal is emitted when a possible swipe is detected.

The `direction` value can be used to restrict the swipe to a certain
direction.

**Parameters**

- `direction`: the direction of the swipe
- `self`: The instance the signal was emitted on.

### `onUpdateSwipe`

```ts
(progress: number, self: Adw.SwipeTracker) => void
```

This signal is emitted every time the progress value changes.

**Parameters**

- `progress`: the current animation progress value
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.SwipeTracker` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAllowLongSwipes`

```ts
getAllowLongSwipes(): boolean
```

Gets whether to allow swiping for more than one snap point at a time.

**Returns** whether long swipes are allowed

### `getAllowMouseDrag`

```ts
getAllowMouseDrag(): boolean
```

Gets whether `self` can be dragged with mouse pointer.

**Returns** whether mouse dragging is allowed

### `getAllowWindowHandle`

```ts
getAllowWindowHandle(): boolean
```

Gets whether to allow touchscreen swiping from `GtkWindowHandle`.

**Returns** whether swiping from window handles is allowed

_Available since 1.5._

### `getEnabled`

```ts
getEnabled(): boolean
```

Gets whether `self` is enabled.

**Returns** whether `self` is enabled

### `getLowerOvershoot`

```ts
getLowerOvershoot(): boolean
```

Gets whether to allow swiping past the first available snap point.

**Returns** whether to allow swiping past the first available snap point

_Available since 1.4._

### `getReversed`

```ts
getReversed(): boolean
```

Gets whether `self` is reversing the swipe direction.

**Returns** whether the direction is reversed

### `getSwipeable`

```ts
getSwipeable(): Adw.Swipeable
```

Get the widget `self` is attached to.

**Returns** the swipeable widget

### `getUpperOvershoot`

```ts
getUpperOvershoot(): boolean
```

Gets whether to allow swiping past the last available snap point.

**Returns** whether to allow swiping past the last available snap point

_Available since 1.4._

### `setAllowLongSwipes`

```ts
setAllowLongSwipes(allowLongSwipes: boolean): void
```

Sets whether to allow swiping for more than one snap point at a time.

If the value is `FALSE`, each swipe can only move to the adjacent snap
points.

**Parameters**

- `allowLongSwipes`: whether to allow long swipes

### `setAllowMouseDrag`

```ts
setAllowMouseDrag(allowMouseDrag: boolean): void
```

Sets whether `self` can be dragged with mouse pointer.

**Parameters**

- `allowMouseDrag`: whether to allow mouse dragging

### `setAllowWindowHandle`

```ts
setAllowWindowHandle(allowWindowHandle: boolean): void
```

Sets whether to allow touchscreen swiping from `GtkWindowHandle`.

Setting it to `TRUE` will make dragging the window impossible.

**Parameters**

- `allowWindowHandle`: whether to allow swiping from window handles

_Available since 1.5._

### `setEnabled`

```ts
setEnabled(enabled: boolean): void
```

Sets whether `self` is enabled.

When it's not enabled, no events will be processed. Usually widgets will want
to expose this via a property.

**Parameters**

- `enabled`: whether `self` is enabled

### `setLowerOvershoot`

```ts
setLowerOvershoot(overshoot: boolean): void
```

Sets whether to allow swiping past the first available snap point.

**Parameters**

- `overshoot`: whether to allow swiping past the first available snap point

_Available since 1.4._

### `setReversed`

```ts
setReversed(reversed: boolean): void
```

Sets whether to reverse the swipe direction.

If the swipe tracker is horizontal, it can be used for supporting RTL text
direction.

**Parameters**

- `reversed`: whether to reverse the swipe direction

### `setUpperOvershoot`

```ts
setUpperOvershoot(overshoot: boolean): void
```

Sets whether to allow swiping past the last available snap point.

**Parameters**

- `overshoot`: whether to allow swiping past the last available snap point

_Available since 1.4._

### `shiftPosition`

```ts
shiftPosition(delta: number): void
```

Moves the current progress value by `delta`.

This can be used to adjust the current position if snap points move during
the gesture.

**Parameters**

- `delta`: the position delta
