---
description: "A dialog presenting a message or a question."
---

# AdwMessageDialog

A dialog presenting a message or a question.



Message dialogs have a heading, a body, an optional child widget, and one or
multiple responses, each presented as a button.

Each response has a unique string ID, and a button label. Additionally, each
response can be enabled or disabled, and can have a suggested or destructive
appearance.

When one of the responses is activated, or the dialog is closed, the
`MessageDialog.response` signal will be emitted. This signal is
detailed, and the detail, as well as the `response` parameter will be set to
the ID of the activated response, or to the value of the
`MessageDialog.closeResponse` property if the dialog had been
closed without activating any of the responses.

Response buttons can be presented horizontally or vertically depending on
available space.

When a response is activated, `AdwMessageDialog` is closed automatically.

An example of using a message dialog:

```c
GtkWidget *dialog;

dialog = adw_message_dialog_new (parent, _("Replace File?"), NULL);

adw_message_dialog_format_body (ADW_MESSAGE_DIALOG (dialog),
                                _("A file named “%s” already exists. Do you want to replace it?"),
                                filename);

adw_message_dialog_add_responses (ADW_MESSAGE_DIALOG (dialog),
                                  "cancel",  _("_Cancel"),
                                  "replace", _("_Replace"),
                                  NULL);

adw_message_dialog_set_response_appearance (ADW_MESSAGE_DIALOG (dialog), "replace", ADW_RESPONSE_DESTRUCTIVE);

adw_message_dialog_set_default_response (ADW_MESSAGE_DIALOG (dialog), "cancel");
adw_message_dialog_set_close_response (ADW_MESSAGE_DIALOG (dialog), "cancel");

g_signal_connect (dialog, "response", G_CALLBACK (response_cb), self);

gtk_window_present (GTK_WINDOW (dialog));
```

### Async API

`AdwMessageDialog` can also be used via the `MessageDialog.choose()`
method. This API follows the GIO async pattern, for example:

```c
static void
dialog_cb (AdwMessageDialog *dialog,
           GAsyncResult     *result,
           MyWindow         *self)
{
  const char *response = adw_message_dialog_choose_finish (dialog, result);

  // ...
}

static void
show_dialog (MyWindow *self)
{
  GtkWidget *dialog;

  dialog = adw_message_dialog_new (GTK_WINDOW (self), _("Replace File?"), NULL);

  adw_message_dialog_format_body (ADW_MESSAGE_DIALOG (dialog),
                                  _("A file named “%s” already exists. Do you want to replace it?"),
                                  filename);

  adw_message_dialog_add_responses (ADW_MESSAGE_DIALOG (dialog),
                                    "cancel",  _("_Cancel"),
                                    "replace", _("_Replace"),
                                    NULL);

  adw_message_dialog_set_response_appearance (ADW_MESSAGE_DIALOG (dialog), "replace", ADW_RESPONSE_DESTRUCTIVE);

  adw_message_dialog_set_default_response (ADW_MESSAGE_DIALOG (dialog), "cancel");
  adw_message_dialog_set_close_response (ADW_MESSAGE_DIALOG (dialog), "cancel");

  adw_message_dialog_choose (ADW_MESSAGE_DIALOG (dialog), NULL, (GAsyncReadyCallback) dialog_cb, self);
}
```

### AdwMessageDialog as GtkBuildable

`AdwMessageDialog` supports adding responses in UI definitions by via the
`<responses>` element that may contain multiple `<response>` elements, each
representing a response.

Each of the `<response>` elements must have the `id` attribute specifying the
response ID. The contents of the element are used as the response label.

Response labels can be translated with the usual `translatable`, `context`
and `comments` attributes.

The `<response>` elements can also have `enabled` and/or `appearance`
attributes. See `MessageDialog.setResponseEnabled()` and
`MessageDialog.setResponseAppearance()` for details.

Example of an `AdwMessageDialog` UI definition:

```xml
<object class="AdwMessageDialog" id="dialog">
  <property name="heading" translatable="yes">Save Changes?</property>
  <property name="body" translatable="yes">Open documents contain unsaved changes. Changes which are not saved will be permanently lost.</property>
  <property name="default-response">save</property>
  <property name="close-response">cancel</property>
  <signal name="response" handler="response_cb"/>
  <responses>
    <response id="cancel" translatable="yes">_Cancel</response>
    <response id="discard" translatable="yes" appearance="destructive">_Discard</response>
    <response id="save" translatable="yes" appearance="suggested" enabled="false">_Save</response>
  </responses>
</object>
```

