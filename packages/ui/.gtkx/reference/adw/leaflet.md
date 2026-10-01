---
description: "An adaptive container acting like a box or a stack."
---

# AdwLeaflet

An adaptive container acting like a box or a stack.




The `AdwLeaflet` widget can display its children like a `Gtk.Box` does
or like a `Gtk.Stack` does, adapting to size changes by switching
between the two modes.

When there is enough space the children are displayed side by side, otherwise
only one is displayed and the leaflet is said to be “folded”.
The threshold is dictated by the preferred minimum sizes of the children.
When a leaflet is folded, the children can be navigated using swipe gestures.

The “over” and “under” transition types stack the children one on top of the
other, while the “slide” transition puts the children side by side. While
navigating to a child on the side or below can be performed by swiping the
current child away, navigating to an upper child requires dragging it from
the edge where it resides. This doesn't affect non-dragging swipes.

### CSS nodes

`AdwLeaflet` has a single CSS node with name `leaflet`. The node will get the
style classes `.folded` when it is folded, `.unfolded` when it's not, or none
if it hasn't computed its fold yet.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

```tsx
import { AdwLeaflet } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwLeaflet**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.Leaflet` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canNavigateBack`

`boolean` · default `false` · deprecated since 1.4

Whether gestures and shortcuts for navigating backward are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back/forward mouse buttons

The keyboard back/forward keys are also supported, as well as the
<kbd>Alt</kbd>+<kbd>←</kbd> shortcut for horizontal orientation, or
<kbd>Alt</kbd>+<kbd>↑</kbd> for vertical orientation.

If the orientation is horizontal, for right-to-left locales, gestures and
shortcuts are reversed.

Only children that have `LeafletPage.navigatable` set to `TRUE`
can be navigated to.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `canNavigateForward`

`boolean` · default `false` · deprecated since 1.4

Whether gestures and shortcuts for navigating forward are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back/forward mouse buttons

The keyboard back/forward keys are also supported, as well as the
<kbd>Alt</kbd>+<kbd>→</kbd> shortcut for horizontal orientation, or
<kbd>Alt</kbd>+<kbd>↓</kbd> for vertical orientation.

If the orientation is horizontal, for right-to-left locales, gestures and
shortcuts are reversed.

Only children that have `LeafletPage.navigatable` set to `TRUE`
can be navigated to.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `canUnfold`

`boolean` · default `true` · deprecated since 1.4

Whether or not the leaflet can unfold.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `childTransitionParams`

`Adw.SpringParams` · deprecated since 1.4

The child transition spring parameters.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `childTransitionRunning`

`boolean` · default `false` · read-only, observe with `onNotifyChildTransitionRunning` · deprecated since 1.4

Whether a child transition is currently running.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `folded`

`boolean` · default `false` · read-only, observe with `onNotifyFolded` · deprecated since 1.4

Whether the leaflet is folded.

The leaflet will be folded if the size allocated to it is smaller than the
sum of the minimum or natural sizes of the children (see
`Leaflet.foldThresholdPolicy`), it will be unfolded otherwise.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `foldThresholdPolicy`

`Adw.FoldThresholdPolicy` · default `ADW_FOLD_THRESHOLD_POLICY_MINIMUM` · deprecated since 1.4

Determines when the leaflet will fold.

If set to `Adw.FoldThresholdPolicy.minimum`, it will only fold when
the children cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`,
it will fold as soon as children don't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately folding.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `homogeneous`

`boolean` · default `true` · deprecated since 1.4

Whether the leaflet allocates the same size for all children when folded.

If set to `FALSE`, different children can have different size along the
opposite orientation.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `modeTransitionDuration`

`number` · default `250` · deprecated since 1.4

The mode transition animation duration, in milliseconds.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `pages`

`Gtk.SelectionModel` · read-only, observe with `onNotifyPages` · deprecated since 1.4

A selection model with the leaflet's pages.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track and change the visible
page.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `transitionType`

`Adw.LeafletTransitionType` · default `ADW_LEAFLET_TRANSITION_TYPE_OVER` · deprecated since 1.4

The type of animation used for transitions between modes and children.

The transition type can be changed without problems at runtime, so it is
possible to change the animation based on the mode or child that is about
to become current.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `visibleChild`

`Gtk.Widget | ReactElement` · deprecated since 1.4

The widget currently visible when the leaflet is folded.

The transition is determined by `Leaflet.transitionType` and
`Leaflet.childTransitionParams`. The transition can be cancelled
by the user, in which case visible child will change back to the previously
visible child.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `visibleChildName`

