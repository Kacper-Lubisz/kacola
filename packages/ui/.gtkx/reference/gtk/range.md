---
description: "Base class for widgets which visualize an adjustment."
---

# GtkRange

Base class for widgets which visualize an adjustment.

Widgets that are derived from `GtkRange` include
`Gtk.Scale` and `Gtk.Scrollbar`.

Apart from signals for monitoring the parameters of the adjustment,
`GtkRange` provides properties and methods for setting a
“fill level” on range widgets. See `Gtk.Range.setFillLevel()`.

## Shortcuts and Gestures

The `GtkRange` slider is draggable. Holding the <kbd>Shift</kbd> key while
dragging, or initiating the drag with a long-press will enable the
fine-tuning mode.

```tsx
import { GtkRange } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkRange**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.Range` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `adjustment`

`Gtk.Adjustment | ReactElement`

The adjustment that is controlled by the range.

### `fillLevel`

`number` · default `179769313486231570814527423731704356798070567525844996598917476803157260780028538760589558632766878171540458953514382464234321326889464182768467546703537516986049910576551282076245490090389328944075868508455133942304583236903222948165808559332123348274797826204144723168738177180919299881250404026184124858368.000000`

The fill level (e.g. prebuffering of a network stream).

### `inverted`

`boolean` · default `false`

If `true`, the direction in which the slider moves is inverted.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `restrictToFillLevel`

`boolean` · default `true`

Controls whether slider movement is restricted to an
upper boundary set by the fill level.

### `roundDigits`

`number` · default `-1`

The number of digits to round the value to when
it changes.

See `Gtk.Range.change-value`.

### `showFillLevel`

`boolean` · default `false`

Controls whether fill level indicator graphics are displayed
on the trough.

## Signals

### `onAdjustBounds`

```ts
(value: number, self: Gtk.Range) => void
```

Emitted before clamping a value, to give the application a
chance to adjust the bounds.

**Parameters**

- `value`: the value before we clamp
- `self`: The instance the signal was emitted on.

### `onChangeValue`

```ts
(scroll: Gtk.ScrollType, value: number, self: Gtk.Range) => boolean | undefined
```

Emitted when a scroll action is performed on a range.

It allows an application to determine the type of scroll event
that occurred and the resultant new value. The application can
handle the event itself and return `true` to prevent further
processing. Or, by returning `false`, it can pass the event to
other handlers until the default GTK handler is reached.

The value parameter is unrounded. An application that overrides
the ::change-value signal is responsible for clamping the value
to the desired number of decimal digits; the default GTK
handler clamps the value based on `Gtk.Range.roundDigits`.

**Parameters**

- `scroll`: the type of scroll action that was performed
- `value`: the new value resulting from the scroll action
- `self`: The instance the signal was emitted on.

**Returns** `true` to prevent other handlers from being invoked for
    the signal, `false` to propagate the signal further

### `onMoveSlider`

```ts
(step: Gtk.ScrollType, self: Gtk.Range) => void
```

Virtual function that moves the slider.

Used for keybindings.

**Parameters**

- `step`: how to move the slider
- `self`: The instance the signal was emitted on.

### `onValueChanged`

```ts
(self: Gtk.Range) => void
```

Emitted when the range value changes.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Range` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment
```

Get the adjustment which is the “model” object for `GtkRange`.

**Returns** a `GtkAdjustment`

### `getFillLevel`

```ts
getFillLevel(): number
```

Gets the current position of the fill level indicator.

**Returns** The current fill level

### `getFlippable`

```ts
getFlippable(): boolean
```

Gets whether the `GtkRange` respects text direction.

See `Gtk.Range.setFlippable()`.

**Returns** `true` if the range is flippable

### `getInverted`

```ts
getInverted(): boolean
```

Gets whether the range is inverted.

See `Gtk.Range.setInverted()`.

**Returns** `true` if the range is inverted

### `getRangeRect`

```ts
getRangeRect(): Gdk.Rectangle
```

This function returns the area that contains the range’s trough,
in coordinates relative to `range`'s origin.

This function is useful mainly for `GtkRange` subclasses.

**Returns** return location for the range rectangle

### `getRestrictToFillLevel`

```ts
getRestrictToFillLevel(): boolean
```

Gets whether the range is restricted to the fill level.

**Returns** `true` if `range` is restricted to the fill level.

### `getRoundDigits`

```ts
getRoundDigits(): number
```

Gets the number of digits to round the value to when
it changes.

See `Gtk.Range.change-value`.

**Returns** the number of digits to round to

### `getShowFillLevel`

```ts
getShowFillLevel(): boolean
```

Gets whether the range displays the fill level graphically.

**Returns** `true` if `range` shows the fill level.

### `getSliderRange`

```ts
getSliderRange(): [number, number]
```

