---
description: "PangoFontsetSimple is a implementation of the abstract PangoFontset base class as an array of fonts."
---

# PangoFontsetSimple

`PangoFontsetSimple` is a implementation of the abstract
`PangoFontset` base class as an array of fonts.

When creating a `PangoFontsetSimple`, you have to provide
the array of fonts that make up the fontset.

```tsx
import { PangoFontsetSimple } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [PangoFontset](.gtkx/reference/pango/fontset.md) → **PangoFontsetSimple**

## Props

`ref` receives the `Pango.FontsetSimple` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.FontsetSimple` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(font: Pango.Font): void
```

Adds a font to the fontset.

The fontset takes ownership of `font`.

**Parameters**

- `font`: a `PangoFont`.

### `size`

```ts
size(): number
```

Returns the number of fonts in the fontset.

**Returns** the size of `fontset`
