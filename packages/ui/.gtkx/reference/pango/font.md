---
description: "A PangoFont is used to represent a font in a rendering-system-independent manner."
---

# PangoFont

A `PangoFont` is used to represent a font in a
rendering-system-independent manner.

```tsx
import { PangoFont } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoFont**

## Props

`ref` receives the `Pango.Font` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Font` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `describe`

```ts
describe(): Pango.FontDescription
```

Returns a description of the font, with font size set in points.

Use `Pango.Font.describeWithAbsoluteSize()` if you want
the font size in device units.

**Returns** a newly-allocated `PangoFontDescription` object.

### `describeWithAbsoluteSize`

```ts
describeWithAbsoluteSize(): Pango.FontDescription
```

Returns a description of the font, with absolute font size set
in device units.

Use `Pango.Font.describe()` if you want the font size in points.

**Returns** a newly-allocated `PangoFontDescription` object.

_Available since 1.14._

### `getCoverage`

```ts
getCoverage(language: Pango.Language): Pango.Coverage
```

Computes the coverage map for a given font and language tag.

**Parameters**

- `language`: the language tag

**Returns** a newly-allocated `PangoCoverage`
  object.

### `getFace`

```ts
getFace(): Pango.FontFace | null
```

Gets the `PangoFontFace` to which `font` belongs.

Note that this function can return `NULL` in cases
where the font outlives its font map.

**Returns** the `PangoFontFace`

_Available since 1.46._

### `getFontMap`

```ts
getFontMap(): Pango.FontMap | null
```

Gets the font map for which the font was created.

Note that the font maintains a *weak* reference to
the font map, so if all references to font map are
dropped, the font map will be finalized even if there
are fonts created with the font map that are still alive.
In that case this function will return `null`.

It is the responsibility of the user to ensure that the
font map is kept alive. In most uses this is not an issue
as a `PangoContext` holds a reference to the font map.

**Returns** the `PangoFontMap`
  for the font

_Available since 1.10._

### `getGlyphExtents`

```ts
getGlyphExtents(glyph: Pango.Glyph): [Pango.Rectangle, Pango.Rectangle]
```

Gets the logical and ink extents of a glyph within a font.

The coordinate system for each rectangle has its origin at the
base line and horizontal origin of the character with increasing
coordinates extending to the right and down. The macros PANGO_ASCENT(),
PANGO_DESCENT(), PANGO_LBEARING(), and PANGO_RBEARING() can be used to convert
from the extents rectangle to more traditional font metrics. The units
of the rectangles are in 1/PANGO_SCALE of a device unit.

If `font` is `null`, this function gracefully sets some sane values in the
output variables and returns.

**Parameters**

- `glyph`: the glyph index

**Returns** Tuple of:

- `inkRect`: rectangle used to store the extents of the glyph as drawn
- `logicalRect`: rectangle used to store the logical extents of the glyph

### `getLanguages`

```ts
getLanguages(): Pango.Language[] | null
```

Returns the languages that are supported by `font`.

If the font backend does not provide this information,
`null` is returned. For the fontconfig backend, this
corresponds to the FC_LANG member of the FcPattern.

The returned array is only valid as long as the font
and its fontmap are valid.

**Returns** an array of `PangoLanguage`

_Available since 1.50._

### `getMetrics`

```ts
getMetrics(language: Pango.Language | null): Pango.FontMetrics
```

Gets overall metric information for a font.

Since the metrics may be substantially different for different scripts,
a language tag can be provided to indicate that the metrics should be
retrieved that correspond to the script(s) used by that language.

If `font` is `null`, this function gracefully sets some sane values in the
output variables and returns.

**Parameters**

- `language`: language tag used to determine which script to get the metrics for, or `null` to indicate to get the metrics for the entire font.

**Returns** a `PangoFontMetrics` object. The caller must call
  `Pango.FontMetrics.unref()` when finished using the object.

### `hasChar`

```ts
hasChar(wc: string): boolean
```

Returns whether the font provides a glyph for this character.

**Parameters**

- `wc`: a Unicode character

**Returns** `TRUE` if `font` can render `wc`

_Available since 1.44._

### `serialize`

```ts
serialize(): GLib.Bytes
```

Serializes the `font` in a way that can be uniquely identified.

There are no guarantees about the format of the output across different
versions of Pango.

The intended use of this function is testing, benchmarking and debugging.
The format is not meant as a permanent storage format.

To recreate a font from its serialized form, use `Pango.Font.deserialize()`.

**Returns** a `GBytes` containing the serialized form of `font`

_Available since 1.50._
