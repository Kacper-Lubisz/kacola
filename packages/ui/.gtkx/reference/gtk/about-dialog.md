---
description: "Displays information about a program."
---

# GtkAboutDialog

Displays information about a program.

The shown information includes the programs' logo, name, copyright,
website and license. It is also possible to give credits to the authors,
documenters, translators and artists who have worked on the program.

An about dialog is typically opened when the user selects the `About`
option from the `Help` menu. All parts of the dialog are optional.



About dialogs often contain links and email addresses. `GtkAboutDialog`
displays these as clickable links. By default, it calls `Gtk.FileLauncher.launch()`
when a user clicks one. The behaviour can be overridden with the
`Gtk.AboutDialog.activate-link` signal.

To specify a person with an email address, use a string like
`Edgar Allan Poe <edgar@poe.com>`. To specify a website with a title,
use a string like `GTK team https://www.gtk.org`.

To make constructing an about dialog as convenient as possible, you can
use the function `Gtk.showAboutDialog()` which constructs and shows
a dialog and keeps it around so that it can be shown again.

Note that GTK sets a default title of `_("About %s")` on the dialog
window (where `%s` is replaced by the name of the application, but in
order to ensure proper translation of the title, applications should
set the title property explicitly when constructing an about dialog,
as shown in the following example:

```c
GFile *logo_file = g_file_new_for_path ("./logo.png");
GdkTexture *example_logo = gdk_texture_new_from_file (logo_file, NULL);
g_object_unref (logo_file);

gtk_show_about_dialog (NULL,
                       "program-name", "ExampleCode",
                       "logo", example_logo,
                       "title", _("About ExampleCode"),
                       NULL);
```

### Shortcuts and Gestures

`GtkAboutDialog` supports the following keyboard shortcuts:

- <kbd>Escape</kbd> closes the window.

### CSS nodes

`GtkAboutDialog` has a single CSS node with the name `window` and style
class `.aboutdialog`.

```tsx
import { GtkAboutDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **GtkAboutDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.AboutDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `artists`

`string[]`

The people who contributed artwork to the program.

Each string may contain email addresses and URLs, which will be displayed
as links.

### `authors`

`string[]`

The authors of the program.

Each string may contain email addresses and URLs, which will be displayed
as links, see the introduction for more details.

### `comments`

`string` · default `null`

Comments about the program.

This string is displayed in a label in the main dialog, thus it
should be a short explanation of the main purpose of the program,
not a detailed list of features.

### `copyright`

`string` · default `null`

Copyright information for the program.

### `creditSections`

`CreditSection[] | null`

Extra sections appended to the dialog's credits. GTK offers no way to remove one, so the list cannot change once it has been applied.

### `documenters`

`string[]`

The people documenting the program.

Each string may contain email addresses and URLs, which will be displayed
as links, see the introduction for more details.

### `license`

`string` · default `null`

The license of the program, as free-form text.

This string is displayed in a text view in a secondary dialog, therefore
it is fine to use a long multi-paragraph text. Note that the text is only
wrapped in the text view if the "wrap-license" property is set to `TRUE`;
otherwise the text itself must contain the intended linebreaks.

When setting this property to a non-`NULL` value, the
`Gtk.AboutDialog.licenseType` property is set to
`Gtk.License.custom` as a side effect.

The text may contain links in this format `<http://www.some.place/>`
and email references in the form `<mail-to@some.body>`, and these will
be converted into clickable links.

### `licenseType`

`Gtk.License` · default `GTK_LICENSE_UNKNOWN`

The license of the program.

The `GtkAboutDialog` will automatically fill out a standard disclaimer
and link the user to the appropriate online resource for the license
text.

If `Gtk.License.unknown` is used, the link used will be the same
specified in the `Gtk.AboutDialog.website` property.

If `Gtk.License.custom` is used, the current contents of the
`Gtk.AboutDialog.license` property are used.

For any other `Gtk.License` value, the contents of the
`Gtk.AboutDialog.license` property are also set by
this property as a side effect.

### `logo`

`Gdk.Paintable | ReactElement`

A logo for the about box.

If it is `NULL`, the default window icon set with
`Gtk.Window.setDefaultIconName()` will be used.

### `logoIconName`

`string` · default `null`

A named icon to use as the logo for the about box.

This property overrides the `Gtk.AboutDialog.logo` property.

### `programName`

`string` · default `null`

The name of the program.

If this is not set, it defaults to the value returned by
`GLib.getApplicationName()`.

### `systemInformation`

`string` · default `null`

Information about the system on which the program is running.

This information is displayed in a separate page, therefore it is fine
to use a long multi-paragraph text. Note that the text should contain
the intended linebreaks.

The text may contain links in this format `<http://www.some.place/>`
and email references in the form `<mail-to@some.body>`, and these will
be converted into clickable links.

### `translatorCredits`

`string` · default `null`

Credits to the translators.

This string should be marked as translatable.

The string may contain email addresses and URLs, which will be displayed
as links, see the introduction for more details.

### `version`

`string` · default `null`

The version of the program.

### `website`

`string` · default `null`

The URL for the link to the website of the program.

This should be a string starting with `http://` or `https://`.

### `websiteLabel`

`string` · default `null`

The label for the link to the website of the program.

### `wrapLicense`

`boolean` · default `false`

Whether to wrap the text in the license dialog.

## Signals

### `onActivateLink`

```ts
(uri: string, self: Gtk.AboutDialog) => boolean | undefined
```

Emitted every time a URL is activated.

Applications may connect to it to override the default behaviour,
which is to call `Gtk.FileLauncher.launch()`.

**Parameters**

- `uri`: the URI that is activated
- `self`: The instance the signal was emitted on.

**Returns** `TRUE` if the link has been activated

## Methods

Methods are called on the `Gtk.AboutDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addCreditSection`

```ts
addCreditSection(sectionName: string, people: string[]): void
```

Creates a new section in the "Credits" page.

**Parameters**

- `sectionName`: The name of the section
- `people`: the people who belong to that section

### `getArtists`

```ts
getArtists(): string[]
```

Returns the names of the artists which are displayed
in the credits page.

**Returns** A
  `NULL`-terminated string array containing the artists

### `getAuthors`

```ts
getAuthors(): string[]
```

Returns the names of the authors which are displayed
in the credits page.

**Returns** A
  `NULL`-terminated string array containing the authors

### `getComments`

```ts
getComments(): string | null
```

Returns the comments string.

**Returns** The comments

### `getCopyright`

```ts
getCopyright(): string | null
```

Returns the copyright string.

**Returns** The copyright string

### `getDocumenters`

```ts
getDocumenters(): string[]
```

Returns the name of the documenters which are displayed
in the credits page.

**Returns** A
  `NULL`-terminated string array containing the documenters

### `getLicense`

```ts
getLicense(): string | null
```

Returns the license information.

**Returns** The license information

### `getLicenseType`

```ts
getLicenseType(): Gtk.License
```

Retrieves the license type.

**Returns** a `Gtk.License` value

### `getLogo`

```ts
getLogo(): Gdk.Paintable | null
```

Returns the paintable displayed as logo in the about dialog.

**Returns** the paintable displayed as
  logo or `NULL` if the logo is unset or has been set via
  `Gtk.AboutDialog.setLogoIconName()`

### `getLogoIconName`

```ts
getLogoIconName(): string | null
```

Returns the icon name displayed as logo in the about dialog.

**Returns** the icon name displayed as logo,
  or `NULL` if the logo has been set via `Gtk.AboutDialog.setLogo()`

### `getProgramName`

```ts
getProgramName(): string | null
```

Returns the program name displayed in the about dialog.

**Returns** the program name

### `getSystemInformation`

```ts
getSystemInformation(): string | null
```

Returns the system information that is shown in the about dialog.

**Returns** the system information

### `getTranslatorCredits`

```ts
getTranslatorCredits(): string | null
```

Returns the translator credits string which is displayed
in the credits page.

**Returns** The translator credits string

### `getVersion`

```ts
getVersion(): string | null
```

Returns the version string.

**Returns** The version string

### `getWebsite`

```ts
getWebsite(): string | null
```

Returns the website URL.

**Returns** The website URL

### `getWebsiteLabel`

```ts
getWebsiteLabel(): string | null
```

Returns the label used for the website link.

**Returns** The label used for the website link

### `getWrapLicense`

```ts
getWrapLicense(): boolean
```

Returns whether the license text in the about dialog is
automatically wrapped.

**Returns** `TRUE` if the license text is wrapped

### `setArtists`

```ts
setArtists(artists: string[]): void
```

Sets the names of the artists to be displayed
in the "Credits" page.

**Parameters**

- `artists`: the authors of the artwork of the application

### `setAuthors`

```ts
setAuthors(authors: string[]): void
```

Sets the names of the authors which are displayed
in the "Credits" page of the about dialog.

**Parameters**

- `authors`: the authors of the application

### `setComments`

```ts
setComments(comments: string | null): void
```

Sets the comments string to display in the about dialog.

This should be a short string of one or two lines.

**Parameters**

- `comments`: a comments string

### `setCopyright`

```ts
setCopyright(copyright: string | null): void
```

Sets the copyright string to display in the about dialog.

This should be a short string of one or two lines.

**Parameters**

- `copyright`: the copyright string

### `setDocumenters`

```ts
setDocumenters(documenters: string[]): void
```

Sets the names of the documenters which are displayed
in the "Credits" page.

**Parameters**

- `documenters`: the authors of the documentation of the application

### `setLicense`

```ts
setLicense(license: string | null): void
```

Sets the license information to be displayed in the
about dialog.

If `license` is `NULL`, the license page is hidden.

**Parameters**

- `license`: the license information

### `setLicenseType`

```ts
setLicenseType(licenseType: Gtk.License): void
```

Sets the license of the application showing the about dialog
from a list of known licenses.

This function overrides the license set using
`Gtk.AboutDialog.setLicense()`.

**Parameters**

- `licenseType`: the type of license

### `setLogo`

```ts
setLogo(logo: Gdk.Paintable | null): void
```

Sets the logo in the about dialog.

**Parameters**

- `logo`: a `GdkPaintable`

### `setLogoIconName`

```ts
setLogoIconName(iconName: string | null): void
```

Sets the icon name to be displayed as logo in the about dialog.

**Parameters**

- `iconName`: an icon name

### `setProgramName`

```ts
setProgramName(name: string | null): void
```

Sets the name to display in the about dialog.

If `name` is not set, the string returned
by `g_get_application_name()` is used.

**Parameters**

- `name`: the program name

### `setSystemInformation`

```ts
setSystemInformation(systemInformation: string | null): void
```

Sets the system information to be displayed in the about
dialog.

If `system_information` is `NULL`, the system information
page is hidden.

See `Gtk.AboutDialog.systemInformation`.

**Parameters**

- `systemInformation`: system information

### `setTranslatorCredits`

```ts
setTranslatorCredits(translatorCredits: string | null): void
```

Sets the translator credits string which is displayed in
the credits page.

The intended use for this string is to display the translator
of the language which is currently used in the user interface.
Using `gettext()`, a simple way to achieve that is to mark the
string for translation:

```c
GtkWidget *about = gtk_about_dialog_new ();
 gtk_about_dialog_set_translator_credits (GTK_ABOUT_DIALOG (about),
                                          _("translator-credits"));
```

It is a good idea to use the customary `msgid` “translator-credits”
for this purpose, since translators will already know the purpose of
that `msgid`, and since `GtkAboutDialog` will detect if “translator-credits”
is untranslated and omit translator credits.

**Parameters**

- `translatorCredits`: the translator credits

### `setVersion`

```ts
setVersion(version: string | null): void
```

Sets the version string to display in the about dialog.

**Parameters**

- `version`: the version string

### `setWebsite`

```ts
setWebsite(website: string | null): void
```

Sets the URL to use for the website link.

**Parameters**

- `website`: a URL string starting with `http://`

### `setWebsiteLabel`

```ts
setWebsiteLabel(websiteLabel: string): void
```

Sets the label to be used for the website link.

**Parameters**

- `websiteLabel`: the label used for the website link

### `setWrapLicense`

```ts
setWrapLicense(wrapLicense: boolean): void
```

Sets whether the license text in the about dialog should be
automatically wrapped.

**Parameters**

- `wrapLicense`: whether to wrap the license
