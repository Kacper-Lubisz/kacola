---
description: "A PangoFontset represents a set of PangoFont to use when rendering text."
---

# PangoFontset

A `PangoFontset` represents a set of `PangoFont` to use when rendering text.

A `PangoFontset` is the result of resolving a `PangoFontDescription`
against a particular `PangoContext`. It has operations for finding the
component font for a particular Unicode character, and for finding a
composite set of metrics for the entire fontset.

```tsx
import { PangoFontset } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoFontset**

## Props

`ref` receives the `Pango.Fontset` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Fontset` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `foreach`

```ts
foreach(func: Pango.FontsetForeachFunc): void
```

Iterates through all the fonts in a fontset, calling `func` for
each one.

If `func` returns `true`, that stops the iteration.

**Parameters**

- `func`: Callback function

_Available since 1.4._

### `getFont`

```ts
getFont(wc: number): Pango.Font
```

Returns the font in the fontset that contains the best
glyph for a Unicode character.

**Parameters**

- `wc`: a Unicode character

**Returns** a `PangoFont`

### `getMetrics`

```ts
getMetrics(): Pango.FontMetrics
```

Get overall metric information for the fonts in the fontset.

**Returns** a `PangoFontMetrics` object
