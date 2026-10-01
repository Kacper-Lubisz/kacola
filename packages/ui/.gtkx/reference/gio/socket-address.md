---
description: "GSocketAddress is the equivalent of struct sockaddr) and its subtypes in the BSD sockets API."
---

# GSocketAddress

`GSocketAddress` is the equivalent of
[`struct sockaddr`](man:sockaddr(3type)) and its subtypes in the BSD sockets
API. This is an abstract class; use `Gio.InetSocketAddress` for
internet sockets, or `Gio.UnixSocketAddress` for UNIX domain sockets.

```tsx
import { GSocketAddress } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocketAddress**

Implements `GSocketConnectable`.

## Props

`ref` receives the `Gio.SocketAddress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `family`

`Gio.SocketFamily` · default `G_SOCKET_FAMILY_INVALID` · read-only, observe with `onNotifyFamily`

The family of the socket address.

_Available since 2.22._

## Methods

Methods are called on the `Gio.SocketAddress` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getFamily`

```ts
getFamily(): Gio.SocketFamily
```

Gets the socket family type of `address`.

**Returns** the socket family type of `address`

_Available since 2.22._

### `getNativeSize`

```ts
getNativeSize(): number
```

Gets the size of `address`'s native struct sockaddr.
You can use this to allocate memory to pass to
`g_socket_address_to_native()`.

**Returns** the size of the native struct sockaddr that
    `address` represents, or `-1` if `address`
    is not valid

_Available since 2.22._

### `toNative`

```ts
toNative(dest: bigint | null, destlen: number): boolean
```

Converts a `GSocketAddress` to a native struct sockaddr, which can
be passed to low-level functions like `connect()` or `bind()`.

If not enough space is available, a `G_IO_ERROR_NO_SPACE` error
is returned. If the address type is not known on the system
then a `G_IO_ERROR_NOT_SUPPORTED` error is returned.

**Parameters**

- `dest`: a pointer to a memory location that will contain the native struct sockaddr
- `destlen`: the size of `dest`. Must be at least as large as `g_socket_address_get_native_size()`

**Returns** `true` if `dest` was filled in, `false` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._
