---
description: "Allows to select a numeric value with a slider control."
---

# GtkScale

Allows to select a numeric value with a slider control.



To use it, you’ll probably want to investigate the methods on its base
class, `Gtk.Range`, in addition to the methods for `GtkScale` itself.
To set the value of a scale, you would normally use `Gtk.Range.setValue()`.
To detect changes to the value, you would normally use the
`Gtk.Range.value-changed` signal.

Note that using the same upper and lower bounds for the `GtkScale` (through
the `GtkRange` methods) will hide the slider itself. This is useful for
applications that want to show an undeterminate value on the scale, without
changing the layout of the application (such as movie or music players).

## GtkScale as GtkBuildable

`GtkScale` supports a custom `<marks>` element, which can contain multiple
`<mark\>` elements. The “value” and “position” attributes have the same
meaning as `Gtk.Scale.addMark()` parameters of the same name. If
the element is not empty, its content is taken as the markup to show at
the mark. It can be translated with the usual ”translatable” and
“context” attributes.

## Shortcuts and Gestures

`GtkPopoverMenu` supports the following keyboard shortcuts:

- Arrow keys, <kbd>+</kbd> and <kbd>-</kbd> will increment or decrement
  by step, or by page when combined with <kbd>Ctrl</kbd>.
- <kbd>PgUp</kbd> and <kbd>PgDn</kbd> will increment or decrement by page.
- <kbd>Home</kbd> and <kbd>End</kbd> will set the minimum or maximum value.

## CSS nodes

```
scale[.fine-tune][.marks-before][.marks-after]
├── [value][.top][.right][.bottom][.left]
├── marks.top
│   ├── mark
│   ┊    ├── [label]
│   ┊    ╰── indicator
┊   ┊
│   ╰── mark
├── marks.bottom
│   ├── mark
│   ┊    ├── indicator
│   ┊    ╰── [label]
┊   ┊
│   ╰── mark
╰── trough
    ├── [fill]
    ├── [highlight]
    ╰── slider
```

`GtkScale` has a main CSS node with name scale and a subnode for its contents,
with subnodes named trough and slider.

The main node gets the style class .fine-tune added when the scale is in
'fine-tuning' mode.

If the scale has an origin (see `Gtk.Scale.setHasOrigin()`), there is
a subnode with name highlight below the trough node that is used for rendering
the highlighted part of the trough.

If the scale is showing a fill level (see `Gtk.Range.setShowFillLevel()`),
there is a subnode with name fill below the trough node that is used for
rendering the filled in part of the trough.

If marks are present, there is a marks subnode before or after the trough
node, below which each mark gets a node with name mark. The marks nodes get
either the .top or .bottom style class.

The mark node has a subnode named indicator. If the mark has text, it also
has a subnode named label. When the mark is either above or left of the
scale, the label subnode is the first when present. Otherwise, the indicator
subnode is the first.

The main CSS node gets the 'marks-before' and/or 'marks-after' style classes
added depending on what marks are present.

If the scale is displaying the value (see `Gtk.Scale.drawValue`),
there is subnode with name value. This node will get the .top or .bottom style
classes similar to the marks node.

## Accessibility

`GtkScale` uses the `Gtk.AccessibleRole.slider` role.

```tsx
import { GtkScale } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkRange](.gtkx/reference/gtk/range.md) → **GtkScale**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Scale` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `digits`

`number` · default `1`

The number of decimal places that are displayed in the value.

### `drawValue`

`boolean` · default `false`

Whether the current value is displayed as a string next to the slider.

### `hasOrigin`

`boolean` · default `true`

Whether the scale has an origin.

### `marks`

`ScaleMark[] | null`

Marks drawn along the scale, cleared and re-added whenever the list changes.

### `valuePos`

`Gtk.PositionType` · default `GTK_POS_TOP`

The position in which the current value is displayed.

## Methods

