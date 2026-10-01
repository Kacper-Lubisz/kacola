---
description: "Displays the progress of a long-running operation."
---

# GtkProgressBar

Displays the progress of a long-running operation.

`GtkProgressBar` provides a visual clue that processing is underway.
It can be used in two different modes: percentage mode and activity mode.



When an application can determine how much work needs to take place
(e.g. read a fixed number of bytes from a file) and can monitor its
progress, it can use the `GtkProgressBar` in percentage mode and the
user sees a growing bar indicating the percentage of the work that
has been completed. In this mode, the application is required to call
`Gtk.ProgressBar.setFraction()` periodically to update the progress bar.

When an application has no accurate way of knowing the amount of work
to do, it can use the `GtkProgressBar` in activity mode, which shows
activity by a block moving back and forth within the progress area. In
this mode, the application is required to call `Gtk.ProgressBar.pulse()`
periodically to update the progress bar.

There is quite a bit of flexibility provided to control the appearance
of the `GtkProgressBar`. Functions are provided to control the orientation
of the bar, optional text can be displayed along with the bar, and the
step size used in activity mode can be set.

## CSS nodes

```
progressbar[.osd]
├── [text]
╰── trough[.empty][.full]
    ╰── progress[.pulse]
```

`GtkProgressBar` has a main CSS node with name progressbar and subnodes with
names text and trough, of which the latter has a subnode named progress. The
text subnode is only present if text is shown. The progress subnode has the
style class .pulse when in activity mode. It gets the style classes .left,
.right, .top or .bottom added when the progress 'touches' the corresponding
end of the GtkProgressBar. The .osd class on the progressbar node is for use
in overlays like the one Epiphany has for page loading progress.

## Accessibility

`GtkProgressBar` uses the `Gtk.AccessibleRole.progress_bar` role
and sets the `Gtk.AccessibleProperty.value_min`, `Gtk.AccessibleProperty.value_max` and `Gtk.AccessibleProperty.value_now` properties to reflect
the progress.

```tsx
import { GtkProgressBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkProgressBar**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.ProgressBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `ellipsize`

`Pango.EllipsizeMode` · default `PANGO_ELLIPSIZE_NONE`

The preferred place to ellipsize the string.

The text will be ellipsized if the progress bar does not have enough room
to display the entire string, specified as a `PangoEllipsizeMode`.

Note that setting this property to a value other than
`PANGO_ELLIPSIZE_NONE` has the side-effect that the progress bar requests
only enough space to display the ellipsis ("..."). Another means to set a
progress bar's width is `Gtk.Widget.setSizeRequest()`.

### `fraction`

`number` · default `0.000000`

The fraction of total work that has been completed.

### `inverted`

`boolean` · default `false`

Invert the direction in which the progress bar grows.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `pulseStep`

`number` · default `0.100000`

The fraction of total progress to move the bounding block when pulsed.

### `showText`

`boolean` · default `false`

Sets whether the progress bar will show a text in addition
to the bar itself.

The shown text is either the value of the `Gtk.ProgressBar.text`
property or, if that is `null`, the `Gtk.ProgressBar.fraction`
value, as a percentage.

To make a progress bar that is styled and sized suitably for showing text
(even if the actual text is blank), set `Gtk.ProgressBar.showText`
to `true` and `Gtk.ProgressBar.text` to the empty string (not `null`).

### `text`

`string` · default `null`

Text to be displayed in the progress bar.

## Methods

Methods are called on the `Gtk.ProgressBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getEllipsize`

```ts
getEllipsize(): Pango.EllipsizeMode
```

Returns the ellipsizing position of the progress bar.

See `Gtk.ProgressBar.setEllipsize()`.

**Returns** `PangoEllipsizeMode`

### `getFraction`

```ts
getFraction(): number
```

Returns the current fraction of the task that’s been completed.

**Returns** a fraction from 0.0 to 1.0

### `getInverted`

```ts
getInverted(): boolean
```

Returns whether the progress bar is inverted.

**Returns** `true` if the progress bar is inverted

### `getPulseStep`

```ts
getPulseStep(): number
```

Retrieves the pulse step.

See `Gtk.ProgressBar.setPulseStep()`.

**Returns** a fraction from 0.0 to 1.0

### `getShowText`

```ts
getShowText(): boolean
```

Returns whether the `GtkProgressBar` shows text.

See `Gtk.ProgressBar.setShowText()`.

**Returns** `true` if text is shown in the progress bar

### `getText`

```ts
getText(): string | null
```

Retrieves the text that is displayed with the progress bar.

The return value is a reference to the text, not a copy of it,
so will become invalid if you change the text in the progress bar.

**Returns** the text

### `pulse`

```ts
pulse(): void
```

Indicates that some progress has been made, but you don’t know how much.

Causes the progress bar to enter “activity mode,” where a block
bounces back and forth. Each call to `Gtk.ProgressBar.pulse()`
causes the block to move by a little bit (the amount of movement
per pulse is determined by `Gtk.ProgressBar.setPulseStep()`).

### `setEllipsize`

```ts
setEllipsize(mode: Pango.EllipsizeMode): void
```

Sets the mode used to ellipsize the text.

The text is ellipsized if there is not enough space
to render the entire string.

**Parameters**

- `mode`: a `PangoEllipsizeMode`

### `setFraction`

```ts
setFraction(fraction: number): void
```

Causes the progress bar to “fill in” the given fraction
of the bar.

The fraction should be between 0.0 and 1.0, inclusive.

**Parameters**

- `fraction`: fraction of the task that’s been completed

### `setInverted`

```ts
setInverted(inverted: boolean): void
```

Sets whether the progress bar is inverted.

Progress bars normally grow from top to bottom or left to right.
Inverted progress bars grow in the opposite direction.

**Parameters**

- `inverted`: `true` to invert the progress bar

### `setPulseStep`

```ts
setPulseStep(fraction: number): void
```

Sets the fraction of total progress bar length to move the
bouncing block.

The bouncing block is moved when `Gtk.ProgressBar.pulse()`
is called.

**Parameters**

- `fraction`: fraction between 0.0 and 1.0

### `setShowText`

```ts
setShowText(showText: boolean): void
```

Sets whether the progress bar will show text next to the bar.

The shown text is either the value of the `Gtk.ProgressBar.text`
property or, if that is `null`, the `Gtk.ProgressBar.fraction` value,
as a percentage.

To make a progress bar that is styled and sized suitably for containing
text (even if the actual text is blank), set `Gtk.ProgressBar.showText`
to `true` and `Gtk.ProgressBar.text` to the empty string (not `null`).

**Parameters**

- `showText`: whether to show text

### `setText`

```ts
setText(text: string | null): void
```

Causes the given `text` to appear next to the progress bar.

If `text` is `null` and `Gtk.ProgressBar.showText` is `true`,
the current value of `Gtk.ProgressBar.fraction` will be displayed
as a percentage.

If `text` is non-`null` and `Gtk.ProgressBar.showText` is `true`,
the text will be displayed. In this case, it will not display the progress
percentage. If `text` is the empty string, the progress bar will still
be styled and sized suitably for containing text, as long as
`Gtk.ProgressBar.showText` is `true`.

**Parameters**

- `text`: a UTF-8 string