### Accessibility

`AdwMessageDialog` uses the `Gtk.AccessibleRole.dialog` role.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

```tsx
import { AdwMessageDialog } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **AdwMessageDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.MessageDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `body`

`string` · deprecated since 1.6

The body text of the dialog.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `bodyUseMarkup`

`boolean` · default `false` · deprecated since 1.6

Whether the body text includes Pango markup.

See `Pango.parseMarkup()`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `closeResponse`

`string` · default `close` · deprecated since 1.6

The ID of the close response.

It will be passed to `MessageDialog.response` if the window is
closed by pressing <kbd>Escape</kbd> or with a system action.

It doesn't have to correspond to any of the responses in the dialog.

The default close response is `close`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `defaultResponse`

`string` · default `null` · deprecated since 1.6

The response ID of the default response.

The button corresponding to this response will be set as the default widget
of the dialog.

If not set, the default widget will not be set, and the last added response
will be focused by default.

See `Gtk.Window.defaultWidget`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `extraChild`

`Gtk.Widget | ReactElement` · deprecated since 1.6

The child widget.

Displayed below the heading and body.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `heading`

`string` · deprecated since 1.6

The heading of the dialog.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `headingUseMarkup`

`boolean` · default `false` · deprecated since 1.6

Whether the heading includes Pango markup.

See `Pango.parseMarkup()`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

## Signals

### `onResponse`

```ts
(response: string, self: Adw.MessageDialog) => void
```

This signal is emitted when the dialog is closed.

`response` will be set to the response ID of the button that had been
activated.

if the dialog was closed by pressing <kbd>Escape</kbd> or with a system
action, `response` will be set to the value of
`MessageDialog.closeResponse`.

**Parameters**

- `response`: the response ID
- `self`: The instance the signal was emitted on.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

## Methods

Methods are called on the `Adw.MessageDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addResponse`

```ts
addResponse(id: string, label: string): void
```

Adds a response with `id` and `label` to `self`.

Responses are represented as buttons in the dialog.

Response ID must be unique. It will be used in
`MessageDialog.response` to tell which response had been activated,
as well as to inspect and modify the response later.

An embedded underline in `label` indicates a mnemonic.

`MessageDialog.setResponseLabel()` can be used to change the response
label after it had been added.

`MessageDialog.setResponseEnabled()` and
`MessageDialog.setResponseAppearance()` can be used to customize the
responses further.

**Parameters**

- `id`: the response ID
- `label`: the response label

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `choose`

```ts
choose(cancellable?: Gio.Cancellable | null): Promise<string>
```

This function shows `self` to the user.

**Parameters**

- `cancellable`: a `GCancellable` to cancel the operation

**Returns** the ID of the response that was selected, or
  `MessageDialog.closeResponse` if the call was cancelled.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.3._

### `chooseFinish`

```ts
chooseFinish(result: Gio.AsyncResult): string
```

Finishes the `MessageDialog.choose()` call and returns the response ID.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** the ID of the response that was selected, or
  `MessageDialog.closeResponse` if the call was cancelled.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.3._

### `getBody`

```ts
getBody(): string
```

Gets the body text of `self`.

**Returns** the body of `self`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getBodyUseMarkup`

```ts
getBodyUseMarkup(): boolean
```

Gets whether the body text of `self` includes Pango markup.

**Returns** whether `self` uses markup for body text

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getCloseResponse`

```ts
getCloseResponse(): string
```

Gets the ID of the close response of `self`.

**Returns** the close response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getDefaultResponse`

```ts
getDefaultResponse(): string | null
```

Gets the ID of the default response of `self`.

**Returns** the default response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getExtraChild`

```ts
getExtraChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getHeading`

```ts
getHeading(): string | null
```

Gets the heading of `self`.

**Returns** the heading of `self`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getHeadingUseMarkup`

```ts
getHeadingUseMarkup(): boolean
```

Gets whether the heading of `self` includes Pango markup.

