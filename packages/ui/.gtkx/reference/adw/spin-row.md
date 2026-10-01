---
description: "An ActionRow with an embedded spin button."
---

# AdwSpinRow

An `ActionRow` with an embedded spin button.



Example of an `AdwSpinRow` UI definition:

```xml
<object class="AdwSpinRow">
  <property name="title" translatable="yes">Spin Row</property>
  <property name="adjustment">
    <object class="GtkAdjustment">
      <property name="lower">0</property>
      <property name="upper">100</property>
      <property name="value">50</property>
      <property name="page-increment">10</property>
      <property name="step-increment">1</property>
    </object>
  </property>
</object>
```

See `Gtk.SpinButton` for details.

### CSS nodes

`AdwSpinRow` has the same structure as `ActionRow`, as well as the
`.spin` style class on the main node.

### Accessibility

`AdwSpinRow` uses an internal `GtkSpinButton` with the
`Gtk.AccessibleRole.spin-button` role.

_Available since 1.4._

```tsx
import { AdwSpinRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → [AdwActionRow](.gtkx/reference/adw/action-row.md) → **AdwSpinRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`, `GtkEditable`.

## Props

`ref` receives the `Adw.SpinRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `adjustment`

`Gtk.Adjustment | ReactElement`

The adjustment that holds the value of the spin row.

_Available since 1.4._

### `climbRate`

`number` · default `0.000000`

The acceleration rate when you hold down a button or key.

_Available since 1.4._

### `cursorPosition`

`number` · default `0` · read-only, observe with `onNotifyCursorPosition` · from `GtkEditable`

The current position of the insertion cursor in chars.

### `digits`

`number` · default `0`

The number of decimal places to display.

_Available since 1.4._

### `editable`

`boolean` · default `true` · from `GtkEditable`

Whether the entry contents can be edited.

### `enableUndo`

`boolean` · default `true` · from `GtkEditable`

If undo/redo should be enabled for the editable.

### `maxWidthChars`

`number` · default `-1` · from `GtkEditable`

The desired maximum width of the entry, in characters.

### `numeric`

`boolean` · default `false`

Whether non-numeric characters should be ignored.

_Available since 1.4._

### `selectionBound`

`number` · default `0` · read-only, observe with `onNotifySelectionBound` · from `GtkEditable`

The position of the opposite end of the selection from the cursor in chars.

### `snapToTicks`

`boolean` · default `false`

Whether invalid values are snapped to the nearest step increment.

_Available since 1.4._

### `text`

`string` · from `GtkEditable`

The contents of the entry.

### `updatePolicy`

`Gtk.SpinButtonUpdatePolicy` · default `GTK_UPDATE_ALWAYS`

The policy for updating the spin row.

The options are always, or only when the value is invalid.

_Available since 1.4._

### `value`

`number` · default `0.000000`

The current value.

_Available since 1.4._

### `widthChars`

`number` · default `-1` · from `GtkEditable`

Number of characters to leave space for in the entry.

### `wrap`

`boolean` · default `false`

Whether the spin row should wrap upon reaching its limits.

_Available since 1.4._

### `xalign`

`number` · default `0.000000` · from `GtkEditable`

The horizontal alignment, from 0 (left) to 1 (right).

Reversed for RTL layouts.

## Signals

### `onChanged`

```ts
(self: Adw.SpinRow) => void
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

### `onDeleteText`

```ts
(startPos: number, endPos: number, self: Adw.SpinRow) => void
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

### `onInput`

```ts
(self: Adw.SpinRow) => [number, number]
```

Emitted to convert the user's input into a double value.

The signal handler is expected to use `Gtk.Editable.getText()` to
retrieve the text of the spinbutton and set new_value to the new value.

The default conversion uses `GLib.strtod()`.

See `Gtk.SpinButton.input`.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `TRUE` for a successful conversion, `FALSE` if the input was not
  handled, and `Gtk.INPUT_ERROR` if the conversion failed.

_Available since 1.4._

### `onInsertText`

```ts
(text: string, length: number, position: number, self: Adw.SpinRow) => number
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
(self: Adw.SpinRow) => boolean | undefined
```

Emitted to tweak the formatting of the value for display.

See `Gtk.SpinButton.output`.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** `TRUE` if the value has been displayed

_Available since 1.4._

### `onWrapped`

```ts
(self: Adw.SpinRow) => void
```

Emitted right after the spinbutton wraps.

See `Gtk.SpinButton.wrapped`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

## Methods

Methods are called on the `Adw.SpinRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `configure`

