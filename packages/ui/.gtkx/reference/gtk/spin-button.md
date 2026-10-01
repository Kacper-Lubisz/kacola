---
description: "Allows to enter or change numeric values."
---

# GtkSpinButton

Allows to enter or change numeric values.



Rather than having to directly type a number into a `GtkEntry`,
`GtkSpinButton` allows the user to click on one of two arrows
to increment or decrement the displayed value. A value can still be
typed in, with the bonus that it can be checked to ensure it is in a
given range.

The main properties of a `GtkSpinButton` are through an adjustment.
See the `Gtk.Adjustment` documentation for more details about
an adjustment's properties.

Note that `GtkSpinButton` will by default make its entry large enough
to accommodate the lower and upper bounds of the adjustment. If this
is not desired, the automatic sizing can be turned off by explicitly
setting `Gtk.Editable.widthChars` to a value != -1.

### Using a GtkSpinButton to get an integer

```c
// Provides a function to retrieve an integer value from a GtkSpinButton
// and creates a spin button to model percentage values.

int
grab_int_value (GtkSpinButton *button,
                gpointer       user_data)
{
  return gtk_spin_button_get_value_as_int (button);
}

void
create_integer_spin_button (void)
{

  GtkWidget *window, *button;
  GtkAdjustment *adjustment;

  adjustment = gtk_adjustment_new (50.0, 0.0, 100.0, 1.0, 5.0, 0.0);

  window = gtk_window_new ();

  // creates the spinbutton, with no decimal places
  button = gtk_spin_button_new (adjustment, 1.0, 0);
  gtk_window_set_child (GTK_WINDOW (window), button);

  gtk_window_present (GTK_WINDOW (window));
}
```

### Using a GtkSpinButton to get a floating point value

```c
// Provides a function to retrieve a floating point value from a
// GtkSpinButton, and creates a high precision spin button.

float
grab_float_value (GtkSpinButton *button,
                  gpointer       user_data)
{
  return gtk_spin_button_get_value (button);
}

void
create_floating_spin_button (void)
{
  GtkWidget *window, *button;
  GtkAdjustment *adjustment;

  adjustment = gtk_adjustment_new (2.500, 0.0, 5.0, 0.001, 0.1, 0.0);

  window = gtk_window_new ();

  // creates the spinbutton, with three decimal places
  button = gtk_spin_button_new (adjustment, 0.001, 3);
  gtk_window_set_child (GTK_WINDOW (window), button);

  gtk_window_present (GTK_WINDOW (window));
}
```

## Shortcuts and Gestures

The following signals have default keybindings:

- `Gtk.SpinButton.change-value`

## CSS nodes

```
spinbutton.horizontal
├── text
│    ├── undershoot.left
│    ╰── undershoot.right
├── button.down
╰── button.up
```

```
spinbutton.vertical
├── button.up
├── text
│    ├── undershoot.left
│    ╰── undershoot.right
╰── button.down
```

`GtkSpinButton`s main CSS node has the name spinbutton. It creates subnodes
for the entry and the two buttons, with these names. The button nodes have
the style classes .up and .down. The `GtkText` subnodes (if present) are put
below the text node. The orientation of the spin button is reflected in
the .vertical or .horizontal style class on the main node.

## Accessibility

`GtkSpinButton` uses the `Gtk.AccessibleRole.spin_button` role.

```tsx
import { GtkSpinButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSpinButton**

Implements `GtkAccessible`, `GtkAccessibleRange`, `GtkBuildable`, `GtkCellEditable`, `GtkConstraintTarget`, `GtkEditable`, `GtkOrientable`.

## Props

`ref` receives the `Gtk.SpinButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `activatesDefault`

`boolean` · default `false`

Whether to activate the default widget when the spin button is activated.

See `Gtk.SpinButton.activate` for what counts as activation.

_Available since 4.14._

### `adjustment`

`Gtk.Adjustment | ReactElement`

The adjustment that holds the value of the spin button.

### `climbRate`

`number` · default `0.000000`

