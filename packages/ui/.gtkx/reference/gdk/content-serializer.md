---
description: "Serializes content for inter-application data transfers."
---

# GdkContentSerializer

Serializes content for inter-application data transfers.

The `GdkContentSerializer` transforms an object that is identified
by a GType into a serialized form (i.e. a byte stream) that is
identified by a mime type.

GTK provides serializers and deserializers for common data types
such as text, colors, images or file lists. To register your own
serialization functions, use `Gdk.contentRegisterSerializer()`.

Also see `Gdk.ContentDeserializer`.

```tsx
import { GdkContentSerializer } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkContentSerializer**

Implements `GAsyncResult`.

## Props

`ref` receives the `Gdk.ContentSerializer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gdk.ContentSerializer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getCancellable`

```ts
getCancellable(): Gio.Cancellable | null
```

Gets the cancellable for the current operation.

This is the `GCancellable` that was passed to `contentSerializeAsync()`.

**Returns** the cancellable for the current operation

### `getGtype`

```ts
getGtype(): bigint
```

Gets the `GType` to of the object to serialize.

**Returns** the `GType` for the current operation

### `getMimeType`

```ts
getMimeType(): string
```

Gets the mime type to serialize to.

**Returns** the mime type for the current operation

### `getOutputStream`

```ts
getOutputStream(): Gio.OutputStream
```

Gets the output stream for the current operation.

This is the stream that was passed to `contentSerializeAsync()`.

**Returns** the output stream for the current operation

### `getPriority`

```ts
getPriority(): number
```

Gets the I/O priority for the current operation.

This is the priority that was passed to `contentSerializeAsync()`.

**Returns** the I/O priority for the current operation

### `getTaskData`

```ts
getTaskData(): bigint | null
```

Gets the data that was associated with the current operation.

See `Gdk.ContentSerializer.setTaskData()`.

**Returns** the task data for `serializer`

### `getUserData`

```ts
getUserData(): bigint | null
```

Gets the user data that was passed when the serializer was registered.

**Returns** the user data for this serializer

### `getValue`

```ts
getValue(): unknown
```

Gets the `GValue` to read the object to serialize from.

**Returns** the `GValue` for the current operation

### `returnError`

```ts
returnError(error: GLib.Error): void
```

Indicate that the serialization has ended with an error.

This function consumes `error`.

**Parameters**

- `error`: a `GError`

### `returnSuccess`

```ts
returnSuccess(): void
```

Indicate that the serialization has been successfully completed.

### `setTaskData`

```ts
setTaskData(data: bigint | null, notify: GLib.DestroyNotify): void
```

Associate data with the current serialization operation.

**Parameters**

- `data`: data to associate with this operation
- `notify`: destroy notify for `data`
