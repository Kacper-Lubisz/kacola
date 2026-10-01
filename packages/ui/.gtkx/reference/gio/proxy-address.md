---
description: "A Gio.InetSocketAddress representing a connection via a proxy server."
---

# GProxyAddress

A `Gio.InetSocketAddress` representing a connection via a proxy server.

_Available since 2.26._

```tsx
import { GProxyAddress } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketAddress](.gtkx/reference/gio/socket-address.md) → [GInetSocketAddress](.gtkx/reference/gio/inet-socket-address.md) → **GProxyAddress**

Implements `GSocketConnectable`.

## Props

`ref` receives the `Gio.ProxyAddress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `destinationHostname`

`string` · default `null` · construct-only

The proxy destination hostname.

_Available since 2.26._

### `destinationPort`

`number` · default `0` · construct-only

The proxy destination port.

_Available since 2.26._

### `destinationProtocol`

`string` · default `null` · construct-only

The protocol being spoke to the destination host, or `null` if
the `GProxyAddress` doesn't know.

_Available since 2.34._

### `password`

`string` · default `null` · construct-only

The proxy password.

_Available since 2.26._

### `protocol`

`string` · default `null` · construct-only

The proxy protocol.

_Available since 2.26._

### `uri`

`string` · default `null` · construct-only

The URI string that the proxy was constructed from (or `null`
if the creator didn't specify this).

_Available since 2.34._

### `username`

`string` · default `null` · construct-only

The proxy username.

_Available since 2.26._

## Methods

Methods are called on the `Gio.ProxyAddress` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDestinationHostname`

```ts
getDestinationHostname(): string
```

Gets `proxy`'s destination hostname; that is, the name of the host
that will be connected to via the proxy, not the name of the proxy
itself.

**Returns** the `proxy`'s destination hostname

_Available since 2.26._

### `getDestinationPort`

```ts
getDestinationPort(): number
```

Gets `proxy`'s destination port; that is, the port on the
destination host that will be connected to via the proxy, not the
port number of the proxy itself.

**Returns** the `proxy`'s destination port

_Available since 2.26._

### `getDestinationProtocol`

```ts
getDestinationProtocol(): string
```

Gets the protocol that is being spoken to the destination
server; eg, "http" or "ftp".

**Returns** the `proxy`'s destination protocol

_Available since 2.34._

### `getPassword`

```ts
getPassword(): string | null
```

Gets `proxy`'s password.

**Returns** the `proxy`'s password

_Available since 2.26._

### `getProtocol`

```ts
getProtocol(): string
```

Gets `proxy`'s protocol. eg, "socks" or "http"

**Returns** the `proxy`'s protocol

_Available since 2.26._

### `getUri`

```ts
getUri(): string | null
```

Gets the proxy URI that `proxy` was constructed from.

**Returns** the `proxy`'s URI, or `null` if unknown

_Available since 2.34._

### `getUsername`

```ts
getUsername(): string | null
```

Gets `proxy`'s username.

**Returns** the `proxy`'s username

_Available since 2.26._
