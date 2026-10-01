---
description: "Represents a style."
---

# GtkSourceStyle

Represents a style.

The `GtkSourceStyle` structure is used to describe text attributes
which are set when given style is used.

```tsx
import { GtkSourceStyle } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceStyle**

## Props

`ref` receives the `GtkSource.Style` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `background`

`string` · default `null` · construct-only

### `backgroundSet`

`boolean` · default `false` · construct-only

### `bold`

`boolean` · default `false` · construct-only

### `boldSet`

`boolean` · default `false` · construct-only

### `foreground`

`string` · default `null` · construct-only

### `foregroundSet`

`boolean` · default `false` · construct-only

### `italic`

`boolean` · default `false` · construct-only

### `italicSet`

`boolean` · default `false` · construct-only

### `lineBackground`

`string` · default `null` · construct-only

### `lineBackgroundSet`

`boolean` · default `false` · construct-only

### `pangoUnderline`

`Pango.Underline` · default `PANGO_UNDERLINE_NONE` · construct-only

### `scale`

`string` · default `null` · construct-only

### `scaleSet`

`boolean` · default `false` · construct-only

### `strikethrough`

`boolean` · default `false` · construct-only

### `strikethroughSet`

`boolean` · default `false` · construct-only

### `underlineColor`

`string` · default `null` · construct-only

### `underlineColorSet`

`boolean` · default `false` · construct-only

### `underlineSet`

`boolean` · default `false` · construct-only

### `weight`

`Pango.Weight` · default `PANGO_WEIGHT_NORMAL` · construct-only

### `weightSet`

`boolean` · default `false` · construct-only

## Methods

Methods are called on the `GtkSource.Style` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `apply`

```ts
apply(tag: Gtk.TextTag): void
```

This function modifies the `Gtk.TextTag` properties that are related to the
`GtkSourceStyle` properties. Other `Gtk.TextTag` properties are left untouched.

If `style` is non-`null`, applies `style` to `tag`.

If `style` is `null`, the related *-set properties of `Gtk.TextTag` are set to
`false`.

**Parameters**

- `tag`: a `GtkTextTag` to apply styles to.

### `copy`

```ts
copy(): GtkSource.Style
```

Creates a copy of `style`, that is a new `GtkSourceStyle` instance which
has the same attributes set.

**Returns** copy of `style`, call `g_object_unref()`
when you are done with it.
