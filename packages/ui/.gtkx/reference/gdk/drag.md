---
description: "Represents the source of an ongoing DND operation."
---

# GdkDrag

Represents the source of an ongoing DND operation.

A `GdkDrag` is created when a drag is started, and stays alive for duration of
the DND operation. After a drag has been started with `Gdk.Drag.begin()`,
the caller gets informed about the status of the ongoing drag operation
with signals on the `GdkDrag` object.

GTK provides a higher level abstraction based on top of these functions,
and so they are not normally needed in GTK applications. See the
"Drag and Drop" section of the GTK documentation for more information.

```tsx
import { GdkDrag } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDrag**

## Props

`ref` receives the `Gdk.Drag` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`Gdk.DragAction` · default `GDK_ACTION_NONE`

The possible actions of this drag.

### `content`

`Gdk.ContentProvider` · construct-only

The `GdkContentProvider`.

### `device`

`Gdk.Device` · construct-only

The `GdkDevice` that is performing the drag.

### `display`

`Gdk.Display` · read-only, observe with `onNotifyDisplay`

The `GdkDisplay` that the drag belongs to.

### `formats`

`Gdk.ContentFormats` · construct-only

The possible formats that the drag can provide its data in.

### `selectedAction`

`Gdk.DragAction` · default `GDK_ACTION_NONE`

The currently selected action of the drag.

### `surface`

`Gdk.Surface` · construct-only

The surface where the drag originates.

## Signals

### `onCancel`

```ts
(reason: Gdk.DragCancelReason, self: Gdk.Drag) => void
```

Emitted when the drag operation is cancelled.

**Parameters**

- `reason`: The reason the drag was cancelled
- `self`: The instance the signal was emitted on.

### `onDndFinished`

```ts
(self: Gdk.Drag) => void
```

Emitted when the destination side has finished reading all data.

The drag object can now free all miscellaneous data.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDropPerformed`

```ts
(self: Gdk.Drag) => void
```

Emitted when the drop operation is performed on an accepting client.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Drag` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `dropDone`

```ts
dropDone(success: boolean): void
```

Informs GDK that the drop ended.

Passing `false` for `success` may trigger a drag cancellation
animation.

This function is called by the drag source, and should be the
last call before dropping the reference to the `drag`.

The `GdkDrag` will only take the first `Gdk.Drag.dropDone()`
call as effective, if this function is called multiple times,
all subsequent calls will be ignored.

**Parameters**

- `success`: whether the drag was ultimatively successful

### `getActions`

```ts
getActions(): Gdk.DragAction
```

Determines the bitmask of possible actions proposed by the source.

**Returns** the `GdkDragAction` flags

### `getContent`

```ts
getContent(): Gdk.ContentProvider
```

Returns the `GdkContentProvider` associated to the `GdkDrag` object.

**Returns** The `GdkContentProvider` associated to `drag`.

### `getDevice`

```ts
getDevice(): Gdk.Device
```

Returns the `GdkDevice` associated to the `GdkDrag` object.

**Returns** The `GdkDevice` associated to `drag`.

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the `GdkDisplay` that the drag object was created for.

**Returns** a `GdkDisplay`

### `getDragSurface`

```ts
getDragSurface(): Gdk.Surface | null
```

Returns the surface on which the drag icon should be rendered
during the drag operation.

Note that the surface may not be available until the drag operation
has begun. GDK will move the surface in accordance with the ongoing
drag operation. The surface is owned by `drag` and will be destroyed
when the drag operation is over.

**Returns** the drag surface

### `getFormats`

```ts
getFormats(): Gdk.ContentFormats
```

Retrieves the formats supported by this `GdkDrag` object.

**Returns** a `GdkContentFormats`

### `getSelectedAction`

```ts
getSelectedAction(): Gdk.DragAction
```

Determines the action chosen by the drag destination.

**Returns** a `GdkDragAction` value

### `getSurface`

```ts
getSurface(): Gdk.Surface
```

Returns the `GdkSurface` where the drag originates.

**Returns** The `GdkSurface` where the drag originates

### `setHotspot`

```ts
setHotspot(hotX: number, hotY: number): void
```

Sets the position of the drag surface that will be kept
under the cursor hotspot.

Initially, the hotspot is at the top left corner of the drag surface.

**Parameters**

- `hotX`: x coordinate of the drag surface hotspot
- `hotY`: y coordinate of the drag surface hotspot
