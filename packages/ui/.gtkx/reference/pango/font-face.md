---
description: "A PangoFontFace is used to represent a group of fonts with the same family, slant, weight, and width, but varying sizes."
---

# PangoFontFace

A `PangoFontFace` is used to represent a group of fonts with
the same family, slant, weight, and width, but varying sizes.

```tsx
import { PangoFontFace } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoFontFace**

## Props

`ref` receives the `Pango.FontFace` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.FontFace` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `describe`

```ts
describe(): Pango.FontDescription
```

Returns a font description that matches the face.

The resulting font description will have the family, style,
variant, weight and stretch of the face, but its size field
will be unset.

**Returns** a newly-created `PangoFontDescription` structure
  holding the description of the face. Use `Pango.FontDescription.free()`
  to free the result.

### `getFaceName`

```ts
getFaceName(): string
```

Gets a name representing the style of this face.

Note that a font family may contain multiple faces
with the same name (e.g. a variable and a non-variable
face for the same style).

**Returns** the face name for the face. This string is
  owned by the face object and must not be modified or freed.

### `getFamily`

```ts
getFamily(): Pango.FontFamily
```

Gets the `PangoFontFamily` that `face` belongs to.

**Returns** the `PangoFontFamily`

_Available since 1.46._

### `isSynthesized`

```ts
isSynthesized(): boolean
```

Returns whether a `PangoFontFace` is synthesized.

This will be the case if the underlying font rendering engine
creates this face from another face, by shearing, emboldening,
lightening or modifying it in some other way.

**Returns** whether `face` is synthesized

_Available since 1.18._

### `listSizes`

```ts
listSizes(): number[] | null
```

List the available sizes for a font.

This is only applicable to bitmap fonts. For scalable fonts, stores
`null` at the location pointed to by `sizes` and 0 at the location pointed
to by `n_sizes`. The sizes returned are in Pango units and are sorted
in ascending order.

**Returns** location to store a pointer to an array of int. This array
  should be freed with `g_free()`.

_Available since 1.4._
