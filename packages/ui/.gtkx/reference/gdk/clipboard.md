---
description: "Represents data shared between applications or inside an application."
---

# GdkClipboard

Represents data shared between applications or inside an application.

To get a `GdkClipboard` object, use `Gdk.Display.getClipboard()` or
`Gdk.Display.getPrimaryClipboard()`. You can find out about the data
that is currently available in a clipboard using
`Gdk.Clipboard.getFormats()`.

To make text or image data available in a clipboard, use
`Gdk.Clipboard.setText()` or `Gdk.Clipboard.setTexture()`.
For other data, you can use `Gdk.Clipboard.setContent()`, which
takes a `Gdk.ContentProvider` object.

To read textual or image data from a clipboard, use
`Gdk.Clipboard.readTextAsync()` or
`Gdk.Clipboard.readTextureAsync()`. For other data, use
`Gdk.Clipboard.readAsync()`, which provides a `GInputStream` object.

```tsx
import { GdkClipboard } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkClipboard**

## Props

`ref` receives the `Gdk.Clipboard` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `content`

`Gdk.ContentProvider` · read-only, observe with `onNotifyContent`

The `GdkContentProvider` or `null` if the clipboard is empty or contents are
provided otherwise.

### `display`

`Gdk.Display` · construct-only

The `GdkDisplay` that the clipboard belongs to.

### `formats`

`Gdk.ContentFormats` · read-only, observe with `onNotifyFormats`

The possible formats that the clipboard can provide its data in.

### `local`

`boolean` · default `true` · read-only, observe with `onNotifyLocal`

`true` if the contents of the clipboard are owned by this process.

## Signals

### `onChanged`

```ts
(self: Gdk.Clipboard) => void
```

Emitted when the clipboard changes ownership.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Clipboard` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getContent`

```ts
getContent(): Gdk.ContentProvider | null
```

Returns the `GdkContentProvider` currently set on `clipboard`.

If the `clipboard` is empty or its contents are not owned by the
current process, `null` will be returned.

**Returns** The content of a clipboard
  if the clipboard does not maintain any content

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Gets the `GdkDisplay` that the clipboard was created for.

**Returns** a `GdkDisplay`

### `getFormats`

```ts
getFormats(): Gdk.ContentFormats
```

Gets the formats that the clipboard can provide its current contents in.

**Returns** The formats of the clipboard

### `isLocal`

```ts
isLocal(): boolean
```

Returns if the clipboard is local.

A clipboard is considered local if it was last claimed
by the running application.

Note that `Gdk.Clipboard.getContent()` may return `null`
even on a local clipboard. In this case the clipboard is empty.

**Returns** `true` if the clipboard is local

### `readAsync`

```ts
readAsync(mimeTypes: string[], ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<[Gio.InputStream | null, string]>
```

Asynchronously requests an input stream to read the `clipboard`'s
contents from.

The clipboard will choose the most suitable mime type from the given list
to fulfill the request, preferring the ones listed first.

**Parameters**

- `mimeTypes`: a `null`-terminated array of mime types to choose from
- `ioPriority`: the I/O priority of the request
- `cancellable`: optional `GCancellable` object

**Returns** Tuple of:

- `result`: a `GInputStream`
- `outMimeType`: location to store the chosen mime type

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readFinish`

```ts
readFinish(result: Gio.AsyncResult): [Gio.InputStream | null, string]
```

Finishes an asynchronous clipboard read.

See `Gdk.Clipboard.readAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** Tuple of:

- `result`: a `GInputStream`
- `outMimeType`: location to store the chosen mime type

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readTextAsync`

```ts
readTextAsync(cancellable?: Gio.Cancellable | null): Promise<string | null>
```

Asynchronously request the `clipboard` contents converted to a string.

This is a simple wrapper around `Gdk.Clipboard.readValueAsync()`.
Use that function or `Gdk.Clipboard.readAsync()` directly if you
need more control over the operation.

**Parameters**

- `cancellable`: optional `GCancellable` object

**Returns** a new string

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readTextFinish`

```ts
readTextFinish(result: Gio.AsyncResult): string | null
```

Finishes an asynchronous clipboard read.

See `Gdk.Clipboard.readTextAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a new string

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readTextureAsync`

```ts
readTextureAsync(cancellable?: Gio.Cancellable | null): Promise<Gdk.Texture | null>
```

Asynchronously request the `clipboard` contents converted to a `GdkPixbuf`.

This is a simple wrapper around `Gdk.Clipboard.readValueAsync()`.
Use that function or `Gdk.Clipboard.readAsync()` directly if you
need more control over the operation.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a new `GdkTexture`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readTextureFinish`

```ts
readTextureFinish(result: Gio.AsyncResult): Gdk.Texture | null
```

Finishes an asynchronous clipboard read.

See `Gdk.Clipboard.readTextureAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a new `GdkTexture`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readValueAsync`

```ts
readValueAsync(type: bigint | AnyClass<TypedClass>, ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<unknown>
```

Asynchronously request the `clipboard` contents converted to the given
`type`.

For local clipboard contents that are available in the given `GType`,
the value will be copied directly. Otherwise, GDK will try to use
`contentDeserializeAsync()` to convert the clipboard's data.

**Parameters**

- `type`: a `GType` to read
- `ioPriority`: the I/O priority of the request
- `cancellable`: optional `GCancellable` object

**Returns** a `GValue` containing the result.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `readValueFinish`

```ts
readValueFinish(result: Gio.AsyncResult): unknown
```

Finishes an asynchronous clipboard read.

See `Gdk.Clipboard.readValueAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a `GValue` containing the result.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `set`

```ts
set(value: GObject.Value | JsValue): void
```

Sets the `clipboard` to contain the given `value`.

**Parameters**

- `value`: a `GValue` to set

### `setContent`

```ts
setContent(provider: Gdk.ContentProvider | null): boolean
```

Sets a new content provider on `clipboard`.

The clipboard will claim the `GdkDisplay`'s resources and advertise
these new contents to other applications.

In the rare case of a failure, this function will return `false`. The
clipboard will then continue reporting its old contents and ignore
`provider`.

If the contents are read by either an external application or the
`clipboard`'s read functions, `clipboard` will select the best format to
transfer the contents and then request that format from `provider`.

**Parameters**

- `provider`: the new contents of `clipboard` or `null` to clear the clipboard

**Returns** `true` if setting the clipboard succeeded

### `storeAsync`

```ts
storeAsync(ioPriority: number, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously instructs the `clipboard` to store its contents remotely.

If the clipboard is not local, this function does nothing but report success.

The purpose of this call is to preserve clipboard contents beyond the
lifetime of an application, so this function is typically called on
exit. Depending on the platform, the functionality may not be available
unless a "clipboard manager" is running.

This function is called automatically when a
[GtkApplication](../gtk4/class.Application.html)
is shut down, so you likely don't need to call it.

**Parameters**

- `ioPriority`: the I/O priority of the request
- `cancellable`: optional `GCancellable` object

**Returns** `true` if storing was successful.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `storeFinish`

```ts
storeFinish(result: Gio.AsyncResult): boolean
```

Finishes an asynchronous clipboard store.

See `Gdk.Clipboard.storeAsync()`.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** `true` if storing was successful.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
