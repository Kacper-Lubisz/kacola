---
description: "GtkAppChooserDialog shows a GtkAppChooserWidget inside a GtkDialog."
---

# GtkAppChooserDialog

`GtkAppChooserDialog` shows a `GtkAppChooserWidget` inside a `GtkDialog`.



Note that `GtkAppChooserDialog` does not have any interesting methods
of its own. Instead, you should get the embedded `GtkAppChooserWidget`
using `Gtk.AppChooserDialog.getWidget()` and call its methods if
the generic `Gtk.AppChooser` interface is not sufficient for
your needs.

To set the heading that is shown above the `GtkAppChooserWidget`,
use `Gtk.AppChooserDialog.setHeading()`.

### CSS nodes

`GtkAppChooserDialog` has a single CSS node with the name `window` and style
class `.appchooser`.

> **Deprecated since 4.10.** The application selection widgets should be implemented according to the design of each platform and/or application requiring them.

```tsx
import { GtkAppChooserDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkDialog](.gtkx/reference/gtk/dialog.md) → **GtkAppChooserDialog**

Implements `GtkAccessible`, `GtkAppChooser`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.AppChooserDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `contentType`

`string` · default `null` · construct-only · from `GtkAppChooser`

The content type of the `GtkAppChooser` object.

See `GContentType` for more information about content types.

### `gfile`

`Gio.File` · construct-only

The GFile used by the `GtkAppChooserDialog`.

The dialog's `GtkAppChooserWidget` content type will
be guessed from the file, if present.

### `heading`

`string` · default `null`

The text to show at the top of the dialog.

The string may contain Pango markup.

## Methods

Methods are called on the `Gtk.AppChooserDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getHeading`

```ts
getHeading(): string | null
```

Returns the text to display at the top of the dialog.

**Returns** the text to display at the top of the dialog,
  or `null`, in which case a default text is displayed

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getWidget`

```ts
getWidget(): Gtk.Widget
```

Returns the `GtkAppChooserWidget` of this dialog.

**Returns** the `GtkAppChooserWidget` of `self`

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
