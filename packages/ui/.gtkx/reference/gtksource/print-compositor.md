---
description: "Compose a Buffer for printing."
---

# GtkSourcePrintCompositor

Compose a `Buffer` for printing.

The `GtkSourcePrintCompositor` object is used to compose a `Buffer`
for printing. You can set various configuration options to customize the
printed output. `GtkSourcePrintCompositor` is designed to be used with the
high-level printing API of gtk+, i.e. `Gtk.PrintOperation`.

The margins specified in this object are the layout margins: they define the
blank space bordering the printed area of the pages. They must not be
confused with the "print margins", i.e. the parts of the page that the
printer cannot print on, defined in the `Gtk.PageSetup` objects. If the
specified layout margins are smaller than the "print margins", the latter
ones are used as a fallback by the `GtkSourcePrintCompositor` object, so that
the printed area is not clipped.

```tsx
import { GtkSourcePrintCompositor } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourcePrintCompositor**

## Props

`ref` receives the `GtkSource.PrintCompositor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bodyFontName`

`string` · default `null`

Name of the font used for the text body.

Accepted values are strings representing a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `buffer`

`GtkSource.Buffer` · construct-only

The `Buffer` object to print.

### `footerFontName`

`string` · default `null`

Name of the font used to print page footer.
If this property is unspecified, the text body font is used.

Accepted values are strings representing a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `headerFontName`

`string` · default `null`

Name of the font used to print page header.
If this property is unspecified, the text body font is used.

Accepted values are strings representing a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `highlightSyntax`

`boolean` · default `true`

Whether to print the document with highlighted syntax.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `lineNumbersFontName`

`string` · default `null`

Name of the font used to print line numbers on the left margin.
If this property is unspecified, the text body font is used.

Accepted values are strings representing a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `nPages`

`number` · default `-1` · read-only, observe with `onNotifyNPages`

The number of pages in the document or <code>-1</code> if the
document has not been completely paginated.

### `printFooter`

`boolean` · default `false`

Whether to print a footer in each page.

Note that by default the footer format is unspecified, and if it is
unspecified the footer will not be printed, regardless of the value of
this property.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `printHeader`

`boolean` · default `false`

Whether to print a header in each page.

Note that by default the header format is unspecified, and if it is
unspecified the header will not be printed, regardless of the value of
this property.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `printLineNumbers`

`number` · default `1`

Interval of printed line numbers.

If this property is set to 0 no numbers will be printed.
If greater than 0, a number will be printed every "print-line-numbers"
lines (i.e. 1 will print all line numbers).

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `tabWidth`

`number` · default `8`

Width of a tab character expressed in spaces.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

### `wrapMode`

`Gtk.WrapMode` · default `GTK_WRAP_NONE`

Whether to wrap lines never, at word boundaries, or at character boundaries.

The value of this property cannot be changed anymore after the first
call to the `PrintCompositor.paginate()` function.

## Methods

Methods are called on the `GtkSource.PrintCompositor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `drawPage`

```ts
drawPage(context: Gtk.PrintContext, pageNr: number): void
```

Draw page `page_nr` for printing on the the Cairo context encapsuled in `context`.

This method has been designed to be called in the handler of the `Gtk.PrintOperation.draw_page` signal
as shown in the following example:

```c
// Signal handler for the GtkPrintOperation::draw_page signal

static void
draw_page (GtkPrintOperation *operation,
           GtkPrintContext   *context,
           gint               page_nr,
           gpointer           user_data)
{
    GtkSourcePrintCompositor *compositor;

    compositor = GTK_SOURCE_PRINT_COMPOSITOR (user_data);

    gtk_source_print_compositor_draw_page (compositor,
                                           context,
                                           page_nr);
}
```
```python
def on_draw_page(
    operation: Gtk.PrintOperation,
    context: Gtk.PrintContext,
    page_nr: int,
    compositor: GtkSource.PrintCompositor,
) -> None:
    """Signal handler for draw-page that renders a single page."""
    compositor.draw_page(context=context, page_nr=page_nr)
```

**Parameters**

