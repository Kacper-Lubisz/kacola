---
description: "Represents the target of an ongoing DND operation."
---

# GdkDrop

Represents the target of an ongoing DND operation.

Possible drop sites get informed about the status of the ongoing drag
operation with events of type `GDK_DRAG_ENTER`, `GDK_DRAG_LEAVE`,
`GDK_DRAG_MOTION` and `GDK_DROP_START`. The `GdkDrop` object can be obtained
from these `Gdk.Event` types using `Gdk.DNDEvent.getDrop()`.

The actual data transfer is initiated from the target side via an async
read, using one of the `GdkDrop` methods for this purpose:
`Gdk.Drop.readAsync()` or `Gdk.Drop.readValueAsync()`.

GTK provides a higher level abstraction based on top of these functions,
and so they are not normally needed in GTK applications. See the
"Drag and Drop" section of the GTK documentation for more information.

```tsx
import { GdkDrop } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDrop**

## Props

`ref` receives the `Gdk.Drop` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`Gdk.DragAction` · default `GDK_ACTION_COPY | GDK_ACTION_MOVE | GDK_ACTION_LINK` · construct-only

The possible actions for this drop

### `device`

`Gdk.Device` · construct-only

The `GdkDevice` performing the drop

### `display`

`Gdk.Display` · read-only, observe with `onNotifyDisplay`

The `GdkDisplay` that the drop belongs to.

### `drag`

`Gdk.Drag` · construct-only

The `GdkDrag` that initiated this drop

### `formats`

`Gdk.ContentFormats` · construct-only

The possible formats that the drop can provide its data in.

### `surface`

`Gdk.Surface` · construct-only

The `GdkSurface` the drop happens on

## Methods

Methods are called on the `Gdk.Drop` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `finish`

```ts
finish(action: Gdk.DragAction): void
```

Ends the drag operation after a drop.

The `action` must be a single action selected from the actions
available via `Gdk.Drop.getActions()`.

**Parameters**

- `action`: the action performed by the destination or `GDK_ACTION_NONE` if the drop failed

### `getActions`

```ts
getActions(): Gdk.DragAction
```

Returns the possible actions for this `GdkDrop`.

If this value contains multiple actions - i.e.
`Gdk.DragAction.isUnique()` returns false for the result -
`Gdk.Drop.finish()` must choose the action to use when
accepting the drop. This will only happen if you passed
`GDK_ACTION_ASK` as one of the possible actions in
`Gdk.Drop.status()`. `GDK_ACTION_ASK` itself will not
be included in the actions returned by this function.

This value may change over the lifetime of the `Gdk.Drop`
both as a response to source side actions as well as to calls to
`Gdk.Drop.status()` or `Gdk.Drop.finish()`. The source
side will not change this value anymore once a drop has started.

**Returns** The possible `GdkDragActions`

### `getDevice`

```ts
getDevice(): Gdk.Device
```

Returns the `GdkDevice` performing the drop.

**Returns** The `GdkDevice` performing the drop.

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the `GdkDisplay` that `self` was created for.

**Returns** a `GdkDisplay`

### `getDrag`

```ts
getDrag(): Gdk.Drag | null
```

If this is an in-app drag-and-drop operation, returns the `GdkDrag`
that corresponds to this drop.

If it is not, `NULL` is returned.

**Returns** the corresponding `GdkDrag`

### `getFormats`

```ts
getFormats(): Gdk.ContentFormats
```

Returns the `GdkContentFormats` that the drop offers the data
to be read in.

**Returns** The possible `GdkContentFormats`

### `getSurface`

```ts
getSurface(): Gdk.Surface
```

Returns the `GdkSurface` performing the drop.

**Returns** The `GdkSurface` performing the drop.

### `readAsync`

```ts
readAsync(mimeTypes: string[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<[Gio.InputStream | null, string]>
```

Asynchronously read the dropped data from a `GdkDrop`
in a format that complies with one of the mime types.

**Parameters**

- `mimeTypes`: pointer to an array of mime types
- `ioPriority`: the I/O priority for the read operation
- `cancellable`: optional `GCancellable` object

**Returns** Tuple of:

- `result`: the `GInputStream`
- `outMimeType`: return location for the used mime type

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readFinish`

```ts
readFinish(result: Gio.AsyncResult): [Gio.InputStream | null, string]
```

Finishes an async drop read operation.

Note that you must not use blocking read calls on the returned stream
in the GTK thread, since some platforms might require communication with
GTK to complete the data transfer. You can use async APIs such as
`g_input_stream_read_bytes_async()`.

See `Gdk.Drop.readAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: the `GInputStream`
- `outMimeType`: return location for the used mime type

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readValueAsync`

```ts
readValueAsync(type: bigint | AnyClass<TypedClass>, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<unknown>
```

Asynchronously request the drag operation's contents converted
to the given `type`.

For local drag-and-drop operations that are available in the given
`GType`, the value will be copied directly. Otherwise, GDK will
try to use `Gdk.contentDeserializeAsync()` to convert the data.

**Parameters**

- `type`: a `GType` to read
- `ioPriority`: the I/O priority of the request.
- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GValue` containing the result.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readValueFinish`

```ts
readValueFinish(result: Gio.AsyncResult): unknown
```

Finishes an async drop read.

See `Gdk.Drop.readValueAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a `GValue` containing the result.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `status`

```ts
status(actions: Gdk.DragAction, preferred: Gdk.DragAction): void
```

Selects all actions that are potentially supported by the destination.

When calling this function, do not restrict the passed in actions to
the ones provided by `Gdk.Drop.getActions()`. Those actions may
change in the future, even depending on the actions you provide here.

The `preferred` action is a hint to the drag-and-drop mechanism about which
action to use when multiple actions are possible.

This function should be called by drag destinations in response to
`GDK_DRAG_ENTER` or `GDK_DRAG_MOTION` events. If the destination does
not yet know the exact actions it supports, it should set any possible
actions first and then later call this function again.

**Parameters**

- `actions`: Supported actions of the destination, or `GDK_ACTION_NONE` to indicate that a drop will not be accepted
- `preferred`: A unique action that's a member of `actions` indicating the preferred action
