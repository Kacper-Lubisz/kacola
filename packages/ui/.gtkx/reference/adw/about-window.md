---
description: "A window showing information about the application."
---

# AdwAboutWindow

A window showing information about the application.



An about window is typically opened when the user activates the `About …`
item in the application's primary menu. All parts of the window are optional.

### Main page

`AdwAboutWindow` prominently displays the application's icon, name, developer
name and version. They can be set with the `AboutWindow.applicationIcon`,
`AboutWindow.applicationName`,
`AboutWindow.developerName` and `AboutWindow.version`
respectively.

### What's New

`AdwAboutWindow` provides a way for applications to display their release
notes, set with the `AboutWindow.releaseNotes` property.

Release notes are formatted the same way as
[AppStream descriptions](https://freedesktop.org/software/appstream/docs/chap-Metadata.html#tag-description).

The supported formatting options are:

* Paragraph (`<p>`)
* Ordered list (`<ol>`), with list items (`<li>`)
* Unordered list (`<ul>`), with list items (`<li>`)

Within paragraphs and list items, emphasis (`<em>`) and inline code
(`<code>`) text styles are supported. The emphasis is rendered in italic,
while inline code is shown in a monospaced font.

Any text outside paragraphs or list items is ignored.

Nested lists are not supported.

Only one version can be shown at a time. By default, the displayed version
number matches `AboutWindow.version`. Use
`AboutWindow.releaseNotesVersion` to override it.

### Details

The Details page displays the application comments and links.

The comments can be set with the `AboutWindow.comments` property.
Unlike `Gtk.AboutDialog.comments`, this string can be long and
detailed. It can also contain links and Pango markup.

To set the application website, use `AboutWindow.website`.
To add extra links below the website, use `AboutWindow.addLink()`.

If the Details page doesn't have any other content besides website, the
website will be displayed on the main page instead.

### Troubleshooting

`AdwAboutWindow` displays the following two links on the main page:

* Support Questions, set with the `AboutWindow.supportUrl` property,
* Report an Issue, set with the `AboutWindow.issueUrl` property.

Additionally, applications can provide debugging information. It will be
shown separately on the Troubleshooting page. Use the
`AboutWindow.debugInfo` property to specify it.

It's intended to be attached to issue reports when reporting issues against
the application. As such, it cannot contain markup or links.

`AdwAboutWindow` provides a quick way to save debug information to a file.
When saving, `AboutWindow.debugInfoFilename` would be used as
the suggested filename.

### Credits and Acknowledgements

The Credits page has the following default sections:

* Developers, set with the `AboutWindow.developers` property,
* Designers, set with the `AboutWindow.designers` property,
* Artists, set with the `AboutWindow.artists` property,
* Documenters, set with the `AboutWindow.documenters` property,
* Translators, set with the `AboutWindow.translatorCredits` property.

When setting translator credits, use the strings `"translator-credits"` or
`"translator_credits"` and mark them as translatable.

The default sections that don't contain any names won't be displayed.

The Credits page can also contain an arbitrary number of extra sections below
the default ones. Use `AboutWindow.addCreditSection()` to add them.

The Acknowledgements page can be used to acknowledge additional people and
organizations for their non-development contributions. Use
`AboutWindow.addAcknowledgementSection()` to add sections to it. For
example, it can be used to list backers in a crowdfunded project or to give
special thanks.

Each of the people or organizations can have an email address or a website
specified. To add a email address, use a string like
`Edgar Allan Poe <edgar@poe.com>`. To specify a website with a title, use a
string like `The GNOME Project https://www.gnome.org`:



### Legal

The Legal page displays the copyright and licensing information for the
application and other modules.

The copyright string is set with the `AboutWindow.copyright`
property and should be a short string of one or two lines, for example:
`© 2022 Example`.

Licensing information can be quickly set from a list of known licenses with
the `AboutWindow.licenseType` property. If the application's
license is not in the list, `AboutWindow.license` can be used
instead.

To add information about other modules, such as application dependencies or
data, use `AboutWindow.addLegalSection()`.

### Constructing

To make constructing an `AdwAboutWindow` as convenient as possible, you can
use the function `showAboutWindow()` which constructs and shows a
window.

```c
static void
show_about (GtkApplication *app)
{
  const char *developers[] = {
    "Angela Avery",
    NULL
  };

  const char *designers[] = {
    "GNOME Design Team",
    NULL
  };

  adw_show_about_window (gtk_application_get_active_window (app),
                         "application-name", _("Example"),
                         "application-icon", "org.example.App",
                         "version", "1.2.3",
                         "copyright", "© 2022 Angela Avery",
                         "issue-url", "https://gitlab.gnome.org/example/example/-/issues/",
                         "license-type", GTK_LICENSE_GPL_3_0,
                         "developers", developers,
                         "designers", designers,
                         "translator-credits", _("translator-credits"),
                         NULL);
}
```

### CSS nodes

`AdwAboutWindow` has a main CSS node with the name `window` and the
style class `.about`.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

```tsx
import { AdwAboutWindow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [AdwWindow](.gtkx/reference/adw/window.md) → **AdwAboutWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.AboutWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `applicationIcon`

`string` · deprecated since 1.6

The name of the application icon.

The icon is displayed at the top of the main page.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `applicationName`

`string` · deprecated since 1.6

The name of the application.

The name is displayed at the top of the main page.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `artists`

`string[]` · deprecated since 1.6

The list of artists of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for
more details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `comments`

`string` · deprecated since 1.6

The comments about the application.

Comments will be shown on the Details page, above links.

Unlike `Gtk.AboutDialog.comments`, this string can be long and
detailed. It can also contain links and Pango markup.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `copyright`

`string` · deprecated since 1.6

The copyright information.

This should be a short string of one or two lines, for example:
`© 2022 Example`.

The copyright information will be displayed on the Legal page, above the
application license.

`AboutWindow.addLegalSection()` can be used to add copyright
information for the application dependencies or other components.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `debugInfo`

`string` · deprecated since 1.6

The debug information.

Debug information will be shown on the Troubleshooting page. It's intended
to be attached to issue reports when reporting issues against the
application.

`AdwAboutWindow` provides a quick way to save debug information to a file.
When saving, `AboutWindow.debugInfoFilename` would be used as
the suggested filename.

Debug information cannot contain markup or links.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `debugInfoFilename`

`string` · deprecated since 1.6

The debug information filename.

It will be used as the suggested filename when saving debug information to
a file.

See `AboutWindow.debugInfo`.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `designers`

`string[]` · deprecated since 1.6

The list of designers of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for
more details.

See also:

* `AboutWindow.developers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `developerName`

`string` · deprecated since 1.6

The developer name.

The developer name is displayed on the main page, under the application
name.

If the application is developed by multiple people, the developer name can
be set to values like "AppName team", "AppName developers" or
"The AppName project", and the individual contributors can be listed on the
Credits page, with `AboutWindow.developers` and related
properties.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `developers`

`string[]` · deprecated since 1.6

The list of developers of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for
more details.

See also:

* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `documenters`

`string[]` · deprecated since 1.6

The list of documenters of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for
more details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `issueUrl`

`string` · deprecated since 1.6

The URL for the application's issue tracker.

The issue tracker link is displayed on the main page.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `license`

`string` · deprecated since 1.6

The license text.

This can be used to set a custom text for the license if it can't be set
via `AboutWindow.licenseType`.

When set, `AboutWindow.licenseType` will be set to
`Gtk.License.custom`.

The license text will be displayed on the Legal page, below the copyright
information.

License text can contain Pango markup and links.

`AboutWindow.addLegalSection()` can be used to add license
information for the application dependencies or other components.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `licenseType`

`Gtk.License` · default `GTK_LICENSE_UNKNOWN` · deprecated since 1.6

The license type.

Allows to set the application's license froma list of known licenses.

If the application's license is not in the list,
`AboutWindow.license` can be used instead. The license type will
be automatically set to `Gtk.License.custom` in that case.

If set to `Gtk.License.unknown`, no information will be displayed.

If the license type is different from `Gtk.License.custom`.
`AboutWindow.license` will be cleared out.

The license description will be displayed on the Legal page, below the
copyright information.

`AboutWindow.addLegalSection()` can be used to add license
information for the application dependencies or other components.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `releaseNotes`

`string` · deprecated since 1.6

The release notes of the application.

Release notes are displayed on the the What's New page.

Release notes are formatted the same way as
[AppStream descriptions](https://freedesktop.org/software/appstream/docs/chap-Metadata.html#tag-description).

The supported formatting options are:

* Paragraph (`<p>`)
* Ordered list (`<ol>`), with list items (`<li>`)
* Unordered list (`<ul>`), with list items (`<li>`)

Within paragraphs and list items, emphasis (`<em>`) and inline code
(`<code>`) text styles are supported. The emphasis is rendered in italic,
while inline code is shown in a monospaced font.

Any text outside paragraphs or list items is ignored.

Nested lists are not supported.

`AdwAboutWindow` displays the version above the release notes. If set, the
`AboutWindow.releaseNotesVersion` of the property will be used
as the version; otherwise, `AboutWindow.version` is used.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `releaseNotesVersion`

`string` · deprecated since 1.6

The version described by the application's release notes.

The release notes version is displayed on the What's New page, above the
release notes.

If not set, `AboutWindow.version` will be used instead.

For example, an application with the current version 2.0.2 might want to
keep the release notes from 2.0.0, and set the release notes version
accordingly.

See `AboutWindow.releaseNotes`.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `supportUrl`

`string` · deprecated since 1.6

The URL of the application's support page.

The support page link is displayed on the main page.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `translatorCredits`

`string` · deprecated since 1.6

The translator credits string.

It will be displayed on the Credits page.

This string should be `"translator-credits"` or `"translator_credits"` and
should be marked as translatable.

The string may contain email addresses and URLs, see the introduction for
more details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `version`

`string` · deprecated since 1.6

The version of the application.

The version is displayed on the main page.

If `AboutWindow.releaseNotesVersion` is not set, the version
will also be displayed above the release notes on the What's New page.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `website`

`string` · deprecated since 1.6

The URL of the application's website.

Website is displayed on the Details page, below comments, or on the main
page if the Details page doesn't have any other content.

Applications can add other links below, see `AboutWindow.addLink()`.

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

## Signals

### `onActivateLink`

```ts
(uri: string, self: Adw.AboutWindow) => boolean | undefined
```

Emitted when a URL is activated.

Applications may connect to it to override the default behavior, which is
to call `Gtk.showUri()`.

**Parameters**

- `uri`: the URI to activate
- `self`: The instance the signal was emitted on.

**Returns** `TRUE` if the link has been activated

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

## Methods

Methods are called on the `Adw.AboutWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addAcknowledgementSection`

```ts
addAcknowledgementSection(name: string | null, people: string[]): void
```

Adds a section to the Acknowledgements page.

This can be used to acknowledge additional people and organizations for their
non-development contributions - for example, backers in a crowdfunded
project.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`

**Parameters**

- `name`: the section name
- `people`: the list of names

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `addCreditSection`

```ts
addCreditSection(name: string | null, people: string[]): void
```

Adds an extra section to the Credits page.

Extra sections are displayed below the standard categories.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `name`: the section name
- `people`: the list of names

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `addLegalSection`

```ts
addLegalSection(title: string, copyright: string | null, licenseType: Gtk.License, license: string | null): void
```

Adds an extra section to the Legal page.

Extra sections will be displayed below the application's own information.

The parameters `copyright`, `license_type` and `license` will be used to present
the it the same way as `AboutWindow.copyright`,
`AboutWindow.licenseType` and `AboutWindow.license` are
for the application's own information.

See those properties for more details.

This can be useful to attribute the application dependencies or data.

Examples:

```c
adw_about_window_add_legal_section (ADW_ABOUT_WINDOW (about),
                                    _("Copyright and a known license"),
                                    "© 2022 Example",
                                    GTK_LICENSE_LGPL_2_1,
                                    NULL);

adw_about_window_add_legal_section (ADW_ABOUT_WINDOW (about),
                                    _("Copyright and custom license"),
                                    "© 2022 Example",
                                    GTK_LICENSE_CUSTOM,
                                    "Custom license text");

adw_about_window_add_legal_section (ADW_ABOUT_WINDOW (about),
                                    _("Copyright only"),
                                    "© 2022 Example",
                                    GTK_LICENSE_UNKNOWN,
                                    NULL);

adw_about_window_add_legal_section (ADW_ABOUT_WINDOW (about),
                                    _("Custom license only"),
                                    NULL,
                                    GTK_LICENSE_CUSTOM,
                                    "Something completely custom here.");
```

**Parameters**

- `title`: the name of the section
- `copyright`: a copyright string
- `licenseType`: the type of license
- `license`: custom license information

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `addLink`

```ts
addLink(title: string, url: string): void
```

Adds an extra link to the Details page.

Extra links are displayed under the comment and website.

Underlines in `title` will be interpreted as indicating a mnemonic.

See `AboutWindow.website`.

**Parameters**

- `title`: the link title
- `url`: the link URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getApplicationIcon`

```ts
getApplicationIcon(): string
```

Gets the name of the application icon for `self`.

**Returns** the application icon name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getApplicationName`

```ts
getApplicationName(): string
```

Gets the application name for `self`.

**Returns** the application name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getArtists`

```ts
getArtists(): string[] | null
```

Gets the list of artists of the application.

**Returns** The list of artists

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getComments`

```ts
getComments(): string
```

Gets the comments about the application.

**Returns** the comments

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getCopyright`

```ts
getCopyright(): string
```

Gets the copyright information for `self`.

**Returns** the copyright information

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDebugInfo`

```ts
getDebugInfo(): string
```

Gets the debug information for `self`.

**Returns** the debug information

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDebugInfoFilename`

```ts
getDebugInfoFilename(): string
```

Gets the debug information filename for `self`.

**Returns** the debug information filename

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDesigners`

```ts
getDesigners(): string[] | null
```

Gets the list of designers of the application.

**Returns** The list of designers

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDeveloperName`

```ts
getDeveloperName(): string
```

Gets the developer name for `self`.

**Returns** the developer_name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDevelopers`

```ts
getDevelopers(): string[] | null
```

Gets the list of developers of the application.

**Returns** The list of developers

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getDocumenters`

```ts
getDocumenters(): string[] | null
```

Gets the list of documenters of the application.

**Returns** The list of documenters

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getIssueUrl`

```ts
getIssueUrl(): string
```

Gets the issue tracker URL for `self`.

**Returns** the issue tracker URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getLicense`

```ts
getLicense(): string
```

Gets the license for `self`.

**Returns** the license

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getLicenseType`

```ts
getLicenseType(): Gtk.License
```

Gets the license type for `self`.

**Returns** the license type

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getReleaseNotes`

```ts
getReleaseNotes(): string
```

Gets the release notes for `self`.

**Returns** the release notes

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getReleaseNotesVersion`

```ts
getReleaseNotesVersion(): string
```

Gets the version described by the application's release notes.

**Returns** the release notes version

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getSupportUrl`

```ts
getSupportUrl(): string
```

Gets the URL of the support page for `self`.

**Returns** the support page URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getTranslatorCredits`

```ts
getTranslatorCredits(): string
```

Gets the translator credits string.

**Returns** The translator credits string

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getVersion`

```ts
getVersion(): string
```

Gets the version for `self`.

**Returns** the version

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `getWebsite`

```ts
getWebsite(): string
```

Gets the application website URL for `self`.

**Returns** the website URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setApplicationIcon`

```ts
setApplicationIcon(applicationIcon: string): void
```

Sets the name of the application icon for `self`.

The icon is displayed at the top of the main page.

**Parameters**

- `applicationIcon`: the application icon name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setApplicationName`

```ts
setApplicationName(applicationName: string): void
```

Sets the application name for `self`.

The name is displayed at the top of the main page.

**Parameters**

- `applicationName`: the application name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setArtists`

```ts
setArtists(artists: string[] | null): void
```

Sets the list of artists of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `artists`: the list of artists

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setComments`

```ts
setComments(comments: string): void
```

Sets the comments about the application.

Comments will be shown on the Details page, above links.

Unlike `Gtk.AboutDialog.comments`, this string can be long and
detailed. It can also contain links and Pango markup.

**Parameters**

- `comments`: the comments

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setCopyright`

```ts
setCopyright(copyright: string): void
```

Sets the copyright information for `self`.

This should be a short string of one or two lines, for example:
`© 2022 Example`.

The copyright information will be displayed on the Legal page, before the
application license.

`AboutWindow.addLegalSection()` can be used to add copyright
information for the application dependencies or other components.

**Parameters**

- `copyright`: the copyright information

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDebugInfo`

```ts
setDebugInfo(debugInfo: string): void
```

Sets the debug information for `self`.

Debug information will be shown on the Troubleshooting page. It's intended
to be attached to issue reports when reporting issues against the
application.

`AdwAboutWindow` provides a quick way to save debug information to a file.
When saving, `AboutWindow.debugInfoFilename` would be used as
the suggested filename.

Debug information cannot contain markup or links.

**Parameters**

- `debugInfo`: the debug information

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDebugInfoFilename`

```ts
setDebugInfoFilename(filename: string): void
```

Sets the debug information filename for `self`.

It will be used as the suggested filename when saving debug information to a
file.

See `AboutWindow.debugInfo`.

**Parameters**

- `filename`: the debug info filename

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDesigners`

```ts
setDesigners(designers: string[] | null): void
```

Sets the list of designers of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.developers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `designers`: the list of designers

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDeveloperName`

```ts
setDeveloperName(developerName: string): void
```

Sets the developer name for `self`.

The developer name is displayed on the main page, under the application name.

If the application is developed by multiple people, the developer name can be
set to values like "AppName team", "AppName developers" or
"The AppName project", and the individual contributors can be listed on the
Credits page, with `AboutWindow.developers` and related properties.

**Parameters**

- `developerName`: the developer name

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDevelopers`

```ts
setDevelopers(developers: string[] | null): void
```

Sets the list of developers of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `developers`: the list of developers

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setDocumenters`

```ts
setDocumenters(documenters: string[] | null): void
```

Sets the list of documenters of the application.

It will be displayed on the Credits page.

Each name may contain email addresses and URLs, see the introduction for more
details.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.translatorCredits`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `documenters`: the list of documenters

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setIssueUrl`

```ts
setIssueUrl(issueUrl: string): void
```

Sets the issue tracker URL for `self`.

The issue tracker link is displayed on the main page.

**Parameters**

- `issueUrl`: the issue tracker URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setLicense`

```ts
setLicense(license: string): void
```

Sets the license for `self`.

This can be used to set a custom text for the license if it can't be set via
`AboutWindow.licenseType`.

When set, `AboutWindow.licenseType` will be set to
`Gtk.License.custom`.

The license text will be displayed on the Legal page, below the copyright
information.

License text can contain Pango markup and links.

`AboutWindow.addLegalSection()` can be used to add license information
for the application dependencies or other components.

**Parameters**

- `license`: the license

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setLicenseType`

```ts
setLicenseType(licenseType: Gtk.License): void
```

Sets the license for `self` from a list of known licenses.

If the application's license is not in the list,
`AboutWindow.license` can be used instead. The license type will be
automatically set to `Gtk.License.custom` in that case.

If `license_type` is `Gtk.License.unknown`, no information will be displayed.

If `license_type` is different from `Gtk.License.custom`.
`AboutWindow.license` will be cleared out.

The license description will be displayed on the Legal page, below the
copyright information.

`AboutWindow.addLegalSection()` can be used to add license information
for the application dependencies or other components.

**Parameters**

- `licenseType`: the license type

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setReleaseNotes`

```ts
setReleaseNotes(releaseNotes: string): void
```

Sets the release notes for `self`.

Release notes are displayed on the the What's New page.

Release notes are formatted the same way as
[AppStream descriptions](https://freedesktop.org/software/appstream/docs/chap-Metadata.html#tag-description).

The supported formatting options are:

* Paragraph (`<p>`)
* Ordered list (`<ol>`), with list items (`<li>`)
* Unordered list (`<ul>`), with list items (`<li>`)

Within paragraphs and list items, emphasis (`<em>`) and inline code
(`<code>`) text styles are supported. The emphasis is rendered in italic,
while inline code is shown in a monospaced font.

Any text outside paragraphs or list items is ignored.

Nested lists are not supported.

`AdwAboutWindow` displays the version above the release notes. If set, the
`AboutWindow.releaseNotesVersion` of the property will be used
as the version; otherwise, `AboutWindow.version` is used.

**Parameters**

- `releaseNotes`: the release notes

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setReleaseNotesVersion`

```ts
setReleaseNotesVersion(version: string): void
```

Sets the version described by the application's release notes.

The release notes version is displayed on the What's New page, above the
release notes.

If not set, `AboutWindow.version` will be used instead.

For example, an application with the current version 2.0.2 might want to
keep the release notes from 2.0.0, and set the release notes version
accordingly.

See `AboutWindow.releaseNotes`.

**Parameters**

- `version`: the release notes version

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setSupportUrl`

```ts
setSupportUrl(supportUrl: string): void
```

Sets the URL of the support page for `self`.

The support page link is displayed on the main page.

**Parameters**

- `supportUrl`: the support page URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setTranslatorCredits`

```ts
setTranslatorCredits(translatorCredits: string): void
```

Sets the translator credits string.

It will be displayed on the Credits page.

This string should be `"translator-credits"` or `"translator_credits"` and
should be marked as translatable.

The string may contain email addresses and URLs, see the introduction for
more details. When there is more than one translator, they must be
separated by a newline in the same string.

See also:

* `AboutWindow.developers`
* `AboutWindow.designers`
* `AboutWindow.artists`
* `AboutWindow.documenters`
* `AboutWindow.addCreditSection()`
* `AboutWindow.addAcknowledgementSection()`

**Parameters**

- `translatorCredits`: the translator credits

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setVersion`

```ts
setVersion(version: string): void
```

Sets the version for `self`.

The version is displayed on the main page.

If `AboutWindow.releaseNotesVersion` is not set, the version will
also be displayed above the release notes on the What's New page.

**Parameters**

- `version`: the version

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._

### `setWebsite`

```ts
setWebsite(website: string): void
```

Sets the application website URL for `self`.

Website is displayed on the Details page, below comments, or on the main page
if the Details page doesn't have any other content.

Applications can add other links below, see `AboutWindow.addLink()`.

**Parameters**

- `website`: the website URL

> **Deprecated since 1.6.** Use `AboutDialog`.

_Available since 1.2._
