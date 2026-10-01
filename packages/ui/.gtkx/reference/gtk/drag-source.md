---
description: "An event controller to initiate Drag-And-Drop operations."
---

# GtkDragSource

An event controller to initiate Drag-And-Drop operations.

`GtkDragSource` can be set up with the necessary
ingredients for a DND operation ahead of time. This includes
the source for the data that is being transferred, in the form
of a `Gdk.ContentProvider`, the desired action, and the icon to
use during the drag operation. After setting it up, the drag
source must be added to a widget as an event controller, using
`Gtk.Widget.addController()`.

```c
static void
my_widget_init (MyWidget *self)
{
  GtkDragSource *drag_source = gtk_drag_source_new ();

  g_signal_connect (drag_source, "prepare", G_CALLBACK (on_drag_prepare), self);
  g_signal_connect (drag_source, "drag-begin", G_CALLBACK (on_drag_begin), self);

  gtk_widget_add_controller (GTK_WIDGET (self), GTK_EVENT_CONTROLLER (drag_source));
}
```

Setting up the content provider and icon ahead of time only makes
sense when the data does not change. More commonly, you will want
to set them up just in time. To do so, `GtkDragSource` has
`Gtk.DragSource.prepare` and `Gtk.DragSource.drag-begin`
signals.

The ::prepare signal is emitted before a drag is started, and
can be used to set the content provider and actions that the
drag should be started with.

```c
static GdkContentProvider *
on_drag_prepare (GtkDragSource *source,
                 double         x,
                 double         y,
                 MyWidget      *self)
{
  // This widget supports two types of content: GFile objects
  // and GdkPixbuf objects; GTK will handle the serialization
  // of these types automatically
  GFile *file = my_widget_get_file (self);
  GdkPixbuf *pixbuf = my_widget_get_pixbuf (self);

  return gdk_content_provider_new_union ((GdkContentProvider *[2]) {
      gdk_content_provider_new_typed (G_TYPE_FILE, file),
      gdk_content_provider_new_typed (GDK_TYPE_PIXBUF, pixbuf),
    }, 2);
}
```

The ::drag-begin signal is emitted after the `GdkDrag` object has
been created, and can be used to set up the drag icon.

```c
static void
on_drag_begin (GtkDragSource *source,
               GdkDrag       *drag,
               MyWidget      *self)
{
  // Set the widget as the drag icon
  GdkPaintable *paintable = gtk_widget_paintable_new (GTK_WIDGET (self));
  gtk_drag_source_set_icon (source, paintable, 0, 0);
  g_object_unref (paintable);
}
```

During the DND operation, `GtkDragSource` emits signals that
can be used to obtain updates about the status of the operation,
but it is not normally necessary to connect to any signals,
except for one case: when the supported actions include
`GDK_ACTION_MOVE`, you need to listen for the
`Gtk.DragSource.drag-end` signal and delete the
data after it has been transferred.

