---
description: "A helper object for ToastOverlay."
---

# AdwToast

A helper object for `ToastOverlay`.

Toasts are meant to be passed into `ToastOverlay.addToast()` as
follows:

```c
adw_toast_overlay_add_toast (overlay, adw_toast_new (_("Simple Toast")));
```



Toasts always have a close button. They emit the `Toast.dismissed`
signal when disappearing.

`Toast.timeout` determines how long the toast stays on screen, while
`Toast.priority` determines how it behaves if another toast is
already being displayed.

Toast titles use Pango markup by default, set `Toast.useMarkup` to
`FALSE` if this is unwanted.

`Toast.customTitle` can be used to replace the title label with a
custom widget.

### Actions

Toasts can have one button on them, with a label and an attached
`Gio.Action`.

```c
AdwToast *toast = adw_toast_new (_("Toast with Action"));

adw_toast_set_button_label (toast, _("_Example"));
adw_toast_set_action_name (toast, "win.example");

adw_toast_overlay_add_toast (overlay, toast);
```



### Modifying toasts

Toasts can be modified after they have been shown. For this, an `AdwToast`
reference must be kept around while the toast is visible.

A common use case for this is using toasts as undo prompts that stack with
each other, allowing to batch undo the last deleted items:

```c

static void
toast_undo_cb (GtkWidget  *sender,
               const char *action,
               GVariant   *param)
{
  // Undo the deletion
}

static void
dismissed_cb (MyWindow *self)
{
  self->undo_toast = NULL;

  // Permanently delete the items
}

static void
delete_item (MyWindow *self,
             MyItem   *item)
{
  g_autofree char *title = NULL;
  int n_items;

  // Mark the item as waiting for deletion
  n_items = ... // The number of waiting items

  if (!self->undo_toast) {
    self->undo_toast = adw_toast_new_format (_("‘%s’ deleted"), ...);

    adw_toast_set_priority (self->undo_toast, ADW_TOAST_PRIORITY_HIGH);
    adw_toast_set_button_label (self->undo_toast, _("_Undo"));
    adw_toast_set_action_name (self->undo_toast, "toast.undo");

    g_signal_connect_swapped (self->undo_toast, "dismissed",
                              G_CALLBACK (dismissed_cb), self);

    adw_toast_overlay_add_toast (self->toast_overlay, self->undo_toast);

    return;
  }

  title =
    g_strdup_printf (ngettext ("<span font_features='tnum=1'>%d</span> item deleted",
                               "<span font_features='tnum=1'>%d</span> items deleted",
                               n_items), n_items);

  adw_toast_set_title (self->undo_toast, title);

  // Bump the toast timeout
  adw_toast_overlay_add_toast (self->toast_overlay, g_object_ref (self->undo_toast));
}

static void
my_window_class_init (MyWindowClass *klass)
{
  GtkWidgetClass *widget_class = GTK_WIDGET_CLASS (klass);

  gtk_widget_class_install_action (widget_class, "toast.undo", NULL, toast_undo_cb);
}
```

```tsx
import { AdwToast } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwToast**

## Props

`ref` receives the `Adw.Toast` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null`

The name of the associated action.

It will be activated when clicking the button.

See `Toast.actionTarget`.

### `actionTarget`

`GLib.Variant`

The parameter for action invocations.

### `buttonLabel`

`string` · default `null`

The label to show on the button.

Underlines in the button text can be used to indicate a mnemonic.

If set to `NULL`, the button won't be shown.

See `Toast.actionName`.

### `customTitle`

`Gtk.Widget | ReactElement`

The custom title widget.

It will be displayed instead of the title if set. In this case,
`Toast.title` is ignored.

Setting a custom title will unset `Toast.title`.

_Available since 1.2._

### `priority`

`Adw.ToastPriority` · default `ADW_TOAST_PRIORITY_NORMAL`

The priority of the toast.

Priority controls how the toast behaves when another toast is already
being displayed.

If the priority is `Adw.ToastPriority.normal`, the toast will be
queued.

If the priority is `Adw.ToastPriority.high`, the toast will be
displayed immediately, pushing the previous toast into the queue instead.

### `timeout`

`number` · default `5`

The timeout of the toast, in seconds.

If timeout is 0, the toast is displayed indefinitely until manually
dismissed.

Toasts cannot disappear while being hovered, pressed (on touchscreen), or
have keyboard focus inside them.

### `title`

`string`

The title of the toast.

The title can be marked up with the Pango text markup language.

Setting a title will unset `Toast.customTitle`.

If `Toast.customTitle` is set, it will be used instead.

