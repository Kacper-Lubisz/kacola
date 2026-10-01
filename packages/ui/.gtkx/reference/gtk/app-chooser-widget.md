---
description: "GtkAppChooserWidget is a widget for selecting applications."
---

# GtkAppChooserWidget

`GtkAppChooserWidget` is a widget for selecting applications.

It is the main building block for `Gtk.AppChooserDialog`.
Most applications only need to use the latter; but you can use
this widget as part of a larger widget if you have special needs.

`GtkAppChooserWidget` offers detailed control over what applications
are shown, using the
`Gtk.AppChooserWidget.showDefault`,
`Gtk.AppChooserWidget.showRecommended`,
`Gtk.AppChooserWidget.showFallback`,
`Gtk.AppChooserWidget.showOther` and
`Gtk.AppChooserWidget.showAll` properties. See the
`Gtk.AppChooser` documentation for more information about these
groups of applications.

To keep track of the selected application, use the
`Gtk.AppChooserWidget.application-selected` and
`Gtk.AppChooserWidget.application-activated` signals.

### CSS nodes

`GtkAppChooserWidget` has a single CSS node with name appchooser.

> **Deprecated since 4.10.** The application selection widgets should be implemented according to the design of each platform and/or application requiring them.

```tsx
import { GtkAppChooserWidget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkAppChooserWidget**

Implements `GtkAccessible`, `GtkAppChooser`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.AppChooserWidget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `contentType`

`string` · default `null` · construct-only · from `GtkAppChooser`

The content type of the `GtkAppChooser` object.

See `GContentType` for more information about content types.

### `defaultText`

`string` · default `null`

The text that appears in the widget when there are no applications
for the given content type.

### `showAll`

`boolean` · default `false`

If `true`, the app chooser presents all applications
in a single list, without subsections for default,
recommended or related applications.

### `showDefault`

`boolean` · default `false`

Determines whether the app chooser should show the default
handler for the content type in a separate section.

If `false`, the default handler is listed among the recommended
applications.

### `showFallback`

`boolean` · default `false`

Determines whether the app chooser should show a section
for fallback applications.

If `false`, the fallback applications are listed among the
other applications.

### `showOther`

`boolean` · default `false`

Determines whether the app chooser should show a section
for other applications.

### `showRecommended`

`boolean` · default `true`

Determines whether the app chooser should show a section
for recommended applications.

If `false`, the recommended applications are listed
among the other applications.

## Signals

### `onApplicationActivated`

```ts
(application: Gio.AppInfo, self: Gtk.AppChooserWidget) => void
```

Emitted when an application item is activated from the widget's list.

This usually happens when the user double clicks an item, or an item
is selected and the user presses one of the keys Space, Shift+Space,
Return or Enter.

**Parameters**

- `application`: the activated `GAppInfo`
- `self`: The instance the signal was emitted on.

### `onApplicationSelected`

```ts
(application: Gio.AppInfo, self: Gtk.AppChooserWidget) => void
```

Emitted when an application item is selected from the widget's list.

**Parameters**

- `application`: the selected `GAppInfo`
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.AppChooserWidget` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getDefaultText`

```ts
getDefaultText(): string | null
```

Returns the text that is shown if there are not applications
that can handle the content type.

**Returns** the value of `Gtk.AppChooserWidget.defaultText`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowAll`

```ts
getShowAll(): boolean
```

Gets whether the app chooser should show all applications
in a flat list.

**Returns** the value of `Gtk.AppChooserWidget.showAll`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowDefault`

```ts
getShowDefault(): boolean
```

Gets whether the app chooser should show the default handler
for the content type in a separate section.

**Returns** the value of `Gtk.AppChooserWidget.showDefault`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowFallback`

```ts
getShowFallback(): boolean
```

Gets whether the app chooser should show related applications
for the content type in a separate section.

**Returns** the value of `Gtk.AppChooserWidget.showFallback`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowOther`

```ts
getShowOther(): boolean
```

Gets whether the app chooser should show applications
which are unrelated to the content type.

**Returns** the value of `Gtk.AppChooserWidget.showOther`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowRecommended`

```ts
getShowRecommended(): boolean
```

Gets whether the app chooser should show recommended applications
for the content type in a separate section.

**Returns** the value of `Gtk.AppChooserWidget.showRecommended`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setDefaultText`

```ts
setDefaultText(text: string): void
```

Sets the text that is shown if there are not applications
that can handle the content type.

**Parameters**

- `text`: the new value for `Gtk.AppChooserWidget.defaultText`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowAll`

```ts
setShowAll(setting: boolean): void
```

Sets whether the app chooser should show all applications
in a flat list.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserWidget.showAll`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowDefault`

```ts
setShowDefault(setting: boolean): void
```

Sets whether the app chooser should show the default handler
for the content type in a separate section.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserWidget.showDefault`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowFallback`

```ts
setShowFallback(setting: boolean): void
```

Sets whether the app chooser should show related applications
for the content type in a separate section.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserWidget.showFallback`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowOther`

```ts
setShowOther(setting: boolean): void
```

Sets whether the app chooser should show applications
which are unrelated to the content type.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserWidget.showOther`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowRecommended`

```ts
setShowRecommended(setting: boolean): void
```

Sets whether the app chooser should show recommended applications
for the content type in a separate section.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserWidget.showRecommended`

> **Deprecated since 4.10.** This widget will be removed in GTK 5
