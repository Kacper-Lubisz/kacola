---
description: "An event controller to receive Drag-and-Drop operations, asynchronously."
---

# GtkDropTargetAsync

An event controller to receive Drag-and-Drop operations, asynchronously.

It is the more complete but also more complex method of handling drop
operations compared to `Gtk.DropTarget`, and you should only use
it if `GtkDropTarget` doesn't provide all the features you need.

To use a `GtkDropTargetAsync` to receive drops on a widget, you create
a `GtkDropTargetAsync` object, configure which data formats and actions
you support, connect to its signals, and then attach it to the widget
with `Gtk.Widget.addController()`.

During a drag operation, the first signal that a `GtkDropTargetAsync`
emits is `Gtk.DropTargetAsync.accept`, which is meant to determine
whether the target is a possible drop site for the ongoing drop. The
default handler for the ::accept signal accepts the drop if it finds
a compatible data format and an action that is supported on both sides.

If it is, and the widget becomes a target, you will receive a
`Gtk.DropTargetAsync.drag-enter` signal, followed by
`Gtk.DropTargetAsync.drag-motion` signals as the pointer moves,
optionally a `Gtk.DropTargetAsync.drop` signal when a drop happens,
and finally a `Gtk.DropTargetAsync.drag-leave` signal when the
pointer moves off the widget.

The ::drag-enter and ::drag-motion handler return a `GdkDragAction`
to update the status of the ongoing operation. The ::drop handler
should decide if it ultimately accepts the drop and if it does, it
should initiate the data transfer and finish the operation by calling
`Gdk.Drop.finish()`.

Between the ::drag-enter and ::drag-leave signals the widget is a
current drop target, and will receive the `GTK_STATE_FLAG_DROP_ACTIVE`
state, which can be used by themes to style the widget as a drop target.

```tsx
import { GtkDropTargetAsync } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkDropTargetAsync**

## Props

`ref` receives the `Gtk.DropTargetAsync` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`Gdk.DragAction` · default `GDK_ACTION_NONE`

The `GdkDragActions` that this drop target supports.

### `formats`

`Gdk.ContentFormats`

The `GdkContentFormats` that determines the supported data formats.

## Signals

### `onAccept`

```ts
(drop: Gdk.Drop, self: Gtk.DropTargetAsync) => boolean | undefined
```

Emitted on the drop site when a drop operation is about to begin.

If the drop is not accepted, `false` will be returned and the drop target
will ignore the drop. If `true` is returned, the drop is accepted for now
but may be rejected later via a call to `Gtk.DropTargetAsync.rejectDrop()`
or ultimately by returning `false` from a `Gtk.DropTargetAsync.drop`
handler.

The default handler for this signal decides whether to accept the drop
based on the formats provided by the `drop`.

If the decision whether the drop will be accepted or rejected needs
further processing, such as inspecting the data, this function should
return `true` and proceed as is `drop` was accepted and if it decides to
reject the drop later, it should call `Gtk.DropTargetAsync.rejectDrop()`.

**Parameters**

- `drop`: the `GdkDrop`
- `self`: The instance the signal was emitted on.

**Returns** `true` if `drop` is accepted

### `onDragEnter`

```ts
(drop: Gdk.Drop, x: number, y: number, self: Gtk.DropTargetAsync) => Gdk.DragAction | undefined
```

Emitted on the drop site when the pointer enters the widget.

It can be used to set up custom highlighting.

**Parameters**

- `drop`: the `GdkDrop`
- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** Preferred action for this drag operation.

### `onDragLeave`

```ts
(drop: Gdk.Drop, self: Gtk.DropTargetAsync) => void
```

Emitted on the drop site when the pointer leaves the widget.

Its main purpose it to undo things done in
`GtkDropTargetAsync`::drag-enter.

**Parameters**

- `drop`: the `GdkDrop`
- `self`: The instance the signal was emitted on.

### `onDragMotion`

```ts
(drop: Gdk.Drop, x: number, y: number, self: Gtk.DropTargetAsync) => Gdk.DragAction | undefined
```

Emitted while the pointer is moving over the drop target.

**Parameters**

- `drop`: the `GdkDrop`
- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** Preferred action for this drag operation.

### `onDrop`

```ts
(drop: Gdk.Drop, x: number, y: number, self: Gtk.DropTargetAsync) => boolean | undefined
```

Emitted on the drop site when the user drops the data onto the widget.

The signal handler must determine whether the pointer position is in a
drop zone or not. If it is not in a drop zone, it returns `false` and no
further processing is necessary.

Otherwise, the handler returns `true`. In this case, this handler will
accept the drop. The handler must ensure that `Gdk.Drop.finish()`
is called to let the source know that the drop is done. The call to
`Gdk.Drop.finish()` must only be done when all data has been received.

To receive the data, use one of the read functions provided by
`Gdk.Drop` such as `Gdk.Drop.readAsync()` or
`Gdk.Drop.readValueAsync()`.

**Parameters**

- `drop`: the `GdkDrop`
- `x`: the x coordinate of the current pointer position
- `y`: the y coordinate of the current pointer position
- `self`: The instance the signal was emitted on.

**Returns** whether the drop is accepted at the given pointer position

## Methods

Methods are called on the `Gtk.DropTargetAsync` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActions`

```ts
getActions(): Gdk.DragAction
```

Gets the actions that this drop target supports.

**Returns** the actions that this drop target supports

### `getFormats`

```ts
getFormats(): Gdk.ContentFormats | null
```

Gets the data formats that this drop target accepts.

If the result is `null`, all formats are expected to be supported.

**Returns** the supported data formats

### `rejectDrop`

```ts
rejectDrop(drop: Gdk.Drop): void
```

Sets the `drop` as not accepted on this drag site.

This function should be used when delaying the decision
on whether to accept a drag or not until after reading
the data.

**Parameters**

- `drop`: the `GdkDrop` of an ongoing drag operation

### `setActions`

```ts
setActions(actions: Gdk.DragAction): void
```

Sets the actions that this drop target supports.

**Parameters**

- `actions`: the supported actions

### `setFormats`

```ts
setFormats(formats: Gdk.ContentFormats | null): void
```

Sets the data formats that this drop target will accept.

**Parameters**

- `formats`: the supported data formats or `null` for any format
