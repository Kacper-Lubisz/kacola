---
description: "Shows a level indicator."
---

# GtkLevelBar

Shows a level indicator.

Typical use cases are displaying the strength of a password, or
showing the charge level of a battery.



Use `Gtk.LevelBar.setValue()` to set the current value, and
`Gtk.LevelBar.addOffsetValue()` to set the value offsets at which
the bar will be considered in a different state. GTK will add a few
offsets by default on the level bar: `GTK_LEVEL_BAR_OFFSET_LOW`,
`GTK_LEVEL_BAR_OFFSET_HIGH` and `GTK_LEVEL_BAR_OFFSET_FULL`, with
values 0.25, 0.75 and 1.0 respectively.

Note that it is your responsibility to update preexisting offsets
when changing the minimum or maximum value. GTK will simply clamp
them to the new range.

### Adding a custom offset on the bar

```c
static GtkWidget *
create_level_bar (void)
{
  GtkWidget *widget;
  GtkLevelBar *bar;

  widget = gtk_level_bar_new ();
  bar = GTK_LEVEL_BAR (widget);

  // This changes the value of the default low offset

  gtk_level_bar_add_offset_value (bar,
                                  GTK_LEVEL_BAR_OFFSET_LOW,
                                  0.10);

  // This adds a new offset to the bar; the application will
  // be able to change its color CSS like this:
  //
  // levelbar block.my-offset {
  //   background-color: magenta;
  //   border-style: solid;
  //   border-color: black;
  //   border-width: 1px;
  // }

  gtk_level_bar_add_offset_value (bar, "my-offset", 0.60);

  return widget;
}
```

The default interval of values is between zero and one, but it’s possible
to modify the interval using `Gtk.LevelBar.setMinValue()` and
`Gtk.LevelBar.setMaxValue()`. The value will be always drawn in
proportion to the admissible interval, i.e. a value of 15 with a specified
interval between 10 and 20 is equivalent to a value of 0.5 with an interval
between 0 and 1. When `GTK_LEVEL_BAR_MODE_DISCRETE` is used, the bar level
is rendered as a finite number of separated blocks instead of a single one.
The number of blocks that will be rendered is equal to the number of units
specified by the admissible interval.

For instance, to build a bar rendered with five blocks, it’s sufficient to
set the minimum value to 0 and the maximum value to 5 after changing the
indicator mode to discrete.

## GtkLevelBar as GtkBuildable

The `GtkLevelBar` implementation of the `GtkBuildable` interface supports a
custom `<offsets>` element, which can contain any number of `<offset>` elements,
each of which must have "name" and "value" attributes.

## CSS nodes

```
levelbar[.discrete]
╰── trough
    ├── block.filled.level-name
    ┊
    ├── block.empty
    ┊
```

`GtkLevelBar` has a main CSS node with name levelbar and one of the style
classes .discrete or .continuous and a subnode with name trough. Below the
trough node are a number of nodes with name block and style class .filled
or .empty. In continuous mode, there is exactly one node of each, in discrete
mode, the number of filled and unfilled nodes corresponds to blocks that are
drawn. The block.filled nodes also get a style class .level-name corresponding
to the level for the current value.

In horizontal orientation, the nodes are always arranged from left to right,
regardless of text direction.

## Accessibility

`GtkLevelBar` uses the `Gtk.AccessibleRole.meter` role.