The acceleration rate when you hold down a button or key.

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `digits`

`number` · default `0`

The number of decimal places to display.

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `editingCanceled`

`boolean` · default `false` · from `GtkCellEditable`

Indicates whether editing on the cell has been canceled.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `numeric`

`boolean` · default `false`

Whether non-numeric characters should be ignored.

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `snapToTicks`

`boolean` · default `false`

Whether erroneous values are automatically changed to the spin buttons
nearest step increment.

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `updatePolicy`

`Gtk.SpinButtonUpdatePolicy` · default `GTK_UPDATE_ALWAYS`

Whether the spin button should update always, or only when the value
is acceptable.

### `value`

`number` · default `0.000000`

The current value.

### `widthChars`

`number` · default `-1` · from `GtkEditable`

Number of characters to leave space for in the entry.

### `wrap`

`boolean` · default `false`

Whether a spin button should wrap upon reaching its limits.

### `xalign`

`number` · default `0.000000` · from `GtkEditable`

The horizontal alignment, from 0 (left) to 1 (right).

Reversed for RTL layouts.

## Signals

### `onActivate`

```ts
(self: Gtk.SpinButton) => void
```

Emitted when the spin button is activated.

The keybindings for this signal are all forms of the <kbd>Enter</kbd> key.

If the <kbd>Enter</kbd> key results in the value being committed to the
spin button, then activation does not occur until <kbd>Enter</kbd> is
pressed again.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.14._

### `onChanged`

```ts
(self: Gtk.SpinButton) => void
```

From `GtkEditable`.

Emitted at the end of a single user-visible operation on the
contents.

E.g., a paste operation that replaces the contents of the
selection will cause only one signal emission (even though it
is implemented by first deleting the selection, then inserting
the new content, and may cause multiple ::notify::text signals
to be emitted).

**Parameters**

- `self`: The instance the signal was emitted on.

### `onChangeValue`

```ts
(scroll: Gtk.ScrollType, self: Gtk.SpinButton) => void
```

Emitted when the user initiates a value change.

This is a [keybinding signal](class.SignalAction.html).

Applications should not connect to it, but may emit it with
`g_signal_emit_by_name()` if they need to control the cursor
programmatically.

The default bindings for this signal are Up/Down and PageUp/PageDown.

**Parameters**

- `scroll`: a `GtkScrollType` to specify the speed and amount of change
- `self`: The instance the signal was emitted on.

### `onDeleteText`

```ts
(startPos: number, endPos: number, self: Gtk.SpinButton) => void
```

From `GtkEditable`.

Emitted when text is deleted from the widget by the user.

The default handler for this signal will normally be responsible for
deleting the text, so by connecting to this signal and then stopping
the signal with `g_signal_stop_emission()`, it is possible to modify the
range of deleted text, or prevent it from being deleted entirely.

The `start_pos` and `end_pos` parameters are interpreted as for
`Gtk.Editable.deleteText()`.

**Parameters**

- `startPos`: the starting position
- `endPos`: the end position
- `self`: The instance the signal was emitted on.

### `onEditingDone`

```ts
(self: Gtk.SpinButton) => void
```

From `GtkCellEditable`.

This signal is a sign for the cell renderer to update its
value from the `cell_editable`.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing, e.g.
`GtkEntry` emits this signal when the user presses Enter. Typical things to
do in a handler for ::editing-done are to capture the edited value,
disconnect the `cell_editable` from signals on the `GtkCellRenderer`, etc.

`gtk_cell_editable_editing_done()` is a convenience method
for emitting `GtkCellEditable::editing-done`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInput`

```ts
(self: Gtk.SpinButton) => [number, number]
```

Emitted to convert the users input into a double value.

The signal handler is expected to use `Gtk.Editable.getText()`
to retrieve the text of the spinbutton and set `new_value` to the
new value.

The default conversion uses `g_strtod()`.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `true` for a successful conversion, `false` if the input
  was not handled, and `GTK_INPUT_ERROR` if the conversion failed.

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Gtk.SpinButton) => number
```

