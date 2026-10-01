---
description: "Provides a button which pops up a scale widget."
---

# GtkScaleButton

Provides a button which pops up a scale widget.

This kind of widget is commonly used for volume controls in multimedia
applications, and GTK provides a `Gtk.VolumeButton` subclass that
is tailored for this use case.

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.ScaleButton.popup`

## CSS nodes

```
scalebutton.scale
╰── button.toggle
    ╰── <icon>
```

`GtkScaleButton` has a single CSS node with name scalebutton and `.scale`
style class, and contains a `button` node with a `.toggle` style class.

```tsx
import { GtkScaleButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkScaleButton**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.ScaleButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false` · read-only, observe with `onNotifyActive`

If the scale button should be pressed in.

_Available since 4.10._

### `adjustment`

`Gtk.Adjustment | ReactElement`

The `GtkAdjustment` that is used as the model.

### `hasFrame`

`boolean` · default `false`

If the scale button has a frame.

_Available since 4.14._

### `icons`

`string[]`

The names of the icons to be used by the scale button.

The first item in the array will be used in the button
when the current value is the lowest value, the second
item for the highest value. All the subsequent icons will
be used for all the other values, spread evenly over the
range of values.

If there's only one icon name in the `icons` array, it will
be used for all the values. If only two icon names are in
the `icons` array, the first one will be used for the bottom
50% of the scale, and the second one for the top 50%.

It is recommended to use at least 3 icons so that the
`GtkScaleButton` reflects the current value of the scale
better for the users.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `value`

`number` · default `0.000000`

The value of the scale.

## Signals

### `onPopdown`

```ts
(self: Gtk.ScaleButton) => void
```

Emitted to dismiss the popup.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>Escape</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPopup`

```ts
(self: Gtk.ScaleButton) => void
```

Emitted to popup the scale widget.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are <kbd>Space</kbd>,
<kbd>Enter</kbd> and <kbd>Return</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onValueChanged`

```ts
(value: number, self: Gtk.ScaleButton) => void
```

Emitted when the value field has changed.

**Parameters**

- `value`: the new value
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.ScaleButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Queries a `GtkScaleButton` and returns its current state.

Returns `true` if the scale button is pressed in and `false`
if it is raised.

**Returns** whether the button is pressed

_Available since 4.10._

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment
```

Gets the `GtkAdjustment` associated with the `GtkScaleButton`’s scale.

See `Gtk.Range.getAdjustment()` for details.

**Returns** the adjustment associated with the scale

### `getHasFrame`

```ts
getHasFrame(): boolean
```

Returns whether the button has a frame.

**Returns** `true` if the button has a frame

_Available since 4.14._

### `getMinusButton`

```ts
getMinusButton(): Gtk.Button
```

Retrieves the minus button of the `GtkScaleButton`.

**Returns** the minus button
  of the `GtkScaleButton`

### `getPlusButton`

```ts
getPlusButton(): Gtk.Button
```

Retrieves the plus button of the `GtkScaleButton.`

**Returns** the plus button
  of the `GtkScaleButton`

### `getPopup`

```ts
getPopup(): Gtk.Widget
```

Retrieves the popup of the `GtkScaleButton`.

**Returns** the popup of the `GtkScaleButton`

### `getValue`

```ts
getValue(): number
```

Gets the current value of the scale button.

**Returns** current value of the scale button

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment): void
```

Sets the `GtkAdjustment` to be used as a model
for the `GtkScaleButton`’s scale.

See `Gtk.Range.setAdjustment()` for details.

**Parameters**

- `adjustment`: a `GtkAdjustment`

### `setHasFrame`

```ts
setHasFrame(hasFrame: boolean): void
```

Sets the style of the button.

**Parameters**

- `hasFrame`: whether the button should have a visible frame

_Available since 4.14._

### `setIcons`

```ts
setIcons(icons: string[]): void
```

Sets the icons to be used by the scale button.

**Parameters**

- `icons`: a `null`-terminated array of icon names

### `setValue`

```ts
setValue(value: number): void
```

Sets the current value of the scale.

If the value is outside the minimum or maximum range values,
it will be clamped to fit inside them.

The scale button emits the `Gtk.ScaleButton.value-changed`
signal if the value changes.

**Parameters**

- `value`: new value of the scale button