```ts
configure(adjustment: Gtk.Adjustment | null, climbRate: number, digits: number): void
```

Changes the properties of an existing spin row.

The adjustment, climb rate, and number of decimal places are updated
accordingly.

**Parameters**

- `adjustment`: the adjustment that this spin row should use
- `climbRate`: the new climb rate
- `digits`: the number of decimal places to display

_Available since 1.4._

### `getAdjustment`

```ts
getAdjustment(): Gtk.Adjustment
```

Gets the adjustment that holds the value for the spin row.

**Returns** the adjustment that holds the spin row's value

_Available since 1.4._

### `getClimbRate`

```ts
getClimbRate(): number
```

Gets the acceleration rate when you hold down a button or key.

**Returns** the acceleration rate when you hold down a button or key

_Available since 1.4._

### `getDigits`

```ts
getDigits(): number
```

Gets the number of decimal places to display.

**Returns** the number of decimal places to display

_Available since 1.4._

### `getNumeric`

```ts
getNumeric(): boolean
```

Gets whether non-numeric characters should be ignored.

**Returns** whether non-numeric characters should be ignored.

_Available since 1.4._

### `getSnapToTicks`

```ts
getSnapToTicks(): boolean
```

Gets whether invalid values are snapped to nearest step increment.

**Returns** whether invalid values are snapped to the nearest step increment

_Available since 1.4._

### `getUpdatePolicy`

```ts
getUpdatePolicy(): Gtk.SpinButtonUpdatePolicy
```

Gets the policy for updating the spin row.

**Returns** the policy for updating the spin row

_Available since 1.4._

### `getValue`

```ts
getValue(): number
```

Gets the current value.

**Returns** the current value

_Available since 1.4._

### `getWrap`

```ts
getWrap(): boolean
```

Gets whether the spin row should wrap upon reaching its limits.

**Returns** whether the spin row should wrap upon reaching its limits

_Available since 1.4._

### `setAdjustment`

```ts
setAdjustment(adjustment: Gtk.Adjustment | null): void
```

Sets the adjustment that holds the value for the spin row.

**Parameters**

- `adjustment`: an adjustment

_Available since 1.4._

### `setClimbRate`

```ts
setClimbRate(climbRate: number): void
```

Sets the acceleration rate when you hold down a button or key.

**Parameters**

- `climbRate`: the acceleration rate when you hold down a button or key

_Available since 1.4._

### `setDigits`

```ts
setDigits(digits: number): void
```

Sets the number of decimal places to display.

**Parameters**

- `digits`: the number of decimal places to display

_Available since 1.4._

### `setNumeric`

```ts
setNumeric(numeric: boolean): void
```

Sets whether non-numeric characters should be ignored.

**Parameters**

- `numeric`: whether non-numeric characters should be ignored

_Available since 1.4._

### `setRange`

```ts
setRange(min: number, max: number): void
```

Sets the minimum and maximum allowable values for `self`.

If the current value is outside this range, it will be adjusted
to fit within the range, otherwise it will remain unchanged.

**Parameters**

- `min`: minimum allowable value
- `max`: maximum allowable value

_Available since 1.4._

### `setSnapToTicks`

```ts
setSnapToTicks(snapToTicks: boolean): void
```

Sets whether invalid values are snapped to the nearest step increment.

**Parameters**

- `snapToTicks`: whether invalid values are snapped to the nearest step increment

_Available since 1.4._

### `setUpdatePolicy`

```ts
setUpdatePolicy(policy: Gtk.SpinButtonUpdatePolicy): void
```

Sets the policy for updating the spin row.

The options are always, or only when the value is invalid.

**Parameters**

- `policy`: the policy for updating the spin row

_Available since 1.4._

### `setValue`

```ts
setValue(value: number): void
```

Sets the current value.

**Parameters**

- `value`: a new value

_Available since 1.4._

### `setWrap`

```ts
setWrap(wrap: boolean): void
```

Sets whether the spin row should wrap upon reaching its limits.

**Parameters**

- `wrap`: whether the spin row should wrap upon reaching its limits

_Available since 1.4._

### `update`

```ts
update(): void
```

Manually force an update of the spin row.

_Available since 1.4._