`string` · default `null` · deprecated since 1.4

The name of the widget currently visible when the leaflet is folded.

See `Leaflet.visibleChild`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

## Methods

Methods are called on the `Adw.Leaflet` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(child: Gtk.Widget): Adw.LeafletPage
```

Adds a child to `self`.

**Parameters**

- `child`: the widget to add

**Returns** the `LeafletPage` for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getAdjacentChild`

```ts
getAdjacentChild(direction: Adw.NavigationDirection): Gtk.Widget | null
```

Finds the previous or next navigatable child.

This will be the same child `Leaflet.navigate()` or swipe gestures will
navigate to.

If there's no child to navigate to, `NULL` will be returned instead.

See `LeafletPage.navigatable`.

**Parameters**

- `direction`: the direction

**Returns** the previous or next child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getCanNavigateBack`

```ts
getCanNavigateBack(): boolean
```

Gets whether gestures and shortcuts for navigating backward are enabled.

**Returns** Whether gestures and shortcuts are enabled.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getCanNavigateForward`

```ts
getCanNavigateForward(): boolean
```

Gets whether gestures and shortcuts for navigating forward are enabled.

**Returns** Whether gestures and shortcuts are enabled.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getCanUnfold`

```ts
getCanUnfold(): boolean
```

Gets whether `self` can unfold.

**Returns** whether `self` can unfold

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getChildByName`

```ts
getChildByName(name: string): Gtk.Widget | null
```

Finds the child of `self` with `name`.

Returns `NULL` if there is no child with this name.

See `LeafletPage.name`.

**Parameters**

- `name`: the name of the child to find

**Returns** the requested child of `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getChildTransitionParams`

```ts
getChildTransitionParams(): Adw.SpringParams
```

Gets the child transition spring parameters for `self`.

**Returns** the child transition parameters

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getChildTransitionRunning`

```ts
getChildTransitionRunning(): boolean
```

Gets whether a child transition is currently running for `self`.

**Returns** whether a transition is currently running

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getFolded`

```ts
getFolded(): boolean
```

Gets whether `self` is folded.

The leaflet will be folded if the size allocated to it is smaller than the
sum of the minimum or natural sizes of the children (see
`Leaflet.foldThresholdPolicy`), it will be unfolded otherwise.

**Returns** whether `self` is folded.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getFoldThresholdPolicy`

```ts
getFoldThresholdPolicy(): Adw.FoldThresholdPolicy
```

Gets the fold threshold policy for `self`.

**Returns** the fold threshold policy

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Gets whether `self` is homogeneous.

**Returns** whether `self` is homogeneous

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getModeTransitionDuration`

```ts
getModeTransitionDuration(): number
```

Gets the mode transition animation duration for `self`.

**Returns** the mode transition duration, in milliseconds.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getPage`

```ts
getPage(child: Gtk.Widget): Adw.LeafletPage
```

Returns the `LeafletPage` object for `child`.

**Parameters**

- `child`: a child of `self`

**Returns** the page object for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getPages`

```ts
getPages(): Gtk.SelectionModel
```

Returns a `Gio.ListModel` that contains the pages of the leaflet.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track and change the visible
page.

**Returns** a `GtkSelectionModel` for the leaflet's children

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getTransitionType`

```ts
getTransitionType(): Adw.LeafletTransitionType
```

Gets the type of animation used for transitions between modes and children.

**Returns** the current transition type of `self`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getVisibleChild`

```ts
getVisibleChild(): Gtk.Widget | null
```

Gets the widget currently visible when the leaflet is folded.

**Returns** the visible child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `getVisibleChildName`

```ts
getVisibleChildName(): string | null
```

Gets the name of the currently visible child widget.

**Returns** the name of the visible child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `insertChildAfter`

```ts
insertChildAfter(child: Gtk.Widget, sibling: Gtk.Widget | null): Adw.LeafletPage
```

Inserts `child` in the position after `sibling` in the list of children.

If `sibling` is `NULL`, inserts `child` at the first position.

**Parameters**

- `child`: the widget to insert
- `sibling`: the sibling after which to insert `child`

**Returns** the `LeafletPage` for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `navigate`

```ts
navigate(direction: Adw.NavigationDirection): boolean
```

Navigates to the previous or next child.

The child must have the `LeafletPage.navigatable` property set to
`TRUE`, otherwise it will be skipped.

This will be the same child as returned by
`Leaflet.getAdjacentChild()` or navigated to via swipe gestures.

**Parameters**

