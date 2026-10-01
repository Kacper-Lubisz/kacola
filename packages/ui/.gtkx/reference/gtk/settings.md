---
description: "Provides a mechanism to share global settings between applications."
---

# GtkSettings

Provides a mechanism to share global settings between applications.

GTK relies on the platform-specific API for getting desktop-wide
settings.

On Wayland, the settings are obtained via a settings portal that
is part of the Linux desktop APIs for application.

On the X window system, this sharing is realized by an
[XSettings](http://www.freedesktop.org/wiki/Specifications/xsettings-spec)
manager.

On macOS, the settings are obtained from `NSUserDefaults`.

In the absence of these sharing mechanisms, GTK reads default values for
settings from `settings.ini` files in `/etc/gtk-4.0`, `$XDG_CONFIG_DIRS/gtk-4.0`
and `$XDG_CONFIG_HOME/gtk-4.0`. These files must be valid key files (see
`GKeyFile`), and have a section called Settings. Themes can also provide
default values for settings by installing a `settings.ini` file
next to their `gtk.css` file.

Applications can override system-wide settings by setting the property
of the `GtkSettings` object with `g_object_set()`. This should be restricted
to special cases though; `GtkSettings` are not meant as an application
configuration facility.

There is one `GtkSettings` instance per display. It can be obtained with
`Gtk.Settings.getForDisplay()`, but in many cases, it is more
convenient to use `Gtk.Widget.getSettings()`.

```tsx
import { GtkSettings } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSettings**

Implements `GtkStyleProvider`.

## Props

`ref` receives the `Gtk.Settings` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `gtkAlternativeButtonOrder`

`boolean` · default `false`

Whether buttons in dialogs should use the alternative button order.

### `gtkAlternativeSortArrows`

`boolean` · default `false`

Controls the direction of the sort indicators in sorted list and tree
views.

By default an arrow pointing down means the column is sorted
in ascending order. When set to `true`, this order will be inverted.

### `gtkApplicationPreferDarkTheme`

`boolean` · default `false` · deprecated since 4.20

Whether the application prefers to use a dark theme.

If a GTK theme includes a dark variant, it will be used
instead of the configured theme.

Some applications benefit from minimizing the amount of light
pollution that interferes with the content. Good candidates for
dark themes are photo and video editors that make the actual
content get all the attention and minimize the distraction of
the chrome.

Dark themes should not be used for documents, where large spaces
are white/light and the dark chrome creates too much contrast
(web browser, text editor...).

> **Deprecated since 4.20.** Use `GtkCssProvider` properties instead

### `gtkCursorAspectRatio`

`number` · default `0.040000`

The aspect ratio of the text caret.

### `gtkCursorBlink`

`boolean` · default `true`

Whether the cursor should blink.

Also see the `Gtk.Settings.gtkCursorBlinkTimeout` setting,
which allows more flexible control over cursor blinking.

### `gtkCursorBlinkTime`

`number` · default `1200`

Length of the cursor blink cycle, in milliseconds.

### `gtkCursorBlinkTimeout`

`number` · default `10`

Time after which the cursor stops blinking, in seconds.

The timer is reset after each user interaction.

Setting this to zero has the same effect as setting
`Gtk.Settings.gtkCursorBlink` to `false`.

### `gtkCursorThemeName`

`string` · default `null`

Name of the cursor theme to use.

Use `null` to use the default theme.

### `gtkCursorThemeSize`

`number` · default `0`

The size to use for cursors.

0 means to use the default size.

### `gtkDecorationLayout`

`string` · default `menu:minimize,maximize,close`

Determines which buttons should be put in the
titlebar of client-side decorated windows, and whether they
should be placed on the left or right.

The format of the string is button names, separated by commas.
A colon separates the buttons that should appear on the left
from those on the right. Recognized button names are minimize,
maximize, close, icon (the window icon) and menu (a menu button
for the fallback app menu).

For example, "menu:minimize,maximize,close" specifies a menu
on the left, and minimize, maximize and close buttons on the right.

Note that buttons will only be shown when they are meaningful.
E.g. a menu button only appears when the desktop shell does not
show the app menu, and a close button only appears on a window
that can be closed.

Also note that the setting can be overridden with the
`Gtk.HeaderBar.decorationLayout` property.

### `gtkDialogsUseHeader`

`boolean` · default `false`

Whether builtin GTK dialogs such as the file chooser, the
color chooser or the font chooser will use a header bar at
the top to show action widgets, or an action area at the bottom.

This setting does not affect custom dialogs using `GtkDialog`
directly, or message dialogs.

### `gtkDndDragThreshold`

`number` · default `8`

The number of pixels the cursor can move before dragging.

### `gtkDoubleClickDistance`

`number` · default `5`

The maximum distance allowed between two clicks for them to be considered
a double click, in pixels.

### `gtkDoubleClickTime`

`number` · default `400`

The maximum time to allow between two clicks for them to be considered
a double click, in milliseconds.

### `gtkEnableAccels`

`boolean` · default `true`

Whether menu items should have visible accelerators which can be
activated.

### `gtkEnableAnimations`

`boolean` · default `true`

Whether to enable toolkit-wide animations.

### `gtkEnableEventSounds`

`boolean` · default `true`

Whether to play any event sounds at all.

See the [Sound Theme Specifications](http://www.freedesktop.org/wiki/Specifications/sound-theme-spec)
for more information on event sounds and sound themes.

GTK itself does not support event sounds, you have to use a loadable
module like the one that comes with libcanberra.

### `gtkEnableInputFeedbackSounds`

`boolean` · default `true`

Whether to play event sounds as feedback to user input.

See the [Sound Theme Specifications](http://www.freedesktop.org/wiki/Specifications/sound-theme-spec)
for more information on event sounds and sound themes.

GTK itself does not support event sounds, you have to use a loadable
module like the one that comes with libcanberra.

### `gtkEnablePrimaryPaste`

`boolean` · default `true`

Whether a middle click on a mouse should paste the
'PRIMARY' clipboard content at the cursor location.

### `gtkEntryPasswordHintTimeout`

`number` · default `0`

How long to show the last input character in hidden
entries.

This value is in milliseconds. 0 disables showing the
last char. 600 is a good value for enabling it.

### `gtkEntrySelectOnFocus`

`boolean` · default `true`

Whether to select the contents of an entry when it is focused.

### `gtkErrorBell`

`boolean` · default `true`

When `true`, keyboard navigation and other input-related errors
will cause a beep.

Since the error bell is implemented using `gdk_surface_beep()`, the
windowing system may offer ways to configure the error bell in many
ways, such as flashing the window or similar visual effects.

### `gtkFontconfigTimestamp`

`number` · default `0`

Timestamp of the current fontconfig configuration.

### `gtkFontName`

`string` · default `Sans 10`

The default font to use.

GTK uses the family name and size from this string.

### `gtkFontRendering`

`Gtk.FontRendering` · default `GTK_FONT_RENDERING_AUTOMATIC`

How GTK font rendering is set up.

When set to `Gtk.FontRendering.MANUAL`, GTK respects the low-level
font-related settings (`Gtk.Settings.gtkHintFontMetrics`,
`Gtk.Settings.gtkXftAntialias`, `Gtk.Settings.gtkXftHinting`,
`Gtk.Settings.gtkXftHintstyle` and `Gtk.Settings.gtkXftRgba`)
as much as practical.

When set to `Gtk.FontRendering.AUTOMATIC`, GTK will consider factors such
as screen resolution and scale in deciding how to render fonts.

_Available since 4.16._

### `gtkHintFontMetrics`

`boolean` · default `true`

Whether hinting should be applied to font metrics.

Note that this also turns off subpixel positioning of glyphs,
since it conflicts with metrics hinting.

_Available since 4.6._

### `gtkIconThemeName`

`string` · default `Adwaita`

Name of the icon theme to use.

See `Gtk.IconTheme` for details about how
GTK handles icon themes.

### `gtkImModule`

`string` · default `null`

Which IM (input method) module should be used by default.

This is the input method that will be used if the user has not
explicitly chosen another input method from the IM context menu.
This also can be a colon-separated list of input methods, which GTK
will try in turn until it finds one available on the system.

See `Gtk.IMContext`.

### `gtkInterfaceColorScheme`

`Gtk.InterfaceColorScheme` · default `GTK_INTERFACE_COLOR_SCHEME_UNSUPPORTED`

The color scheme used for rendering the user interface.

This setting communicates the system-wide preference.
The color scheme that is actually used when applying CSS
styles can be set with the `Gtk.CssProvider.prefersColorScheme`
property.

_Available since 4.20._

### `gtkInterfaceContrast`

`Gtk.InterfaceContrast` · default `GTK_INTERFACE_CONTRAST_UNSUPPORTED`

The level of contrast to use for the user interface.

This setting communicates the system-wide preference.
The contrast level that is actually used when applying CSS
styles can be set with the `Gtk.CssProvider.prefersContrast`
property.

_Available since 4.20._

### `gtkInterfaceReducedMotion`

`Gtk.ReducedMotion` · default `GTK_REDUCED_MOTION_NO_PREFERENCE`

Whether animations should be reduced to essential motions.

This setting communicates the system-wide preference.
The motion level that is actually used when applying CSS
styles can be set with the `Gtk.CssProvider.prefersReducedMotion`
property.

_Available since 4.22._

### `gtkKeynavUseCaret`

`boolean` · default `false`

Whether GTK should make sure that text can be navigated with
a caret, even if it is not editable.

This is useful when using a screen reader.

### `gtkLabelSelectOnFocus`

`boolean` · default `true`

Whether to select the contents of a selectable
label when it is focused.

### `gtkLongPressTime`

`number` · default `500`

The time for a button or touch press to be considered a “long press”.

See `Gtk.GestureLongPress`.

### `gtkOverlayScrolling`

`boolean` · default `true`

Whether scrolled windows may use overlaid scrolling indicators.

If this is set to `false`, scrolled windows will have permanent
scrollbars.

### `gtkPrimaryButtonWarpsSlider`

`boolean` · default `true`

If the value of this setting is `true`, clicking the primary button in a
`GtkRange` trough will move the slider, and hence set the range’s value, to
the point that you clicked.

If it is `false`, a primary click will cause the slider/value to move
by the range’s page-size towards the point clicked.

Whichever action you choose for the primary button, the other action will
be available by holding Shift and primary-clicking, or clicking the middle
mouse button.

### `gtkPrintBackends`

`string` · default `cups,file`

A comma-separated list of print backends to use in the print
dialog.

Available print backends depend on the GTK installation,
and may include "file", "cups", "lpr" or "papi".

### `gtkPrintPreviewCommand`

`string` · default `evince --unlink-tempfile --preview --print-settings %s %f`

A command to run for displaying the print preview.

The command should contain a `%f` placeholder, which will get
replaced by the path to the pdf file. The command may also
contain a `%s` placeholder, which will get replaced by the
path to a file containing the print settings in the format
produced by `Gtk.PrintSettings.toFile()`.

The preview application is responsible for removing the pdf
file and the print settings file when it is done.

### `gtkRecentFilesEnabled`

`boolean` · default `true`

Whether GTK should keep track of items inside the recently used
resources list.

If set to `false`, the list will always be empty.

### `gtkRecentFilesMaxAge`

`number` · default `30`

The maximum age, in days, of the items inside the recently used
resources list.

Items older than this setting will be excised from the list.
If set to 0, the list will always be empty; if set to -1, no
item will be removed.

### `gtkShellShowsAppMenu`

`boolean` · default `false` · deprecated since 4.20

Set to `true` if the desktop environment is displaying
the app menu, `false` if the app should display it itself.

> **Deprecated since 4.20.** This setting is not relevant anymore

### `gtkShellShowsDesktop`

`boolean` · default `true` · deprecated since 4.20

Set to `true` if the desktop environment is displaying
the desktop folder, `false` if not.

> **Deprecated since 4.20.** This setting is not relevant anymore

### `gtkShellShowsMenubar`

`boolean` · default `false` · deprecated since 4.20

Set to `true` if the desktop environment is displaying
the menubar, `false` if the app should display it itself.

> **Deprecated since 4.20.** This setting is not relevant anymore

### `gtkShowStatusShapes`

`boolean` · default `false`

When `true`, widgets like switches include shapes to indicate their on/off state.

_Available since 4.14._

### `gtkSoundThemeName`

`string` · default `freedesktop`

The XDG sound theme to use for event sounds.

See the [Sound Theme Specifications](http://www.freedesktop.org/wiki/Specifications/sound-theme-spec)
for more information on event sounds and sound themes.

GTK itself does not support event sounds, you have to use
a loadable module like the one that comes with libcanberra.

### `gtkSplitCursor`

`boolean` · default `false`

Whether two cursors should be displayed for mixed left-to-right and
right-to-left text.

### `gtkThemeName`

`string` · default `Default`

Name of the theme to load.

See `Gtk.CssProvider` for details about how
GTK finds the CSS stylesheet for a theme.

### `gtkTitlebarDoubleClick`

`string` · default `toggle-maximize`

Determines the action to take when a double-click
occurs on the titlebar of client-side decorated windows.

Recognized actions are minimize, toggle-maximize, menu, lower
or none.

### `gtkTitlebarMiddleClick`

`string` · default `none`

Determines the action to take when a middle-click
occurs on the titlebar of client-side decorated windows.

Recognized actions are minimize, toggle-maximize, menu, lower
or none.

### `gtkTitlebarRightClick`

`string` · default `menu`

Determines the action to take when a right-click
occurs on the titlebar of client-side decorated windows.

Recognized actions are minimize, toggle-maximize, menu, lower
or none.

### `gtkXftAntialias`

`number` · default `-1`

Whether to antialias fonts.

The values are 0 for no, 1 for yes, or -1 for the system default.

### `gtkXftDpi`

`number` · default `-1`

The font resolution, in 1024 * dots/inch.

-1 to use the default value.

### `gtkXftHinting`

`number` · default `-1`

Whether to enable font hinting.

The values are 0 for no, 1 for yes, or -1 for the system default.

### `gtkXftHintstyle`

`string` · default `null`

What degree of font hinting to use.

The possible vaues are hintnone, hintslight,
hintmedium, hintfull.

### `gtkXftRgba`

`string` · default `null`

The type of subpixel antialiasing to use.

The possible values are none, rgb, bgr, vrgb, vbgr.

Note that GSK does not support subpixel antialiasing, and this
setting has no effect on font rendering in GTK.

## Signals

### `onGtkPrivateChanged`

```ts
(self: Gtk.Settings) => void
```

From `GtkStyleProvider`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Settings` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `resetProperty`

```ts
resetProperty(name: string): void
```

Undoes the effect of calling `g_object_set()` to install an
application-specific value for a setting.

After this call, the setting will again follow the session-wide
value for this setting.

**Parameters**

- `name`: the name of the setting to reset
