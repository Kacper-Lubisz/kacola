---
description: "A view switcher that uses a toggle group."
---

# AdwInlineViewSwitcher

A view switcher that uses a toggle group.



A view switcher showing pages of an `ViewStack` within an
`ToggleGroup`, similar to `ViewSwitcher`.

The toggles can display either an icon, a label or both. Use the
`InlineViewSwitcher.displayMode` to control this.



### CSS nodes

`AdwInlineViewSwitcher` has a single CSS node with the name
`inline-view-switcher`.

### Style classes

Like `AdwToggleGroup`, it can accept the [`.flat`](style-classes.html#flat_1)
and [`.round`](style-classes.html#round) style classes.



### Accessibility

The internal toggle group uses the `Gtk.AccessibleRole.tab-list` role.
Its toggles use the `Gtk.AccessibleRole.tab` role.

See also: `ViewSwitcher`, `ViewSwitcherBar`,
`ViewSwitcherSidebar`.

_Available since 1.7._

```tsx
import { AdwInlineViewSwitcher } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwInlineViewSwitcher**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.InlineViewSwitcher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `canShrink`

`boolean` · default `false`

Whether the toggles can be smaller than the natural size of their contents.

If set to `TRUE`, the toggle labels will ellipsize.

See `ToggleGroup.canShrink`.

_Available since 1.7._

### `displayMode`

`Adw.InlineViewSwitcherDisplayMode` · default `ADW_INLINE_VIEW_SWITCHER_LABELS`

The display mode.

Determines what the toggles display: a label, an icon or both.

_Available since 1.7._

### `homogeneous`

`boolean` · default `false`

Whether all toggles take the same size.

_Available since 1.7._

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `stack`

`Adw.ViewStack | ReactElement`

The stack the view switcher controls.

_Available since 1.7._

## Methods

Methods are called on the `Adw.InlineViewSwitcher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCanShrink`

```ts
getCanShrink(): boolean
```

Gets whether the toggles can be smaller than the natural size of their
contents.

**Returns** whether the toggles can shrink

_Available since 1.7._

### `getDisplayMode`

```ts
getDisplayMode(): Adw.InlineViewSwitcherDisplayMode
```

Gets the display mode of `self`.

**Returns** the display mode

_Available since 1.7._

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Gets whether all toggles within `self` take the same size.

**Returns** whether all toggles take the same size

_Available since 1.7._

### `getStack`

```ts
getStack(): Adw.ViewStack | null
```

Gets the stack `self` controls.

**Returns** The stack of `self`

_Available since 1.7._

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

Sets whether the toggles can be smaller than the natural size of their
contents.

If `can_shrink` is `TRUE`, the toggle labels will ellipsize.

See `ToggleGroup.canShrink`.

**Parameters**

- `canShrink`: whether the toggles can shrink

_Available since 1.7._

### `setDisplayMode`

```ts
setDisplayMode(mode: Adw.InlineViewSwitcherDisplayMode): void
```

Sets the display mode of `self`.

Determines what the toggles display: a label, an icon or both.

**Parameters**

- `mode`: the display mode

_Available since 1.7._

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether all toggles within `self` take the same size.

**Parameters**

- `homogeneous`: whether all toggles should take the same size

_Available since 1.7._

### `setStack`

```ts
setStack(stack: Adw.ViewStack | null): void
```

Sets the stack to control.

**Parameters**

- `stack`: a stack

_Available since 1.7._
