---
description: "An event controller to receive Drag-and-Drop operations."
---

# GtkDropTarget

An event controller to receive Drag-and-Drop operations.

The most basic way to use a `GtkDropTarget` to receive drops on a
widget is to create it via `Gtk.DropTarget.new()`, passing in the
`GType` of the data you want to receive and connect to the
`Gtk.DropTarget.drop` signal to receive the data:

```c
static gboolean
on_drop (GtkDropTarget *target,
         const GValue  *value,
         double         x,
         double         y,
         gpointer       data)
{
  MyWidget *self = data;

  // Call the appropriate setter depending on the type of data
  // that we received
  if (G_VALUE_HOLDS (value, G_TYPE_FILE))
    my_widget_set_file (self, g_value_get_object (value));
  else if (G_VALUE_HOLDS (value, GDK_TYPE_PIXBUF))
    my_widget_set_pixbuf (self, g_value_get_object (value));
  else
    return FALSE;

  return TRUE;
}

static void
my_widget_init (MyWidget *self)
{
  GtkDropTarget *target =
    gtk_drop_target_new (G_TYPE_INVALID, GDK_ACTION_COPY);

  // This widget accepts two types of drop types: GFile objects
  // and GdkPixbuf objects
  gtk_drop_target_set_gtypes (target, (GType [2]) {
    G_TYPE_FILE,
    GDK_TYPE_PIXBUF,
  }, 2);

  g_signal_connect (target, "drop", G_CALLBACK (on_drop), self);
  gtk_widget_add_controller (GTK_WIDGET (self), GTK_EVENT_CONTROLLER (target));
}
```

`GtkDropTarget` supports more options, such as:

 * rejecting potential drops via the `Gtk.DropTarget.accept` signal
   and the `Gtk.DropTarget.reject()` function to let other drop
   targets handle the drop
 * tracking an ongoing drag operation before the drop via the
   `Gtk.DropTarget.enter`, `Gtk.DropTarget.motion` and
   `Gtk.DropTarget.leave` signals
 * configuring how to receive data by setting the
   `Gtk.DropTarget.preload` property and listening for its
   availability via the `Gtk.DropTarget.value` property

However, `GtkDropTarget` is ultimately modeled in a synchronous way
and only supports data transferred via `GType`. If you want full control
over an ongoing drop, the `Gtk.DropTargetAsync` object gives you
this ability.

While a pointer is dragged over the drop target's widget and the drop
has not been rejected, that widget will receive the
`GTK_STATE_FLAG_DROP_ACTIVE` state, which can be used to style the widget.

If you are not interested in receiving the drop, but just want to update
UI state during a Drag-and-Drop operation (e.g. switching tabs), you can
use `Gtk.DropControllerMotion`.

```tsx
import { GtkDropTarget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkDropTarget**

## Props

`ref` receives the `Gtk.DropTarget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`Gdk.DragAction` · default `GDK_ACTION_NONE`

The `GdkDragActions` that this drop target supports.

### `currentDrop`

`Gdk.Drop` · read-only, observe with `onNotifyCurrentDrop`

The `GdkDrop` that is currently being performed.

_Available since 4.4._

### `drop`

`Gdk.Drop` · read-only, observe with `onNotifyDrop` · deprecated since 4.4

The `GdkDrop` that is currently being performed.

> **Deprecated since 4.4.** Use `Gtk.DropTarget.currentDrop` instead

### `formats`

`Gdk.ContentFormats` · construct-only

The `GdkContentFormats` that determine the supported data formats.

### `preload`

`boolean` · default `false`

Whether the drop data should be preloaded when the pointer is only
hovering over the widget but has not been released.

Setting this property allows finer grained reaction to an ongoing
drop at the cost of loading more data.

The default value for this property is `false` to avoid downloading
huge amounts of data by accident.

For example, if somebody drags a full document of gigabytes of text
from a text editor across a widget with a preloading drop target,
this data will be downloaded, even if the data is ultimately dropped
elsewhere.

For a lot of data formats, the amount of data is very small (like
`GDK_TYPE_RGBA`), so enabling this property does not hurt at all.
And for local-only Drag-and-Drop operations, no data transfer is done,
so enabling it there is free.

### `types`

`GObject.Type[] | null`

GTypes the target accepts a drop of.

### `value`

`GObject.Value` · read-only, observe with `onNotifyValue`

The value for this drop operation.

This is `null` if the data has not been loaded yet or no drop
operation is going on.

Data may be available before the `Gtk.DropTarget.drop`
signal gets emitted - for example when the `Gtk.DropTarget.preload`
property is set. You can use the ::notify signal to be notified
of available data.

## Signals

### `onAccept`

