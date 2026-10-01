---
description: "A dialog presenting a message or a question."
---

# AdwAlertDialog

A dialog presenting a message or a question.



Alert dialogs have a heading, a body, an optional child widget, and one or
multiple responses, each presented as a button.

Each response has a unique string ID, and a button label. Additionally, each
response can be enabled or disabled, and can have a suggested or destructive
appearance.

When one of the responses is activated, or the dialog is closed, the
`AlertDialog.response` signal will be emitted. This signal is
detailed, and the detail, as well as the `response` parameter will be set to
the ID of the activated response, or to the value of the
`AlertDialog.closeResponse` property if the dialog had been closed
without activating any of the responses.

Response buttons can be presented horizontally or vertically depending on
available space.

When a response is activated, `AdwAlertDialog` is closed automatically.

An example of using an alert dialog:

```c
AdwDialog *dialog;

dialog = adw_alert_dialog_new (_("Replace File?"), NULL);

adw_alert_dialog_format_body (ADW_ALERT_DIALOG (dialog),
                              _("A file named “%s” already exists. Do you want to replace it?"),
                              filename);

adw_alert_dialog_add_responses (ADW_ALERT_DIALOG (dialog),
                                "cancel",  _("_Cancel"),
                                "replace", _("_Replace"),
                                NULL);

adw_alert_dialog_set_response_appearance (ADW_ALERT_DIALOG (dialog),
                                          "replace",
                                          ADW_RESPONSE_DESTRUCTIVE);

adw_alert_dialog_set_default_response (ADW_ALERT_DIALOG (dialog), "cancel");
adw_alert_dialog_set_close_response (ADW_ALERT_DIALOG (dialog), "cancel");

g_signal_connect (dialog, "response", G_CALLBACK (response_cb), self);

adw_dialog_present (dialog, parent);
```

### Async API

`AdwAlertDialog` can also be used via the `AlertDialog.choose()` method.
This API follows the GIO async pattern, for example:

```c
static void
dialog_cb (AdwAlertDialog *dialog,
           GAsyncResult   *result,
           MyWindow       *self)
{
  const char *response = adw_alert_dialog_choose_finish (dialog, result);

  // ...
}

static void
show_dialog (MyWindow *self)
{
  AdwDialog *dialog;

  dialog = adw_alert_dialog_new (_("Replace File?"), NULL);

  adw_alert_dialog_format_body (ADW_ALERT_DIALOG (dialog),
                                _("A file named “%s” already exists. Do you want to replace it?"),
                                filename);

  adw_alert_dialog_add_responses (ADW_ALERT_DIALOG (dialog),
                                  "cancel",  _("_Cancel"),
                                  "replace", _("_Replace"),
                                  NULL);

  adw_alert_dialog_set_response_appearance (ADW_ALERT_DIALOG (dialog),
                                            "replace",
                                            ADW_RESPONSE_DESTRUCTIVE);

  adw_alert_dialog_set_default_response (ADW_ALERT_DIALOG (dialog), "cancel");
  adw_alert_dialog_set_close_response (ADW_ALERT_DIALOG (dialog), "cancel");

  adw_alert_dialog_choose (ADW_ALERT_DIALOG (dialog), GTK_WIDGET (self),
                           NULL, (GAsyncReadyCallback) dialog_cb, self);
}
```

### AdwAlertDialog as GtkBuildable

`AdwAlertDialog` supports adding responses in UI definitions by via the
`<responses>` element that may contain multiple `<response>` elements, each
representing a response.

Each of the `<response>` elements must have the `id` attribute specifying the
response ID. The contents of the element are used as the response label.

Response labels can be translated with the usual `translatable`, `context`
and `comments` attributes.

The `<response>` elements can also have `enabled` and/or `appearance`
attributes. See `AlertDialog.setResponseEnabled()` and
`AlertDialog.setResponseAppearance()` for details.

Example of an `AdwAlertDialog` UI definition:

```xml
<object class="AdwAlertDialog" id="dialog">
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

_Available since 1.5._

```tsx
import { AdwAlertDialog } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [AdwDialog](.gtkx/reference/adw/dialog.md) → **AdwAlertDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.AlertDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `body`

`string`

The body text of the dialog.

_Available since 1.5._

### `bodyUseMarkup`

`boolean` · default `false`

Whether the body text includes Pango markup.

See `Pango.parseMarkup()`.

_Available since 1.5._

### `children`

`ReactNode`

