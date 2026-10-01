---
description: "Encapsulates context information that is required when drawing pages for printing."
---

# GtkPrintContext

Encapsulates context information that is required when
drawing pages for printing.

This includes the cairo context and important parameters like page size
and resolution. It also lets you easily create `Pango.Layout` and
`Pango.Context` objects that match the font metrics of the cairo surface.

`GtkPrintContext` objects get passed to the
`Gtk.PrintOperation.begin-print`,
`Gtk.PrintOperation.end-print`,
`Gtk.PrintOperation.request-page-setup` and
`Gtk.PrintOperation.draw-page` signals on the
`Gtk.PrintOperation` object.

### Using GtkPrintContext in a ::draw-page callback

```c
static void
draw_page (GtkPrintOperation *operation,
           GtkPrintContext   *context,
           int                page_nr)
{
  cairo_t *cr;
  PangoLayout *layout;
  PangoFontDescription *desc;

  cr = gtk_print_context_get_cairo_context (context);

  // Draw a red rectangle, as wide as the paper (inside the margins)
  cairo_set_source_rgb (cr, 1.0, 0, 0);
  cairo_rectangle (cr, 0, 0, gtk_print_context_get_width (context), 50);

  cairo_fill (cr);

  // Draw some lines
  cairo_move_to (cr, 20, 10);
  cairo_line_to (cr, 40, 20);
  cairo_arc (cr, 60, 60, 20, 0, M_PI);
  cairo_line_to (cr, 80, 20);

  cairo_set_source_rgb (cr, 0, 0, 0);
  cairo_set_line_width (cr, 5);
  cairo_set_line_cap (cr, CAIRO_LINE_CAP_ROUND);
  cairo_set_line_join (cr, CAIRO_LINE_JOIN_ROUND);

  cairo_stroke (cr);

  // Draw some text
  layout = gtk_print_context_create_pango_layout (context);
  pango_layout_set_text (layout, "Hello World! Printing is easy", -1);
  desc = pango_font_description_from_string ("sans 28");
  pango_layout_set_font_description (layout, desc);
  pango_font_description_free (desc);

  cairo_move_to (cr, 30, 20);
  pango_cairo_layout_path (cr, layout);

  // Font Outline
  cairo_set_source_rgb (cr, 0.93, 1.0, 0.47);
  cairo_set_line_width (cr, 0.5);
  cairo_stroke_preserve (cr);

  // Font Fill
  cairo_set_source_rgb (cr, 0, 0.0, 1.0);
  cairo_fill (cr);

  g_object_unref (layout);
}
```

```tsx
import { GtkPrintContext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrintContext**

## Props

`ref` receives the `Gtk.PrintContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.PrintContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `createPangoContext`

```ts
createPangoContext(): Pango.Context
```

Creates a new `PangoContext` that can be used with the
`GtkPrintContext`.

**Returns** a new Pango context for `context`

### `createPangoLayout`

```ts
createPangoLayout(): Pango.Layout
```

Creates a new `PangoLayout` that is suitable for use
with the `GtkPrintContext`.

**Returns** a new Pango layout for `context`

### `getCairoContext`

```ts
getCairoContext(): cairo.Context
```

Obtains the cairo context that is associated with the
`GtkPrintContext`.

**Returns** the cairo context of `context`

### `getDpiX`

```ts
getDpiX(): number
```

Obtains the horizontal resolution of the `GtkPrintContext`,
in dots per inch.

**Returns** the horizontal resolution of `context`

### `getDpiY`

```ts
getDpiY(): number
```

Obtains the vertical resolution of the `GtkPrintContext`,
in dots per inch.

**Returns** the vertical resolution of `context`

### `getHardMargins`

```ts
getHardMargins(): [boolean, number, number, number, number]
```

Obtains the hardware printer margins of the `GtkPrintContext`,
in units.

**Returns** Tuple of:

- `result`: `true` if the hard margins were retrieved
- `top`: top hardware printer margin
- `bottom`: bottom hardware printer margin
- `left`: left hardware printer margin
- `right`: right hardware printer margin

### `getHeight`

```ts
getHeight(): number
```

Obtains the height of the `GtkPrintContext`, in pixels.

**Returns** the height of `context`

### `getPageSetup`

```ts
getPageSetup(): Gtk.PageSetup
```

Obtains the `GtkPageSetup` that determines the page
dimensions of the `GtkPrintContext`.

**Returns** the page setup of `context`

### `getPangoFontmap`

```ts
getPangoFontmap(): Pango.FontMap
```

Returns a `PangoFontMap` that is suitable for use
with the `GtkPrintContext`.

**Returns** the font map of `context`

### `getWidth`

```ts
getWidth(): number
```

Obtains the width of the `GtkPrintContext`, in pixels.

**Returns** the width of `context`

### `setCairoContext`

```ts
setCairoContext(cr: cairo.Context, dpiX: number, dpiY: number): void
```

Sets a new cairo context on a print context.

This function is intended to be used when implementing
an internal print preview, it is not needed for printing,
since GTK itself creates a suitable cairo context in that
case.

**Parameters**

- `cr`: the cairo context
- `dpiX`: the horizontal resolution to use with `cr`
- `dpiY`: the vertical resolution to use with `cr`