```ts
(drop: Gdk.Drop, self: Gtk.DropTarget) => boolean | undefined
```

Emitted on the drop site when a drop operation is about to begin.

If the drop is not accepted, `false` will be returned and the drop target
will ignore the drop. If `true` is returned, the drop is accepted for now
but may be rejected later via a call to `Gtk.DropTarget.reject()`
or ultimately by returning `false` from a `Gtk.DropTarget.drop`
handler.

The default handler for this signal decides whether to accept the drop
based on the formats provided by the `drop`.

If the decision whether the drop will be accepted or rejected depends
on the data, this function should return `true`, the
`Gtk.DropTarget.preload` property should be set and the value
should be inspected via the ::notify:value signal, calling
`Gtk.DropTarget.reject()` if required.

**Parameters**

- `drop`: the `GdkDrop`
- `self`: The instance the signal was emitted on.

**Returns** `true` if `drop` is accepted

### `onDrop`

```ts
(value: GObject.Value, x: number, y: number, self: Gtk.DropTarget) => boolean | undefined
```

Emitted on the drop site when the user drops the data onto the widget.

The signal handler must determine whether the pointer position is in
a drop zone or not. If it is not in a drop zone, it returns `false`
and no further processing is necessary.

Otherwise, the handler returns `true`. In this case, this handler will
accept the drop. The handler is responsible for using the given `value`
and performing the drop operation.

**Parameters**

- `value`: the `GValue` being dropped
- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** whether the drop was accepted at the given pointer position

### `onEnter`

```ts
(x: number, y: number, self: Gtk.DropTarget) => Gdk.DragAction | undefined
```

Emitted on the drop site when the pointer enters the widget.

It can be used to set up custom highlighting.

**Parameters**

- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** Preferred action for this drag operation or `GDK_ACTION_NONE` if
  dropping is not supported at the current `x`,`y` location.

### `onLeave`

```ts
(self: Gtk.DropTarget) => void
```

Emitted on the drop site when the pointer leaves the widget.

Its main purpose it to undo things done in
`Gtk.DropTarget.enter`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMotion`

```ts
(x: number, y: number, self: Gtk.DropTarget) => Gdk.DragAction | undefined
```

Emitted while the pointer is moving over the drop target.

**Parameters**

- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** Preferred action for this drag operation or `GDK_ACTION_NONE` if
  dropping is not supported at the current `x`,`y` location.

## Methods

Methods are called on the `Gtk.DropTarget` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActions`

```ts
getActions(): Gdk.DragAction
```

Gets the actions that this drop target supports.

**Returns** the actions that this drop target supports

### `getCurrentDrop`

```ts
getCurrentDrop(): Gdk.Drop | null
```

Gets the currently handled drop operation.

If no drop operation is going on, `null` is returned.

**Returns** The current drop

_Available since 4.4._

### `getDrop`

```ts
getDrop(): Gdk.Drop | null
```

Gets the currently handled drop operation.

If no drop operation is going on, `null` is returned.

**Returns** The current drop

> **Deprecated since 4.4.** Use `Gtk.DropTarget.getCurrentDrop()` instead

### `getFormats`

```ts
getFormats(): Gdk.ContentFormats | null
```

Gets the data formats that this drop target accepts.

If the result is `null`, all formats are expected to be supported.

**Returns** the supported data formats

### `getGtypes`

```ts
getGtypes(): bigint[] | null
```

Gets the list of supported `GType`s that can be dropped on the target.

If no types have been set, `NULL` will be returned.

**Returns** the `G_TYPE_INVALID`-terminated array of types included in
  formats

### `getPreload`

```ts
getPreload(): boolean
```

Gets whether data should be preloaded on hover.

**Returns** `true` if drop data should be preloaded

### `getValue`

```ts
getValue(): unknown
```

Gets the current drop data, as a `GValue`.

**Returns** The current drop data

### `reject`

```ts
reject(): void
```

Rejects the ongoing drop operation.

If no drop operation is ongoing, i.e when `Gtk.DropTarget.currentDrop`
is `null`, this function does nothing.

This function should be used when delaying the decision
on whether to accept a drag or not until after reading
the data.

### `setActions`

```ts
setActions(actions: Gdk.DragAction): void
```

Sets the actions that this drop target supports.

**Parameters**

- `actions`: the supported actions

### `setGtypes`

```ts
setGtypes(types: (bigint | AnyClass<TypedClass>)[] | null): void
```

Sets the supported `GType`s for this drop target.

**Parameters**

- `types`: all supported `GType`s that can be dropped on the target

### `setPreload`

```ts
setPreload(preload: boolean): void
```

Sets whether data should be preloaded on hover.

**Parameters**

- `preload`: `true` to preload drop data
