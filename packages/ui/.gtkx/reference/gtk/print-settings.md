---
description: "Collects the settings of a print dialog in a system-independent way."
---

# GtkPrintSettings

Collects the settings of a print dialog in a system-independent way.

The main use for this object is that once you’ve printed you can get a
settings object that represents the settings the user chose, and the next
time you print you can pass that object in so that the user doesn’t have
to re-set all his settings.

Its also possible to enumerate the settings so that you can easily save
the settings for the next time your app runs, or even store them in a
document. The predefined keys try to use shared values as much as possible
so that moving such a document between systems still works.

```tsx
import { GtkPrintSettings } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrintSettings**

## Props

`ref` receives the `Gtk.PrintSettings` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.PrintSettings` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `copy`

```ts
copy(): Gtk.PrintSettings
```

Copies a `GtkPrintSettings` object.

**Returns** a newly allocated copy of `other`

### `foreach`

```ts
foreach(func: Gtk.PrintSettingsFunc): void
```

Calls `func` for each key-value pair of `settings`.

**Parameters**

- `func`: the function to call

### `get`

```ts
get(key: string): string | null
```

Looks up the string value associated with `key`.

**Parameters**

- `key`: a key

**Returns** the string value for `key`

### `getBool`

```ts
getBool(key: string): boolean
```

Returns the boolean represented by the value
that is associated with `key`.

The string “true” represents `true`, any other
string `false`.

**Parameters**

- `key`: a key

**Returns** `true`, if `key` maps to a true value.

### `getCollate`

```ts
getCollate(): boolean
```

Gets the value of `GTK_PRINT_SETTINGS_COLLATE`.

**Returns** whether to collate the printed pages

### `getDefaultSource`

```ts
getDefaultSource(): string | null
```

Gets the value of `GTK_PRINT_SETTINGS_DEFAULT_SOURCE`.

**Returns** the default source

### `getDither`

```ts
getDither(): string | null
```

Gets the value of `GTK_PRINT_SETTINGS_DITHER`.

**Returns** the dithering that is used

### `getDouble`

```ts
getDouble(key: string): number
```

Returns the double value associated with `key`, or 0.

**Parameters**

- `key`: a key

**Returns** the double value of `key`

### `getDoubleWithDefault`

```ts
getDoubleWithDefault(key: string, def: number): number
```

Returns the floating point number represented by
the value that is associated with `key`, or `default_val`
if the value does not represent a floating point number.

Floating point numbers are parsed with `g_ascii_strtod()`.

**Parameters**

- `key`: a key
- `def`: the default value

**Returns** the floating point number associated with `key`

### `getDuplex`

```ts
getDuplex(): Gtk.PrintDuplex
```

Gets the value of `GTK_PRINT_SETTINGS_DUPLEX`.

**Returns** whether to print the output in duplex.

### `getFinishings`

```ts
getFinishings(): string | null
```

Gets the value of `GTK_PRINT_SETTINGS_FINISHINGS`.

**Returns** the finishings

### `getInt`

```ts
getInt(key: string): number
```

Returns the integer value of `key`, or 0.

**Parameters**

- `key`: a key

**Returns** the integer value of `key`

### `getIntWithDefault`

```ts
getIntWithDefault(key: string, def: number): number
```

Returns the value of `key`, interpreted as
an integer, or the default value.

**Parameters**

- `key`: a key
- `def`: the default value

**Returns** the integer value of `key`

### `getLength`

```ts
getLength(key: string, unit: Gtk.Unit): number
```

Returns the value associated with `key`, interpreted
as a length.

The returned value is converted to `units`.

**Parameters**

- `key`: a key
- `unit`: the unit of the return value

**Returns** the length value of `key`, converted to `unit`

### `getMediaType`

```ts
getMediaType(): string | null
```

Gets the value of `GTK_PRINT_SETTINGS_MEDIA_TYPE`.

The set of media types is defined in PWG 5101.1-2002 PWG.

**Returns** the media type

### `getNCopies`

```ts
getNCopies(): number
```

Gets the value of `GTK_PRINT_SETTINGS_N_COPIES`.

**Returns** the number of copies to print

### `getNumberUp`

```ts
getNumberUp(): number
```

Gets the value of `GTK_PRINT_SETTINGS_NUMBER_UP`.

**Returns** the number of pages per sheet

### `getNumberUpLayout`