- `direction`: the direction

**Returns** whether the visible child was changed

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `prepend`

```ts
prepend(child: Gtk.Widget): Adw.LeafletPage
```

Inserts `child` at the first position in `self`.

**Parameters**

- `child`: the widget to prepend

**Returns** the `LeafletPage` for `child`

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from `self`.

**Parameters**

- `child`: the child to remove

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `reorderChildAfter`

```ts
reorderChildAfter(child: Gtk.Widget, sibling: Gtk.Widget | null): void
```

Moves `child` to the position after `sibling` in the list of children.

If `sibling` is `NULL`, moves `child` to the first position.

**Parameters**

- `child`: the widget to move, must be a child of `self`
- `sibling`: the sibling to move `child` after

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setCanNavigateBack`

```ts
setCanNavigateBack(canNavigateBack: boolean): void
```

Sets whether gestures and shortcuts for navigating backward are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back/forward mouse buttons

The keyboard back/forward keys are also supported, as well as the
<kbd>Alt</kbd>+<kbd>←</kbd> shortcut for horizontal orientation, or
<kbd>Alt</kbd>+<kbd>↑</kbd> for vertical orientation.

If the orientation is horizontal, for right-to-left locales, gestures and
shortcuts are reversed.

Only children that have `LeafletPage.navigatable` set to `TRUE` can
be navigated to.

**Parameters**

- `canNavigateBack`: the new value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setCanNavigateForward`

```ts
setCanNavigateForward(canNavigateForward: boolean): void
```

Sets whether gestures and shortcuts for navigating forward are enabled.

The supported gestures are:

- One-finger swipe on touchscreens
- Horizontal scrolling on touchpads (usually two-finger swipe)
- Back/forward mouse buttons

The keyboard back/forward keys are also supported, as well as the
<kbd>Alt</kbd>+<kbd>→</kbd> shortcut for horizontal orientation, or
<kbd>Alt</kbd>+<kbd>↓</kbd> for vertical orientation.

If the orientation is horizontal, for right-to-left locales, gestures and
shortcuts are reversed.

Only children that have `LeafletPage.navigatable` set to `TRUE` can
be navigated to.

**Parameters**

- `canNavigateForward`: the new value

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setCanUnfold`

```ts
setCanUnfold(canUnfold: boolean): void
```

Sets whether `self` can unfold.

**Parameters**

- `canUnfold`: whether `self` can unfold

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setChildTransitionParams`

```ts
setChildTransitionParams(params: Adw.SpringParams): void
```

Sets the child transition spring parameters for `self`.

The default value is equivalent to:

```c
adw_spring_params_new (1, 0.5, 500)
```

**Parameters**

- `params`: the new parameters

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setFoldThresholdPolicy`

```ts
setFoldThresholdPolicy(policy: Adw.FoldThresholdPolicy): void
```

Sets the fold threshold policy for `self`.

If set to `Adw.FoldThresholdPolicy.minimum`, it will only fold when the
children cannot fit anymore. With `Adw.FoldThresholdPolicy.natural`, it
will fold as soon as children don't get their natural size.

This can be useful if you have a long ellipsizing label and want to let it
ellipsize instead of immediately folding.

**Parameters**

- `policy`: the policy to use

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets `self` to be homogeneous or not.

If set to `FALSE`, different children can have different size along the
opposite orientation.

**Parameters**

- `homogeneous`: whether to make `self` homogeneous

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setModeTransitionDuration`

```ts
setModeTransitionDuration(duration: number): void
```

Sets the mode transition animation duration for `self`.

**Parameters**

- `duration`: the new duration, in milliseconds

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setTransitionType`

```ts
setTransitionType(transition: Adw.LeafletTransitionType): void
```

Sets the type of animation used for transitions between modes and children.

The transition type can be changed without problems at runtime, so it is
possible to change the animation based on the mode or child that is about to
become current.

**Parameters**

- `transition`: the new transition type

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setVisibleChild`

```ts
setVisibleChild(visibleChild: Gtk.Widget): void
```

Sets the widget currently visible when the leaflet is folded.

The transition is determined by `Leaflet.transitionType` and
`Leaflet.childTransitionParams`. The transition can be cancelled
by the user, in which case visible child will change back to the previously
visible child.

**Parameters**

- `visibleChild`: the new child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)

### `setVisibleChildName`

```ts
setVisibleChildName(name: string): void
```

Makes the child with the name `name` visible.

See `Leaflet.visibleChild`.

**Parameters**

- `name`: the name of a child

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwleaflet)