- `context`: the `GtkPrintContext` encapsulating the context information that is required when drawing the page for printing.
- `pageNr`: the number of the page to print.

### `getBodyFontName`

```ts
getBodyFontName(): string
```

Returns the name of the font used to print the text body.

The returned string must be freed with `g_free()`.

**Returns** a new string containing the name of the font used to print the
text body.

### `getBottomMargin`

```ts
getBottomMargin(unit: Gtk.Unit): number
```

Gets the bottom margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value.

**Returns** the bottom margin.

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

Gets the `Buffer` associated with the compositor.

The returned object reference is owned by the compositor object and
should not be unreferenced.

**Returns** the `GtkSourceBuffer` associated with the compositor.

### `getFooterFontName`

```ts
getFooterFontName(): string
```

Returns the name of the font used to print the page footer.

The returned string must be freed with `g_free()`.

**Returns** a new string containing the name of the font used to print
the page footer.

### `getHeaderFontName`

```ts
getHeaderFontName(): string
```

Returns the name of the font used to print the page header.

The returned string must be freed with `g_free()`.

**Returns** a new string containing the name of the font used to print
the page header.

### `getHighlightSyntax`

```ts
getHighlightSyntax(): boolean
```

Determines whether the printed text will be highlighted according to the
buffer rules.

Note that highlighting will happen only if the buffer to print has highlighting activated.

**Returns** `true` if the printed output will be highlighted.

### `getLeftMargin`

```ts
getLeftMargin(unit: Gtk.Unit): number
```

Gets the left margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value.

**Returns** the left margin

### `getLineNumbersFontName`

```ts
getLineNumbersFontName(): string
```

Returns the name of the font used to print line numbers on the left margin.

The returned string must be freed with `g_free()`.

**Returns** a new string containing the name of the font used to print
line numbers on the left margin.

### `getNPages`

```ts
getNPages(): number
```

Returns the number of pages in the document or <code>-1</code> if the
document has not been completely paginated.

**Returns** the number of pages in the document or <code>-1</code> if the
document has not been completely paginated.

### `getPaginationProgress`

```ts
getPaginationProgress(): number
```

Returns the current fraction of the document pagination that has been completed.

**Returns** a fraction from 0.0 to 1.0 inclusive.

### `getPrintFooter`

```ts
getPrintFooter(): boolean
```

Determines if a footer is set to be printed for each page.

A footer will be printed if this function returns `true`
**and** some format strings have been specified
with `PrintCompositor.setFooterFormat()`.

**Returns** `true` if the footer is set to be printed.

### `getPrintHeader`

```ts
getPrintHeader(): boolean
```

Determines if a header is set to be printed for each page.

A header will be printed if this function returns `true`
**and** some format strings have been specified
with `PrintCompositor.setHeaderFormat()`.

**Returns** `true` if the header is set to be printed.

### `getPrintLineNumbers`

```ts
getPrintLineNumbers(): number
```

Returns the interval used for line number printing.

If the value is 0, no line numbers will be printed. The default value is
1 (i.e. numbers printed in all lines).

**Returns** the interval of printed line numbers.

### `getRightMargin`

```ts
getRightMargin(unit: Gtk.Unit): number
```

Gets the right margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value.

**Returns** the right margin.

### `getTabWidth`

```ts
getTabWidth(): number
```

Returns the width of tabulation in characters for printed text.

**Returns** width of tab.

### `getTopMargin`

```ts
getTopMargin(unit: Gtk.Unit): number
```

Gets the top margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value.

**Returns** the top margin.

### `getWrapMode`

```ts
getWrapMode(): Gtk.WrapMode
```

Gets the line wrapping mode for the printed text.

**Returns** the line wrap mode.

### `ignoreTag`

```ts
ignoreTag(tag: Gtk.TextTag): void
```

Specifies a tag whose style should be ignored when compositing the
document to the printable page.

**Parameters**

- `tag`: a `GtkTextTag`

_Available since 5.2._

### `paginate`

```ts
paginate(context: Gtk.PrintContext): boolean
```

Paginate the document associated with the `compositor`.

