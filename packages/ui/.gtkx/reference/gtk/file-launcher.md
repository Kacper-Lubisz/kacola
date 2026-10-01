---
description: "Asynchronous API to open a file with an application."
---

# GtkFileLauncher

Asynchronous API to open a file with an application.

`GtkFileLauncher` collects the arguments that are needed to open the file.

Depending on system configuration, user preferences and available APIs, this
may or may not show an app chooser dialog or launch the default application
right away.

The operation is started with the `Gtk.FileLauncher.launch()` function.

To launch uris that don't represent files, use `Gtk.UriLauncher`.

_Available since 4.10._

```tsx
import { GtkFileLauncher } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkFileLauncher**

## Props

`ref` receives the `Gtk.FileLauncher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `alwaysAsk`

`boolean` · default `false`

Whether to ask the user to choose an app for opening the file. If `FALSE`,
the file might be opened with a default app or the previous choice.

_Available since 4.12._

### `file`

`Gio.File | ReactElement`

The file to launch.

_Available since 4.10._

### `writable`

`boolean` · default `false`

Whether to make the file writable for the handler.

_Available since 4.14._

## Methods

Methods are called on the `Gtk.FileLauncher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getAlwaysAsk`

```ts
getAlwaysAsk(): boolean
```

Returns whether to ask the user which app to use.

**Returns** true if always asking the user

_Available since 4.12._

### `getFile`

```ts
getFile(): Gio.File | null
```

Gets the file that will be opened.

**Returns** the file

_Available since 4.10._

### `getWritable`

```ts
getWritable(): boolean
```

Returns whether to make the file writable for the handler.

**Returns** true if the file will be made writable

_Available since 4.14._

### `launch`

```ts
launch(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Launches an application to open the file.

This may present an app chooser dialog to the user.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** true if an application was launched

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `launchFinish`

```ts
launchFinish(result: Gio.AsyncResult): boolean
```

Finishes the `Gtk.FileLauncher.launch()` call and
returns the result.

**Parameters**

- `result`: the result

**Returns** true if an application was launched

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openContainingFolder`

```ts
openContainingFolder(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Launches a file manager to show the file in its parent directory.

This is only supported for native files. It will fail if `file`
is e.g. a http:// uri.

**Parameters**

- `parent`: the parent window
- `cancellable`: a cancellable to cancel the operation

**Returns** true if an application was launched

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `openContainingFolderFinish`

```ts
openContainingFolderFinish(result: Gio.AsyncResult): boolean
```

Finishes the `Gtk.FileLauncher.openContainingFolder()`
call and returns the result.

**Parameters**

- `result`: the result

**Returns** true if an application was launched

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `setAlwaysAsk`

```ts
setAlwaysAsk(alwaysAsk: boolean): void
```

Sets whether to always ask the user which app to use.

If false, the file might be opened with a default app
or the previous choice.

**Parameters**

- `alwaysAsk`: whether to always ask

_Available since 4.12._

### `setFile`

```ts
setFile(file: Gio.File | null): void
```

Sets the file that will be opened.

**Parameters**

- `file`: the file

_Available since 4.10._

### `setWritable`

```ts
setWritable(writable: boolean): void
```

Sets whether to make the file writable for the handler.

**Parameters**

- `writable`: whether to make the file writable

_Available since 4.14._
