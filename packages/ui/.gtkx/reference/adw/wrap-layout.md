---
description: "A box-like layout that can wrap into multiple lines."
---

# AdwWrapLayout

A box-like layout that can wrap into multiple lines.



`AdwWrapLayout` is similar to `Gtk.BoxLayout`, but can wrap lines when
the widgets cannot fit otherwise. Unlike `Gtk.FlowBox`, the children
aren't arranged into a grid and behave more like words in a wrapping label.

Like `GtkBoxLayout`, `AdwWrapLayout` is orientable and has spacing:

- `WrapLayout.childSpacing` between children in the same line;
- `WrapLayout.lineSpacing` between lines.

::: note
    Unlike `GtkBoxLayout`, `AdwWrapLayout` cannot follow the CSS
    `border-spacing` property.

Use the `WrapLayout.naturalLineLength` property to determine the
layout's natural size, e.g. when using it in a `Gtk.Popover`.

Normally, a horizontal `AdwWrapLayout` wraps left to right and top to bottom
for left-to-right languages. Both of these directions can be reversed, using
the `WrapLayout.packDirection` and
`WrapLayout.wrapReverse` properties. Additionally, the alignment
of each line can be controlled with the `WrapLayout.align` property.

Lines can be justified using the `WrapLayout.justify` property,
filling the entire line by either increasing child size or spacing depending
on the value. Set `WrapLayout.justifyLastLine` to justify the last
line as well.

By default, `AdwWrapLayout` wraps as soon as the previous line cannot fit
any more children without shrinking them past their natural size. Set
`WrapLayout.wrapPolicy` to `Adw.WrapPolicy.minimum` to only
wrap once all the children in the previous line have been shrunk to their
minimum size.

To make each line take the same amount of space, set
`WrapLayout.lineHomogeneous` to `TRUE`.

Spacing and natural line length can scale with the text scale factor, use the
`WrapLayout.childSpacingUnit`,
`WrapLayout.lineSpacingUnit` and/or
`WrapLayout.naturalLineLengthUnit` properties to enable that
behavior.

See `WrapBox`.

_Available since 1.7._

```tsx
import { AdwWrapLayout } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkLayoutManager](.gtkx/reference/gtk/layout-manager.md) → **AdwWrapLayout**

Implements `GtkOrientable`.

## Props

`ref` receives the `Adw.WrapLayout` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `align`

`number` · default `0.000000`

The alignment of the children within each line.

0 means the children are placed at the start of the line, 1 means they are
placed at the end of the line. 0.5 means they are placed in the middle of
the line.

Alignment is only used when `WrapLayout.justify` is set to
`Adw.JustifyMode.none`, or on the last line when the
`WrapLayout.justifyLastLine` is `FALSE`.

_Available since 1.7._

### `childSpacing`

`number` · default `0`

The spacing between widgets on the same line.

See `WrapLayout.childSpacingUnit`.

_Available since 1.7._

### `childSpacingUnit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_PX`

The length unit for child spacing.

Allows the spacing to vary depending on the text scale factor.

See `WrapLayout.childSpacing`.

_Available since 1.7._

### `justify`

`Adw.JustifyMode` · default `ADW_JUSTIFY_NONE`

Determines whether and how each complete line should be stretched to fill
the entire widget.

If set to `Adw.JustifyMode.fill`, each widget in the line will be
stretched, keeping consistent spacing, so that the line fills the entire
widget.

If set to `Adw.JustifyMode.spread`, the spacing between widgets will
be increased, keeping widget sizes intact. The first and last widget will
be aligned with the beginning and end of the line. If the line only
contains a single widget, it will be stretched regardless.

If set to `Adw.JustifyMode.none`, the line will not be stretched and
the children will be placed together within the line, according to
`WrapLayout.align`.

By default this doesn't affect the last line, as it will be incomplete. Use
`WrapLayout.justifyLastLine` to justify it as well.

_Available since 1.7._

### `justifyLastLine`

`boolean` · default `false`

Whether the last line should be stretched to fill the entire widget.

See `WrapLayout.justify`.

_Available since 1.7._

### `lineHomogeneous`

`boolean` · default `false`

Whether all lines should take the same amount of space.

_Available since 1.7._

### `lineSpacing`

`number` · default `0`

The spacing between lines.

See `WrapLayout.lineSpacingUnit`.

_Available since 1.7._

### `lineSpacingUnit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_PX`

The length unit for line spacing.

Allows the spacing to vary depending on the text scale factor.

See `WrapLayout.lineSpacing`.

_Available since 1.7._

### `naturalLineLength`

`number` · default `-1`

Determines the natural size for each line.

It should be used to limit the line lengths, for example when used in
popovers.

See `WrapLayout.naturalLineLengthUnit`.

_Available since 1.7._

### `naturalLineLengthUnit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_PX`

The length unit for natural line length.

Allows the length to vary depending on the text scale factor.

See `WrapLayout.naturalLineLength`.

_Available since 1.7._

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `packDirection`

`Adw.PackDirection` · default `ADW_PACK_START_TO_END`

The direction children are packed in each line.

_Available since 1.7._

### `wrapPolicy`

`Adw.WrapPolicy` · default `ADW_WRAP_NATURAL`

The policy for line wrapping.

If set to `Adw.WrapPolicy.natural`, the box will wrap to the next line
as soon as the previous line cannot fit any more children without shrinking
them past their natural size.

If set to `Adw.WrapPolicy.minimum`, the box will try to fit as many
children into each line as possible, shrinking them down to their minimum
size before wrapping to the next line.

_Available since 1.7._

### `wrapReverse`

`boolean` · default `false`

Whether wrap direction should be reversed.

By default, lines wrap downwards in a horizontal box, and towards the end
in a vertical box. If set to `TRUE`, they wrap upwards or towards the start
respectively.

_Available since 1.7._

## Methods

Methods are called on the `Adw.WrapLayout` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAlign`

