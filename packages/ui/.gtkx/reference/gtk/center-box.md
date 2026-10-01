---
description: "Arranges three children in a row, keeping the middle child centered as well as possible."
---

# GtkCenterBox

Arranges three children in a row, keeping the middle child
centered as well as possible.



To add children to `GtkCenterBox`, use `Gtk.CenterBox.setStartWidget()`,
`Gtk.CenterBox.setCenterWidget()` and
`Gtk.CenterBox.setEndWidget()`.

The sizing and positioning of children can be influenced with the
align and expand properties of the children.

## GtkCenterBox as GtkBuildable

The `GtkCenterBox` implementation of the `GtkBuildable` interface
supports placing children in the 3 positions by specifying “start”, “center”
or “end” as the “type” attribute of a `<child>` element.

## CSS nodes

`GtkCenterBox` uses a single CSS node with the name “box”,

The first child of the `GtkCenterBox` will be allocated depending on the
text direction, i.e. in left-to-right layouts it will be allocated on the
left and in right-to-left layouts on the right.

In vertical orientation, the nodes of the children are arranged from top to
bottom.

## Accessibility

Until GTK 4.10, `GtkCenterBox` used the `Gtk.AccessibleRole.group` role.

Starting from GTK 4.12, `GtkCenterBox` uses the `Gtk.AccessibleRole.generic`
role.

```tsx
import { GtkCenterBox } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkCenterBox**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.CenterBox` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baselinePosition`

`Gtk.BaselinePosition` · default `GTK_BASELINE_POSITION_CENTER`

The position of the baseline aligned widget if extra space is available.

### `centerWidget`

`Gtk.Widget | ReactElement`

The widget that is placed at the center position.

_Available since 4.10._

### `endWidget`

`Gtk.Widget | ReactElement`

The widget that is placed at the end position.

In vertical orientation, the end position is at the bottom.
In horizontal orientation, the end position is at the trailing
edge with respect to the text direction.

_Available since 4.10._

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `shrinkCenterLast`

`boolean` · default `true`

Whether to shrink the center widget after other children.

By default, when there's no space to give all three children their
natural widths, the start and end widgets start shrinking and the
center child keeps natural width until they reach minimum width.

If false, start and end widgets keep natural width and the
center widget starts shrinking instead.

_Available since 4.12._

### `startWidget`

`Gtk.Widget | ReactElement`

The widget that is placed at the start position.

In vertical orientation, the start position is at the top.
In horizontal orientation, the start position is at the leading
edge with respect to the text direction.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.CenterBox` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBaselinePosition`

```ts
getBaselinePosition(): Gtk.BaselinePosition
```

Gets the baseline position of the center box.

See `Gtk.CenterBox.setBaselinePosition()`.

**Returns** the baseline position

### `getCenterWidget`

```ts
getCenterWidget(): Gtk.Widget | null
```

Gets the center widget.

**Returns** the center widget

### `getEndWidget`

```ts
getEndWidget(): Gtk.Widget | null
```

Gets the end widget.

**Returns** the end widget

### `getShrinkCenterLast`

```ts
getShrinkCenterLast(): boolean
```

Gets whether the center widget shrinks after other children.

**Returns** whether to shrink the center widget after others

_Available since 4.12._

### `getStartWidget`

```ts
getStartWidget(): Gtk.Widget | null
```

Gets the start widget.

**Returns** the start widget

### `setBaselinePosition`

```ts
setBaselinePosition(position: Gtk.BaselinePosition): void
```

Sets the baseline position of a center box.

This affects only horizontal boxes with at least one baseline
aligned child. If there is more vertical space available than
requested, and the baseline is not allocated by the parent then
`position` is used to allocate the baseline with respect to the
extra space available.

**Parameters**

- `position`: the baseline position

### `setCenterWidget`

```ts
setCenterWidget(child: Gtk.Widget | null): void
```

Sets the center widget.

To remove the existing center widget, pass `NULL`.

**Parameters**

- `child`: the new center widget

### `setEndWidget`

```ts
setEndWidget(child: Gtk.Widget | null): void
```

Sets the end widget.

To remove the existing end widget, pass `NULL`.

**Parameters**

- `child`: the new end widget

### `setShrinkCenterLast`

```ts
setShrinkCenterLast(shrinkCenterLast: boolean): void
```

Sets whether to shrink the center widget after other children.

By default, when there's no space to give all three children their
natural widths, the start and end widgets start shrinking and the
center child keeps natural width until they reach minimum width.

If `shrink_center_last` is false, start and end widgets keep natural
width and the center widget starts shrinking instead.

**Parameters**

- `shrinkCenterLast`: whether to shrink the center widget after others

_Available since 4.12._

### `setStartWidget`

```ts
setStartWidget(child: Gtk.Widget | null): void
```

Sets the start widget.

To remove the existing start widget, pass `NULL`.

**Parameters**

- `child`: the new start widget
