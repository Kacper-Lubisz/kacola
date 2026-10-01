---
description: "A best fit container."
---

# AdwSqueezer

A best fit container.




The `AdwSqueezer` widget is a container which only shows the first of its
children that fits in the available size. It is convenient to offer different
widgets to represent the same data with different levels of detail, making
the widget seem to squeeze itself to fit in the available space.

Transitions between children can be animated as fades. This can be controlled
with `Squeezer.transitionType`.

### CSS nodes

`AdwSqueezer` has a single CSS node with name `squeezer`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

```tsx
import { AdwSqueezer } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwSqueezer**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.Squeezer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `allowNone`

`boolean` · default `false` · deprecated since 1.4

Whether to allow squeezing beyond the last child's minimum size.

If set to `TRUE`, the squeezer can shrink to the point where no child can
be shown. This is functionally equivalent to appending a widget with 0×0
minimum size.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `homogeneous`

`boolean` · default `false` · deprecated since 1.4

Whether all children have the same size for the opposite orientation.

For example, if a squeezer is horizontal and is homogeneous, it will
request the same height for all its children. If it isn't, the squeezer may
change size when a different child becomes visible.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `interpolateSize`

`boolean` · default `false` · deprecated since 1.4

Whether the squeezer interpolates its size when changing the visible child.

If `TRUE`, the squeezer will interpolate its size between the one of the
previous visible child and the one of the new visible child, according to
the set transition duration and the orientation, e.g. if the squeezer is
horizontal, it will interpolate the its height.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `pages`

`Gtk.SelectionModel` · read-only, observe with `onNotifyPages` · deprecated since 1.4

A selection model with the squeezer's pages.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track the visible page.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `switchThresholdPolicy`

`Adw.FoldThresholdPolicy` · default `ADW_FOLD_THRESHOLD_POLICY_NATURAL` · deprecated since 1.4

The switch threshold policy.

Determines when the squeezer will switch children.

If set to `Adw.FoldThresholdPolicy.minimum`, it will only switch when
the visible child cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`,
it will switch as soon as the visible child doesn't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately switching.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `transitionDuration`

`number` · default `200` · deprecated since 1.4

The transition animation duration, in milliseconds.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `transitionRunning`

`boolean` · default `false` · read-only, observe with `onNotifyTransitionRunning` · deprecated since 1.4

Whether a transition is currently running.

If a transition is impossible, the property value will be set to `TRUE` and
then immediately to `FALSE`, so it's possible to rely on its notifications
to know that a transition has happened.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `transitionType`

`Adw.SqueezerTransitionType` · default `ADW_SQUEEZER_TRANSITION_TYPE_NONE` · deprecated since 1.4

The type of animation used for transitions between children.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `visibleChild`

`Gtk.Widget` · read-only, observe with `onNotifyVisibleChild` · deprecated since 1.4

The currently visible child.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `xalign`

`number` · default `0.500000` · deprecated since 1.4

The horizontal alignment, from 0 (start) to 1 (end).

This affects the children allocation during transitions, when they exceed
the size of the squeezer.

For example, 0.5 means the child will be centered, 0 means it will keep the
start side aligned and overflow the end side, and 1 means the opposite.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `yalign`

`number` · default `0.500000` · deprecated since 1.4

The vertical alignment, from 0 (top) to 1 (bottom).

This affects the children allocation during transitions, when they exceed
the size of the squeezer.

For example, 0.5 means the child will be centered, 0 means it will keep the
top side aligned and overflow the bottom side, and 1 means the opposite.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

## Methods

Methods are called on the `Adw.Squeezer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(child: Gtk.Widget): Adw.SqueezerPage
```

Adds a child to `self`.

**Parameters**

- `child`: the widget to add

**Returns** the `SqueezerPage` for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getAllowNone`

```ts
getAllowNone(): boolean
```

Gets whether to allow squeezing beyond the last child's minimum size.

**Returns** whether `self` allows squeezing beyond the last child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Gets whether all children have the same size for the opposite orientation.

**Returns** whether `self` is homogeneous

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getInterpolateSize`

```ts
getInterpolateSize(): boolean
```

Gets whether `self` interpolates its size when changing the visible child.

**Returns** whether the size is interpolated

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getPage`

```ts
getPage(child: Gtk.Widget): Adw.SqueezerPage
```

Returns the `SqueezerPage` object for `child`.

**Parameters**

- `child`: a child of `self`

**Returns** the page object for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getPages`

