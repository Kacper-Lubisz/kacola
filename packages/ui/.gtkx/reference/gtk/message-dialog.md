---
description: "GtkMessageDialog presents a dialog with some message text."
---

# GtkMessageDialog

`GtkMessageDialog` presents a dialog with some message text.



It’s simply a convenience widget; you could construct the equivalent of
`GtkMessageDialog` from `GtkDialog` without too much effort, but
`GtkMessageDialog` saves typing.

The easiest way to do a modal message dialog is to use the `GTK_DIALOG_MODAL`
flag, which will call `Gtk.Window.setModal()` internally. The dialog will
prevent interaction with the parent window until it's hidden or destroyed.
You can use the `Gtk.Dialog.response` signal to know when the user
dismissed the dialog.

An example for using a modal dialog:
```c
GtkDialogFlags flags = GTK_DIALOG_DESTROY_WITH_PARENT | GTK_DIALOG_MODAL;
dialog = gtk_message_dialog_new (parent_window,
                                 flags,
                                 GTK_MESSAGE_ERROR,
                                 GTK_BUTTONS_CLOSE,
                                 "Error reading “%s”: %s",
                                 filename,
                                 g_strerror (errno));
// Destroy the dialog when the user responds to it
// (e.g. clicks a button)

g_signal_connect (dialog, "response",
                  G_CALLBACK (gtk_window_destroy),
                  NULL);
```

You might do a non-modal `GtkMessageDialog` simply by omitting the
`GTK_DIALOG_MODAL` flag:

```c
GtkDialogFlags flags = GTK_DIALOG_DESTROY_WITH_PARENT;
dialog = gtk_message_dialog_new (parent_window,
                                 flags,
                                 GTK_MESSAGE_ERROR,
                                 GTK_BUTTONS_CLOSE,
                                 "Error reading “%s”: %s",
                                 filename,
                                 g_strerror (errno));

// Destroy the dialog when the user responds to it
// (e.g. clicks a button)
g_signal_connect (dialog, "response",
                  G_CALLBACK (gtk_window_destroy),
                  NULL);
```

## GtkMessageDialog as GtkBuildable

The `GtkMessageDialog` implementation of the `GtkBuildable` interface exposes
the message area as an internal child with the name “message_area”.

> **Deprecated since 4.10.** Use `Gtk.AlertDialog` instead

```tsx
import { GtkMessageDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkDialog](.gtkx/reference/gtk/dialog.md) → **GtkMessageDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.MessageDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buttons`

`Gtk.ButtonsType` · default `GTK_BUTTONS_NONE` · construct-only

Set of buttons to display on the dialog.

### `messageArea`

`Gtk.Widget` · read-only, observe with `onNotifyMessageArea`

The `GtkBox` that corresponds to the message area of this dialog.

See `Gtk.MessageDialog.getMessageArea()` for a detailed
description of this area.

### `messageType`

`Gtk.MessageType` · default `GTK_MESSAGE_INFO`

The type of the message.

### `secondaryText`

`string` · default `null`

The secondary text of the message dialog.

### `secondaryUseMarkup`

`boolean` · default `false`

`true` if the secondary text of the dialog includes Pango markup.

See `Pango.parseMarkup()`.

### `text`

`string`

The primary text of the message dialog.

If the dialog has a secondary text, this will appear as the title.

### `useMarkup`

`boolean` · default `false`

`true` if the primary text of the dialog includes Pango markup.

See `Pango.parseMarkup()`.

## Methods

Methods are called on the `Gtk.MessageDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getMessageArea`

```ts
getMessageArea(): Gtk.Widget
```

Returns the message area of the dialog.

This is the box where the dialog’s primary and secondary labels
are packed. You can add your own extra content to that box and it
will appear below those labels. See `Gtk.Dialog.getContentArea()`
for the corresponding function in the parent `Gtk.Dialog`.

**Returns** A `GtkBox` corresponding to the
  “message area” in the `message_dialog`

> **Deprecated since 4.10.** Use `Gtk.AlertDialog` instead

### `setMarkup`

```ts
setMarkup(str: string): void
```

Sets the text of the message dialog.

**Parameters**

- `str`: string with Pango markup

> **Deprecated since 4.10.** Use `Gtk.AlertDialog` instead