From `GtkEditable`.

Emitted when text is inserted into the widget by the user.

The default handler for this signal will normally be responsible
for inserting the text, so by connecting to this signal and then
stopping the signal with `g_signal_stop_emission()`, it is possible
to modify the inserted text, or prevent it from being inserted entirely.

**Parameters**

- `text`: the new text to insert
- `length`: the length of the new text, in bytes, or -1 if new_text is nul-terminated
- `position`: the position, in characters, at which to insert the new text. this is an in-out parameter. After the signal emission is finished, it should point after the newly inserted text.
- `self`: The instance the signal was emitted on.

### `onOutput`

```ts
(self: Gtk.SpinButton) => boolean | undefined
```

Emitted to tweak the formatting of the value for display.

```c
// show leading zeros
static gboolean
on_output (GtkSpinButton *spin,
           gpointer       data)
{
   char *text;
   int value;

   value = gtk_spin_button_get_value_as_int (spin);
   text = g_strdup_printf ("%02d", value);
   gtk_editable_set_text (GTK_EDITABLE (spin), text):
   g_free (text);

   return TRUE;
}
```

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `true` if the value has been displayed

### `onRemoveWidget`

```ts
(self: Gtk.SpinButton) => void
```

From `GtkCellEditable`.

This signal is meant to indicate that the cell is finished
editing, and the `cell_editable` widget is being removed and may
subsequently be destroyed.

Implementations of `GtkCellEditable` are responsible for
emitting this signal when they are done editing. It must
be emitted after the `GtkCellEditable::editing-done` signal,
to give the cell renderer a chance to update the cell's value
before the widget is removed.

`gtk_cell_editable_remove_widget()` is a convenience method
for emitting `GtkCellEditable::remove-widget`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onValueChanged`

```ts
(self: Gtk.SpinButton) => void
```

Emitted when the value is changed.

Also see the `Gtk.SpinButton.output` signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onWrapped`

```ts
(self: Gtk.SpinButton) => void
```

Emitted right after the spinbutton wraps from its maximum
to its minimum value or vice-versa.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.SpinButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `configure`

```ts
configure(adjustment: Gtk.Adjustment | null, climbRate: number, digits: number): void
```

Changes the properties of an existing spin button.

The adjustment, climb rate, and number of decimal places
are updated accordingly.

**Parameters**

- `adjustment`: a `GtkAdjustment` to replace the spin button’s existing adjustment, or `null` to leave its current adjustment unchanged
- `climbRate`: the new climb rate
- `digits`: the number of decimal places to display in the spin button

### `getActivatesDefault`

```ts
getActivatesDefault(): boolean
```

Retrieves the value set by `Gtk.SpinButton.setActivatesDefault()`.

**Returns** `true` if the spin button will activate the default widget

_Available since 4.14._

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment
```

Get the adjustment associated with a `GtkSpinButton`.

**Returns** the `GtkAdjustment` of `spin_button`

### `getClimbRate`

```ts
getClimbRate(): number
```

Returns the acceleration rate for repeated changes.

**Returns** the acceleration rate

### `getDigits`

```ts
getDigits(): number
```

Fetches the precision of `spin_button`.

**Returns** the current precision

### `getIncrements`

```ts
getIncrements(): [number, number]
```

Gets the current step and page the increments
used by `spin_button`.

See `Gtk.SpinButton.setIncrements()`.

**Returns** Tuple of:

- `step`: location to store step increment
- `page`: location to store page increment

### `getNumeric`

```ts
getNumeric(): boolean
```

Returns whether non-numeric text can be typed into the spin button.

**Returns** `true` if only numeric text can be entered

### `getRange`

```ts
getRange(): [number, number]
```

Gets the range allowed for `spin_button`.

See `Gtk.SpinButton.setRange()`.

**Returns** Tuple of:

- `min`: location to store minimum allowed value
- `max`: location to store maximum allowed value

### `getSnapToTicks`

```ts
getSnapToTicks(): boolean
```

Returns whether the values are corrected to the nearest step.

**Returns** `true` if values are snapped to the nearest step

### `getUpdatePolicy`

```ts
getUpdatePolicy(): Gtk.SpinButtonUpdatePolicy
```

Gets the update behavior of a spin button.

See `Gtk.SpinButton.setUpdatePolicy()`.

**Returns** the current update policy

### `getValue`

```ts
getValue(): number
```

Get the value in the `spin_button`.

**Returns** the value of `spin_button`

### `getValueAsInt`

```ts
getValueAsInt(): number
```

Get the value `spin_button` represented as an integer.

**Returns** the value of `spin_button`

### `getWrap`

```ts
getWrap(): boolean
```

Returns whether the spin button’s value wraps around to the
opposite limit when the upper or lower limit of the range is
exceeded.

**Returns** `true` if the spin button wraps around

### `setActivatesDefault`

```ts
setActivatesDefault(activatesDefault: boolean): void
```

Sets whether activating the spin button will activate the default
widget for the window containing the spin button.

See `Gtk.SpinButton.activate` for what counts as activation.

**Parameters**

- `activatesDefault`: `true` to activate window’s default widget on activation

_Available since 4.14._

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment): void
```

