---
description: "Shows text in a predefined area."
---

# GtkInscription

Shows text in a predefined area.

You likely want to use `GtkLabel` instead as this widget is intended only
for a small subset of use cases. The main scenario envisaged is inside lists
such as `GtkColumnView`.

While a `GtkLabel` sizes itself depending on the text that is displayed,
`GtkInscription` is given a size and inscribes the given text into that
space as well as it can.

Users of this widget should take care to plan behaviour for the common case
where the text doesn't fit exactly in the allocated space.

### CSS nodes

`GtkInscription` has a single CSS node with the name label.

_Available since 4.8._

```tsx
import { GtkInscription } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkInscription**

Implements `GtkAccessible`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Inscription` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `attributes`

`Pango.AttrList`

A list of style attributes to apply to the text of the inscription.

_Available since 4.8._

### `markup`

`string` · default `null`

Utility property that sets both the `Gtk.Inscription.text` and
`Gtk.Inscription.attributes` properties, mainly intended for use in
GtkBuilder ui files to ease translation support and bindings.

This function uses `Pango.parseMarkup()` to parse the markup into text and
attributes. The markup must be valid. If you cannot ensure that, consider using
`Pango.parseMarkup()` and setting the two properties yourself.

_Available since 4.8._

### `minChars`

`number` · default `3`

The number of characters that should fit into the inscription at minimum.

This influences the requested width, not the width actually given to the widget,
which might turn out to be larger.

Note that this is an approximate character width, so some characters might be
wider and some might be thinner, so do not expect the number of characters to
exactly match.

If you set this property to 0, the inscription will not request any width at all
and its width will be determined entirely by its surroundings.

_Available since 4.8._

### `minLines`

`number` · default `1`

The number of lines that should fit into the inscription at minimum.

This influences the requested height, not the height actually given to the widget,
which might turn out to be larger.

Note that this is an approximate line height, so if the text uses things like fancy
Unicode or attribute that influence the height, the text might not fit.

If you set this property to 0, the inscription will not request any height at all
and its height will be determined entirely by its surroundings.

_Available since 4.8._

### `natChars`

`number` · default `0`

The number of characters that should ideally fit into the inscription.

This influences the requested width, not the width actually given to the widget.
The widget might turn out larger as well as smaller.

If this property is set to a value smaller than `Gtk.Inscription.minChars`,
that value will be used. In particular, for the default value of 0, this will always
be the case.

_Available since 4.8._

### `natLines`

`number` · default `0`

The number of lines that should ideally fit into the inscription.

This influences the requested height, not the height actually given to the widget.
The widget might turn out larger as well as smaller.

If this property is set to a value smaller than `Gtk.Inscription.minLines`,
that value will be used. In particular, for the default value of 0, this will always
be the case.

_Available since 4.8._

### `text`

`string` · default `null`

The displayed text.

_Available since 4.8._

### `textOverflow`

`Gtk.InscriptionOverflow` · default `GTK_INSCRIPTION_OVERFLOW_CLIP`

The overflow method to use for the text.

_Available since 4.8._

### `wrapMode`

`Pango.WrapMode` · default `PANGO_WRAP_WORD_CHAR`

Controls how the line wrapping is done.

Note that unlike `GtkLabel`, the default here is `PANGO_WRAP_WORD_CHAR`.

_Available since 4.8._

### `xalign`

`number` · default `0.000000`

The horizontal alignment of the text inside the allocated size.

Compare this to `Gtk.Widget.halign`, which determines how the
inscription's size allocation is positioned in the available space.

_Available since 4.8._

### `yalign`

`number` · default `0.500000`

The vertical alignment of the text inside the allocated size.

Compare this to `Gtk.Widget.valign`, which determines how the
inscription's size allocation is positioned in the available space.

_Available since 4.8._

## Methods

