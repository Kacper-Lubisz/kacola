---
description: "Allows drawing with cairo."
---

# GtkDrawingArea

Allows drawing with cairo.



It’s essentially a blank widget; you can draw on it. After
creating a drawing area, the application may want to connect to:

- The `Gtk.Widget.realize` signal to take any necessary actions
  when the widget is instantiated on a particular display.
  (Create GDK resources in response to this signal.)

- The `Gtk.DrawingArea.resize` signal to take any necessary
  actions when the widget changes size.

- Call `Gtk.DrawingArea.setDrawFunc()` to handle redrawing the
  contents of the widget.

The following code portion demonstrates using a drawing
area to display a circle in the normal widget foreground
color.

### Simple GtkDrawingArea usage

```c
static void
draw_function (GtkDrawingArea *area,
               cairo_t        *cr,
               int             width,
               int             height,
               gpointer        data)
{
  GdkRGBA color;

  cairo_arc (cr,
             width / 2.0, height / 2.0,
             MIN (width, height) / 2.0,
             0, 2 * G_PI);

  gtk_widget_get_color (GTK_WIDGET (area),
                        &color);
  gdk_cairo_set_source_rgba (cr, &color);

  cairo_fill (cr);
}

int
main (int argc, char **argv)
{
  gtk_init ();

  GtkWidget *area = gtk_drawing_area_new ();
  gtk_drawing_area_set_content_width (GTK_DRAWING_AREA (area), 100);
  gtk_drawing_area_set_content_height (GTK_DRAWING_AREA (area), 100);
  gtk_drawing_area_set_draw_func (GTK_DRAWING_AREA (area),
                                  draw_function,
                                  NULL, NULL);
  return 0;
}
```

The draw function is normally called when a drawing area first comes
onscreen, or when it’s covered by another window and then uncovered.
You can also force a redraw by adding to the “damage region” of the
drawing area’s window using `Gtk.Widget.queueDraw()`.
This will cause the drawing area to call the draw function again.

The available routines for drawing are documented in the
[Cairo documentation](https://www.cairographics.org/manual/); GDK
offers additional API to integrate with Cairo, like `Gdk.cairoSetSourceRgba()`
or `Gdk.cairoSetSourcePixbuf()`.

To receive mouse events on a drawing area, you will need to use
event controllers. To receive keyboard events, you will need to set
the “can-focus” property on the drawing area, and you should probably
draw some user-visible indication that the drawing area is focused.

If you need more complex control over your widget, you should consider
creating your own `GtkWidget` subclass.

```tsx
import { GtkDrawingArea } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkDrawingArea**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.DrawingArea` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `contentHeight`

`number` · default `0`

The content height.

### `contentWidth`

`number` · default `0`

The content width.

### `drawFunc`

`Gtk.DrawingAreaDrawFunc | null`

Callback that draws the area's contents; setting it queues a redraw.

## Signals

### `onResize`

```ts
(width: number, height: number, self: Gtk.DrawingArea) => void
```

Emitted once when the widget is realized, and then each time the widget
is changed while realized.

This is useful in order to keep state up to date with the widget size,
like for instance a backing surface.

**Parameters**

- `width`: the width of the viewport
- `height`: the height of the viewport
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.DrawingArea` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getContentHeight`

```ts
getContentHeight(): number
```

Retrieves the content height of the `GtkDrawingArea`.

**Returns** The height requested for content of the drawing area

### `getContentWidth`

```ts
getContentWidth(): number
```

Retrieves the content width of the `GtkDrawingArea`.

**Returns** The width requested for content of the drawing area

### `setContentHeight`

```ts
setContentHeight(height: number): void
```

Sets the desired height of the contents of the drawing area.

Note that because widgets may be allocated larger sizes than they
requested, it is possible that the actual height passed to your draw
function is larger than the height set here. You can use
`Gtk.Widget.setValign()` to avoid that.

If the height is set to 0 (the default), the drawing area may disappear.

**Parameters**

- `height`: the height of contents

### `setContentWidth`

```ts
setContentWidth(width: number): void
```

Sets the desired width of the contents of the drawing area.

Note that because widgets may be allocated larger sizes than they
requested, it is possible that the actual width passed to your draw
function is larger than the width set here. You can use
`Gtk.Widget.setHalign()` to avoid that.

If the width is set to 0 (the default), the drawing area may disappear.

**Parameters**

- `width`: the width of contents

### `setDrawFunc`

```ts
setDrawFunc(drawFunc: Gtk.DrawingAreaDrawFunc | null): void
```

Setting a draw function is the main thing you want to do when using
a drawing area.

The draw function is called whenever GTK needs to draw the contents
of the drawing area to the screen.

The draw function will be called during the drawing stage of GTK.
In the drawing stage it is not allowed to change properties of any
GTK widgets or call any functions that would cause any properties
to be changed. You should restrict yourself exclusively to drawing
your contents in the draw function.

If what you are drawing does change, call `Gtk.Widget.queueDraw()`
on the drawing area. This will cause a redraw and will call `draw_func` again.

**Parameters**

- `drawFunc`: callback that lets you draw the drawing area's contents
