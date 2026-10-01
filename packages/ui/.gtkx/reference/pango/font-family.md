---
description: "A PangoFontFamily is used to represent a family of related font faces."
---

# PangoFontFamily

A `PangoFontFamily` is used to represent a family of related
font faces.

The font faces in a family share a common design, but differ in
slant, weight, width or other aspects.

```tsx
import { PangoFontFamily } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoFontFamily**

Implements `GListModel`.

## Props

`ref` receives the `Pango.FontFamily` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `isMonospace`

`boolean` · default `false` · read-only, observe with `onNotifyIsMonospace`

Is this a monospace font

_Available since 1.52._

### `isVariable`

`boolean` · default `false` · read-only, observe with `onNotifyIsVariable`

Is this a variable font

_Available since 1.52._

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items contained in this list.

_Available since 1.52._

### `name`

`string` · default `null` · read-only, observe with `onNotifyName`

The name of the family

_Available since 1.52._

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items contained in this list.

_Available since 1.52._

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Pango.FontFamily) => void
```

From `GListModel`.

This signal is emitted whenever items were added to or removed
from `list`. At `position`, `removed` items were removed and `added`
items were added in their place.

Note: If `removed != added`, the positions of all later items
in the model change.

**Parameters**

- `position`: the position at which `list` changed
- `removed`: the number of items removed
- `added`: the number of items added
- `self`: The instance the signal was emitted on.

_Available since 2.44._

## Methods

Methods are called on the `Pango.FontFamily` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `getFace`

```ts
getFace(name: string | null): Pango.FontFace | null
```

Gets the `PangoFontFace` of `family` with the given name.

**Parameters**

- `name`: the name of a face. If the name is `null`, the family's default face (fontconfig calls it "Regular") will be returned.

**Returns** the `PangoFontFace`,
  or `null` if no face with the given name exists.

_Available since 1.46._

### `getName`

```ts
getName(): string
```

Gets the name of the family.

The name is unique among all fonts for the font backend and can
be used in a `PangoFontDescription` to specify that a face from
this family is desired.

**Returns** the name of the family. This string is owned
  by the family object and must not be modified or freed.

### `isMonospace`

```ts
isMonospace(): boolean
```

A monospace font is a font designed for text display where the the
characters form a regular grid.

For Western languages this would
mean that the advance width of all characters are the same, but
this categorization also includes Asian fonts which include
double-width characters: characters that occupy two grid cells.
`g_unichar_iswide()` returns a result that indicates whether a
character is typically double-width in a monospace font.

The best way to find out the grid-cell size is to call
`Pango.FontMetrics.getApproximateDigitWidth()`, since the
results of `Pango.FontMetrics.getApproximateCharWidth()` may
be affected by double-width characters.

**Returns** `true` if the family is monospace.

_Available since 1.4._

### `isVariable`

```ts
isVariable(): boolean
```

A variable font is a font which has axes that can be modified to
produce different faces.

Such axes are also known as _variations_; see
`Pango.FontDescription.setVariations()` for more information.

**Returns** `true` if the family is variable

_Available since 1.44._

### `listFaces`

```ts
listFaces(): Pango.FontFace[]
```

Lists the different font faces that make up `family`.

The faces in a family share a common design, but differ in slant, weight,
width and other aspects.

Note that the returned faces are not in any particular order, and
multiple faces may have the same name or characteristics.

`PangoFontFamily` also implemented the `Gio.ListModel` interface
for enumerating faces.

**Returns** location to store an array of pointers to `PangoFontFace` objects,
  or `null`. This array should be freed with `g_free()` when it is no
  longer needed.