**Returns** whether `self` uses markup for heading

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getResponseAppearance`

```ts
getResponseAppearance(response: string): Adw.ResponseAppearance
```

Gets the appearance of `response`.

See `MessageDialog.setResponseAppearance()`.

**Parameters**

- `response`: a response ID

**Returns** the appearance of `response`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getResponseEnabled`

```ts
getResponseEnabled(response: string): boolean
```

Gets whether `response` is enabled.

See `MessageDialog.setResponseEnabled()`.

**Parameters**

- `response`: a response ID

**Returns** whether `response` is enabled

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `getResponseLabel`

```ts
getResponseLabel(response: string): string
```

Gets the label of `response`.

See `MessageDialog.setResponseLabel()`.

**Parameters**

- `response`: a response ID

**Returns** the label of `response`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `hasResponse`

```ts
hasResponse(response: string): boolean
```

Gets whether `self` has a response with the ID `response`.

**Parameters**

- `response`: response ID

**Returns** whether `self` has a response with the ID `response`.

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `removeResponse`

```ts
removeResponse(id: string): void
```

Removes a response from `self`.

**Parameters**

- `id`: the response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.5._

### `response`

```ts
response(response: string): void
```

Emits the `MessageDialog.response` signal with the given response ID.

Used to indicate that the user has responded to the dialog in some way.

**Parameters**

- `response`: response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setBody`

```ts
setBody(body: string): void
```

Sets the body text of `self`.

**Parameters**

- `body`: the body of `self`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setBodyUseMarkup`

```ts
setBodyUseMarkup(useMarkup: boolean): void
```

Sets whether the body text of `self` includes Pango markup.

See `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup for body text

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setCloseResponse`

```ts
setCloseResponse(response: string): void
```

Sets the ID of the close response of `self`.

It will be passed to `MessageDialog.response` if the window is
closed by pressing <kbd>Escape</kbd> or with a system action.

It doesn't have to correspond to any of the responses in the dialog.

The default close response is `close`.

**Parameters**

- `response`: the close response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setDefaultResponse`

```ts
setDefaultResponse(response: string | null): void
```

Sets the ID of the default response of `self`.

The button corresponding to this response will be set as the default widget
of `self`.

If not set, the default widget will not be set, and the last added response
will be focused by default.

See `Gtk.Window.defaultWidget`.

**Parameters**

- `response`: the default response ID

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setExtraChild`

```ts
setExtraChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

The child widget is displayed below the heading and body.

**Parameters**

- `child`: the child widget

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setHeading`

```ts
setHeading(heading: string | null): void
```

Sets the heading of `self`.

**Parameters**

- `heading`: the heading of `self`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setHeadingUseMarkup`

```ts
setHeadingUseMarkup(useMarkup: boolean): void
```

Sets whether the heading of `self` includes Pango markup.

See `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup for heading

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setResponseAppearance`

```ts
setResponseAppearance(response: string, appearance: Adw.ResponseAppearance): void
```

Sets the appearance for `response`.



Use `Adw.ResponseAppearance.suggested` to mark important responses such
as the affirmative action, like the Save button in the example.

Use `Adw.ResponseAppearance.destructive` to draw attention to the
potentially damaging consequences of using `response`. This appearance acts as
a warning to the user. The Discard button in the example is using this
appearance.

The default appearance is `Adw.ResponseAppearance.default`.

Negative responses like Cancel or Close should use the default appearance.

**Parameters**

- `response`: a response ID
- `appearance`: appearance for `response`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setResponseEnabled`

```ts
setResponseEnabled(response: string, enabled: boolean): void
```

Sets whether `response` is enabled.

If `response` is not enabled, the corresponding button will have
`Gtk.Widget.sensitive` set to `FALSE` and it can't be activated as
a default response.

`response` can still be used as `MessageDialog.closeResponse` while
it's not enabled.

Responses are enabled by default.

**Parameters**

- `response`: a response ID
- `enabled`: whether to enable `response`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._

### `setResponseLabel`

```ts
setResponseLabel(response: string, label: string): void
```

Sets the label of `response` to `label`.

Labels are displayed on the dialog buttons. An embedded underline in `label`
indicates a mnemonic.

**Parameters**

- `response`: a response ID
- `label`: the label of `response`

> **Deprecated since 1.6.** Use `AlertDialog`.

_Available since 1.2._
