---
description: "Asynchronous API to present a color chooser dialog."
---

# GtkColorDialog

Asynchronous API to present a color chooser dialog.

`GtkColorDialog` collects the arguments that are needed to present
the dialog to the user, such as a title for the dialog and whether
it should be modal.

The dialog is shown with the `Gtk.ColorDialog.chooseRgba()`
function.

See `Gtk.ColorDialogButton` for a convenient control
that uses `GtkColorDialog` and presents the results.

_Available since 4.10._

```tsx
import { GtkColorDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkColorDialog**

## Props

`ref` receives the `Gtk.ColorDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `modal`

`boolean` · default `true`

Whether the color chooser dialog is modal.

_Available since 4.10._

### `title`

`string` · default `null`

A title that may be shown on the color chooser dialog.

_Available since 4.10._

### `withAlpha`

`boolean` · default `true`

Whether colors may have alpha (translucency).

When with-alpha is false, the color that is selected
will be forced to have alpha == 1.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.ColorDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `chooseRgba`

```ts
chooseRgba(parent: Gtk.Window | null, initialColor: Gdk.RGBA | null, cancellable?: Gio.Cancellable | null): Promise<Gdk.RGBA>
```

Presents a color chooser dialog to the user.

**Parameters**

- `parent`: the parent window
- `initialColor`: the color to select initially
- `cancellable`: a cancellable to cancel the operation

**Returns** the selected color

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseRgbaFinish`

```ts
chooseRgbaFinish(result: Gio.AsyncResult): Gdk.RGBA
```

Finishes the `Gtk.ColorDialog.chooseRgba()` call

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: the result

**Returns** the selected color

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `getModal`

```ts
getModal(): boolean
```

Returns whether the color chooser dialog
blocks interaction with the parent window
while it is presented.

**Returns** true if the color chooser dialog is modal

_Available since 4.10._

### `getTitle`

```ts
getTitle(): string
```

Returns the title that will be shown on the
color chooser dialog.

**Returns** the title

_Available since 4.10._

### `getWithAlpha`

```ts
getWithAlpha(): boolean
```

Returns whether colors may have alpha.

**Returns** true if colors may have alpha

_Available since 4.10._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the color chooser dialog
blocks interaction with the parent window
while it is presented.

**Parameters**

- `modal`: the new value

_Available since 4.10._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title that will be shown on the
color chooser dialog.

**Parameters**

- `title`: the new title

_Available since 4.10._

### `setWithAlpha`

```ts
setWithAlpha(withAlpha: boolean): void
```

Sets whether colors may have alpha.

**Parameters**

- `withAlpha`: the new value

_Available since 4.10._