```tsx
import { GtkLevelBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkLevelBar**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.LevelBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `inverted`

`boolean` · default `false`

Whether the `GtkLeveBar` is inverted.

Level bars normally grow from top to bottom or left to right.
Inverted level bars grow in the opposite direction.

### `maxValue`

`number` · default `1.000000`

Determines the maximum value of the interval that can be displayed by the bar.

### `minValue`

`number` · default `0.000000`

Determines the minimum value of the interval that can be displayed by the bar.

### `mode`

`Gtk.LevelBarMode` · default `GTK_LEVEL_BAR_MODE_CONTINUOUS`

Determines the way `GtkLevelBar` interprets the value properties to draw the
level fill area.

Specifically, when the value is `GTK_LEVEL_BAR_MODE_CONTINUOUS`,
`GtkLevelBar` will draw a single block representing the current value in
that area; when the value is `GTK_LEVEL_BAR_MODE_DISCRETE`,
the widget will draw a succession of separate blocks filling the
draw area, with the number of blocks being equal to the units separating
the integral roundings of `Gtk.LevelBar.minValue` and
`Gtk.LevelBar.maxValue`.

### `offsets`

`LevelBarOffset[] | null`

Offsets that split the bar's range into differently styled intervals.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `value`

`number` · default `0.000000`

Determines the currently filled value of the level bar.

## Signals

### `onOffsetChanged`

```ts
(name: string, self: Gtk.LevelBar) => void
```

Emitted when an offset specified on the bar changes value.

This typically is the result of a `Gtk.LevelBar.addOffsetValue()`
call.

The signal supports detailed connections; you can connect to the
detailed signal "changed::x" in order to only receive callbacks when
the value of offset "x" changes.

**Parameters**

- `name`: the name of the offset that changed value
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.LevelBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addOffsetValue`

```ts
addOffsetValue(name: string, value: number): void
```

Adds a new offset marker on `self` at the position specified by `value`.

When the bar value is in the interval topped by `value` (or between `value`
and `Gtk.LevelBar.maxValue` in case the offset is the last one
on the bar) a style class named `level-``name` will be applied
when rendering the level bar fill.

If another offset marker named `name` exists, its value will be
replaced by `value`.

**Parameters**

- `name`: the name of the new offset
- `value`: the value for the new offset

### `getInverted`

```ts
getInverted(): boolean
```

Returns whether the levelbar is inverted.

**Returns** `true` if the level bar is inverted

### `getMaxValue`

```ts
getMaxValue(): number
```

Returns the `max-value` of the `GtkLevelBar`.

**Returns** a positive value

### `getMinValue`

```ts
getMinValue(): number
```

Returns the `min-value` of the `GtkLevelBar`.

**Returns** a positive value

### `getMode`

```ts
getMode(): Gtk.LevelBarMode
```

Returns the `mode` of the `GtkLevelBar`.

**Returns** a `GtkLevelBarMode`

### `getOffsetValue`

```ts
getOffsetValue(name: string | null): [boolean, number]
```

Fetches the value specified for the offset marker `name` in `self`.

**Parameters**

- `name`: the name of an offset in the bar

**Returns** Tuple of:

- `result`: `true` if the specified offset is found
- `value`: location where to store the value

### `getValue`

```ts
getValue(): number
```

Returns the `value` of the `GtkLevelBar`.

**Returns** a value in the interval between
  `Gtk.LevelBar.minValue` and `Gtk.LevelBar.maxValue`

### `removeOffsetValue`

```ts
removeOffsetValue(name: string | null): void
```

Removes an offset marker from a `GtkLevelBar`.

The marker must have been previously added with
`Gtk.LevelBar.addOffsetValue()`.

**Parameters**

- `name`: the name of an offset in the bar

### `setInverted`

```ts
setInverted(inverted: boolean): void
```

Sets whether the `GtkLevelBar` is inverted.

**Parameters**

- `inverted`: `true` to invert the level bar

### `setMaxValue`

```ts
setMaxValue(value: number): void
```

Sets the `max-value` of the `GtkLevelBar`.

You probably want to update preexisting level offsets after calling
this function.

**Parameters**

- `value`: a positive value

### `setMinValue`

```ts
setMinValue(value: number): void
```

Sets the `min-value` of the `GtkLevelBar`.

You probably want to update preexisting level offsets after calling
this function.

**Parameters**

- `value`: a positive value

### `setMode`

```ts
setMode(mode: Gtk.LevelBarMode): void
```

Sets the `mode` of the `GtkLevelBar`.

**Parameters**

- `mode`: a `GtkLevelBarMode`

### `setValue`

```ts
setValue(value: number): void
```

Sets the value of the `GtkLevelBar`.

**Parameters**

- `value`: a value in the interval between `Gtk.LevelBar.minValue` and `Gtk.LevelBar.maxValue`