Methods are called on the `Gtk.Scale` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addMark`

```ts
addMark(value: number, position: Gtk.PositionType, markup: string | null): void
```

Adds a mark at `value`.

A mark is indicated visually by drawing a tick mark next to the scale,
and GTK makes it easy for the user to position the scale exactly at the
marks value.

If `markup` is not `null`, text is shown next to the tick mark.

To remove marks from a scale, use `Gtk.Scale.clearMarks()`.

**Parameters**

- `value`: the value at which the mark is placed, must be between the lower and upper limits of the scales’ adjustment
- `position`: where to draw the mark. For a horizontal scale, `GTK_POS_TOP` and `GTK_POS_LEFT` are drawn above the scale, anything else below. For a vertical scale, `GTK_POS_LEFT` and `GTK_POS_TOP` are drawn to the left of the scale, anything else to the right.
- `markup`: Text to be shown at the mark, using Pango markup

### `clearMarks`

```ts
clearMarks(): void
```

Removes any marks that have been added.

### `getDigits`

```ts
getDigits(): number
```

Gets the number of decimal places that are displayed in the value.

**Returns** the number of decimal places that are displayed

### `getDrawValue`

```ts
getDrawValue(): boolean
```

Returns whether the current value is displayed as a string
next to the slider.

**Returns** whether the current value is displayed as a string

### `getHasOrigin`

```ts
getHasOrigin(): boolean
```

Returns whether the scale has an origin.

**Returns** `true` if the scale has an origin.

### `getLayout`

```ts
getLayout(): Pango.Layout | null
```

Gets the `PangoLayout` used to display the scale.

The returned object is owned by the scale so does not need
to be freed by the caller.

**Returns** the `Pango.Layout`
  for this scale, or `null` if the `Gtk.Scale.drawValue`
  property is `false`.

### `getLayoutOffsets`

```ts
getLayoutOffsets(): [number, number]
```

Obtains the coordinates where the scale will draw the
`PangoLayout` representing the text in the scale.

Remember when using the `PangoLayout` function you need to
convert to and from pixels using `PANGO_PIXELS()` or `PANGO_SCALE`.

If the `Gtk.Scale.drawValue` property is `false`, the return
values are undefined.

**Returns** Tuple of:

- `x`: location to store X offset of layout
- `y`: location to store Y offset of layout

### `getValuePos`

```ts
getValuePos(): Gtk.PositionType
```

Gets the position in which the current value is displayed.

**Returns** the position in which the current value is displayed

### `setDigits`

```ts
setDigits(digits: number): void
```

Sets the number of decimal places that are displayed in the value.

Also causes the value of the adjustment to be rounded to this number
of digits, so the retrieved value matches the displayed one, if
`Gtk.Scale.drawValue` is `true` when the value changes. If
you want to enforce rounding the value when `Gtk.Scale.drawValue`
is `false`, you can set `Gtk.Range.roundDigits` instead.

Note that rounding to a small number of digits can interfere with
the smooth autoscrolling that is built into `GtkScale`. As an alternative,
you can use `Gtk.Scale.setFormatValueFunc()` to format the displayed
value yourself.

**Parameters**

- `digits`: the number of decimal places to display, e.g. use 1 to display 1.0, 2 to display 1.00, etc

### `setDrawValue`

```ts
setDrawValue(drawValue: boolean): void
```

Specifies whether the current value is displayed as a string next
to the slider.

**Parameters**

- `drawValue`: `true` to draw the value

### `setFormatValueFunc`

```ts
setFormatValueFunc(func: Gtk.ScaleFormatValueFunc | null): void
```

`func` allows you to change how the scale value is displayed.

The given function will return an allocated string representing
`value`. That string will then be used to display the scale's value.

If `NULL` is passed as `func`, the value will be displayed on
its own, rounded according to the value of the
`Gtk.Scale.digits` property.

**Parameters**

- `func`: function that formats the value

### `setHasOrigin`

```ts
setHasOrigin(hasOrigin: boolean): void
```

Sets whether the scale has an origin.

If `Gtk.Scale.hasOrigin` is set to `true` (the default),
the scale will highlight the part of the trough between the origin
(bottom or left side) and the current value.

**Parameters**

- `hasOrigin`: `true` if the scale has an origin

### `setValuePos`

```ts
setValuePos(pos: Gtk.PositionType): void
```

Sets the position in which the current value is displayed.

**Parameters**

- `pos`: the position in which the current value is displayed
