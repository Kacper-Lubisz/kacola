---
description: "A PangoContext stores global information used to control the itemization process."
---

# PangoContext

A `PangoContext` stores global information used to control the
itemization process.

The information stored by `PangoContext` includes the fontmap used
to look up fonts, and default values such as the default language,
default gravity, or default font.

To obtain a `PangoContext`, use `Pango.FontMap.createContext()`.

```tsx
import { PangoContext } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoContext**

## Props

`ref` receives the `Pango.Context` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Context` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(): void
```

Forces a change in the context, which will cause any `PangoLayout`
using this context to re-layout.

This function is only useful when implementing a new backend
for Pango, something applications won't do. Backends should
call this function if they have attached extra data to the context
and such data is changed.

_Available since 1.32.4._

### `getBaseDir`

```ts
getBaseDir(): Pango.Direction
```

Retrieves the base direction for the context.

See `Pango.Context.setBaseDir()`.

**Returns** the base direction for the context.

### `getBaseGravity`

```ts
getBaseGravity(): Pango.Gravity
```

Retrieves the base gravity for the context.

See `Pango.Context.setBaseGravity()`.

**Returns** the base gravity for the context.

_Available since 1.16._

### `getFontDescription`

```ts
getFontDescription(): Pango.FontDescription | null
```

Retrieve the default font description for the context.

**Returns** a pointer to the context's default font
  description. This value must not be modified or freed.

### `getFontMap`

```ts
getFontMap(): Pango.FontMap | null
```

Gets the `PangoFontMap` used to look up fonts for this context.

**Returns** the font map for the.
  `PangoContext` This value is owned by Pango and should not be
  unreferenced.

_Available since 1.6._

### `getGravity`

```ts
getGravity(): Pango.Gravity
```

Retrieves the gravity for the context.

This is similar to `Pango.Context.getBaseGravity()`,
except for when the base gravity is `PANGO_GRAVITY_AUTO` for
which `Pango.Gravity.getForMatrix()` is used to return the
gravity from the current context matrix.

**Returns** the resolved gravity for the context.

_Available since 1.16._

### `getGravityHint`

```ts
getGravityHint(): Pango.GravityHint
```

Retrieves the gravity hint for the context.

See `Pango.Context.setGravityHint()` for details.

**Returns** the gravity hint for the context.

_Available since 1.16._

### `getLanguage`

```ts
getLanguage(): Pango.Language
```

Retrieves the global language tag for the context.

**Returns** the global language tag.

### `getMatrix`

```ts
getMatrix(): Pango.Matrix | null
```

Gets the transformation matrix that will be applied when
rendering with this context.

See `Pango.Context.setMatrix()`.

**Returns** the matrix, or `null` if no
  matrix has been set (which is the same as the identity matrix).
  The returned matrix is owned by Pango and must not be modified
  or freed.

_Available since 1.6._

### `getMetrics`

```ts
getMetrics(desc: Pango.FontDescription | null, language: Pango.Language | null): Pango.FontMetrics
```

Get overall metric information for a particular font description.

Since the metrics may be substantially different for different scripts,
a language tag can be provided to indicate that the metrics should be
retrieved that correspond to the script(s) used by that language.

The `PangoFontDescription` is interpreted in the same way as by `itemize()`,
and the family name may be a comma separated list of names. If characters
from multiple of these families would be used to render the string, then
the returned fonts would be a composite of the metrics for the fonts loaded
for the individual families.

**Parameters**

- `desc`: a `PangoFontDescription` structure. `null` means that the font description from the context will be used.
- `language`: language tag used to determine which script to get the metrics for. `null` means that the language tag from the context will be used. If no language tag is set on the context, metrics for the default language (as determined by `Pango.Language.getDefault()` will be returned.

**Returns** a `PangoFontMetrics` object. The caller must call
  `Pango.FontMetrics.unref()` when finished using the object.

### `getRoundGlyphPositions`

```ts
getRoundGlyphPositions(): boolean
```

Returns whether font rendering with this context should
round glyph positions and widths.

_Available since 1.44._

### `getSerial`

```ts
getSerial(): number
```

Returns the current serial number of `context`.

The serial number is initialized to an small number larger than zero
when a new context is created and is increased whenever the context
is changed using any of the setter functions, or the `PangoFontMap` it
uses to find fonts has changed. The serial may wrap, but will never
have the value 0. Since it can wrap, never compare it with "less than",
always use "not equals".

This can be used to automatically detect changes to a `PangoContext`,
and is only useful when implementing objects that need update when their
`PangoContext` changes, like `PangoLayout`.

**Returns** The current serial number of `context`.

_Available since 1.32.4._

### `listFamilies`

```ts
listFamilies(): Pango.FontFamily[]
```

List all families for a context.

**Returns** location
  to store a pointer to an array of `PangoFontFamily`. This array should
  be freed with `g_free()`.

### `loadFont`

```ts
loadFont(desc: Pango.FontDescription): Pango.Font | null
```

Loads the font in one of the fontmaps in the context
that is the closest match for `desc`.

**Parameters**

- `desc`: a `PangoFontDescription` describing the font to load

**Returns** the newly allocated `PangoFont`
  that was loaded, or `null` if no font matched.

### `loadFontset`

```ts
loadFontset(desc: Pango.FontDescription, language: Pango.Language): Pango.Fontset | null
```

Load a set of fonts in the context that can be used to render
a font matching `desc`.

**Parameters**

- `desc`: a `PangoFontDescription` describing the fonts to load
- `language`: a `PangoLanguage` the fonts will be used for

**Returns** the newly allocated
  `PangoFontset` loaded, or `null` if no font matched.

### `setBaseDir`

```ts
setBaseDir(direction: Pango.Direction): void
```

Sets the base direction for the context.

The base direction is used in applying the Unicode bidirectional
algorithm; if the `direction` is `PANGO_DIRECTION_LTR` or
`PANGO_DIRECTION_RTL`, then the value will be used as the paragraph
direction in the Unicode bidirectional algorithm. A value of
`PANGO_DIRECTION_WEAK_LTR` or `PANGO_DIRECTION_WEAK_RTL` is used only
for paragraphs that do not contain any strong characters themselves.

**Parameters**

- `direction`: the new base direction

### `setBaseGravity`

```ts
setBaseGravity(gravity: Pango.Gravity): void
```

Sets the base gravity for the context.

The base gravity is used in laying vertical text out.

**Parameters**

- `gravity`: the new base gravity

_Available since 1.16._

### `setFontDescription`

```ts
setFontDescription(desc: Pango.FontDescription): void
```

Set the default font description for the context

**Parameters**

- `desc`: the new pango font description

### `setFontMap`

```ts
setFontMap(fontMap: Pango.FontMap | null): void
```

Sets the font map to be searched when fonts are looked-up
in this context.

This is only for internal use by Pango backends, a `PangoContext`
obtained via one of the recommended methods should already have a
suitable font map.

**Parameters**

- `fontMap`: the `PangoFontMap` to set.

### `setGravityHint`

```ts
setGravityHint(hint: Pango.GravityHint): void
```

Sets the gravity hint for the context.

The gravity hint is used in laying vertical text out, and
is only relevant if gravity of the context as returned by
`Pango.Context.getGravity()` is set to `PANGO_GRAVITY_EAST`
or `PANGO_GRAVITY_WEST`.

**Parameters**

- `hint`: the new gravity hint

_Available since 1.16._

### `setLanguage`

```ts
setLanguage(language: Pango.Language | null): void
```

Sets the global language tag for the context.

The default language for the locale of the running process
can be found using `Pango.Language.getDefault()`.

**Parameters**

- `language`: the new language tag.

### `setMatrix`

```ts
setMatrix(matrix: Pango.Matrix | null): void
```

Sets the transformation matrix that will be applied when rendering
with this context.

Note that reported metrics are in the user space coordinates before
the application of the matrix, not device-space coordinates after the
application of the matrix. So, they don't scale with the matrix, though
they may change slightly for different matrices, depending on how the
text is fit to the pixel grid.

**Parameters**

- `matrix`: a `PangoMatrix`, or `null` to unset any existing matrix. (No matrix set is the same as setting the identity matrix.)

_Available since 1.6._

### `setRoundGlyphPositions`

```ts
setRoundGlyphPositions(roundPositions: boolean): void
```

Sets whether font rendering with this context should
round glyph positions and widths to integral positions,
in device units.

This is useful when the renderer can't handle subpixel
positioning of glyphs.

The default value is to round glyph positions, to remain
compatible with previous Pango behavior.

**Parameters**

- `roundPositions`: whether to round glyph positions

_Available since 1.44._
