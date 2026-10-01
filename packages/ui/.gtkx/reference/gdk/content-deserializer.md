---
description: "Deserializes content received via inter-application data transfers."
---

# GdkContentDeserializer

Deserializes content received via inter-application data transfers.

The `GdkContentDeserializer` transforms serialized content that is
identified by a mime type into an object identified by a GType.

GTK provides serializers and deserializers for common data types
such as text, colors, images or file lists. To register your own
deserialization functions, use `contentRegisterDeserializer()`.

Also see `Gdk.ContentSerializer`.

```tsx
import { GdkContentDeserializer } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkContentDeserializer**

Implements `GAsyncResult`.

## Props

`ref` receives the `Gdk.ContentDeserializer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gdk.ContentDeserializer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getCancellable`

```ts
getCancellable(): Gio.Cancellable | null
```

Gets the cancellable for the current operation.

This is the `GCancellable` that was passed to `Gdk.contentDeserializeAsync()`.

**Returns** the cancellable for the current operation

### `getGtype`

```ts
getGtype(): bigint
```

Gets the `GType` to create an instance of.

**Returns** the `GType` for the current operation

### `getInputStream`

```ts
getInputStream(): Gio.InputStream
```

Gets the input stream for the current operation.

This is the stream that was passed to `Gdk.contentDeserializeAsync()`.

**Returns** the input stream for the current operation

### `getMimeType`

```ts
getMimeType(): string
```

Gets the mime type to deserialize from.

**Returns** the mime type for the current operation

### `getPriority`

```ts
getPriority(): number
```

Gets the I/O priority for the current operation.

This is the priority that was passed to `Gdk.contentDeserializeAsync()`.

**Returns** the I/O priority for the current operation

### `getTaskData`

```ts
getTaskData(): bigint | null
```

Gets the data that was associated with the current operation.

See `Gdk.ContentDeserializer.setTaskData()`.

**Returns** the task data for `deserializer`

### `getUserData`

```ts
getUserData(): bigint | null
```

Gets the user data that was passed when the deserializer was registered.

**Returns** the user data for this deserializer

### `getValue`

```ts
getValue(): unknown
```

Gets the `GValue` to store the deserialized object in.

**Returns** the `GValue` for the current operation

### `returnError`

```ts
returnError(error: GLib.Error): void
```

Indicate that the deserialization has ended with an error.

This function consumes `error`.

**Parameters**

- `error`: a `GError`

### `returnSuccess`

```ts
returnSuccess(): void
```

Indicate that the deserialization has been successfully completed.

### `setTaskData`

```ts
setTaskData(data: bigint | null, notify: GLib.DestroyNotify): void
```

Associate data with the current deserialization operation.

**Parameters**

- `data`: data to associate with this operation
- `notify`: destroy notify for `data`
