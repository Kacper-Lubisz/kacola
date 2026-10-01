---
description: "A class for managing application-wide styling."
---

# AdwStyleManager

A class for managing application-wide styling.

`AdwStyleManager` provides a way to query and influence the application
styles, such as whether to use dark style, the system accent color or high
contrast appearance.

It allows to set the color scheme via the
`StyleManager.colorScheme` property, and to query the current
appearance, as well as whether a system-wide color scheme and accent color
preferences exists.

```tsx
import { AdwStyleManager } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwStyleManager**

## Props

`ref` receives the `Adw.StyleManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accentColor`

`Adw.AccentColor` · default `ADW_ACCENT_COLOR_BLUE` · read-only, observe with `onNotifyAccentColor`

The current system accent color.

See also `StyleManager.accentColorRgba`.

_Available since 1.6._

### `accentColorRgba`

`Gdk.RGBA` · read-only, observe with `onNotifyAccentColorRgba`

The current system accent color as a `GdkRGBA`.

Equivalent to calling `AccentColor.toRgba()` on the value of
`StyleManager.accentColor`.

This is a background color. The matching foreground color is white.

_Available since 1.6._

### `colorScheme`

`Adw.ColorScheme` · default `ADW_COLOR_SCHEME_DEFAULT`

The requested application color scheme.

The effective appearance will be decided based on the application color
scheme and the system preferred color scheme. The
`StyleManager.dark` property can be used to query the current
effective appearance.

The `Adw.ColorScheme.prefer-light` color scheme results in the
application using light appearance unless the system prefers dark colors.
This is the default value.

The `Adw.ColorScheme.prefer-dark` color scheme results in the
application using dark appearance, but can still switch to the light
appearance if the system can prefers it, for example, when the high
contrast preference is
enabled.

The `Adw.ColorScheme.force-light` and `Adw.ColorScheme.force-dark`
values ignore the system preference entirely. They are useful if the
application wants to match its UI to its content or to provide a separate
color scheme switcher.

If a per-`Gdk.Display` style manager has its color scheme set to
`Adw.ColorScheme.default`, it will inherit the color scheme from the
default style manager.

For the default style manager, `Adw.ColorScheme.default` is equivalent
to `Adw.ColorScheme.prefer-light`.

The `StyleManager.systemSupportsColorSchemes` property can be
used to check if the current environment provides a color scheme
preference.

### `dark`

`boolean` · default `false` · read-only, observe with `onNotifyDark`

Whether the application is using dark appearance.

This property can be used to query the current appearance, as requested via
`StyleManager.colorScheme`.

### `display`

`Gdk.Display` · construct-only

The display the style manager is associated with.

The display will be `NULL` for the style manager returned by
`StyleManager.getDefault()`.

### `documentFontName`

`string` · default `Sans 10` · read-only, observe with `onNotifyDocumentFontName`

The system document font.

The font is in the same format as `Gtk.Settings.gtkFontName`,
e.g. "Adwaita Sans 12".

Use `Pango.FontDescription.fromString()` to parse it.

_Available since 1.7._

### `highContrast`

`boolean` · default `false` · read-only, observe with `onNotifyHighContrast`

Whether the application is using high contrast appearance.

This cannot be overridden by applications.

### `monospaceFontName`

`string` · default `Monospace 10` · read-only, observe with `onNotifyMonospaceFontName`

The system monospace font.

The font is in the same format as `Gtk.Settings.gtkFontName`,
e.g. "Adwaita Mono 11".

Use `Pango.FontDescription.fromString()` to parse it.

_Available since 1.7._

### `systemSupportsAccentColors`

`boolean` · default `false` · read-only, observe with `onNotifySystemSupportsAccentColors`

Whether the system supports accent colors.

This property can be used to check if the current environment provides an
accent color preference. For example, applications might want to show a
preference for choosing accent color if it's set to `FALSE`.

See `StyleManager.accentColor`.

_Available since 1.6._

### `systemSupportsColorSchemes`

`boolean` · default `false` · read-only, observe with `onNotifySystemSupportsColorSchemes`

Whether the system supports color schemes.

This property can be used to check if the current environment provides a
color scheme preference. For example, applications might want to show a
separate appearance switcher if it's set to `FALSE`.

See `StyleManager.colorScheme`.

## Methods

Methods are called on the `Adw.StyleManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getAccentColor`

```ts
getAccentColor(): Adw.AccentColor
```

Gets the current system accent color.

See also `StyleManager.accentColorRgba`.

**Returns** the current system accent color

_Available since 1.6._

### `getAccentColorRgba`

```ts
getAccentColorRgba(): Gdk.RGBA
```

Gets the current system accent color as a `GdkRGBA`.

Equivalent to calling `AccentColor.toRgba()` on the value of
`StyleManager.accentColor`.

This is a background color. The matching foreground color is white.

**Returns** the current system accent color

_Available since 1.6._

### `getColorScheme`

```ts
getColorScheme(): Adw.ColorScheme
```

Gets the requested application color scheme.

**Returns** the color scheme

### `getDark`

```ts
getDark(): boolean
```

Gets whether the application is using dark appearance.

This can be used to query the current appearance, as requested via
`StyleManager.colorScheme`.

**Returns** whether the application is using dark appearance

### `getDisplay`

```ts
getDisplay(): Gdk.Display | null
```

Gets the display the style manager is associated with.

The display will be `NULL` for the style manager returned by
`StyleManager.getDefault()`.

**Returns** the display

### `getDocumentFontName`

```ts
getDocumentFontName(): string
```

Gets the system document font.

The font is in the same format as `Gtk.Settings.gtkFontName`,
e.g. "Adwaita Sans 12".

Use `Pango.FontDescription.fromString()` to parse it.

**Returns** the system document font

_Available since 1.7._

### `getHighContrast`

```ts
getHighContrast(): boolean
```

Gets whether the application is using high contrast appearance.

This cannot be overridden by applications.

**Returns** whether the application is using high contrast appearance

### `getMonospaceFontName`

```ts
getMonospaceFontName(): string
```

Gets the system monospace font.

The font is in the same format as `Gtk.Settings.gtkFontName`,
e.g. "Adwaita Mono 11".

Use `Pango.FontDescription.fromString()` to parse it.

**Returns** the system monospace font

_Available since 1.7._

### `getSystemSupportsAccentColors`

```ts
getSystemSupportsAccentColors(): boolean
```

Gets whether the system supports accent colors.

This can be used to check if the current environment provides an accent color
preference. For example, applications might want to show a preference for
choosing accent color if it's set to `FALSE`.

See `StyleManager.accentColor`.

**Returns** whether the system supports accent colors

_Available since 1.6._

### `getSystemSupportsColorSchemes`

```ts
getSystemSupportsColorSchemes(): boolean
```

Gets whether the system supports color schemes.

This can be used to check if the current environment provides a color scheme
preference. For example, applications might want to show a separate
appearance switcher if it's set to `FALSE`.

**Returns** whether the system supports color schemes

### `setColorScheme`

```ts
setColorScheme(colorScheme: Adw.ColorScheme): void
```

Sets the requested application color scheme.

The effective appearance will be decided based on the application color
scheme and the system preferred color scheme. The
`StyleManager.dark` property can be used to query the current
effective appearance.

The `Adw.ColorScheme.prefer-light` color scheme results in the
application using light appearance unless the system prefers dark colors.
This is the default value.

The `Adw.ColorScheme.prefer-dark` color scheme results in the
application using dark appearance, but can still switch to the light
appearance if the system can prefers it, for example, when the high contrast
preference is enabled.

The `Adw.ColorScheme.force-light` and `Adw.ColorScheme.force-dark`
values ignore the system preference entirely. They are useful if the
application wants to match its UI to its content or to provide a separate
color scheme switcher.

If a per-`Gdk.Display` style manager has its color scheme set to
`Adw.ColorScheme.default`, it will inherit the color scheme from the
default style manager.

For the default style manager, `Adw.ColorScheme.default` is equivalent
to `Adw.ColorScheme.prefer-light`.

The `StyleManager.systemSupportsColorSchemes` property can be
used to check if the current environment provides a color scheme
preference.

**Parameters**

- `colorScheme`: the color scheme