This function returns sliders range along the long dimension,
in widget->window coordinates.

This function is useful mainly for `GtkRange` subclasses.

**Returns** Tuple of:

- `sliderStart`: return location for the slider's start
- `sliderEnd`: return location for the slider's end

### `getSliderSizeFixed`

```ts
getSliderSizeFixed(): boolean
```

This function is useful mainly for `GtkRange` subclasses.

See `Gtk.Range.setSliderSizeFixed()`.

**Returns** whether the range’s slider has a fixed size.

### `getValue`

```ts
getValue(): number
```

Gets the current value of the range.

**Returns** current value of the range.

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment): void
```

Sets the adjustment to be used as the “model” object for the `GtkRange`

The adjustment indicates the current range value, the minimum and
maximum range values, the step/page increments used for keybindings
and scrolling, and the page size.

The page size is normally 0 for `GtkScale` and nonzero for `GtkScrollbar`,
and indicates the size of the visible area of the widget being scrolled.
The page size affects the size of the scrollbar slider.

**Parameters**

- `adjustment`: a `GtkAdjustment`

### `setFillLevel`

```ts
setFillLevel(fillLevel: number): void
```

Set the new position of the fill level indicator.

The “fill level” is probably best described by its most prominent
use case, which is an indicator for the amount of pre-buffering in
a streaming media player. In that use case, the value of the range
would indicate the current play position, and the fill level would
be the position up to which the file/stream has been downloaded.

This amount of prebuffering can be displayed on the range’s trough
and is themeable separately from the trough. To enable fill level
display, use `Gtk.Range.setShowFillLevel()`. The range defaults
to not showing the fill level.

Additionally, it’s possible to restrict the range’s slider position
to values which are smaller than the fill level. This is controlled
by `Gtk.Range.setRestrictToFillLevel()` and is by default
enabled.

**Parameters**

- `fillLevel`: the new position of the fill level indicator

### `setFlippable`

```ts
setFlippable(flippable: boolean): void
```

Sets whether the `GtkRange` respects text direction.

If a range is flippable, it will switch its direction
if it is horizontal and its direction is `GTK_TEXT_DIR_RTL`.

See `Gtk.Widget.getDirection()`.

**Parameters**

- `flippable`: `true` to make the range flippable

### `setIncrements`

```ts
setIncrements(step: number, page: number): void
```

Sets the step and page sizes for the range.

The step size is used when the user clicks the `GtkScrollbar`
arrows or moves a `GtkScale` via arrow keys. The page size
is used for example when moving via Page Up or Page Down keys.

**Parameters**

- `step`: step size
- `page`: page size

### `setInverted`

```ts
setInverted(setting: boolean): void
```

Sets whether to invert the range.

Ranges normally move from lower to higher values as the
slider moves from top to bottom or left to right. Inverted
ranges have higher values at the top or on the right rather
than on the bottom or left.

**Parameters**

- `setting`: `true` to invert the range

### `setRange`

```ts
setRange(min: number, max: number): void
```

Sets the allowable values in the `GtkRange`.

The range value is clamped to be between `min` and `max`.
(If the range has a non-zero page size, it is clamped
between `min` and `max` - page-size.)

**Parameters**

- `min`: minimum range value
- `max`: maximum range value

### `setRestrictToFillLevel`

```ts
setRestrictToFillLevel(restrictToFillLevel: boolean): void
```

Sets whether the slider is restricted to the fill level.

See `Gtk.Range.setFillLevel()` for a general description
of the fill level concept.

**Parameters**

- `restrictToFillLevel`: Whether the fill level restricts slider movement.

### `setRoundDigits`

```ts
setRoundDigits(roundDigits: number): void
```

Sets the number of digits to round the value to when
it changes.

See `Gtk.Range.change-value`.

**Parameters**

- `roundDigits`: the precision in digits, or -1

### `setShowFillLevel`

```ts
setShowFillLevel(showFillLevel: boolean): void
```

Sets whether a graphical fill level is show on the trough.

See `Gtk.Range.setFillLevel()` for a general description
of the fill level concept.

**Parameters**

- `showFillLevel`: Whether a fill level indicator graphics is shown.

### `setSliderSizeFixed`

```ts
setSliderSizeFixed(sizeFixed: boolean): void
```

Sets whether the range’s slider has a fixed size, or a size that
depends on its adjustment’s page size.

This function is useful mainly for `GtkRange` subclasses.

**Parameters**

- `sizeFixed`: `true` to make the slider size constant

### `setValue`

```ts
setValue(value: number): void
```

Sets the current value of the range.

If the value is outside the minimum or maximum range values,
it will be clamped to fit inside them. The range emits the
`Gtk.Range.value-changed` signal if the value changes.

**Parameters**

- `value`: new value of the range
