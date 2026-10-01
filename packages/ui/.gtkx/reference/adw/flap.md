---
description: "An adaptive container acting like a box or an overlay."
---

# AdwFlap

An adaptive container acting like a box or an overlay.




The `AdwFlap` widget can display its children like a `Gtk.Box` does or
like a `Gtk.Overlay` does, according to the
`Flap.foldPolicy` value.

`AdwFlap` has at most three children: `Flap.content`,
`Flap.flap` and `Flap.separator`. Content is the primary
child, flap is displayed next to it when unfolded, or overlays it when
folded. Flap can be shown or hidden by changing the
`Flap.revealFlap` value, as well as via swipe gestures if
`Flap.swipeToOpen` and/or `Flap.swipeToClose` are set
to `TRUE`.

Optionally, a separator can be provided, which would be displayed between
the content and the flap when there's no shadow to separate them, depending
on the transition type.

`Flap.flap` is transparent by default; add the
[`.background`](style-classes.html#background) style class to it if this is
unwanted.

If `Flap.modal` is set to `TRUE`, content becomes completely
inaccessible when the flap is revealed while folded.

The position of the flap and separator children relative to the content is
determined by orientation, as well as the `Flap.flapPosition`
value.

Folding the flap will automatically hide the flap widget, and unfolding it
will automatically reveal it. If this behavior is not desired, the
`Flap.locked` property can be used to override it.

Common use cases include sidebars, header bars that need to be able to
overlap the window content (for example, in fullscreen mode) and bottom
sheets.

### AdwFlap as GtkBuildable

The `AdwFlap` implementation of the `Gtk.Buildable` interface supports
setting the flap child by specifying “flap” as the “type” attribute of a
`<child>` element, and separator by specifying “separator”. Specifying
“content” child type or omitting it results in setting the content child.

### CSS nodes

`AdwFlap` has a single CSS node with name `flap`. The node will get the style
classes `.folded` when it is folded, and `.unfolded` when it's not.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

```tsx
import { AdwFlap } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwFlap**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.Flap` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `content`

`Gtk.Widget | ReactElement` · deprecated since 1.4

The content widget.

It's always displayed when unfolded, and partially visible when folded.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `flap`

`Gtk.Widget | ReactElement` · deprecated since 1.4

The flap widget.

It's only visible when `Flap.revealProgress` is greater than 0.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `flapPosition`

`Gtk.PackType` · default `GTK_PACK_START` · deprecated since 1.4

The flap position.

If it's set to `Gtk.PackType.start`, the flap is displayed before the
content, if `Gtk.PackType.end`, it's displayed after the content.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `foldDuration`

`number` · default `250` · deprecated since 1.4

The fold transition animation duration, in milliseconds.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `folded`

`boolean` · default `false` · read-only, observe with `onNotifyFolded` · deprecated since 1.4

Whether the flap is currently folded.

See `Flap.foldPolicy`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `foldPolicy`

`Adw.FlapFoldPolicy` · default `ADW_FLAP_FOLD_POLICY_AUTO` · deprecated since 1.4

The fold policy for the flap.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `foldThresholdPolicy`

`Adw.FoldThresholdPolicy` · default `ADW_FOLD_THRESHOLD_POLICY_MINIMUM` · deprecated since 1.4

Determines when the flap will fold.

If set to `Adw.FoldThresholdPolicy.minimum`, flap will only fold when
the children cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`,
it will fold as soon as children don't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately folding.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `locked`

`boolean` · default `false` · deprecated since 1.4

Whether the flap is locked.

If `FALSE`, folding when the flap is revealed automatically closes it, and
unfolding it when the flap is not revealed opens it. If `TRUE`,
`Flap.revealFlap` value never changes on its own.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `modal`

`boolean` · default `true` · deprecated since 1.4

Whether the flap is modal.

If `TRUE`, clicking the content widget while flap is revealed, as well as
pressing the <kbd>Esc</kbd> key, will close the flap. If `FALSE`, clicks
are passed through to the content widget.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `revealFlap`

`boolean` · default `true` · deprecated since 1.4

Whether the flap widget is revealed.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `revealParams`

`Adw.SpringParams` · deprecated since 1.4

The reveal animation spring parameters.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `revealProgress`

`number` · default `1.000000` · read-only, observe with `onNotifyRevealProgress` · deprecated since 1.4

The current reveal transition progress.

0 means fully hidden, 1 means fully revealed.

See `Flap.revealFlap`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `separator`

`Gtk.Widget | ReactElement` · deprecated since 1.4

The separator widget.

It's displayed between content and flap when there's no shadow to display.
When exactly it's visible depends on the `Flap.transitionType`
value.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `swipeToClose`

`boolean` · default `true` · deprecated since 1.4

Whether the flap can be closed with a swipe gesture.

The area that can be swiped depends on the `Flap.transitionType`
value.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `swipeToOpen`

`boolean` · default `true` · deprecated since 1.4

Whether the flap can be opened with a swipe gesture.

The area that can be swiped depends on the `Flap.transitionType`
value.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `transitionType`

`Adw.FlapTransitionType` · default `ADW_FLAP_TRANSITION_TYPE_OVER` · deprecated since 1.4

the type of animation used for reveal and fold transitions.

`Flap.flap` is transparent by default, which means the content
will be seen through it with `Adw.FlapTransitionType.over` transitions;
add the [`.background`](style-classes.html#background) style class to it if
this is unwanted.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

## Methods

Methods are called on the `Adw.Flap` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getContent`

```ts
getContent(): Gtk.Widget | null
```

Gets the content widget for `self`.

**Returns** the content widget for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFlap`

```ts
getFlap(): Gtk.Widget | null
```

Gets the flap widget for `self`.

**Returns** the flap widget for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFlapPosition`

```ts
getFlapPosition(): Gtk.PackType
```

Gets the flap position for `self`.

**Returns** the flap position for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFoldDuration`

```ts
getFoldDuration(): number
```

Gets the fold transition animation duration for `self`, in milliseconds.

**Returns** the fold transition duration

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFolded`

```ts
getFolded(): boolean
```

Gets whether `self` is currently folded.

See `Flap.foldPolicy`.

**Returns** `TRUE` if `self` is currently folded

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFoldPolicy`

```ts
getFoldPolicy(): Adw.FlapFoldPolicy
```

Gets the fold policy for `self`.

**Returns** the fold policy for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getFoldThresholdPolicy`

```ts
getFoldThresholdPolicy(): Adw.FoldThresholdPolicy
```

Gets the fold threshold policy for `self`.

**Returns** the fold threshold policy

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getLocked`

```ts
getLocked(): boolean
```

Gets whether `self` is locked.

**Returns** `TRUE` if `self` is locked

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getModal`

```ts
getModal(): boolean
```

Gets whether `self` is modal.

**Returns** `TRUE` if `self` is modal

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getRevealFlap`

```ts
getRevealFlap(): boolean
```

Gets whether the flap widget is revealed for `self`.

**Returns** `TRUE` if the flap widget is revealed

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getRevealParams`

```ts
getRevealParams(): Adw.SpringParams
```

Gets the reveal animation spring parameters for `self`.

**Returns** the reveal animation parameters

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getRevealProgress`

```ts
getRevealProgress(): number
```

Gets the current reveal progress for `self`.

0 means fully hidden, 1 means fully revealed.

See `Flap.revealFlap`.

**Returns** the current reveal progress for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getSeparator`

```ts
getSeparator(): Gtk.Widget | null
```

Gets the separator widget for `self`.

**Returns** the separator widget for `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getSwipeToClose`

```ts
getSwipeToClose(): boolean
```

Gets whether `self` can be closed with a swipe gesture.

**Returns** `TRUE` if `self` can be closed with a swipe gesture

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getSwipeToOpen`

```ts
getSwipeToOpen(): boolean
```

Gets whether `self` can be opened with a swipe gesture.

**Returns** `TRUE` if `self` can be opened with a swipe gesture

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `getTransitionType`

```ts
getTransitionType(): Adw.FlapTransitionType
```

Gets the type of animation used for reveal and fold transitions in `self`.

**Returns** the current transition type of `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setContent`

```ts
setContent(content: Gtk.Widget | null): void
```

Sets the content widget for `self`.

It's always displayed when unfolded, and partially visible when folded.

**Parameters**

- `content`: the content widget

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setFlap`

```ts
setFlap(flap: Gtk.Widget | null): void
```

Sets the flap widget for `self`.

It's only visible when `Flap.revealProgress` is greater than 0.

**Parameters**

- `flap`: the flap widget

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setFlapPosition`

```ts
setFlapPosition(position: Gtk.PackType): void
```

Sets the flap position for `self`.

If it's set to `Gtk.PackType.start`, the flap is displayed before the
content, if `Gtk.PackType.end`, it's displayed after the content.

**Parameters**

- `position`: the new value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setFoldDuration`

```ts
setFoldDuration(duration: number): void
```

Sets the fold transition animation duration for `self`, in milliseconds.

**Parameters**

- `duration`: the new duration, in milliseconds

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setFoldPolicy`

```ts
setFoldPolicy(policy: Adw.FlapFoldPolicy): void
```

Sets the fold policy for `self`.

**Parameters**

- `policy`: the fold policy

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setFoldThresholdPolicy`

```ts
setFoldThresholdPolicy(policy: Adw.FoldThresholdPolicy): void
```

Sets the fold threshold policy for `self`.

If set to `Adw.FoldThresholdPolicy.minimum`, flap will only fold when
the children cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`,
it will fold as soon as children don't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately folding.

**Parameters**

- `policy`: the policy to use

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setLocked`

```ts
setLocked(locked: boolean): void
```

Sets whether `self` is locked.

If `FALSE`, folding when the flap is revealed automatically closes it, and
unfolding it when the flap is not revealed opens it. If `TRUE`,
`Flap.revealFlap` value never changes on its own.

**Parameters**

- `locked`: the new value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether `self` is modal.

If `TRUE`, clicking the content widget while flap is revealed, as well as
pressing the <kbd>Esc</kbd> key, will close the flap. If `FALSE`, clicks are
passed through to the content widget.

**Parameters**

- `modal`: whether `self` is modal

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setRevealFlap`

```ts
setRevealFlap(revealFlap: boolean): void
```

Sets whether the flap widget is revealed for `self`.

**Parameters**

- `revealFlap`: whether to reveal the flap widget

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setRevealParams`

```ts
setRevealParams(params: Adw.SpringParams): void
```

Sets the reveal animation spring parameters for `self`.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

**Parameters**

- `params`: the new parameters

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setSeparator`

```ts
setSeparator(separator: Gtk.Widget | null): void
```

Sets the separator widget for `self`.

It's displayed between content and flap when there's no shadow to display.
When exactly it's visible depends on the `Flap.transitionType`
value.

**Parameters**

- `separator`: the separator widget

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setSwipeToClose`

```ts
setSwipeToClose(swipeToClose: boolean): void
```

Sets whether `self` can be closed with a swipe gesture.

The area that can be swiped depends on the `Flap.transitionType`
value.

**Parameters**

- `swipeToClose`: whether `self` can be closed with a swipe gesture

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setSwipeToOpen`

```ts
setSwipeToOpen(swipeToOpen: boolean): void
```

Sets whether `self` can be opened with a swipe gesture.

The area that can be swiped depends on the `Flap.transitionType`
value.

**Parameters**

- `swipeToOpen`: whether `self` can be opened with a swipe gesture

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)

### `setTransitionType`

```ts
setTransitionType(transitionType: Adw.FlapTransitionType): void
```

Sets the type of animation used for reveal and fold transitions in `self`.

`Flap.flap` is transparent by default, which means the content will
be seen through it with `Adw.FlapTransitionType.over` transitions; add
the [`.background`](style-classes.html#background) style class to it if this
is unwanted.

**Parameters**

- `transitionType`: the new transition type

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwflap)
