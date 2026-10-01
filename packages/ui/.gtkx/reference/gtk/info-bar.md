---
description: "GtkInfoBar can be used to show messages to the user without a dialog."
---

# GtkInfoBar

`GtkInfoBar` can be used to show messages to the user without a dialog.



It is often temporarily shown at the top or bottom of a document.
In contrast to `Gtk.Dialog`, which has an action area at the
bottom, `GtkInfoBar` has an action area at the side.

The API of `GtkInfoBar` is very similar to `GtkDialog`, allowing you
to add buttons to the action area with `Gtk.InfoBar.addButton()`
or `Gtk.InfoBar.newWithButtons()`. The sensitivity of action widgets
can be controlled with `Gtk.InfoBar.setResponseSensitive()`.

To add widgets to the main content area of a `GtkInfoBar`, use
`Gtk.InfoBar.addChild()`.

Similar to `Gtk.MessageDialog`, the contents of a `GtkInfoBar`
can by classified as error message, warning, informational message, etc,
by using `Gtk.InfoBar.setMessageType()`. GTK may use the message
type to determine how the message is displayed.

A simple example for using a `GtkInfoBar`:
```c
GtkWidget *message_label;
GtkWidget *widget;
GtkWidget *grid;
GtkInfoBar *bar;

// set up info bar
widget = gtk_info_bar_new ();
bar = GTK_INFO_BAR (widget);
grid = gtk_grid_new ();

message_label = gtk_label_new ("");
gtk_info_bar_add_child (bar, message_label);
gtk_info_bar_add_button (bar,
                         _("_OK"),
                         GTK_RESPONSE_OK);
g_signal_connect (bar,
                  "response",
                  G_CALLBACK (gtk_widget_hide),
                  NULL);
gtk_grid_attach (GTK_GRID (grid),
                 widget,
                 0, 2, 1, 1);

// ...

// show an error message
gtk_label_set_text (GTK_LABEL (message_label), "An error occurred!");
gtk_info_bar_set_message_type (bar, GTK_MESSAGE_ERROR);
gtk_widget_show (bar);
```

## GtkInfoBar as GtkBuildable

`GtkInfoBar` supports a custom `<action-widgets>` element, which can contain
multiple `<action-widget>` elements. The “response” attribute specifies a
numeric response, and the content of the element is the id of widget
(which should be a child of the dialogs `action_area`).

`GtkInfoBar` supports adding action widgets by specifying “action” as
the “type” attribute of a `<child>` element. The widget will be added
either to the action area. The response id has to be associated
with the action widget using the `<action-widgets>` element.

## CSS nodes

`GtkInfoBar` has a single CSS node with name infobar. The node may get
one of the style classes .info, .warning, .error or .question, depending
on the message type.
If the info bar shows a close button, that button will have the .close
style class applied.

> **Deprecated since 4.10.** There is no replacement in GTK for an "info bar" widget; you can use `Gtk.Revealer` with a `Gtk.Box` containing a `Gtk.Label` and an optional `Gtk.Button`, according to your application's design.

```tsx
import { GtkInfoBar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkInfoBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.InfoBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `messageType`

`Gtk.MessageType` · default `GTK_MESSAGE_INFO`

The type of the message.

The type may be used to determine the appearance of the info bar.

### `revealed`

`boolean` · default `true`

Whether the info bar shows its contents.

### `showCloseButton`

`boolean` · default `false`

Whether to include a standard close button.

## Signals

### `onClose`

```ts
(self: Gtk.InfoBar) => void
```

Gets emitted when the user uses a keybinding to dismiss the info bar.

The ::close signal is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is the Escape key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onResponse`

```ts
(responseId: number, self: Gtk.InfoBar) => void
```

Emitted when an action widget is clicked.

The signal is also emitted when the application programmer
calls `Gtk.InfoBar.response()`. The `response_id` depends
on which action widget was clicked.

**Parameters**

