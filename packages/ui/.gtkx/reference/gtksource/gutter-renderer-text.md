---
description: "Renders text in the gutter."
---

# GtkSourceGutterRendererText

Renders text in the gutter.

A `GtkSourceGutterRendererText` can be used to render text in a cell of
`Gutter`.

```tsx
import { GtkSourceGutterRendererText } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkSourceGutterRenderer](.gtkx/reference/gtksource/gutter-renderer.md) → **GtkSourceGutterRendererText**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.GutterRendererText` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `markup`

`string` · default `null`

### `text`

`string` · default `null`

## Methods

Methods are called on the `GtkSource.GutterRendererText` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `gutterRendererTextMeasure`

```ts
gutterRendererTextMeasure(text: string): [number, number]
```

Measures the text provided using the pango layout used by the
`GtkSourceGutterRendererText`.

**Parameters**

- `text`: the text to measure.

**Returns** Tuple of:

- `width`: location to store the width of the text in pixels, or `null`.
- `height`: location to store the height of the text in pixels, or `null`.

### `measureMarkup`

```ts
measureMarkup(markup: string): [number, number]
```

Measures the pango markup provided using the pango layout used by the
`GtkSourceGutterRendererText`.

**Parameters**

- `markup`: the pango markup to measure.

**Returns** Tuple of:

- `width`: location to store the width of the text in pixels, or `null`.
- `height`: location to store the height of the text in pixels, or `null`.

### `setMarkup`

```ts
setMarkup(markup: string, length: number): void
```

### `setText`

```ts
setText(text: string, length: number): void
```
