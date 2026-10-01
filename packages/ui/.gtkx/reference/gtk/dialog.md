---
description: "Dialogs are a convenient way to prompt the user for a small amount of input."
---

# GtkDialog

Dialogs are a convenient way to prompt the user for a small amount
of input.



Typical uses are to display a message, ask a question, or anything else
that does not require extensive effort on the user’s part.

The main area of a `GtkDialog` is called the "content area", and is yours
to populate with widgets such a `GtkLabel` or `GtkEntry`, to present
your information, questions, or tasks to the user.

In addition, dialogs allow you to add "action widgets". Most commonly,
action widgets are buttons. Depending on the platform, action widgets may
be presented in the header bar at the top of the window, or at the bottom
of the window. To add action widgets, create your `GtkDialog` using
`Gtk.Dialog.newWithButtons()`, or use
`Gtk.Dialog.addButton()`, `Gtk.Dialog.addButtons()`,
or `Gtk.Dialog.addActionWidget()`.

`GtkDialogs` uses some heuristics to decide whether to add a close
button to the window decorations. If any of the action buttons use
the response ID `GTK_RESPONSE_CLOSE` or `GTK_RESPONSE_CANCEL`, the
close button is omitted.

Clicking a button that was added as an action widget will emit the
`Gtk.Dialog.response` signal with a response ID that you specified.
GTK will never assign a meaning to positive response IDs; these are
entirely user-defined. But for convenience, you can use the response
IDs in the `Gtk.ResponseType` enumeration (these all have values
less than zero). If a dialog receives a delete event, the
`Gtk.Dialog.response` signal will be emitted with the
`GTK_RESPONSE_DELETE_EVENT` response ID.

Dialogs are created with a call to `Gtk.Dialog.new()` or
`Gtk.Dialog.newWithButtons()`. The latter is recommended; it allows
you to set the dialog title, some convenient flags, and add buttons.

A “modal” dialog (that is, one which freezes the rest of the application
from user input), can be created by calling `Gtk.Window.setModal()`
on the dialog. When using `Gtk.Dialog.newWithButtons()`, you can also
pass the `GTK_DIALOG_MODAL` flag to make a dialog modal.

For the simple dialog in the following example, a `Gtk.MessageDialog`
would save some effort. But you’d need to create the dialog contents manually
if you had more than a simple message in the dialog.

An example for simple `GtkDialog` usage:

```c
// Function to open a dialog box with a message
void
quick_message (GtkWindow *parent, char *message)
{
 GtkWidget *dialog, *label, *content_area;
 GtkDialogFlags flags;

 // Create the widgets
 flags = GTK_DIALOG_DESTROY_WITH_PARENT;
 dialog = gtk_dialog_new_with_buttons ("Message",
                                       parent,
                                       flags,
                                       _("_OK"),
                                       GTK_RESPONSE_NONE,
                                       NULL);
 content_area = gtk_dialog_get_content_area (GTK_DIALOG (dialog));
 label = gtk_label_new (message);

 // Ensure that the dialog box is destroyed when the user responds

 g_signal_connect_swapped (dialog,
                           "response",
                           G_CALLBACK (gtk_window_destroy),
                           dialog);

 // Add the label, and show everything we’ve added

 gtk_box_append (GTK_BOX (content_area), label);
 gtk_widget_show (dialog);
}
```

## GtkDialog as GtkBuildable

The `GtkDialog` implementation of the `GtkBuildable` interface exposes the
`content_area` as an internal child with the name “content_area”.

`GtkDialog` supports a custom `<action-widgets>` element, which can contain
multiple `<action-widget>` elements. The “response” attribute specifies a
numeric response, and the content of the element is the id of widget
(which should be a child of the dialogs `action_area`). To mark a response
as default, set the “default” attribute of the `<action-widget>` element
to true.

`GtkDialog` supports adding action widgets by specifying “action” as
the “type” attribute of a `<child>` element. The widget will be added
either to the action area or the headerbar of the dialog, depending
on the “use-header-bar” property. The response id has to be associated
with the action widget using the `<action-widgets>` element.

An example of a `GtkDialog` UI definition fragment:

```xml
<object class="GtkDialog" id="dialog1">
  <child type="action">
    <object class="GtkButton" id="button_cancel"/>
  </child>
  <child type="action">
    <object class="GtkButton" id="button_ok">
    </object>
  </child>
  <action-widgets>
    <action-widget response="cancel">button_cancel</action-widget>
    <action-widget response="ok" default="true">button_ok</action-widget>
  </action-widgets>
</object>
```

## Accessibility

`GtkDialog` uses the `GTK_ACCESSIBLE_ROLE_DIALOG` role.