In order to support non-blocking pagination, document is paginated in small chunks.
Each time `PrintCompositor.paginate()` is invoked, a chunk of the document
is paginated. To paginate the entire document, `PrintCompositor.paginate()`
must be invoked multiple times.
It returns `true` if the document has been completely paginated, otherwise it returns `false`.

This method has been designed to be invoked in the handler of the `Gtk.PrintOperation.paginate` signal,
as shown in the following example:

```c
// Signal handler for the GtkPrintOperation::paginate signal

static gboolean
paginate (GtkPrintOperation *operation,
          GtkPrintContext   *context,
          gpointer           user_data)
{
    GtkSourcePrintCompositor *compositor;

    compositor = GTK_SOURCE_PRINT_COMPOSITOR (user_data);

    if (gtk_source_print_compositor_paginate (compositor, context))
    {
        gint n_pages;

        n_pages = gtk_source_print_compositor_get_n_pages (compositor);
        gtk_print_operation_set_n_pages (operation, n_pages);

        return TRUE;
    }

    return FALSE;
}
```
```python
def on_paginate(
    operation: Gtk.PrintOperation,
    context: Gtk.PrintContext,
    compositor: GtkSource.PrintCompositor,
) -> bool:
    if compositor.paginate(context=context):
        n_pages = compositor.get_n_pages()
        operation.set_n_pages(n_pages=n_pages)
        return True
    return False
```

If you don't need to do pagination in chunks, you can simply do it all in the
`Gtk.PrintOperation.begin-print` handler, and set the number of pages from there, like
in the following example:

```c
// Signal handler for the GtkPrintOperation::begin-print signal

static void
begin_print (GtkPrintOperation *operation,
             GtkPrintContext   *context,
             gpointer           user_data)
{
    GtkSourcePrintCompositor *compositor;
    gint n_pages;

    compositor = GTK_SOURCE_PRINT_COMPOSITOR (user_data);

    while (!gtk_source_print_compositor_paginate (compositor, context));

    n_pages = gtk_source_print_compositor_get_n_pages (compositor);
    gtk_print_operation_set_n_pages (operation, n_pages);
}
```
```python
def on_begin_print(
    operation: Gtk.PrintOperation,
    context: Gtk.PrintContext,
    compositor: GtkSource.PrintCompositor,
) -> None:
    # Paginate until complete
    while not compositor.paginate(context=context):
        pass

    n_pages = compositor.get_n_pages()
    operation.set_n_pages(n_pages=n_pages)
```

**Parameters**

- `context`: the `GtkPrintContext` whose parameters (e.g. paper size, print margins, etc.) are used by the the `compositor` to paginate the document.

**Returns** `true` if the document has been completely paginated, `false` otherwise.

### `setBodyFontName`

```ts
setBodyFontName(fontName: string): void
```

Sets the default font for the printed text.

`font_name` should be a
string representation of a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `fontName`: the name of the default font for the body text.

### `setBottomMargin`

```ts
setBottomMargin(margin: number, unit: Gtk.Unit): void
```

Sets the bottom margin used by `compositor`.

**Parameters**

- `margin`: the new bottom margin in units of `unit`.
- `unit`: the units for `margin`.

### `setFooterFontName`

```ts
setFooterFontName(fontName: string | null): void
```

Sets the font for printing the page footer.

If `null` is supplied, the default font (i.e. the one being used for the
text) will be used instead.

`font_name` should be a
string representation of a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `fontName`: the name of the font for the footer text, or `null`.

### `setFooterFormat`

```ts
setFooterFormat(separator: boolean, left: string | null, center: string | null, right: string | null): void
```

See `PrintCompositor.setHeaderFormat()` for more information
about the parameters.

**Parameters**

- `separator`: `true` if you want a separator line to be printed.
- `left`: a format string to print on the left of the footer.
- `center`: a format string to print on the center of the footer.
- `right`: a format string to print on the right of the footer.

### `setHeaderFontName`

```ts
setHeaderFontName(fontName: string | null): void
```

Sets the font for printing the page header.

If `null` is supplied, the default font (i.e. the one being used for the
text) will be used instead.

