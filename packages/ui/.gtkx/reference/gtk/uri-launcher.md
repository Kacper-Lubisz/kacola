---
description: "Asynchronous API to open a uri with an application."
---

# GtkUriLauncher

Asynchronous API to open a uri with an application.

`GtkUriLauncher` collects the arguments that are needed to open the uri.

Depending on system configuration, user preferences and available APIs, this
may or may not show an app chooser dialog or launch the default application
right away.

The operation is started with the `Gtk.UriLauncher.launch()` function.

To launch a file, use `Gtk.FileLauncher`.

_Available since 4.10._

```tsx
import { GtkUriLauncher } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkUriLauncher**

## Props

`ref` receives the `Gtk.UriLauncher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `uri`

`string` · default `null`

The uri to launch.

_Available since 4.10._

## Methods

Methods are called on the `Gtk.UriLauncher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `canLaunch`

```ts
canLaunch(parent: Gtk.Window | null): boolean
```

Returns whether the launcher is likely to succeed
in launching an application for its uri.

This can be used to disable controls that trigger
the launcher when they are known not to work.

**Parameters**

- `parent`: the parent window

**Returns** false if the launcher is known not to support
  the uri, true otherwise

_Available since 4.20._

### `getUri`

```ts
getUri(): string | null
```

Gets the uri that will be opened.

**Returns** the uri

_Available since 4.10._

### `launch`

```ts
launch(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Launches an application to open the uri.

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

Finishes the `Gtk.UriLauncher.launch()` call and
returns the result.

**Parameters**

- `result`: the result

**Returns** true if an application was launched

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.10._

### `setUri`

```ts
setUri(uri: string | null): void
```

Sets the uri that will be opened.

**Parameters**

- `uri`: the uri

_Available since 4.10._