```ts
getAlign(): number
```

Gets the alignment of the children within each line.

**Returns** the child alignment

_Available since 1.7._

### `getChildSpacing`

```ts
getChildSpacing(): number
```

Gets spacing between widgets on the same line.

**Returns** spacing between widgets on the same line

_Available since 1.7._

### `getChildSpacingUnit`

```ts
getChildSpacingUnit(): Adw.LengthUnit
```

Gets the length unit for child spacing.

**Returns** the length unit

_Available since 1.7._

### `getJustify`

```ts
getJustify(): Adw.JustifyMode
```

Gets whether and how each complete line is stretched to fill the entire widget.

**Returns** the justify mode

_Available since 1.7._

### `getJustifyLastLine`

```ts
getJustifyLastLine(): boolean
```

Gets whether the last line should be stretched to fill the entire widget.

**Returns** whether the last line is justified

_Available since 1.7._

### `getLineHomogeneous`

```ts
getLineHomogeneous(): boolean
```

Gets whether all lines should take the same amount of space.

**Returns** whether lines should be homogeneous

_Available since 1.7._

### `getLineSpacing`

```ts
getLineSpacing(): number
```

Gets the spacing between lines.

**Returns** the line spacing

_Available since 1.7._

### `getLineSpacingUnit`

```ts
getLineSpacingUnit(): Adw.LengthUnit
```

Gets the length unit for line spacing.

**Returns** the length unit

_Available since 1.7._

### `getNaturalLineLength`

```ts
getNaturalLineLength(): number
```

Gets the natural size for each line.

**Returns** the natural length

_Available since 1.7._

### `getNaturalLineLengthUnit`

```ts
getNaturalLineLengthUnit(): Adw.LengthUnit
```

Gets the length unit for line spacing.

**Returns** the length unit

_Available since 1.7._

### `getPackDirection`

```ts
getPackDirection(): Adw.PackDirection
```

Gets the direction children are packed in each line.

**Returns** the line direction

_Available since 1.7._

### `getWrapPolicy`

```ts
getWrapPolicy(): Adw.WrapPolicy
```

Gets the policy for line wrapping.

**Returns** the wrap policy

_Available since 1.7._

### `getWrapReverse`

```ts
getWrapReverse(): boolean
```

Gets whether wrap direction is reversed.

**Returns** whether wrap direction is reversed

_Available since 1.7._

### `setAlign`

```ts
setAlign(align: number): void
```

Sets the alignment of the children within each line.

0 means the children are placed at the start of the line, 1 means they are
placed at the end of the line. 0.5 means they are placed in the middle of the
line.

Alignment is only used when `WrapLayout.justify` is set to
`Adw.JustifyMode.none`, or on the last line when the
`WrapLayout.justifyLastLine` is `FALSE`.

**Parameters**

- `align`: the child alignment

_Available since 1.7._

