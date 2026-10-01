---
description: "PangoRenderer is a base class for objects that can render text provided as PangoGlyphString or PangoLayout."
---

# PangoRenderer

`PangoRenderer` is a base class for objects that can render text
provided as `PangoGlyphString` or `PangoLayout`.

By subclassing `PangoRenderer` and overriding operations such as
`draw_glyphs` and `draw_rectangle`, renderers for particular font
backends and destinations can be created.

_Available since 1.8._

```tsx
import { PangoRenderer } from "@gtkx/jsx/pango";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **PangoRenderer**

## Props

`ref` receives the `Pango.Renderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Pango.Renderer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/pango`. Methods inherited from ancestors are documented on their own pages.

### `activate`

```ts
activate(): void
```

Does initial setup before rendering operations on `renderer`.

`Pango.Renderer.deactivate()` should be called when done drawing.
Calls such as `Pango.Renderer.drawLayout()` automatically
activate the layout before drawing on it.

Calls to `Pango.Renderer.activate()` and
`Pango.Renderer.deactivate()` can be nested and the
renderer will only be initialized and deinitialized once.

_Available since 1.8._

### `deactivate`

```ts
deactivate(): void
```

Cleans up after rendering operations on `renderer`.

See docs for `Pango.Renderer.activate()`.

_Available since 1.8._

### `drawErrorUnderline`

```ts
drawErrorUnderline(x: number, y: number, width: number, height: number): void
```

Draw a squiggly line that approximately covers the given rectangle
in the style of an underline used to indicate a spelling error.

The width of the underline is rounded to an integer number
of up/down segments and the resulting rectangle is centered
in the original rectangle.

This should be called while `renderer` is already active.
Use `Pango.Renderer.activate()` to activate a renderer.

**Parameters**

- `x`: X coordinate of underline, in Pango units in user coordinate system
- `y`: Y coordinate of underline, in Pango units in user coordinate system
- `width`: width of underline, in Pango units in user coordinate system
- `height`: height of underline, in Pango units in user coordinate system

_Available since 1.8._

### `drawGlyph`

```ts
drawGlyph(font: Pango.Font, glyph: Pango.Glyph, x: number, y: number): void
```

Draws a single glyph with coordinates in device space.

**Parameters**

- `font`: a `PangoFont`
- `glyph`: the glyph index of a single glyph
- `x`: X coordinate of left edge of baseline of glyph
- `y`: Y coordinate of left edge of baseline of glyph

_Available since 1.8._

### `drawGlyphItem`

```ts
drawGlyphItem(text: string | null, glyphItem: Pango.GlyphItem, x: number, y: number): void
```

Draws the glyphs in `glyph_item` with the specified `PangoRenderer`,
embedding the text associated with the glyphs in the output if the
output format supports it.

This is useful for rendering text in PDF.

Note that this method does not handle attributes in `glyph_item`.
If you want colors, shapes and lines handled automatically according
to those attributes, you need to use `pango_renderer_draw_layout_line()`
or `pango_renderer_draw_layout()`.

Note that `text` is the start of the text for layout, which is then
indexed by `glyph_item->item->offset`.

If `text` is `null`, this simply calls `Pango.Renderer.drawGlyphs()`.

The default implementation of this method simply falls back to
`Pango.Renderer.drawGlyphs()`.

**Parameters**

- `text`: the UTF-8 text that `glyph_item` refers to
- `glyphItem`: a `PangoGlyphItem`
- `x`: X position of left edge of baseline, in user space coordinates in Pango units
- `y`: Y position of left edge of baseline, in user space coordinates in Pango units

_Available since 1.22._

### `drawGlyphs`

```ts
drawGlyphs(font: Pango.Font, glyphs: Pango.GlyphString, x: number, y: number): void
```

Draws the glyphs in `glyphs` with the specified `PangoRenderer`.

**Parameters**

- `font`: a `PangoFont`
- `glyphs`: a `PangoGlyphString`
- `x`: X position of left edge of baseline, in user space coordinates in Pango units.
- `y`: Y position of left edge of baseline, in user space coordinates in Pango units.

_Available since 1.8._

### `drawLayout`

```ts
drawLayout(layout: Pango.Layout, x: number, y: number): void
```

Draws `layout` with the specified `PangoRenderer`.

This is equivalent to drawing the lines of the layout, at their
respective positions relative to `x`, `y`.

**Parameters**

- `layout`: a `PangoLayout`
- `x`: X position of left edge of baseline, in user space coordinates in Pango units.
- `y`: Y position of left edge of baseline, in user space coordinates in Pango units.

_Available since 1.8._

### `drawLayoutLine`

```ts
drawLayoutLine(line: Pango.LayoutLine, x: number, y: number): void
```

Draws `line` with the specified `PangoRenderer`.

This draws the glyph items that make up the line, as well as
shapes, backgrounds and lines that are specified by the attributes
of those items.

**Parameters**

- `line`: a `PangoLayoutLine`
- `x`: X position of left edge of baseline, in user space coordinates in Pango units.
- `y`: Y position of left edge of baseline, in user space coordinates in Pango units.

_Available since 1.8._

### `drawRectangle`

```ts
drawRectangle(part: Pango.RenderPart, x: number, y: number, width: number, height: number): void
```

Draws an axis-aligned rectangle in user space coordinates with the
specified `PangoRenderer`.

This should be called while `renderer` is already active.
Use `Pango.Renderer.activate()` to activate a renderer.

**Parameters**

- `part`: type of object this rectangle is part of
- `x`: X position at which to draw rectangle, in user space coordinates in Pango units
- `y`: Y position at which to draw rectangle, in user space coordinates in Pango units
- `width`: width of rectangle in Pango units
- `height`: height of rectangle in Pango units

_Available since 1.8._

### `drawTrapezoid`

```ts
drawTrapezoid(part: Pango.RenderPart, y1: number, x11: number, x21: number, y2: number, x12: number, x22: number): void
```

Draws a trapezoid with the parallel sides aligned with the X axis
using the given `PangoRenderer`; coordinates are in device space.

**Parameters**

- `part`: type of object this trapezoid is part of
- `y1`: Y coordinate of top of trapezoid
- `x11`: X coordinate of left end of top of trapezoid
- `x21`: X coordinate of right end of top of trapezoid
- `y2`: Y coordinate of bottom of trapezoid
- `x12`: X coordinate of left end of bottom of trapezoid
- `x22`: X coordinate of right end of bottom of trapezoid

_Available since 1.8._

### `getAlpha`

```ts
getAlpha(part: Pango.RenderPart): number
```

Gets the current alpha for the specified part.

**Parameters**

- `part`: the part to get the alpha for

**Returns** the alpha for the specified part,
  or 0 if it hasn't been set and should be
  inherited from the environment.

_Available since 1.38._

### `getColor`

```ts
getColor(part: Pango.RenderPart): Pango.Color | null
```

Gets the current rendering color for the specified part.

**Parameters**

- `part`: the part to get the color for

**Returns** the color for the
  specified part, or `null` if it hasn't been set and should be
  inherited from the environment.

_Available since 1.8._

### `getLayout`

```ts
getLayout(): Pango.Layout | null
```

Gets the layout currently being rendered using `renderer`.

Calling this function only makes sense from inside a subclass's
methods, like in its draw_shape vfunc, for example.

The returned layout should not be modified while still being
rendered.

**Returns** the layout, or `null` if
  no layout is being rendered using `renderer` at this time.

_Available since 1.20._

### `getLayoutLine`

```ts
getLayoutLine(): Pango.LayoutLine | null
```

Gets the layout line currently being rendered using `renderer`.

Calling this function only makes sense from inside a subclass's
methods, like in its draw_shape vfunc, for example.

The returned layout line should not be modified while still being
rendered.

**Returns** the layout line, or `null`
  if no layout line is being rendered using `renderer` at this time.

_Available since 1.20._

### `getMatrix`

```ts
getMatrix(): Pango.Matrix | null
```

Gets the transformation matrix that will be applied when
rendering.

See `Pango.Renderer.setMatrix()`.

**Returns** the matrix, or `null` if no matrix has
  been set (which is the same as the identity matrix). The returned
  matrix is owned by Pango and must not be modified or freed.

_Available since 1.8._

### `partChanged`

```ts
partChanged(part: Pango.RenderPart): void
```

Informs Pango that the way that the rendering is done
for `part` has changed.

This should be called if the rendering changes in a way that would
prevent multiple pieces being joined together into one drawing call.
For instance, if a subclass of `PangoRenderer` was to add a stipple
option for drawing underlines, it needs to call

```
pango_renderer_part_changed (render, PANGO_RENDER_PART_UNDERLINE);
```

When the stipple changes or underlines with different stipples
might be joined together. Pango automatically calls this for
changes to colors. (See `Pango.Renderer.setColor()`)

**Parameters**

- `part`: the part for which rendering has changed.

_Available since 1.8._

### `setAlpha`

```ts
setAlpha(part: Pango.RenderPart, alpha: number): void
```

Sets the alpha for part of the rendering.

Note that the alpha may only be used if a color is
specified for `part` as well.

**Parameters**

- `part`: the part to set the alpha for
- `alpha`: an alpha value between 1 and 65536, or 0 to unset the alpha

_Available since 1.38._

### `setColor`

```ts
setColor(part: Pango.RenderPart, color: Pango.Color | null): void
```

Sets the color for part of the rendering.

Also see `Pango.Renderer.setAlpha()`.

**Parameters**

- `part`: the part to change the color of
- `color`: the new color or `null` to unset the current color

_Available since 1.8._

### `setMatrix`

```ts
setMatrix(matrix: Pango.Matrix | null): void
```

Sets the transformation matrix that will be applied when rendering.

**Parameters**

- `matrix`: a `PangoMatrix`, or `null` to unset any existing matrix (No matrix set is the same as setting the identity matrix.)

_Available since 1.8._