`font_name` should be a
string representation of a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `fontName`: the name of the font for header text, or `null`.

### `setHeaderFormat`

```ts
setHeaderFormat(separator: boolean, left: string | null, center: string | null, right: string | null): void
```

Sets strftime like header format strings, to be printed on the
left, center and right of the top of each page.

The strings may include strftime(3) codes which will be expanded at print time.
A subset of `strftime()` codes are accepted, see `GLib.DateTime.format()`
for more details on the accepted format specifiers.
Additionally the following format specifiers are accepted:

- `N`: the page number
- `Q`: the page count.

`separator` specifies if a solid line should be drawn to separate
the header from the document text.

If `null` is given for any of the three arguments, that particular
string will not be printed.

For the header to be printed, in
addition to specifying format strings, you need to enable header
printing with `PrintCompositor.setPrintHeader()`.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `separator`: `true` if you want a separator line to be printed.
- `left`: a format string to print on the left of the header.
- `center`: a format string to print on the center of the header.
- `right`: a format string to print on the right of the header.

### `setHighlightSyntax`

```ts
setHighlightSyntax(highlight: boolean): void
```

Sets whether the printed text will be highlighted according to the
buffer rules.  Both color and font style are applied.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `highlight`: whether syntax should be highlighted.

### `setLeftMargin`

```ts
setLeftMargin(margin: number, unit: Gtk.Unit): void
```

Sets the left margin used by `compositor`.

**Parameters**

- `margin`: the new left margin in units of `unit`.
- `unit`: the units for `margin`.

### `setLineNumbersFontName`

```ts
setLineNumbersFontName(fontName: string | null): void
```

Sets the font for printing line numbers on the left margin.

If `null` is supplied, the default font (i.e. the one being used for the
text) will be used instead.

`font_name` should be a
string representation of a font description Pango can understand.
(e.g. &quot;Monospace 10&quot;). See `Pango.FontDescription.fromString()`
for a description of the format of the string representation.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `fontName`: the name of the font for line numbers, or `null`.

### `setPrintFooter`

```ts
setPrintFooter(print: boolean): void
```

Sets whether you want to print a footer in each page.

The footer consists of three pieces of text and an optional line
separator, configurable with
`PrintCompositor.setFooterFormat()`.

Note that by default the footer format is unspecified, and if it's
empty it will not be printed, regardless of this setting.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `print`: `true` if you want the footer to be printed.

### `setPrintHeader`

```ts
setPrintHeader(print: boolean): void
```

Sets whether you want to print a header in each page.

The header consists of three pieces of text and an optional line
separator, configurable with `PrintCompositor.setHeaderFormat()`.

Note that by default the header format is unspecified, and if it's
empty it will not be printed, regardless of this setting.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `print`: `true` if you want the header to be printed.

### `setPrintLineNumbers`

```ts
setPrintLineNumbers(interval: number): void
```

Sets the interval for printed line numbers.

If `interval` is 0 no numbers will be printed. If greater than 0, a number will be
printed every `interval` lines (i.e. 1 will print all line numbers).

Maximum accepted value for `interval` is 100.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `interval`: interval for printed line numbers.

### `setRightMargin`

```ts
setRightMargin(margin: number, unit: Gtk.Unit): void
```

Sets the right margin used by `compositor`.

**Parameters**

- `margin`: the new right margin in units of `unit`.
- `unit`: the units for `margin`.

### `setTabWidth`

```ts
setTabWidth(width: number): void
```

Sets the width of tabulation in characters for printed text.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `width`: width of tab in characters.

### `setTopMargin`

```ts
setTopMargin(margin: number, unit: Gtk.Unit): void
```

Sets the top margin used by `compositor`.

**Parameters**

- `margin`: the new top margin in units of `unit`
- `unit`: the units for `margin`

### `setWrapMode`

```ts
setWrapMode(wrapMode: Gtk.WrapMode): void
```

Sets the line wrapping mode for the printed text.

This function cannot be called anymore after the first call to the
`PrintCompositor.paginate()` function.

**Parameters**

- `wrapMode`: a `GtkWrapMode`.
