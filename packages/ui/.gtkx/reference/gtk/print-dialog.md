---
description: "Asynchronous API to present a print dialog to the user."
---

# GtkPrintDialog

Asynchronous API to present a print dialog to the user.

`GtkPrintDialog` collects the arguments that are needed to present
 the dialog, such as a title for the dialog and whether it should
 be modal.

The dialog is shown with the `Gtk.PrintDialog.setup()` function.

The actual printing can be done with `Gtk.PrintDialog.print()` or
`Gtk.PrintDialog.printFile()`. These APIs follows the GIO async pattern,
and the results can be obtained by calling the corresponding finish methods.

_Available since 4.14._

```tsx
import { GtkPrintDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkPrintDialog**

## Props

`ref` receives the `Gtk.PrintDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `acceptLabel`

`string` · default `null`

A label that may be shown on the accept button of a print dialog
that is presented by `Gtk.PrintDialog.setup()`.

_Available since 4.14._

### `modal`

`boolean` · default `true`

Whether the print dialog is modal.

_Available since 4.14._

### `pageSetup`

`Gtk.PageSetup | ReactElement`

The page setup to use.

_Available since 4.14._

### `printSettings`

`Gtk.PrintSettings | ReactElement`

The print settings to use.

_Available since 4.14._

### `title`

`string` · default `null`

A title that may be shown on the print dialog that is
presented by `Gtk.PrintDialog.setup()`.

_Available since 4.14._

## Methods

Methods are called on the `Gtk.PrintDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAcceptLabel`

```ts
getAcceptLabel(): string
```

Returns the label that will be shown on the
accept button of the print dialog.

**Returns** the accept label

_Available since 4.14._

### `getModal`

```ts
getModal(): boolean
```

Returns whether the print dialog blocks
interaction with the parent window while
it is presented.

**Returns** whether the print dialog is modal

_Available since 4.14._

### `getPageSetup`

```ts
getPageSetup(): Gtk.PageSetup | null
```

Returns the page setup.

**Returns** the page setup

_Available since 4.14._

### `getPrintSettings`

```ts
getPrintSettings(): Gtk.PrintSettings | null
```

Returns the print settings for the print dialog.

**Returns** the settings

_Available since 4.14._

### `getTitle`

```ts
getTitle(): string
```

Returns the title that will be shown on the
print dialog.

**Returns** the title

_Available since 4.14._

### `print`

```ts
print(parent: Gtk.Window | null, setup: Gtk.PrintSetup | null, cancellable?: Gio.Cancellable | null): Promise<Gio.OutputStream>
```

This function prints content from a stream.

If you pass `NULL` as `setup`, then this method will present a print dialog.
Otherwise, it will attempt to print directly, without user interaction.

The `callback` will be called when the printing is done.

**Parameters**

- `parent`: the parent `GtkWindow`
- `setup`: the `GtkPrintSetup` to use
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** a `Gio.OutputStream`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `printFile`

```ts
printFile(parent: Gtk.Window | null, setup: Gtk.PrintSetup | null, file: Gio.File, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

This function prints a file.

If you pass `NULL` as `setup`, then this method will present a print dialog.
Otherwise, it will attempt to print directly, without user interaction.

**Parameters**

- `parent`: the parent `GtkWindow`
- `setup`: the `GtkPrintSetup` to use
- `file`: the `GFile` to print
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** Whether the call was successful

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `printFileFinish`

```ts
printFileFinish(result: Gio.AsyncResult): boolean
```

Finishes the `Gtk.PrintDialog.printFile()` call and
returns the results.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Whether the call was successful

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `printFinish`

```ts
printFinish(result: Gio.AsyncResult): Gio.OutputStream
```

Finishes the `Gtk.PrintDialog.print()` call and
returns the results.

If the call was successful, the content to be printed should be
written to the returned output stream. Otherwise, `NULL` is returned.

The overall results of the print operation will be returned in the
`Gio.OutputStream.close()` call, so if you are interested in the
results, you need to explicitly close the output stream (it will be
closed automatically if you just unref it). Be aware that the close
call may not be instant as it operation will for the printer to finish
printing.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a `Gio.OutputStream`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `setAcceptLabel`

```ts
setAcceptLabel(acceptLabel: string): void
```

Sets the label that will be shown on the
accept button of the print dialog shown for
`Gtk.PrintDialog.setup()`.

**Parameters**

- `acceptLabel`: the new accept label

_Available since 4.14._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the print dialog blocks
interaction with the parent window while
it is presented.

**Parameters**

- `modal`: the new value

_Available since 4.14._

### `setPageSetup`

```ts
setPageSetup(pageSetup: Gtk.PageSetup): void
```

Set the page setup for the print dialog.

**Parameters**

- `pageSetup`: the new page setup

_Available since 4.14._

### `setPrintSettings`

```ts
setPrintSettings(printSettings: Gtk.PrintSettings): void
```

Sets the print settings for the print dialog.

**Parameters**

- `printSettings`: the new print settings

_Available since 4.14._

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title that will be shown on the print dialog.

**Parameters**

- `title`: the new title

_Available since 4.14._

### `setup`

```ts
setup(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gtk.PrintSetup>
```

This function presents a print dialog to let the user select a printer,
and set up print settings and page setup.

The `callback` will be called when the dialog is dismissed.
The obtained `Gtk.PrintSetup` can then be passed
to `Gtk.PrintDialog.print()` or `Gtk.PrintDialog.printFile()`.

One possible use for this method is to have the user select a printer,
then show a page setup UI in the application (e.g. to arrange images
on a page), then call `Gtk.PrintDialog.print()` on `self`
to do the printing without further user interaction.

**Parameters**

- `parent`: the parent `GtkWindow`
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** the resulting `[struct@Gtk.PrintSetup]`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `setupFinish`

```ts
setupFinish(result: Gio.AsyncResult): Gtk.PrintSetup
```

Finishes the `Gtk.PrintDialog.setup()` call.

If the call was successful, it returns a `Gtk.PrintSetup`
which contains the print settings and page setup information that
will be used to print.

Note that this function returns a `Gtk.DialogError.DISMISSED`
error if the user cancels the dialog.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** the resulting `[struct@Gtk.PrintSetup]`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._