Widget set as the dialog's extra child, shown below the `heading` and `body` and above the response buttons, leaving the dialog's own chrome in place.

### `closeResponse`

`string` · default `close`

The ID of the close response.

It will be passed to `AlertDialog.response` if the dialog is
closed by pressing <kbd>Escape</kbd> or with a system action.

It doesn't have to correspond to any of the responses in the dialog.

The default close response is `close`.

_Available since 1.5._

### `defaultResponse`

`string` · default `null`

The response ID of the default response.

The button corresponding to this response will be set as the default widget
of the dialog.

If not set, the default widget will not be set, and the last added response
will be focused by default.

See `Dialog.defaultWidget`.

_Available since 1.5._

### `heading`

`string`

The heading of the dialog.

_Available since 1.5._

### `headingUseMarkup`

`boolean` · default `false`

Whether the heading includes Pango markup.

See `Pango.parseMarkup()`.

_Available since 1.5._

### `preferWideLayout`

`boolean` · default `false`

Whether to prefer horizontal button layout.

`AdwAlertDialog` can present buttons horizontally or vertically depending
on available space, how many buttons there are and how wide they are.

By default it will prefer to stack buttons vertically at medium sizes.

Set to `TRUE` to prefer horizontal layout in these cases instead. This will
make the dialog slightly wider as well.

Vertical layout may still be used if the dialog would get too wide
otherwise.

Does nothing with just one button, or when the buttons are already
horizontal.

_Available since 1.6._

### `responses`

`AlertDialogResponse[] | null`

Buttons the dialog offers, added and removed as the list changes.

## Signals

### `onResponse`

```ts
(response: string, self: Adw.AlertDialog) => void
```

This signal is emitted when the dialog is closed.

`response` will be set to the response ID of the button that had been
activated.

if the dialog was closed by pressing <kbd>Escape</kbd> or with a system
action, `response` will be set to the value of
`AlertDialog.closeResponse`.

**Parameters**

- `response`: the response ID
- `self`: The instance the signal was emitted on.

_Available since 1.5._

## Methods

Methods are called on the `Adw.AlertDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addResponse`

```ts
addResponse(id: string, label: string): void
```

Adds a response with `id` and `label` to `self`.

Responses are represented as buttons in the dialog.

Response ID must be unique. It will be used in `AlertDialog.response`
to tell which response had been activated, as well as to inspect and modify
the response later.

An embedded underline in `label` indicates a mnemonic.

`AlertDialog.setResponseLabel()` can be used to change the response
label after it had been added.

`AlertDialog.setResponseEnabled()` and
`AlertDialog.setResponseAppearance()` can be used to customize the
responses further.

**Parameters**

- `id`: the response ID
- `label`: the response label

_Available since 1.5._

### `choose`

```ts
choose(parent: Gtk.Widget | null, cancellable?: Gio.Cancellable | null): Promise<string>
```

This function shows `self` to the user.

If the window is an `Window` or `ApplicationWindow`, the dialog
will be shown within it. Otherwise, it will be a separate window.

**Parameters**

- `parent`: the parent widget
- `cancellable`: a `GCancellable` to cancel the operation

**Returns** the ID of the response that was selected, or
  `AlertDialog.closeResponse` if the call was cancelled.

_Available since 1.5._

### `chooseFinish`

```ts
chooseFinish(result: Gio.AsyncResult): string
```

Finishes the `AlertDialog.choose()` call and returns the response ID.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** the ID of the response that was selected, or
  `AlertDialog.closeResponse` if the call was cancelled.

_Available since 1.5._

### `getBody`

```ts
getBody(): string
```

Gets the body text of `self`.

**Returns** the body of `self`.

_Available since 1.5._

### `getBodyUseMarkup`

```ts
getBodyUseMarkup(): boolean
```

Gets whether the body text of `self` includes Pango markup.

**Returns** whether `self` uses markup for body text

_Available since 1.5._

### `getCloseResponse`

```ts
getCloseResponse(): string
```

Gets the ID of the close response of `self`.

**Returns** the close response ID

_Available since 1.5._

### `getDefaultResponse`

```ts
getDefaultResponse(): string | null
```

Gets the ID of the default response of `self`.

**Returns** the default response ID

_Available since 1.5._

### `getExtraChild`

```ts
getExtraChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`.

_Available since 1.5._

### `getHeading`

```ts
getHeading(): string | null
```

Gets the heading of `self`.

**Returns** the heading of `self`.

_Available since 1.5._

### `getHeadingUseMarkup`

```ts
getHeadingUseMarkup(): boolean
```

