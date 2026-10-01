---
description: "A model for a numeric value."
---

# GtkAdjustment

A model for a numeric value.

The `GtkAdjustment` has an associated lower and upper bound.
It also contains step and page increments, and a page size.

Adjustments are used within several GTK widgets, including
`Gtk.SpinButton`, `Gtk.Viewport`, `Gtk.Scrollbar`
and `Gtk.Scale`.

The `GtkAdjustment` object does not update the value itself. Instead
it is left up to the owner of the `GtkAdjustment` to control the value.

```tsx
import { GtkAdjustment } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkAdjustment**

## Props

`ref` receives the `Gtk.Adjustment` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `lower`

`number` · default `0.000000`

The minimum value of the adjustment.

### `pageIncrement`

`number` · default `0.000000`

The page increment of the adjustment.

### `pageSize`

`number` · default `0.000000`

The page size of the adjustment.

Note that the page-size is irrelevant and should be set to zero
if the adjustment is used for a simple scalar value, e.g. in a
`GtkSpinButton`.

### `stepIncrement`

`number` · default `0.000000`

The step increment of the adjustment.

### `upper`

`number` · default `0.000000`

The maximum value of the adjustment.

Note that values will be restricted by `upper - page-size` if the page-size
property is nonzero.

### `value`

`number` · default `0.000000`

The value of the adjustment.

## Signals

### `onChanged`

```ts
(self: Gtk.Adjustment) => void
```

Emitted when one or more of the `GtkAdjustment` properties have been
changed.

Note that the `Gtk.Adjustment.value` property is
covered by the `Gtk.Adjustment.value-changed` signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onValueChanged`

```ts
(self: Gtk.Adjustment) => void
```

Emitted when the value has been changed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Adjustment` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clampPage`

```ts
clampPage(lower: number, upper: number): void
```

Updates the value of the adjustment to ensure that the
given range is contained in the current page.

The current page goes from `value` to `value` + `page-size`.
If the range is larger than the page size, then only the
start of it will be in the current page.

A `Gtk.Adjustment.value-changed` signal will be emitted
if the value is changed.

**Parameters**

- `lower`: the lower value
- `upper`: the upper value

### `configure`

```ts
configure(value: number, lower: number, upper: number, stepIncrement: number, pageIncrement: number, pageSize: number): void
```

Sets all properties of the adjustment at once.

Use this function to avoid multiple emissions of the
`Gtk.Adjustment.changed` signal. See
`Gtk.Adjustment.setLower()` for an alternative
way of compressing multiple emissions of
`Gtk.Adjustment.changed` into one.

**Parameters**

- `value`: the new value
- `lower`: the new minimum value
- `upper`: the new maximum value
- `stepIncrement`: the new step increment
- `pageIncrement`: the new page increment
- `pageSize`: the new page size

### `getLower`

```ts
getLower(): number
```

Retrieves the minimum value of the adjustment.

**Returns** the minimum value

### `getMinimumIncrement`

```ts
getMinimumIncrement(): number
```

Gets the smaller of step increment and page increment.

**Returns** the minimum increment

### `getPageIncrement`

```ts
getPageIncrement(): number
```

Retrieves the page increment of the adjustment.

**Returns** the page increment

### `getPageSize`

```ts
getPageSize(): number
```

Retrieves the page size of the adjustment.

**Returns** the page size

### `getStepIncrement`

```ts
getStepIncrement(): number
```

Retrieves the step increment of the adjustment.

**Returns** the step increment

### `getUpper`

```ts
getUpper(): number
```

Retrieves the maximum value of the adjustment.

**Returns** the maximum value

### `getValue`

```ts
getValue(): number
```

Gets the current value of the adjustment.

**Returns** the current value

### `setLower`

```ts
setLower(lower: number): void
```

Sets the minimum value of the adjustment.

When setting multiple adjustment properties via their individual
setters, multiple `Gtk.Adjustment.changed` signals will
be emitted. However, since the emission of the
`Gtk.Adjustment.changed` signal is tied to the emission
of the ::notify signals of the changed properties, it’s possible
to compress the `Gtk.Adjustment.changed` signals into one
by calling `g_object_freeze_notify()` and `g_object_thaw_notify()`
around the calls to the individual setters.

Alternatively, using a single `g_object_set()` for all the properties
to change, or using `Gtk.Adjustment.configure()` has the same effect.

**Parameters**

- `lower`: the new minimum value

### `setPageIncrement`

```ts
setPageIncrement(pageIncrement: number): void
```

Sets the page increment of the adjustment.

See `Gtk.Adjustment.setLower()` about how to compress
multiple emissions of the `Gtk.Adjustment.changed`
signal when setting multiple adjustment properties.

**Parameters**

- `pageIncrement`: the new page increment

### `setPageSize`

```ts
setPageSize(pageSize: number): void
```

Sets the page size of the adjustment.

See `Gtk.Adjustment.setLower()` about how to compress
multiple emissions of the `Gtk.Adjustment.changed`
signal when setting multiple adjustment properties.

**Parameters**

- `pageSize`: the new page size

### `setStepIncrement`

```ts
setStepIncrement(stepIncrement: number): void
```

Sets the step increment of the adjustment.

See `Gtk.Adjustment.setLower()` about how to compress
multiple emissions of the `Gtk.Adjustment.changed`
signal when setting multiple adjustment properties.

**Parameters**

- `stepIncrement`: the new step increment

### `setUpper`

```ts
setUpper(upper: number): void
```

Sets the maximum value of the adjustment.

Note that values will be restricted by `upper - page-size`
if the page-size property is nonzero.

See `Gtk.Adjustment.setLower()` about how to compress
multiple emissions of the `Gtk.Adjustment.changed`
signal when setting multiple adjustment properties.

**Parameters**

- `upper`: the new maximum value

### `setValue`

```ts
setValue(value: number): void
```

Sets the `GtkAdjustment` value.

The value is clamped to lie between `Gtk.Adjustment.lower`
and `Gtk.Adjustment.upper`.

Note that for adjustments which are used in a `GtkScrollbar`,
the effective range of allowed values goes from
`Gtk.Adjustment.lower` to
`Gtk.Adjustment.upper` - `Gtk.Adjustment.pageSize`.

**Parameters**

- `value`: the new value
