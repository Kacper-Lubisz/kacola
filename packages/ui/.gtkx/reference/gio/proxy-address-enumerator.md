---
description: "GProxyAddressEnumerator is a wrapper around Gio.SocketAddressEnumerator which takes the Gio.SocketAddress instances returned by the Gio.SocketAddressEnumerator and wraps them in Gio.ProxyAddress instances, using the g..."
---

# GProxyAddressEnumerator

`GProxyAddressEnumerator` is a wrapper around
`Gio.SocketAddressEnumerator` which takes the `Gio.SocketAddress`
instances returned by the `Gio.SocketAddressEnumerator`
and wraps them in `Gio.ProxyAddress` instances, using the given
`Gio.ProxyAddressEnumerator.proxyResolver`.

This enumerator will be returned (for example, by
`Gio.SocketConnectable.enumerate()`) as appropriate when a proxy is
configured; there should be no need to manually wrap a
`Gio.SocketAddressEnumerator` instance with one.

```tsx
import { GProxyAddressEnumerator } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketAddressEnumerator](.gtkx/reference/gio/socket-address-enumerator.md) → **GProxyAddressEnumerator**

## Props

`ref` receives the `Gio.ProxyAddressEnumerator` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `connectable`

`Gio.SocketConnectable` · construct-only

The connectable being enumerated.

### `defaultPort`

`number` · default `0` · construct-only

The default port to use if `GProxyAddressEnumerator.uri` does not
specify one.

_Available since 2.38._

### `proxyResolver`

`Gio.ProxyResolver | ReactElement`

The proxy resolver to use.

_Available since 2.36._

### `uri`

`string` · default `null` · construct-only

The destination URI. Use `none://` for a generic socket.