Gets whether the heading of `self` includes Pango markup.

**Returns** whether `self` uses markup for heading

_Available since 1.5._

### `getPreferWideLayout`

```ts
getPreferWideLayout(): boolean
```

Gets whether `self` prefers horizontal button layout.

**Returns** whether to prefer wide layout

_Available since 1.6._

### `getResponseAppearance`

```ts
getResponseAppearance(response: string): Adw.ResponseAppearance
```

Gets the appearance of `response`.

See `AlertDialog.setResponseAppearance()`.

**Parameters**

- `response`: a response ID

**Returns** the appearance of `response`

_Available since 1.5._

### `getResponseEnabled`

```ts
getResponseEnabled(response: string): boolean
```

Gets whether `response` is enabled.

See `AlertDialog.setResponseEnabled()`.

**Parameters**

- `response`: a response ID

**Returns** whether `response` is enabled

_Available since 1.5._

### `getResponseLabel`

```ts
getResponseLabel(response: string): string
```

Gets the label of `response`.

See `AlertDialog.setResponseLabel()`.

**Parameters**

- `response`: a response ID

**Returns** the label of `response`

_Available since 1.5._

### `hasResponse`

```ts
hasResponse(response: string): boolean
```

Gets whether `self` has a response with the ID `response`.

**Parameters**

- `response`: response ID

**Returns** whether `self` has a response with the ID `response`.

_Available since 1.5._

### `removeResponse`

```ts
removeResponse(id: string): void
```

Removes a response from `self`.

**Parameters**

- `id`: the response ID

_Available since 1.5._

### `setBody`

```ts
setBody(body: string): void
```

Sets the body text of `self`.

**Parameters**

- `body`: the body of `self`

_Available since 1.5._

### `setBodyUseMarkup`

```ts
setBodyUseMarkup(useMarkup: boolean): void
```

Sets whether the body text of `self` includes Pango markup.

See `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup for body text

_Available since 1.5._

### `setCloseResponse`

```ts
setCloseResponse(response: string): void
```

Sets the ID of the close response of `self`.

It will be passed to `AlertDialog.response` if the dialog is closed
by pressing <kbd>Escape</kbd> or with a system action.

It doesn't have to correspond to any of the responses in the dialog.

The default close response is `close`.

**Parameters**

- `response`: the close response ID

_Available since 1.5._

### `setDefaultResponse`

```ts
setDefaultResponse(response: string | null): void
```

Sets the ID of the default response of `self`.

The button corresponding to this response will be set as the default widget
of `self`.

If not set, the default widget will not be set, and the last added response
will be focused by default.

See `Dialog.defaultWidget`.

**Parameters**

- `response`: the default response ID

_Available since 1.5._

### `setExtraChild`

```ts
setExtraChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

The child widget is displayed below the heading and body.

**Parameters**

- `child`: the child widget

_Available since 1.5._

### `setHeading`

```ts
setHeading(heading: string | null): void
```

Sets the heading of `self`.

**Parameters**

- `heading`: the heading of `self`

_Available since 1.5._

### `setHeadingUseMarkup`

```ts
setHeadingUseMarkup(useMarkup: boolean): void
```

Sets whether the heading of `self` includes Pango markup.

See `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup for heading

_Available since 1.5._

### `setPreferWideLayout`

```ts
setPreferWideLayout(preferWideLayout: boolean): void
```

Whether to prefer horizontal button layout.

`AdwAlertDialog` can present buttons horizontally or vertically depending
on available space, how many buttons there are and how wide they are.

By default it will prefer to stack buttons vertically at medium sizes.

Set to `TRUE` to prefer horizontal layout in these cases instead. This will
make the dialog slightly wider as well.

Vertical layout may still be used if the dialog would get too wide
otherwise.

Does nothing with just one button, or when the buttons are already
horizontal.

**Parameters**

- `preferWideLayout`: whether to prefer wide layout

_Available since 1.6._

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

_Available since 1.5._

### `setResponseEnabled`

```ts
setResponseEnabled(response: string, enabled: boolean): void
```

Sets whether `response` is enabled.

If `response` is not enabled, the corresponding button will have
`Gtk.Widget.sensitive` set to `FALSE` and it can't be activated as
a default response.

`response` can still be used as `AlertDialog.closeResponse` while
it's not enabled.

Responses are enabled by default.

**Parameters**

- `response`: a response ID
- `enabled`: whether to enable `response`

_Available since 1.5._

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

_Available since 1.5._