### `setChildSpacing`

```ts
setChildSpacing(childSpacing: number): void
```

Sets the spacing between widgets on the same line.

See `WrapLayout.childSpacingUnit`.

**Parameters**

- `childSpacing`: the child spacing

_Available since 1.7._

### `setChildSpacingUnit`

```ts
setChildSpacingUnit(unit: Adw.LengthUnit): void
```

Sets the length unit for child spacing.

Allows the spacing to vary depending on the text scale factor.

See `WrapLayout.childSpacing`.

**Parameters**

- `unit`: the length unit

_Available since 1.7._

### `setJustify`

```ts
setJustify(justify: Adw.JustifyMode): void
```

Sets whether and how each complete line should be stretched to fill the
entire widget.

If set to `Adw.JustifyMode.fill`, each widget in the line will be
stretched, keeping consistent spacing, so that the line fills the entire
widget.

If set to `Adw.JustifyMode.spread`, the spacing between widgets will be
increased, keeping widget sizes intact. The first and last widget will be
aligned with the beginning and end of the line. If the line only contains a
single widget, it will be stretched regardless.

If set to `Adw.JustifyMode.none`, the line will not be stretched and the
children will be placed together within the line, according to
`WrapLayout.align`.

By default this doesn't affect the last line, as it will be incomplete. Use
`WrapLayout.justifyLastLine` to justify it as well.

**Parameters**

- `justify`: the justify mode

_Available since 1.7._

### `setJustifyLastLine`

```ts
setJustifyLastLine(justifyLastLine: boolean): void
```

Sets whether the last line should be stretched to fill the entire widget.

See `WrapLayout.justify`.

**Parameters**

- `justifyLastLine`: whether to justify the last line

_Available since 1.7._

### `setLineHomogeneous`

```ts
setLineHomogeneous(homogeneous: boolean): void
```

Sets whether all lines should take the same amount of space.

**Parameters**

- `homogeneous`: whether lines should be homogeneous

_Available since 1.7._

### `setLineSpacing`

```ts
setLineSpacing(lineSpacing: number): void
```

Sets the spacing between lines.

See `WrapLayout.lineSpacingUnit`.

**Parameters**

- `lineSpacing`: the line spacing

_Available since 1.7._

### `setLineSpacingUnit`

```ts
setLineSpacingUnit(unit: Adw.LengthUnit): void
```

Sets the length unit for line spacing.

Allows the spacing to vary depending on the text scale factor.

See `WrapLayout.lineSpacing`.

**Parameters**

- `unit`: the length unit

_Available since 1.7._

### `setNaturalLineLength`

```ts
setNaturalLineLength(naturalLineLength: number): void
```

Sets the natural size for each line.

It should be used to limit the line lengths, for example when used in
popovers.

See `WrapLayout.naturalLineLengthUnit`.

**Parameters**

- `naturalLineLength`: the natural length

_Available since 1.7._

### `setNaturalLineLengthUnit`

```ts
setNaturalLineLengthUnit(unit: Adw.LengthUnit): void
```

Sets the length unit for natural line length.

Allows the length to vary depending on the text scale factor.

See `WrapLayout.naturalLineLength`.

**Parameters**

- `unit`: the length unit

_Available since 1.7._

### `setPackDirection`

```ts
setPackDirection(packDirection: Adw.PackDirection): void
```

Sets the direction children are packed in each line.

**Parameters**

- `packDirection`: the new line direction

_Available since 1.7._

### `setWrapPolicy`

```ts
setWrapPolicy(wrapPolicy: Adw.WrapPolicy): void
```

Sets the policy for line wrapping.

If set to `Adw.WrapPolicy.natural`, the box will wrap to the next line
as soon as the previous line cannot fit any more children without shrinking
them past their natural size.

If set to `Adw.WrapPolicy.minimum`, the box will try to fit as many
children into each line as possible, shrinking them down to their minimum
size before wrapping to the next line.

**Parameters**

- `wrapPolicy`: the new wrap policy

_Available since 1.7._

### `setWrapReverse`

```ts
setWrapReverse(wrapReverse: boolean): void
```

Sets whether wrap direction should be reversed.

By default, lines wrap downwards in a horizontal box, and towards the end
in a vertical box. If set to `TRUE`, they wrap upwards or towards the start
respectively.

**Parameters**

- `wrapReverse`: whether to reverse wrap direction

_Available since 1.7._
