---
description: "Stores page size, orientation and margins for printing."
---

# GtkPageSetup

Stores page size, orientation and margins for printing.

The idea is that you can get one of these from the page setup dialog
and then pass it to the `GtkPrintOperation` when printing.
The benefit of splitting this out of the `GtkPrintSettings` is that
these affect the actual layout of the page, and thus need to be set
long before user prints.

### Margins

The margins specified in this object are the “print margins”, i.e. the
parts of the page that the printer cannot print on. These are different
from the layout margins that a word processor uses; they are typically
used to determine the minimal size for the layout margins.

To obtain a `GtkPageSetup` use `Gtk.PageSetup.new()` to get the defaults,
or use `Gtk.printRunPageSetupDialog()` to show the page setup dialog
and receive the resulting page setup.

### A page setup dialog

```c
static GtkPrintSettings *settings = NULL;
static GtkPageSetup *page_setup = NULL;

static void
do_page_setup (void)
{
  GtkPageSetup *new_page_setup;

  if (settings == NULL)
    settings = gtk_print_settings_new ();

  new_page_setup = gtk_print_run_page_setup_dialog (GTK_WINDOW (main_window),
                                                    page_setup, settings);

  if (page_setup)
    g_object_unref (page_setup);

  page_setup = new_page_setup;
}
```

```tsx
import { GtkPageSetup } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPageSetup**

## Props

`ref` receives the `Gtk.PageSetup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.PageSetup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `copy`

```ts
copy(): Gtk.PageSetup
```

Copies a `GtkPageSetup`.

**Returns** a copy of `other`

### `getBottomMargin`

```ts
getBottomMargin(unit: Gtk.Unit): number
```

Gets the bottom margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the bottom margin

### `getLeftMargin`

```ts
getLeftMargin(unit: Gtk.Unit): number
```

Gets the left margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the left margin

### `getOrientation`

```ts
getOrientation(): Gtk.PageOrientation
```

Gets the page orientation of the `GtkPageSetup`.

**Returns** the page orientation

### `getPageHeight`

```ts
getPageHeight(unit: Gtk.Unit): number
```

Returns the page height in units of `unit`.

Note that this function takes orientation
and margins into consideration.
See `Gtk.PageSetup.getPaperHeight()`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the page height.

### `getPageWidth`

```ts
getPageWidth(unit: Gtk.Unit): number
```

Returns the page width in units of `unit`.

Note that this function takes orientation
and margins into consideration.
See `Gtk.PageSetup.getPaperWidth()`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the page width.

### `getPaperHeight`

```ts
getPaperHeight(unit: Gtk.Unit): number
```

Returns the paper height in units of `unit`.

Note that this function takes orientation,
but not margins into consideration.
See `Gtk.PageSetup.getPageHeight()`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the paper height.

### `getPaperSize`

```ts
getPaperSize(): Gtk.PaperSize
```

Gets the paper size of the `GtkPageSetup`.

**Returns** the paper size

### `getPaperWidth`

```ts
getPaperWidth(unit: Gtk.Unit): number
```

Returns the paper width in units of `unit`.

Note that this function takes orientation,
but not margins into consideration.
See `Gtk.PageSetup.getPageWidth()`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the paper width.

### `getRightMargin`

```ts
getRightMargin(unit: Gtk.Unit): number
```

Gets the right margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the right margin

### `getTopMargin`

```ts
getTopMargin(unit: Gtk.Unit): number
```

Gets the top margin in units of `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the top margin

### `loadFile`

```ts
loadFile(fileName: string): boolean
```

Reads the page setup from the file `file_name`.

See `Gtk.PageSetup.toFile()`.

**Parameters**

- `fileName`: the filename to read the page setup from

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `loadKeyFile`

```ts
loadKeyFile(keyFile: GLib.KeyFile, groupName: string | null): boolean
```

Reads the page setup from the group `group_name` in the key file
`key_file`.

**Parameters**

- `keyFile`: the `GKeyFile` to retrieve the page_setup from
- `groupName`: the name of the group in the key_file to read to use the default name “Page Setup”

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `setBottomMargin`

```ts
setBottomMargin(margin: number, unit: Gtk.Unit): void
```

Sets the bottom margin of the `GtkPageSetup`.

**Parameters**

- `margin`: the new bottom margin in units of `unit`
- `unit`: the units for `margin`

### `setLeftMargin`

```ts
setLeftMargin(margin: number, unit: Gtk.Unit): void
```

Sets the left margin of the `GtkPageSetup`.

**Parameters**

- `margin`: the new left margin in units of `unit`
- `unit`: the units for `margin`

### `setOrientation`

```ts
setOrientation(orientation: Gtk.PageOrientation): void
```

Sets the page orientation of the `GtkPageSetup`.

**Parameters**

- `orientation`: a `GtkPageOrientation` value

### `setPaperSize`

```ts
setPaperSize(size: Gtk.PaperSize): void
```

Sets the paper size of the `GtkPageSetup` without
changing the margins.

See `Gtk.PageSetup.setPaperSizeAndDefaultMargins()`.

**Parameters**

- `size`: a `GtkPaperSize`

### `setPaperSizeAndDefaultMargins`

```ts
setPaperSizeAndDefaultMargins(size: Gtk.PaperSize): void
```

Sets the paper size of the `GtkPageSetup` and modifies
the margins according to the new paper size.

**Parameters**

- `size`: a `GtkPaperSize`

### `setRightMargin`

```ts
setRightMargin(margin: number, unit: Gtk.Unit): void
```

Sets the right margin of the `GtkPageSetup`.

**Parameters**

- `margin`: the new right margin in units of `unit`
- `unit`: the units for `margin`

### `setTopMargin`

```ts
setTopMargin(margin: number, unit: Gtk.Unit): void
```

Sets the top margin of the `GtkPageSetup`.

**Parameters**

- `margin`: the new top margin in units of `unit`
- `unit`: the units for `margin`

### `toFile`

```ts
toFile(fileName: string): boolean
```

This function saves the information from `setup` to `file_name`.

**Parameters**

- `fileName`: the file to save to

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `toGvariant`

```ts
toGvariant(): GLib.Variant
```

Serialize page setup to an a{sv} variant.

**Returns** a new, floating, `GVariant`

### `toKeyFile`

```ts
toKeyFile(keyFile: GLib.KeyFile, groupName: string | null): void
```

This function adds the page setup from `setup` to `key_file`.

**Parameters**

- `keyFile`: the `GKeyFile` to save the page setup to
- `groupName`: the group to add the settings to in `key_file`, or `null` to use the default name “Page Setup”