> **Deprecated since 4.10.** Use `Gtk.Window` instead

```tsx
import { GtkDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **GtkDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.Dialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `useHeaderBar`

`number` · default `-1` · construct-only · deprecated since 4.10

`true` if the dialog uses a headerbar for action buttons
instead of the action-area.

For technical reasons, this property is declared as an integer
property, but you should only set it to `true` or `false`.

### Creating a dialog with headerbar

Builtin `GtkDialog` subclasses such as `Gtk.ColorChooserDialog`
set this property according to platform conventions (using the
`Gtk.Settings.gtkDialogsUseHeader` setting).

Here is how you can achieve the same:

```c
g_object_get (settings, "gtk-dialogs-use-header", &header, NULL);
dialog = g_object_new (GTK_TYPE_DIALOG, header, TRUE, NULL);
```

> **Deprecated since 4.10.** Use `Gtk.Window` instead

## Signals

### `onClose`

```ts
(self: Gtk.Dialog) => void
```

Emitted when the user uses a keybinding to close the dialog.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is the Escape key.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `onResponse`

```ts
(responseId: number, self: Gtk.Dialog) => void
```

Emitted when an action widget is clicked.

The signal is also emitted when the dialog receives a
delete event, and when `Gtk.Dialog.response()` is called.
On a delete event, the response ID is `GTK_RESPONSE_DELETE_EVENT`.
Otherwise, it depends on which action widget was clicked.

**Parameters**

- `responseId`: the response ID
- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.Window` instead

## Methods

Methods are called on the `Gtk.Dialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addActionWidget`

```ts
addActionWidget(child: Gtk.Widget, responseId: number): void
```

Adds an activatable widget to the action area of a `GtkDialog`.

GTK connects a signal handler that will emit the
`Gtk.Dialog.response` signal on the dialog when the widget
is activated. The widget is appended to the end of the dialog’s action
area.

If you want to add a non-activatable widget, simply pack it into
the `action_area` field of the `GtkDialog` struct.

**Parameters**

- `child`: an activatable widget
- `responseId`: response ID for `child`

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `addButton`

```ts
addButton(buttonText: string, responseId: number): Gtk.Widget
```

Adds a button with the given text.

GTK arranges things so that clicking the button will emit the
`Gtk.Dialog.response` signal with the given `response_id`.
The button is appended to the end of the dialog’s action area.
The button widget is returned, but usually you don’t need it.

**Parameters**

- `buttonText`: text of button
- `responseId`: response ID for the button

**Returns** the `GtkButton` widget that was added

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `getContentArea`

```ts
getContentArea(): Gtk.Box
```

Returns the content area of `dialog`.

**Returns** the content area `GtkBox`.

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `getHeaderBar`

```ts
getHeaderBar(): Gtk.HeaderBar
```

Returns the header bar of `dialog`.

Note that the headerbar is only used by the dialog if the
`Gtk.Dialog.useHeaderBar` property is `true`.

**Returns** the header bar

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `getResponseForWidget`

```ts
getResponseForWidget(widget: Gtk.Widget): number
```

Gets the response id of a widget in the action area
of a dialog.

**Parameters**

- `widget`: a widget in the action area of `dialog`

**Returns** the response id of `widget`, or `GTK_RESPONSE_NONE`
 if `widget` doesn’t have a response id set.

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `getWidgetForResponse`

```ts
getWidgetForResponse(responseId: number): Gtk.Widget | null
```

Gets the widget button that uses the given response ID in the action area
of a dialog.

**Parameters**

- `responseId`: the response ID used by the `dialog` widget

**Returns** the `widget` button that uses the given
  `response_id`

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `response`

```ts
response(responseId: number): void
```

Emits the ::response signal with the given response ID.

Used to indicate that the user has responded to the dialog in some way.

**Parameters**

- `responseId`: response ID

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `setDefaultResponse`

```ts
setDefaultResponse(responseId: number): void
```

Sets the default widget for the dialog based on the response ID.

Pressing “Enter” normally activates the default widget.

**Parameters**

- `responseId`: a response ID

> **Deprecated since 4.10.** Use `Gtk.Window` instead

### `setResponseSensitive`

```ts
setResponseSensitive(responseId: number, setting: boolean): void
```

A convenient way to sensitize/desensitize dialog buttons.

Calls `gtk_widget_set_sensitive (widget, @setting)`
for each widget in the dialog’s action area with the given `response_id`.

**Parameters**

- `responseId`: a response ID
- `setting`: `true` for sensitive

> **Deprecated since 4.10.** Use `Gtk.Window` instead
