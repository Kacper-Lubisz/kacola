---
description: "A GTcpWrapperConnection can be used to wrap a Gio.IOStream that is based on a Gio.Socket, but which is not actually a Gio.SocketConnection."
---

# GTcpWrapperConnection

A `GTcpWrapperConnection` can be used to wrap a `Gio.IOStream` that is
based on a `Gio.Socket`, but which is not actually a
`Gio.SocketConnection`. This is used by `Gio.SocketClient` so
that it can always return a `Gio.SocketConnection`, even when the
connection it has actually created is not directly a
`Gio.SocketConnection`.

_Available since 2.28._

```tsx
import { GTcpWrapperConnection } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GIOStream](.gtkx/reference/gio/io-stream.md) → [GSocketConnection](.gtkx/reference/gio/socket-connection.md) → [GTcpConnection](.gtkx/reference/gio/tcp-connection.md) → **GTcpWrapperConnection**

## Props

`ref` receives the `Gio.TcpWrapperConnection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `baseIoStream`

`Gio.IOStream` · construct-only

The wrapped `Gio.IOStream`.

_Available since 2.28._

## Methods

Methods are called on the `Gio.TcpWrapperConnection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getBaseIoStream`

```ts
getBaseIoStream(): Gio.IOStream
```

Gets `conn`'s base `GIOStream`

**Returns** `conn`'s base `GIOStream`