Replaces the `GtkAdjustment` associated with `spin_button`.

**Parameters**

- `adjustment`: a `GtkAdjustment` to replace the existing adjustment

### `setClimbRate`

```ts
setClimbRate(climbRate: number): void
```

Sets the acceleration rate for repeated changes when you
hold down a button or key.

**Parameters**

- `climbRate`: the rate of acceleration, must be >= 0

### `setDigits`

```ts
setDigits(digits: number): void
```

Set the precision to be displayed by `spin_button`.

Up to 20 digit precision is allowed.

**Parameters**

- `digits`: the number of digits after the decimal point to be displayed for the spin button’s value

### `setIncrements`

```ts
setIncrements(step: number, page: number): void
```

Sets the step and page increments for spin_button.

This affects how quickly the value changes when
the spin button’s arrows are activated.

**Parameters**

- `step`: increment applied for a button 1 press.
- `page`: increment applied for a button 2 press.

### `setNumeric`

```ts
setNumeric(numeric: boolean): void
```

Sets the flag that determines if non-numeric text can be typed
into the spin button.

**Parameters**

- `numeric`: flag indicating if only numeric entry is allowed

### `setRange`

```ts
setRange(min: number, max: number): void
```

Sets the minimum and maximum allowable values for `spin_button`.

If the current value is outside this range, it will be adjusted
to fit within the range, otherwise it will remain unchanged.

**Parameters**

- `min`: minimum allowable value
- `max`: maximum allowable value

### `setSnapToTicks`

```ts
setSnapToTicks(snapToTicks: boolean): void
```

Sets the policy as to whether values are corrected to the
nearest step increment when a spin button is activated after
providing an invalid value.

**Parameters**

- `snapToTicks`: a flag indicating if invalid values should be corrected

### `setUpdatePolicy`

```ts
setUpdatePolicy(policy: Gtk.SpinButtonUpdatePolicy): void
```

Sets the update behavior of a spin button.

This determines whether the spin button is always
updated or only when a valid value is set.

**Parameters**

- `policy`: a `GtkSpinButtonUpdatePolicy` value

### `setValue`

```ts
setValue(value: number): void
```

Sets the value of `spin_button`.

**Parameters**

- `value`: the new value

### `setWrap`

```ts
setWrap(wrap: boolean): void
```

Sets the flag that determines if a spin button value wraps
around to the opposite limit when the upper or lower limit
of the range is exceeded.

**Parameters**

- `wrap`: a flag indicating if wrapping behavior is performed

### `spin`

```ts
spin(direction: Gtk.SpinType, increment: number): void
```

Increment or decrement a spin button’s value in a specified
direction by a specified amount.

**Parameters**

- `direction`: a `GtkSpinType` indicating the direction to spin
- `increment`: step increment to apply in the specified direction

### `update`

```ts
update(): void
```

Manually force an update of the spin button.