```ts
getPages(): Gtk.SelectionModel
```

Returns a `Gio.ListModel` that contains the pages of `self`.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track the visible page.

**Returns** a `GtkSelectionModel` for the squeezer's children

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getSwitchThresholdPolicy`

```ts
getSwitchThresholdPolicy(): Adw.FoldThresholdPolicy
```

Gets the switch threshold policy for `self`.

**Returns** the fold threshold policy

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getTransitionDuration`

```ts
getTransitionDuration(): number
```

Gets the transition animation duration for `self`.

**Returns** the transition duration, in milliseconds

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getTransitionRunning`

```ts
getTransitionRunning(): boolean
```

Gets whether a transition is currently running for `self`.

If a transition is impossible, the property value will be set to `TRUE` and
then immediately to `FALSE`, so it's possible to rely on its notifications
to know that a transition has happened.

**Returns** whether a transition is currently running

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getTransitionType`

```ts
getTransitionType(): Adw.SqueezerTransitionType
```

Gets the type of animation used for transitions between children in `self`.

**Returns** the current transition type of `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getVisibleChild`

```ts
getVisibleChild(): Gtk.Widget | null
```

Gets the currently visible child of `self`.

**Returns** the visible child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getXalign`

```ts
getXalign(): number
```

Gets the horizontal alignment, from 0 (start) to 1 (end).

**Returns** the alignment value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `getYalign`

```ts
getYalign(): number
```

Gets the vertical alignment, from 0 (top) to 1 (bottom).

**Returns** the alignment value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from `self`.

**Parameters**

- `child`: the child to remove

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setAllowNone`

```ts
setAllowNone(allowNone: boolean): void
```

Sets whether to allow squeezing beyond the last child's minimum size.

If set to `TRUE`, the squeezer can shrink to the point where no child can be
shown. This is functionally equivalent to appending a widget with 0×0 minimum
size.

**Parameters**

- `allowNone`: whether `self` allows squeezing beyond the last child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether all children have the same size for the opposite orientation.

For example, if a squeezer is horizontal and is homogeneous, it will request
the same height for all its children. If it isn't, the squeezer may change
size when a different child becomes visible.

**Parameters**

- `homogeneous`: whether `self` is homogeneous

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setInterpolateSize`

```ts
setInterpolateSize(interpolateSize: boolean): void
```

Sets whether `self` interpolates its size when changing the visible child.

If `TRUE`, the squeezer will interpolate its size between the one of the
previous visible child and the one of the new visible child, according to the
set transition duration and the orientation, e.g. if the squeezer is
horizontal, it will interpolate the its height.

**Parameters**

- `interpolateSize`: whether to interpolate the size

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setSwitchThresholdPolicy`

```ts
setSwitchThresholdPolicy(policy: Adw.FoldThresholdPolicy): void
```

Sets the switch threshold policy for `self`.

Determines when the squeezer will switch children.

If set to `Adw.FoldThresholdPolicy.minimum`, it will only switch when
the visible child cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`,
it will switch as soon as the visible child doesn't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately switching.

**Parameters**

- `policy`: the policy to use

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setTransitionDuration`

```ts
setTransitionDuration(duration: number): void
```

Sets the transition animation duration for `self`.

**Parameters**

- `duration`: the new duration, in milliseconds

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setTransitionType`

```ts
setTransitionType(transition: Adw.SqueezerTransitionType): void
```

Sets the type of animation used for transitions between children in `self`.

**Parameters**

- `transition`: the new transition type

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setXalign`

```ts
setXalign(xalign: number): void
```

Sets the horizontal alignment, from 0 (start) to 1 (end).

This affects the children allocation during transitions, when they exceed the
size of the squeezer.

For example, 0.5 means the child will be centered, 0 means it will keep the
start side aligned and overflow the end side, and 1 means the opposite.

**Parameters**

- `xalign`: the new alignment value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)

### `setYalign`

```ts
setYalign(yalign: number): void
```

Sets the vertical alignment, from 0 (top) to 1 (bottom).

This affects the children allocation during transitions, when they exceed the
size of the squeezer.

For example, 0.5 means the child will be centered, 0 means it will keep the
top side aligned and overflow the bottom side, and 1 means the opposite.

**Parameters**

- `yalign`: the new alignment value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwsqueezer)
