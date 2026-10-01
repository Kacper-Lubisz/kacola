---
description: "The GtkAppChooserButton lets the user select an application."
---

# GtkAppChooserButton

The `GtkAppChooserButton` lets the user select an application.



Initially, a `GtkAppChooserButton` selects the first application
in its list, which will either be the most-recently used application
or, if `Gtk.AppChooserButton.showDefaultItem` is `true`, the
default application.

The list of applications shown in a `GtkAppChooserButton` includes
the recommended applications for the given content type. When
`Gtk.AppChooserButton.showDefaultItem` is set, the default
application is also included. To let the user chooser other applications,
you can set the `Gtk.AppChooserButton.showDialogItem` property,
which allows to open a full `Gtk.AppChooserDialog`.

It is possible to add custom items to the list, using
`Gtk.AppChooserButton.appendCustomItem()`. These items cause
the `Gtk.AppChooserButton.custom-item-activated` signal to be
emitted when they are selected.

To track changes in the selected application, use the
`Gtk.AppChooserButton.changed` signal.

### CSS nodes

`GtkAppChooserButton` has a single CSS node with the name “appchooserbutton”.

> **Deprecated since 4.10.** The application selection widgets should be implemented according to the design of each platform and/or application requiring them.

```tsx
import { GtkAppChooserButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkAppChooserButton**

Implements `GtkAccessible`, `GtkAppChooser`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.AppChooserButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `contentType`

`string` · default `null` · construct-only · from `GtkAppChooser`

The content type of the `GtkAppChooser` object.

See `GContentType` for more information about content types.

### `heading`

`string` · default `null`

The text to show at the top of the dialog that can be
opened from the button.

The string may contain Pango markup.

### `modal`

`boolean` · default `true`

Whether the app chooser dialog should be modal.

### `showDefaultItem`

`boolean` · default `false`

Determines whether the dropdown menu shows the default application
on top for the provided content type.

### `showDialogItem`

`boolean` · default `false`

Determines whether the dropdown menu shows an item to open
a `GtkAppChooserDialog`.

## Signals

### `onActivate`

```ts
(self: Gtk.AppChooserButton) => void
```

Emitted to when the button is activated.

The `::activate` signal on `GtkAppChooserButton` is an action signal and
emitting it causes the button to pop up its dialog.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.4._

### `onChanged`

```ts
(self: Gtk.AppChooserButton) => void
```

Emitted when the active application changes.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCustomItemActivated`

```ts
(itemName: string, self: Gtk.AppChooserButton) => void
```

Emitted when a custom item is activated.

Use `Gtk.AppChooserButton.appendCustomItem()`,
to add custom items.

**Parameters**

- `itemName`: the name of the activated item
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.AppChooserButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `appendCustomItem`

```ts
appendCustomItem(name: string, label: string, icon: Gio.Icon): void
```

Appends a custom item to the list of applications that is shown
in the popup.

The item name must be unique per-widget. Clients can use the
provided name as a detail for the
`Gtk.AppChooserButton.custom-item-activated` signal, to add a
callback for the activation of a particular custom item in the list.

See also `Gtk.AppChooserButton.appendSeparator()`.

**Parameters**

- `name`: the name of the custom item
- `label`: the label for the custom item
- `icon`: the icon for the custom item

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `appendSeparator`

```ts
appendSeparator(): void
```

Appends a separator to the list of applications that is shown
in the popup.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getHeading`

```ts
getHeading(): string | null
```

Returns the text to display at the top of the dialog.

**Returns** the text to display at the top of the dialog,
  or `null`, in which case a default text is displayed

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getModal`

```ts
getModal(): boolean
```

Gets whether the dialog is modal.

**Returns** `true` if the dialog is modal

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowDefaultItem`

```ts
getShowDefaultItem(): boolean
```

Returns whether the dropdown menu should show the default
application at the top.

**Returns** the value of `Gtk.AppChooserButton.showDefaultItem`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getShowDialogItem`

```ts
getShowDialogItem(): boolean
```

Returns whether the dropdown menu shows an item
for a `GtkAppChooserDialog`.

**Returns** the value of `Gtk.AppChooserButton.showDialogItem`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setActiveCustomItem`

```ts
setActiveCustomItem(name: string): void
```

Selects a custom item.

See `Gtk.AppChooserButton.appendCustomItem()`.

Use `Gtk.AppChooser.refresh()` to bring the selection
to its initial state.

**Parameters**

- `name`: the name of the custom item

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setHeading`

```ts
setHeading(heading: string): void
```

Sets the text to display at the top of the dialog.

If the heading is not set, the dialog displays a default text.

**Parameters**

- `heading`: a string containing Pango markup

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the dialog should be modal.

**Parameters**

- `modal`: `true` to make the dialog modal

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowDefaultItem`

```ts
setShowDefaultItem(setting: boolean): void
```

Sets whether the dropdown menu of this button should show the
default application for the given content type at top.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserButton.showDefaultItem`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setShowDialogItem`

```ts
setShowDialogItem(setting: boolean): void
```

Sets whether the dropdown menu of this button should show an
entry to trigger a `GtkAppChooserDialog`.

**Parameters**

- `setting`: the new value for `Gtk.AppChooserButton.showDialogItem`

> **Deprecated since 4.10.** This widget will be removed in GTK 5