Methods are called on the `Gtk.Inscription` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAttributes`

```ts
getAttributes(): Pango.AttrList | null
```

Gets the inscription's attribute list.

**Returns** the attribute list

_Available since 4.8._

### `getMinChars`

```ts
getMinChars(): number
```

Gets the `min-chars` of the inscription.

See the `Gtk.Inscription.minChars` property.

**Returns** the min-chars property

_Available since 4.8._

### `getMinLines`

```ts
getMinLines(): number
```

Gets the `min-lines` of the inscription.

See the `Gtk.Inscription.minLines` property.

**Returns** the min-lines property

_Available since 4.8._

### `getNatChars`

```ts
getNatChars(): number
```

Gets the `nat-chars` of the inscription.

See the `Gtk.Inscription.natChars` property.

**Returns** the nat-chars property

_Available since 4.8._

### `getNatLines`

```ts
getNatLines(): number
```

Gets the `nat-lines` of the inscription.

See the `Gtk.Inscription.natLines` property.

**Returns** the nat-lines property

_Available since 4.8._

### `getText`

```ts
getText(): string | null
```

Gets the text that is displayed.

**Returns** The displayed text

_Available since 4.8._

### `getTextOverflow`

```ts
getTextOverflow(): Gtk.InscriptionOverflow
```

Gets the inscription's overflow method.

**Returns** the overflow method

_Available since 4.8._

### `getWrapMode`

```ts
getWrapMode(): Pango.WrapMode
```

Returns line wrap mode used by the inscription.

See `Gtk.Inscription.setWrapMode()`.

**Returns** the line wrap mode

_Available since 4.8._

### `getXalign`

```ts
getXalign(): number
```

Gets the `xalign` of the inscription.

See the `Gtk.Inscription.xalign` property.

**Returns** the xalign property

_Available since 4.8._

### `getYalign`

```ts
getYalign(): number
```

Gets the `yalign` of the inscription.

See the `Gtk.Inscription.yalign` property.

**Returns** the yalign property

_Available since 4.8._

### `setAttributes`

```ts
setAttributes(attrs: Pango.AttrList | null): void
```

Apply attributes to the inscription text.

These attributes will not be evaluated for sizing the inscription.

**Parameters**

- `attrs`: a `Pango.AttrList`

_Available since 4.8._

### `setMarkup`

```ts
setMarkup(markup: string | null): void
```

Utility function to set the text and attributes to be displayed.

See the `Gtk.Inscription.markup` property.

**Parameters**

- `markup`: The markup to display

_Available since 4.8._

### `setMinChars`

```ts
setMinChars(minChars: number): void
```

Sets the `min-chars` of the inscription.

See the `Gtk.Inscription.minChars` property.

**Parameters**

- `minChars`: the minimum number of characters that should fit, approximately

_Available since 4.8._

### `setMinLines`

```ts
setMinLines(minLines: number): void
```

Sets the `min-lines` of the inscription.

See the `Gtk.Inscription.minLines` property.

**Parameters**

- `minLines`: the minimum number of lines that should fit, approximately

_Available since 4.8._

### `setNatChars`

```ts
setNatChars(natChars: number): void
```

Sets the `nat-chars` of the inscription.

See the `Gtk.Inscription.natChars` property.

**Parameters**

- `natChars`: the number of characters that should ideally fit, approximately

_Available since 4.8._

### `setNatLines`

```ts
setNatLines(natLines: number): void
```

Sets the `nat-lines` of the inscription.

See the `Gtk.Inscription.natLines` property.

**Parameters**

- `natLines`: the number of lines that should ideally fit

_Available since 4.8._

### `setText`

```ts
setText(text: string | null): void
```

Sets the text to be displayed.

**Parameters**

- `text`: The text to display

_Available since 4.8._

### `setTextOverflow`

```ts
setTextOverflow(overflow: Gtk.InscriptionOverflow): void
```

Sets what to do when the text doesn't fit.

**Parameters**

- `overflow`: the overflow method to use

_Available since 4.8._

### `setWrapMode`

```ts
setWrapMode(wrapMode: Pango.WrapMode): void
```

Controls how line wrapping is done.

**Parameters**

- `wrapMode`: the line wrapping mode

_Available since 4.8._

### `setXalign`

```ts
setXalign(xalign: number): void
```

Sets the `xalign` of the inscription.

See the `Gtk.Inscription.xalign` property.

**Parameters**

- `xalign`: the new xalign value, between 0 and 1

_Available since 4.8._

### `setYalign`

```ts
setYalign(yalign: number): void
```

Sets the `yalign` of the inscription.

See the `Gtk.Inscription.yalign` property.

**Parameters**

- `yalign`: the new yalign value, between 0 and 1

_Available since 4.8._