### `useMarkup`

`boolean` · default `true`

Whether to use Pango markup for the toast title.

See also `Pango.parseMarkup()`.

_Available since 1.4._

## Signals

### `onButtonClicked`

```ts
(self: Adw.Toast) => void
```

Emitted after the button has been clicked.

It can be used as an alternative to setting an action.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.2._

### `onDismissed`

```ts
(self: Adw.Toast) => void
```

Emitted when the toast has been dismissed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Adw.Toast` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `dismiss`

```ts
dismiss(): void
```

Dismisses `self`.

Does nothing if `self` has already been dismissed, or hasn't been added to an
`ToastOverlay`.

### `getActionName`

```ts
getActionName(): string | null
```

Gets the name of the associated action.

**Returns** the action name

### `getActionTargetValue`

```ts
getActionTargetValue(): GLib.Variant | null
```

Gets the parameter for action invocations.

**Returns** the action target

### `getButtonLabel`

```ts
getButtonLabel(): string | null
```

Gets the label to show on the button.

**Returns** the button label

### `getCustomTitle`

```ts
getCustomTitle(): Gtk.Widget | null
```

Gets the custom title widget of `self`.

**Returns** the custom title widget

_Available since 1.2._

### `getPriority`

```ts
getPriority(): Adw.ToastPriority
```

Gets priority for `self`.

**Returns** the priority

### `getTimeout`

```ts
getTimeout(): number
```

Gets timeout for `self`.

**Returns** the timeout

### `getTitle`

```ts
getTitle(): string | null
```

Gets the title that will be displayed on the toast.

If a custom title has been set with `Adw.Toast.setCustomTitle()`
the return value will be `null`.

**Returns** the title

### `getUseMarkup`

```ts
getUseMarkup(): boolean
```

Gets whether to use Pango markup for the toast title.

**Returns** whether the toast uses markup

_Available since 1.4._

### `setActionName`

```ts
setActionName(actionName: string | null): void
```

Sets the name of the associated action.

It will be activated when clicking the button.

See `Toast.actionTarget`.

**Parameters**

- `actionName`: the action name

### `setActionTargetValue`

```ts
setActionTargetValue(actionTarget: GLib.Variant | null): void
```

Sets the parameter for action invocations.

If the `action_target` variant has a floating reference this function
will sink it.

**Parameters**

- `actionTarget`: the action target

### `setButtonLabel`

```ts
setButtonLabel(buttonLabel: string | null): void
```

Sets the label to show on the button.

Underlines in the button text can be used to indicate a mnemonic.

If set to `NULL`, the button won't be shown.

See `Toast.actionName`.

**Parameters**

- `buttonLabel`: a button label

### `setCustomTitle`

```ts
setCustomTitle(widget: Gtk.Widget | null): void
```

Sets the custom title widget of `self`.

It will be displayed instead of the title if set. In this case,
`Toast.title` is ignored.

Setting a custom title will unset `Toast.title`.

**Parameters**

- `widget`: the custom title widget

_Available since 1.2._

### `setDetailedActionName`

```ts
setDetailedActionName(detailedActionName: string | null): void
```

Sets the action name and its parameter.

`detailed_action_name` is a string in the format accepted by
`Gio.Action.parseDetailedName()`.

**Parameters**

- `detailedActionName`: the detailed action name

### `setPriority`

```ts
setPriority(priority: Adw.ToastPriority): void
```

Sets priority for `self`.

Priority controls how the toast behaves when another toast is already
being displayed.

If `priority` is `Adw.ToastPriority.normal`, the toast will be queued.

If `priority` is `Adw.ToastPriority.high`, the toast will be displayed
immediately, pushing the previous toast into the queue instead.

**Parameters**

- `priority`: the priority

### `setTimeout`

```ts
setTimeout(timeout: number): void
```

Sets timeout for `self`.

If `timeout` is 0, the toast is displayed indefinitely until manually
dismissed.

Toasts cannot disappear while being hovered, pressed (on touchscreen), or
have keyboard focus inside them.

**Parameters**

- `timeout`: the timeout

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title that will be displayed on the toast.

The title can be marked up with the Pango text markup language.

Setting a title will unset `Toast.customTitle`.

If `Toast.customTitle` is set, it will be used instead.

**Parameters**

- `title`: a title

### `setUseMarkup`

```ts
setUseMarkup(useMarkup: boolean): void
```

Whether to use Pango markup for the toast title.

See also `Pango.parseMarkup()`.

**Parameters**

- `useMarkup`: whether to use markup

_Available since 1.4._
