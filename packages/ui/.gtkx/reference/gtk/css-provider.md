---
description: "A style provider for CSS."
---

# GtkCssProvider

A style provider for CSS.

It is able to parse CSS-like input in order to style widgets.

An application can make GTK parse a specific CSS style sheet by calling
`Gtk.CssProvider.loadFromFile()` or
`Gtk.CssProvider.loadFromResource()`
and adding the provider with `Gtk.StyleContext.addProvider()` or
`Gtk.StyleContext.addProviderForDisplay()`.

In addition, certain files will be read when GTK is initialized.
First, the file `$XDG_CONFIG_HOME/gtk-4.0/gtk.css` is loaded if it
exists. Then, GTK loads the first existing file among
`XDG_DATA_HOME/themes/THEME/gtk-VERSION/gtk-VARIANT.css`,
`$HOME/.themes/THEME/gtk-VERSION/gtk-VARIANT.css`,
`$XDG_DATA_DIRS/themes/THEME/gtk-VERSION/gtk-VARIANT.css` and
`DATADIR/share/themes/THEME/gtk-VERSION/gtk-VARIANT.css`,
where `THEME` is the name of the current theme (see the
`Gtk.Settings.gtkThemeName` setting), `VARIANT` is the
variant to load (see the
`Gtk.Settings.gtkApplicationPreferDarkTheme` setting),
`DATADIR` is the prefix configured when GTK was compiled (unless
overridden by the `GTK_DATA_PREFIX` environment variable), and
`VERSION` is the GTK version number. If no file is found for the
current version, GTK tries older versions all the way back to 4.0.

To track errors while loading CSS, connect to the
`Gtk.CssProvider.parsing-error` signal.

```tsx
import { GtkCssProvider } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkCssProvider**

Implements `GtkStyleProvider`.

## Props

`ref` receives the `Gtk.CssProvider` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `prefersColorScheme`

`Gtk.InterfaceColorScheme` · default `GTK_INTERFACE_COLOR_SCHEME_DEFAULT`

Define the color scheme used for rendering the user interface.

The UI can be set to either `Gtk.InterfaceColorScheme.LIGHT`,
or `Gtk.InterfaceColorScheme.DARK` mode. Other values will
be interpreted the same as `Gtk.InterfaceColorScheme.LIGHT`.

This setting is be available for media queries in CSS:

```css
@media (prefers-color-scheme: dark) {
  // some dark mode styling
}
```

Changing this setting will reload the style sheet.

_Available since 4.20._

### `prefersContrast`

`Gtk.InterfaceContrast` · default `GTK_INTERFACE_CONTRAST_NO_PREFERENCE`

Define the contrast mode to use for the user interface.

When set to `Gtk.InterfaceContrast.MORE` or
`Gtk.InterfaceContrast.LESS`, the UI is rendered in
high or low contrast.

When set to `Gtk.InterfaceContrast.NO_PREFERENCE` (the default),
the user interface will be rendered in default mode.

This setting is be available for media queries in CSS:

```css
@media (prefers-contrast: more) {
  // some style with high contrast
}
```

Changing this setting will reload the style sheet.

_Available since 4.20._

### `prefersReducedMotion`

`Gtk.ReducedMotion` · default `GTK_REDUCED_MOTION_NO_PREFERENCE`

Define the type of reduced motion to use for the user interface.

When set to `Gtk.ReducedMotion.REDUCE` the UI is rendered in
with reduced motion animations.

When set to `Gtk.ReducedMotion.NO_PREFERENCE` (the default),
the user interface will be rendered in default mode.

This setting is be available for media queries in CSS:

```css
@media (prefers-reduced-motion: reduce) {
  // some style with reduced motion
}
```

Changing this setting will reload the style sheet.

_Available since 4.22._

## Signals

### `onGtkPrivateChanged`

```ts
(self: Gtk.CssProvider) => void
```

From `GtkStyleProvider`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onParsingError`

```ts
(section: Gtk.CssSection, error: GLib.Error, self: Gtk.CssProvider) => void
```

Signals that a parsing error occurred.

The expected error values are in the `Gtk.CssParserError`
and `Gtk.CssParserWarning` enumerations.

The `path`, `line` and `position` describe the actual location of
the error as accurately as possible.

Parsing errors are never fatal, so the parsing will resume after
the error. Errors may however cause parts of the given data or
even all of it to not be parsed at all. So it is a useful idea
to check that the parsing succeeds by connecting to this signal.

Errors in the `Gtk.CssParserWarning` enumeration should not
be treated as fatal errors.

Note that this signal may be emitted at any time as the css provider
may opt to defer parsing parts or all of the input to a later time
than when a loading function was called.

**Parameters**

- `section`: section the error happened in
- `error`: The parsing error
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CssProvider` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `loadFromBytes`

```ts
loadFromBytes(data: GLib.Bytes): void
```

Loads `data` into `css_provider`.

This clears any previously loaded information.

**Parameters**

- `data`: `GBytes` containing the data to load

_Available since 4.12._

### `loadFromData`

```ts
loadFromData(data: string, length: number): void
```

Loads `data` into `css_provider`.

This clears any previously loaded information.

**Parameters**

- `data`: CSS data to be parsed
- `length`: the length of `data` in bytes, or -1 for NUL terminated strings

> **Deprecated since 4.12.** Use `Gtk.CssProvider.loadFromString()` or `Gtk.CssProvider.loadFromBytes()` instead

### `loadFromFile`

```ts
loadFromFile(file: Gio.File): void
```

Loads the data contained in `file` into `css_provider`.

This clears any previously loaded information.

**Parameters**

- `file`: `GFile` pointing to a file to load

### `loadFromPath`

```ts
loadFromPath(path: string): void
```

Loads the data contained in `path` into `css_provider`.

This clears any previously loaded information.

**Parameters**

- `path`: the path of a filename to load, in the GLib filename encoding

### `loadFromResource`

```ts
loadFromResource(resourcePath: string): void
```

Loads the data contained in the resource at `resource_path` into
the `css_provider`.

This clears any previously loaded information.

**Parameters**

- `resourcePath`: a `GResource` resource path

### `loadFromString`

```ts
loadFromString(string: string): void
```

Loads `string` into `css_provider`.

This clears any previously loaded information.

**Parameters**

- `string`: the CSS to load

_Available since 4.12._

### `loadNamed`

```ts
loadNamed(name: string, variant: string | null): void
```

Loads a theme from the usual theme paths.

The actual process of finding the theme might change between
releases, but it is guaranteed that this function uses the same
mechanism to load the theme that GTK uses for loading its own theme.

**Parameters**

- `name`: A theme name
- `variant`: variant to load, for example, "dark", or `null` for the default

> **Deprecated since 4.20.** Using any of the other theme loaders, combine with media queries.

### `toString`

```ts
toString(): string
```

Converts the `provider` into a string representation in CSS
format.

Using `Gtk.CssProvider.loadFromString()` with the return
value from this function on a new provider created with
`Gtk.CssProvider.new()` will basically create a duplicate
of this `provider`.

**Returns** a new string representing the `provider`.