```tsx
import { GtkDragSource } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → [GtkGesture](.gtkx/reference/gtk/gesture.md) → [GtkGestureSingle](.gtkx/reference/gtk/gesture-single.md) → **GtkDragSource**

## Props

`ref` receives the `Gtk.DragSource` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`Gdk.DragAction` · default `GDK_ACTION_COPY`

The actions that are supported by drag operations from the source.

Note that you must handle the `Gtk.DragSource.drag-end` signal
if the actions include `GDK_ACTION_MOVE`.

### `content`

`Gdk.ContentProvider | ReactElement`

The data that is offered by drag operations from this source.

### `icon`

`DragSourceIcon | null`

Icon shown under the pointer while a drag started from this source is in flight.

## Signals

### `onDragBegin`

```ts
(drag: Gdk.Drag, self: Gtk.DragSource) => void
```

Emitted on the drag source when a drag is started.

It can be used to e.g. set a custom drag icon with
`Gtk.DragSource.setIcon()`.

**Parameters**

- `drag`: the `GdkDrag` object
- `self`: The instance the signal was emitted on.

### `onDragCancel`

```ts
(drag: Gdk.Drag, reason: Gdk.DragCancelReason, self: Gtk.DragSource) => boolean | undefined
```

Emitted on the drag source when a drag has failed.

The signal handler may handle a failed drag operation based on
the type of error. It should return `true` if the failure has been handled
and the default "drag operation failed" animation should not be shown.

**Parameters**

- `drag`: the `GdkDrag` object
- `reason`: information on why the drag failed
- `self`: The instance the signal was emitted on.

**Returns** `true` if the failed drag operation has been already handled

### `onDragEnd`

```ts
(drag: Gdk.Drag, deleteData: boolean, self: Gtk.DragSource) => void
```

Emitted on the drag source when a drag is finished.

A typical reason to connect to this signal is to undo
things done in `Gtk.DragSource.prepare` or
`Gtk.DragSource.drag-begin` handlers.

**Parameters**

- `drag`: the `GdkDrag` object
- `deleteData`: `true` if the drag was performing `GDK_ACTION_MOVE`, and the data should be deleted
- `self`: The instance the signal was emitted on.

### `onPrepare`

```ts
(x: number, y: number, self: Gtk.DragSource) => Gdk.ContentProvider | null | undefined
```

Emitted when a drag is about to be initiated.

It returns the `GdkContentProvider` to use for the drag that is about
to start. The default handler for this signal returns the value of
the `Gtk.DragSource.content` property, so if you set up that
property ahead of time, you don't need to connect to this signal.

**Parameters**

- `x`: the X coordinate of the drag starting point
- `y`: the Y coordinate of the drag starting point
- `self`: The instance the signal was emitted on.

**Returns** a `GdkContentProvider`

## Methods

Methods are called on the `Gtk.DragSource` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `dragCancel`

```ts
dragCancel(): void
```

Cancels a currently ongoing drag operation.

### `getActions`

```ts
getActions(): Gdk.DragAction
```

Gets the actions that are currently set on the `GtkDragSource`.

**Returns** the actions set on `source`

### `getContent`

```ts
getContent(): Gdk.ContentProvider | null
```

Gets the current content provider of a `GtkDragSource`.

**Returns** the `GdkContentProvider` of `source`

### `getDrag`

```ts
getDrag(): Gdk.Drag | null
```

Returns the underlying `GdkDrag` object for an ongoing drag.

**Returns** the `GdkDrag` of the current
  drag operation

### `setActions`

```ts
setActions(actions: Gdk.DragAction): void
```

Sets the actions on the `GtkDragSource`.

During a DND operation, the actions are offered to potential
drop targets. If `actions` include `GDK_ACTION_MOVE`, you need
to listen to the `Gtk.DragSource.drag-end` signal and
handle `delete_data` being `true`.

This function can be called before a drag is started,
or in a handler for the `Gtk.DragSource.prepare` signal.

**Parameters**

- `actions`: the actions to offer

### `setContent`

```ts
setContent(content: Gdk.ContentProvider | null): void
```

Sets a content provider on a `GtkDragSource`.

When the data is requested in the cause of a DND operation,
it will be obtained from the content provider.

This function can be called before a drag is started,
or in a handler for the `Gtk.DragSource.prepare` signal.

You may consider setting the content provider back to
`null` in a `Gtk.DragSource.drag-end` signal handler.

**Parameters**

- `content`: a `GdkContentProvider`

### `setIcon`

```ts
setIcon(paintable: Gdk.Paintable | null, hotX: number, hotY: number): void
```

Sets a paintable to use as icon during DND operations.

The hotspot coordinates determine the point on the icon
that gets aligned with the hotspot of the cursor.

If `paintable` is `null`, a default icon is used.

This function can be called before a drag is started, or in
a `Gtk.DragSource.prepare` or
`Gtk.DragSource.drag-begin` signal handler.

**Parameters**

- `paintable`: the `GdkPaintable` to use as icon
- `hotX`: the hotspot X coordinate on the icon
- `hotY`: the hotspot Y coordinate on the icon
