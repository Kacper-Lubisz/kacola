---
description: "Collects the arguments that are needed to present a message to the user."
---

# GtkAlertDialog

Collects the arguments that are needed to present a message to the user.

The message is shown with the `Gtk.AlertDialog.choose()`
function.

If you don't need to wait for a button to be clicked, you can use
`Gtk.AlertDialog.show()`.

_Available since 4.10._

```tsx
import { GtkAlertDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkAlertDialog**

## Props

`ref` receives the `Gtk.AlertDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buttons`

`string[]`

Labels for buttons to show in the alert.

The labels should be translated and may contain
a `_` character to indicate the mnemonic character.

If this property is not set, then a 'Close' button is
automatically created.

_Available since 4.10._

### `cancelButton`

`number` · default `-1`

Determines what happens when the <kbd>Escape</kbd> key is pressed
while the alert is shown.

If this property holds the index of a button in `Gtk.AlertDialog.buttons`,
then pressing Escape is treated as if that button was pressed. If it is -1
or not a valid index for the `buttons` array, then an error is returned.

If `buttons` is `NULL`, then the automatically created 'Close' button
is treated as both cancel and default button, so 0 is returned.

_Available since 4.10._

### `defaultButton`

`number` · default `-1`

Determines what happens when the <kbd>Return</kbd> key is pressed
while the alert is shown.

If this property holds the index of a button in `Gtk.AlertDialog.buttons`,
then pressing Return is treated as if that button was pressed. If it is -1
or not a valid index for the `buttons` array, then nothing happens.

If `buttons` is `NULL`, then the automatically created 'Close' button
is treated as both cancel and default button, so 0 is returned.

_Available since 4.10._

### `detail`

`string` · default `null`

The detail text for the alert.

_Available since 4.10._

### `message`

`string` · default `null`

The message for the alert.

_Available since 4.10._

### `modal`

`boolean` · default `true`

Whether the alert is modal.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.AlertDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `choose`

```ts
choose(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<number>
```

Shows the alert to the user.

It is ok to pass `NULL` for the callback if the alert
does not have more than one button. A simpler API for
this case is `Gtk.AlertDialog.show()`.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** the index of the button that was clicked, or -1 if
  the dialog was cancelled and `Gtk.AlertDialog.cancelButton`
  is not set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `chooseFinish`

```ts
chooseFinish(result: Gio.AsyncResult): number
```

Finishes the `Gtk.AlertDialog.choose()` call.

**Parameters**

- `result`: the result

**Returns** the index of the button that was clicked, or -1 if
  the dialog was cancelled and `Gtk.AlertDialog.cancelButton`
  is not set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `getButtons`

```ts
getButtons(): string[] | null
```

Returns the button labels for the alert.

**Returns** the button labels

_Available since 4.10._

### `getCancelButton`

```ts
getCancelButton(): number
```

Returns the index of the cancel button.

**Returns** the index of the cancel button, or -1

_Available since 4.10._

### `getDefaultButton`

```ts
getDefaultButton(): number
```

Returns the index of the default button.

**Returns** the index of the default button, or -1

_Available since 4.10._

### `getDetail`

```ts
getDetail(): string
```

Returns the detail text that will be shown in the alert.

**Returns** the detail text

_Available since 4.10._

### `getMessage`

```ts
getMessage(): string
```

Returns the message that will be shown in the alert.

**Returns** the message

_Available since 4.10._

### `getModal`

```ts
getModal(): boolean
```

Returns whether the alert blocks interaction
with the parent window while it is presented.

**Returns** true if the alert is modal

_Available since 4.10._

### `setButtons`

```ts
setButtons(labels: string[]): void
```

Sets the button labels for the alert.

**Parameters**

- `labels`: the new button labels

_Available since 4.10._

### `setCancelButton`

```ts
setCancelButton(button: number): void
```

Sets the index of the cancel button.

See `Gtk.AlertDialog.cancelButton` for
details of how this value is used.

**Parameters**

- `button`: the new cancel button

_Available since 4.10._

### `setDefaultButton`

```ts
setDefaultButton(button: number): void
```

Sets the index of the default button.

See `Gtk.AlertDialog.defaultButton` for
details of how this value is used.

**Parameters**

- `button`: the new default button

_Available since 4.10._

### `setDetail`

```ts
setDetail(detail: string): void
```

Sets the detail text that will be shown in the alert.

**Parameters**

- `detail`: the new detail text

_Available since 4.10._

### `setMessage`

```ts
setMessage(message: string): void
```

Sets the message that will be shown in the alert.

**Parameters**

- `message`: the new message

_Available since 4.10._

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets whether the alert blocks interaction
with the parent window while it is presented.

**Parameters**

- `modal`: the new value

_Available since 4.10._

### `show`

```ts
show(parent: Gtk.Window | null): void
```

Shows the alert to the user.

This function is a simpler version of `Gtk.AlertDialog.choose()`
intended for dialogs with a single button.

If you want to cancel the dialog or if the alert has more than one
button, you should use that function instead and provide it with a
`Gio.Cancellable` and callback respectively.

**Parameters**

- `parent`: the parent window

_Available since 4.10._