- `responseId`: the response ID
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.InfoBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addActionWidget`

```ts
addActionWidget(child: Gtk.Widget, responseId: number): void
```

Add an activatable widget to the action area of a `GtkInfoBar`.

This also connects a signal handler that will emit the
`Gtk.InfoBar.response` signal on the message area
when the widget is activated. The widget is appended to the
end of the message areas action area.

**Parameters**

- `child`: an activatable widget
- `responseId`: response ID for `child`

> **Deprecated since 4.10.**

### `addButton`

```ts
addButton(buttonText: string, responseId: number): Gtk.Button
```

Adds a button with the given text.

Clicking the button will emit the `Gtk.InfoBar.response`
signal with the given response_id. The button is appended to the
end of the info bar's action area. The button widget is returned,
but usually you don't need it.

**Parameters**

- `buttonText`: text of button
- `responseId`: response ID for the button

**Returns** the `GtkButton` widget
that was added

> **Deprecated since 4.10.**

### `addChild`

```ts
addChild(widget: Gtk.Widget): void
```

Adds a widget to the content area of the info bar.

**Parameters**

- `widget`: the child to be added

> **Deprecated since 4.10.**

### `getMessageType`

```ts
getMessageType(): Gtk.MessageType
```

Returns the message type of the message area.

**Returns** the message type of the message area.

> **Deprecated since 4.10.**

### `getRevealed`

```ts
getRevealed(): boolean
```

Returns whether the info bar is currently revealed.

**Returns** the current value of the `Gtk.InfoBar.revealed` property

> **Deprecated since 4.10.**

### `getShowCloseButton`

```ts
getShowCloseButton(): boolean
```

Returns whether the widget will display a standard close button.

**Returns** `true` if the widget displays standard close button

> **Deprecated since 4.10.**

### `removeActionWidget`

```ts
removeActionWidget(widget: Gtk.Widget): void
```

Removes a widget from the action area of `info_bar`.

The widget must have been put there by a call to
`Gtk.InfoBar.addActionWidget()` or `Gtk.InfoBar.addButton()`.

**Parameters**

- `widget`: an action widget to remove

> **Deprecated since 4.10.**

### `removeChild`

```ts
removeChild(widget: Gtk.Widget): void
```

Removes a widget from the content area of the info bar.

**Parameters**

- `widget`: a child that has been added to the content area

> **Deprecated since 4.10.**

### `response`

```ts
response(responseId: number): void
```

Emits the “response” signal with the given `response_id`.

**Parameters**

- `responseId`: a response ID

> **Deprecated since 4.10.**

### `setDefaultResponse`

```ts
setDefaultResponse(responseId: number): void
```

Sets the last widget in the info bar’s action area with
the given response_id as the default widget for the dialog.

Pressing “Enter” normally activates the default widget.

Note that this function currently requires `info_bar` to
be added to a widget hierarchy.

**Parameters**

- `responseId`: a response ID

> **Deprecated since 4.10.**

### `setMessageType`

```ts
setMessageType(messageType: Gtk.MessageType): void
```

Sets the message type of the message area.

GTK uses this type to determine how the message is displayed.

**Parameters**

- `messageType`: a `GtkMessageType`

> **Deprecated since 4.10.**

### `setResponseSensitive`

```ts
setResponseSensitive(responseId: number, setting: boolean): void
```

Sets the sensitivity of action widgets for `response_id`.

Calls `gtk_widget_set_sensitive (widget, setting)` for each
widget in the info bars’s action area with the given `response_id`.
A convenient way to sensitize/desensitize buttons.

**Parameters**

- `responseId`: a response ID
- `setting`: TRUE for sensitive

> **Deprecated since 4.10.**

### `setRevealed`

```ts
setRevealed(revealed: boolean): void
```

Sets whether the `GtkInfoBar` is revealed.

Changing this will make `info_bar` reveal or conceal
itself via a sliding transition.

Note: this does not show or hide `info_bar` in the
`Gtk.Widget.visible` sense, so revealing has no effect
if `Gtk.Widget.visible` is `false`.

**Parameters**

- `revealed`: The new value of the property

> **Deprecated since 4.10.**

### `setShowCloseButton`

```ts
setShowCloseButton(setting: boolean): void
```

If true, a standard close button is shown.

When clicked it emits the response `GTK_RESPONSE_CLOSE`.

**Parameters**

- `setting`: `true` to include a close button

> **Deprecated since 4.10.**
