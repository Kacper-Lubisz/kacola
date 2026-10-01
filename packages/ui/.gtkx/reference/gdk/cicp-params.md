---
description: "Contains the parameters that define a colorstate with cicp parameters."
---

# GdkCicpParams

Contains the parameters that define a colorstate with cicp parameters.

Cicp parameters are specified in the ITU-T H.273
[specification](https://www.itu.int/rec/T-REC-H.273/en).

See the documentation of individual properties for supported values.

The 'unspecified' value (2) is not treated in any special way, and
must be replaced by a different value before creating a color state.

`GdkCicpParams` can be used as a builder object to construct a color
state from Cicp data with `Gdk.CicpParams.buildColorState()`.
The function will return an error if the given parameters are not
supported.

You can obtain a `GdkCicpParams` object from a color state with
`Gdk.ColorState.createCicpParams()`. This can be used to
create a variant of a color state, by changing just one of the cicp
parameters, or just to obtain information about the color state.

_Available since 4.16._

```tsx
import { GdkCicpParams } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkCicpParams**

## Props

`ref` receives the `Gdk.CicpParams` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `colorPrimaries`

`number` · default `2`

The color primaries to use.

Supported values:

- 1: BT.709 / sRGB
- 2: unspecified
- 5: PAL
- 6,7: BT.601 / NTSC
- 9: BT.2020
- 12: Display P3

_Available since 4.16._

### `matrixCoefficients`

`number` · default `2`

The matrix coefficients (for YUV to RGB conversion).

Supported values:

- 0: RGB
- 1: BT.709
- 2: unspecified
- 5,6: BT.601
- 9: BT.2020

_Available since 4.16._

### `range`

`Gdk.CicpRange` · default `GDK_CICP_RANGE_NARROW`

Whether the data is using the full range of values.

The range of the data.

_Available since 4.16._

### `transferFunction`

`number` · default `2`

The transfer function to use.

Supported values:

- 1,6,14,15: BT.709, BT.601, BT.2020
- 2: unspecified
- 4: gamma 2.2
- 5: gamma 2.8
- 8: linear
- 13: sRGB
- 16: BT.2100 PQ
- 18: BT.2100 HLG

_Available since 4.16._

## Methods

Methods are called on the `Gdk.CicpParams` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `buildColorState`

```ts
buildColorState(): Gdk.ColorState
```

Creates a new `GdkColorState` object for the cicp parameters in `self`.

Note that this may fail if the cicp parameters in `self` are not
supported by GTK. In that case, `NULL` is returned, and `error` is set
with an error message that can be presented to the user.

**Returns** A newly allocated `GdkColorState`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.16._

### `getColorPrimaries`

```ts
getColorPrimaries(): number
```

Returns the value of the color-primaries property
of `self`.

**Returns** the color-primaries value

_Available since 4.16._

### `getMatrixCoefficients`

```ts
getMatrixCoefficients(): number
```

Gets the matrix-coefficients property of `self`.

**Returns** the matrix-coefficients value

_Available since 4.16._

### `getRange`

```ts
getRange(): Gdk.CicpRange
```

Gets the range property of `self`.

**Returns** the range value

_Available since 4.16._

### `getTransferFunction`

```ts
getTransferFunction(): number
```

Gets the transfer-function property of `self`.

**Returns** the transfer-function value

_Available since 4.16._

### `setColorPrimaries`

```ts
setColorPrimaries(colorPrimaries: number): void
```

Sets the color-primaries property of `self`.

**Parameters**

- `colorPrimaries`: the new color primaries value

_Available since 4.16._

### `setMatrixCoefficients`

```ts
setMatrixCoefficients(matrixCoefficients: number): void
```

`self` a `GdkCicpParams`
Sets the matrix-coefficients property of `self`.

**Parameters**

- `matrixCoefficients`: the new matrix-coefficients value

_Available since 4.16._

### `setRange`

```ts
setRange(range: Gdk.CicpRange): void
```

Sets the range property of `self`

**Parameters**

- `range`: the range value

_Available since 4.16._

### `setTransferFunction`

```ts
setTransferFunction(transferFunction: number): void
```

Sets the transfer-function property of `self`.

**Parameters**

- `transferFunction`: the new transfer-function value

_Available since 4.16._