```ts
getNumberUpLayout(): Gtk.NumberUpLayout
```

Gets the value of `GTK_PRINT_SETTINGS_NUMBER_UP_LAYOUT`.

**Returns** layout of page in number-up mode

### `getOrientation`

```ts
getOrientation(): Gtk.PageOrientation
```

Get the value of `GTK_PRINT_SETTINGS_ORIENTATION`,
converted to a `GtkPageOrientation`.

**Returns** the orientation

### `getOutputBin`

```ts
getOutputBin(): string | null
```

Gets the value of `GTK_PRINT_SETTINGS_OUTPUT_BIN`.

**Returns** the output bin

### `getPageRanges`

```ts
getPageRanges(): Gtk.PageRange[]
```

Gets the value of `GTK_PRINT_SETTINGS_PAGE_RANGES`.

**Returns** an array
  of `GtkPageRange`s. Use `g_free()` to free the array when
  it is no longer needed.

### `getPageSet`

```ts
getPageSet(): Gtk.PageSet
```

Gets the value of `GTK_PRINT_SETTINGS_PAGE_SET`.

**Returns** the set of pages to print

### `getPaperHeight`

```ts
getPaperHeight(unit: Gtk.Unit): number
```

Gets the value of `GTK_PRINT_SETTINGS_PAPER_HEIGHT`,
converted to `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the paper height, in units of `unit`

### `getPaperSize`

```ts
getPaperSize(): Gtk.PaperSize | null
```

Gets the value of `GTK_PRINT_SETTINGS_PAPER_FORMAT`,
converted to a `GtkPaperSize`.

**Returns** the paper size

### `getPaperWidth`

```ts
getPaperWidth(unit: Gtk.Unit): number
```

Gets the value of `GTK_PRINT_SETTINGS_PAPER_WIDTH`,
converted to `unit`.

**Parameters**

- `unit`: the unit for the return value

**Returns** the paper width, in units of `unit`

### `getPrinter`

```ts
getPrinter(): string | null
```

Convenience function to obtain the value of
`GTK_PRINT_SETTINGS_PRINTER`.

**Returns** the printer name

### `getPrinterLpi`

```ts
getPrinterLpi(): number
```

Gets the value of `GTK_PRINT_SETTINGS_PRINTER_LPI`.

**Returns** the resolution in lpi (lines per inch)

### `getPrintPages`

```ts
getPrintPages(): Gtk.PrintPages
```

Gets the value of `GTK_PRINT_SETTINGS_PRINT_PAGES`.

**Returns** which pages to print

### `getQuality`

```ts
getQuality(): Gtk.PrintQuality
```

Gets the value of `GTK_PRINT_SETTINGS_QUALITY`.

**Returns** the print quality

### `getResolution`

```ts
getResolution(): number
```

Gets the value of `GTK_PRINT_SETTINGS_RESOLUTION`.

**Returns** the resolution in dpi

### `getResolutionX`

```ts
getResolutionX(): number
```

Gets the value of `GTK_PRINT_SETTINGS_RESOLUTION_X`.

**Returns** the horizontal resolution in dpi

### `getResolutionY`

```ts
getResolutionY(): number
```

Gets the value of `GTK_PRINT_SETTINGS_RESOLUTION_Y`.

**Returns** the vertical resolution in dpi

### `getReverse`

```ts
getReverse(): boolean
```

Gets the value of `GTK_PRINT_SETTINGS_REVERSE`.

**Returns** whether to reverse the order of the printed pages

### `getScale`

```ts
getScale(): number
```

Gets the value of `GTK_PRINT_SETTINGS_SCALE`.

**Returns** the scale in percent

### `getUseColor`

```ts
getUseColor(): boolean
```

Gets the value of `GTK_PRINT_SETTINGS_USE_COLOR`.

**Returns** whether to use color

### `hasKey`

```ts
hasKey(key: string): boolean
```

Returns `true`, if a value is associated with `key`.

**Parameters**

- `key`: a key

**Returns** `true`, if `key` has a value

### `loadFile`

```ts
loadFile(fileName: string): boolean
```

Reads the print settings from `file_name`.

If the file could not be loaded then error is set to either
a `GFileError` or `GKeyFileError`.

See `Gtk.PrintSettings.toFile()`.

**Parameters**

- `fileName`: the filename to read the settings from

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `loadKeyFile`

```ts
loadKeyFile(keyFile: GLib.KeyFile, groupName: string | null): boolean
```

Reads the print settings from the group `group_name` in `key_file`.

If the file could not be loaded then error is set to either a
`GFileError` or `GKeyFileError`.

**Parameters**

- `keyFile`: the `GKeyFile` to retrieve the settings from
- `groupName`: the name of the group to use, or `null` to use the default “Print Settings”

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `set`

```ts
set(key: string, value: string | null): void
```

Associates `value` with `key`.

**Parameters**

- `key`: a key
- `value`: a string value

### `setBool`

```ts
setBool(key: string, value: boolean): void
```

Sets `key` to a boolean value.

**Parameters**

- `key`: a key
- `value`: a boolean

### `setCollate`

```ts
setCollate(collate: boolean): void
```

Sets the value of `GTK_PRINT_SETTINGS_COLLATE`.

**Parameters**

- `collate`: whether to collate the output

### `setDefaultSource`

```ts
setDefaultSource(defaultSource: string): void
```

Sets the value of `GTK_PRINT_SETTINGS_DEFAULT_SOURCE`.

**Parameters**

- `defaultSource`: the default source

### `setDither`

```ts
setDither(dither: string): void
```

Sets the value of `GTK_PRINT_SETTINGS_DITHER`.

**Parameters**

- `dither`: the dithering that is used

### `setDouble`

```ts
setDouble(key: string, value: number): void
```

Sets `key` to a double value.

**Parameters**

- `key`: a key
- `value`: a double value

### `setDuplex`

```ts
setDuplex(duplex: Gtk.PrintDuplex): void
```

Sets the value of `GTK_PRINT_SETTINGS_DUPLEX`.

**Parameters**

- `duplex`: a `GtkPrintDuplex` value

### `setFinishings`

```ts
setFinishings(finishings: string): void
```

Sets the value of `GTK_PRINT_SETTINGS_FINISHINGS`.

**Parameters**

- `finishings`: the finishings

### `setInt`

```ts
setInt(key: string, value: number): void
```

Sets `key` to an integer value.

**Parameters**

- `key`: a key
- `value`: an integer

### `setLength`

```ts
setLength(key: string, value: number, unit: Gtk.Unit): void
```

Associates a length in units of `unit` with `key`.

**Parameters**

- `key`: a key
- `value`: a length
- `unit`: the unit of `length`

### `setMediaType`

```ts
setMediaType(mediaType: string): void
```

Sets the value of `GTK_PRINT_SETTINGS_MEDIA_TYPE`.

The set of media types is defined in PWG 5101.1-2002 PWG.

**Parameters**

- `mediaType`: the media type

### `setNCopies`

```ts
setNCopies(numCopies: number): void
```

Sets the value of `GTK_PRINT_SETTINGS_N_COPIES`.

**Parameters**

- `numCopies`: the number of copies

### `setNumberUp`

```ts
setNumberUp(numberUp: number): void
```

Sets the value of `GTK_PRINT_SETTINGS_NUMBER_UP`.

**Parameters**

- `numberUp`: the number of pages per sheet

### `setNumberUpLayout`

```ts
setNumberUpLayout(numberUpLayout: Gtk.NumberUpLayout): void
```

Sets the value of `GTK_PRINT_SETTINGS_NUMBER_UP_LAYOUT`.

**Parameters**

- `numberUpLayout`: a `GtkNumberUpLayout` value

### `setOrientation`

```ts
setOrientation(orientation: Gtk.PageOrientation): void
```

Sets the value of `GTK_PRINT_SETTINGS_ORIENTATION`.

**Parameters**

- `orientation`: a page orientation

### `setOutputBin`

```ts
setOutputBin(outputBin: string): void
```

Sets the value of `GTK_PRINT_SETTINGS_OUTPUT_BIN`.

**Parameters**

- `outputBin`: the output bin

### `setPageRanges`

```ts
setPageRanges(pageRanges: Gtk.PageRange[]): void
```

Sets the value of `GTK_PRINT_SETTINGS_PAGE_RANGES`.

**Parameters**

- `pageRanges`: an array of `GtkPageRange`s

### `setPageSet`

```ts
setPageSet(pageSet: Gtk.PageSet): void
```

Sets the value of `GTK_PRINT_SETTINGS_PAGE_SET`.

**Parameters**

- `pageSet`: a `GtkPageSet` value

### `setPaperHeight`

```ts
setPaperHeight(height: number, unit: Gtk.Unit): void
```

Sets the value of `GTK_PRINT_SETTINGS_PAPER_HEIGHT`.

**Parameters**

- `height`: the paper height
- `unit`: the units of `height`

### `setPaperSize`

```ts
setPaperSize(paperSize: Gtk.PaperSize): void
```

Sets the value of `GTK_PRINT_SETTINGS_PAPER_FORMAT`,
`GTK_PRINT_SETTINGS_PAPER_WIDTH` and
`GTK_PRINT_SETTINGS_PAPER_HEIGHT`.

**Parameters**

- `paperSize`: a paper size

### `setPaperWidth`

```ts
setPaperWidth(width: number, unit: Gtk.Unit): void
```

Sets the value of `GTK_PRINT_SETTINGS_PAPER_WIDTH`.

**Parameters**

- `width`: the paper width
- `unit`: the units of `width`

### `setPrinter`

```ts
setPrinter(printer: string): void
```

Convenience function to set `GTK_PRINT_SETTINGS_PRINTER`
to `printer`.

**Parameters**

- `printer`: the printer name

### `setPrinterLpi`

```ts
setPrinterLpi(lpi: number): void
```

Sets the value of `GTK_PRINT_SETTINGS_PRINTER_LPI`.

**Parameters**

- `lpi`: the resolution in lpi (lines per inch)

### `setPrintPages`

```ts
setPrintPages(pages: Gtk.PrintPages): void
```

Sets the value of `GTK_PRINT_SETTINGS_PRINT_PAGES`.

**Parameters**

- `pages`: a `GtkPrintPages` value

### `setQuality`

```ts
setQuality(quality: Gtk.PrintQuality): void
```

Sets the value of `GTK_PRINT_SETTINGS_QUALITY`.

**Parameters**

- `quality`: a `GtkPrintQuality` value

### `setResolution`

```ts
setResolution(resolution: number): void
```

Sets the values of `GTK_PRINT_SETTINGS_RESOLUTION`,
`GTK_PRINT_SETTINGS_RESOLUTION_X` and
`GTK_PRINT_SETTINGS_RESOLUTION_Y`.

**Parameters**

- `resolution`: the resolution in dpi

### `setResolutionXy`

```ts
setResolutionXy(resolutionX: number, resolutionY: number): void
```

Sets the values of `GTK_PRINT_SETTINGS_RESOLUTION`,
`GTK_PRINT_SETTINGS_RESOLUTION_X` and
`GTK_PRINT_SETTINGS_RESOLUTION_Y`.

**Parameters**

- `resolutionX`: the horizontal resolution in dpi
- `resolutionY`: the vertical resolution in dpi

### `setReverse`

```ts
setReverse(reverse: boolean): void
```

Sets the value of `GTK_PRINT_SETTINGS_REVERSE`.

**Parameters**

- `reverse`: whether to reverse the output

### `setScale`

```ts
setScale(scale: number): void
```

Sets the value of `GTK_PRINT_SETTINGS_SCALE`.

**Parameters**

- `scale`: the scale in percent

### `setUseColor`

```ts
setUseColor(useColor: boolean): void
```

Sets the value of `GTK_PRINT_SETTINGS_USE_COLOR`.

**Parameters**

- `useColor`: whether to use color

### `toFile`

```ts
toFile(fileName: string): boolean
```

This function saves the print settings from `settings` to `file_name`.

If the file could not be written then error is set to either a
`GFileError` or `GKeyFileError`.

**Parameters**

- `fileName`: the file to save to

**Returns** `true` on success

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `toGvariant`

```ts
toGvariant(): GLib.Variant
```

Serialize print settings to an a{sv} variant.

**Returns** a new, floating, `GVariant`

### `toKeyFile`

```ts
toKeyFile(keyFile: GLib.KeyFile, groupName: string | null): void
```

This function adds the print settings from `settings` to `key_file`.

**Parameters**

- `keyFile`: the `GKeyFile` to save the print settings to
- `groupName`: the group to add the settings to in `key_file`, or `null` to use the default “Print Settings”

### `unset`

```ts
unset(key: string): void
```

Removes any value associated with `key`.

This has the same effect as setting the value to `null`.

**Parameters**

- `key`: a key
