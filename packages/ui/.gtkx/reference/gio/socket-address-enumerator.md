---
description: "GSocketAddressEnumerator is an enumerator type for Gio.SocketAddress instances."
---

# GSocketAddressEnumerator

`GSocketAddressEnumerator` is an enumerator type for
`Gio.SocketAddress` instances. It is returned by enumeration functions
such as `Gio.SocketConnectable.enumerate()`, which returns a
`GSocketAddressEnumerator` to list each `Gio.SocketAddress` which could
be used to connect to that `Gio.SocketConnectable`.

Enumeration is typically a blocking operation, so the asynchronous methods
`Gio.SocketAddressEnumerator.nextAsync()` and
`Gio.SocketAddressEnumerator.nextFinish()` should be used where
possible.

Each `GSocketAddressEnumerator` can only be enumerated once. Once
`Gio.SocketAddressEnumerator.next()` has returned `NULL`, further
enumeration with that `GSocketAddressEnumerator` is not possible, and it can
be unreffed.

```tsx
import { GSocketAddressEnumerator } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocketAddressEnumerator**

## Props

`ref` receives the `Gio.SocketAddressEnumerator` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.SocketAddressEnumerator` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `next`

```ts
next(cancellable: Gio.Cancellable | null): Gio.SocketAddress | null
```

Retrieves the next `GSocketAddress` from `enumerator`. Note that this
may block for some amount of time. (Eg, a `GNetworkAddress` may need
to do a DNS lookup before it can return an address.) Use
`g_socket_address_enumerator_next_async()` if you need to avoid
blocking.

If `enumerator` is expected to yield addresses, but for some reason
is unable to (eg, because of a DNS error), then the first call to
`g_socket_address_enumerator_next()` will return an appropriate error
in `*error`. However, if the first call to
`g_socket_address_enumerator_next()` succeeds, then any further
internal errors (other than `cancellable` being triggered) will be
ignored.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GSocketAddress` (owned by the caller), or `null` on
    error (in which case `*error` will be set) or if there are no
    more addresses.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `nextAsync`

```ts
nextAsync(cancellable?: Gio.Cancellable | null): Promise<Gio.SocketAddress | null>
```

Asynchronously retrieves the next `GSocketAddress` from `enumerator`
and then calls `callback`, which must call
`g_socket_address_enumerator_next_finish()` to get the result.

It is an error to call this multiple times before the previous callback has finished.

**Parameters**

- `cancellable`: optional `GCancellable` object, `null` to ignore.

**Returns** a `GSocketAddress` (owned by the caller), or `null` on
    error (in which case `*error` will be set) or if there are no
    more addresses.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `nextFinish`

```ts
nextFinish(result: Gio.AsyncResult): Gio.SocketAddress | null
```

Retrieves the result of a completed call to
`g_socket_address_enumerator_next_async()`. See
`g_socket_address_enumerator_next()` for more information about
error handling.

**Parameters**

- `result`: a `GAsyncResult`

**Returns** a `GSocketAddress` (owned by the caller), or `null` on
    error (in which case `*error` will be set) or if there are no
    more addresses.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.
