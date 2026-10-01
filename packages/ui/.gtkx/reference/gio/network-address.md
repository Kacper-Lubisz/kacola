---
description: "GNetworkAddress provides an easy way to resolve a hostname and then attempt to connect to that host, handling the possibility of multiple IP addresses and multiple address families."
---

# GNetworkAddress

`GNetworkAddress` provides an easy way to resolve a hostname and
then attempt to connect to that host, handling the possibility of
multiple IP addresses and multiple address families.

The enumeration results of resolved addresses *may* be cached as long
as this object is kept alive which may have unexpected results if
alive for too long.

See `Gio.SocketConnectable` for an example of using the connectable
interface.

```tsx
import { GNetworkAddress } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GNetworkAddress**

Implements `GSocketConnectable`.

## Props

`ref` receives the `Gio.NetworkAddress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `hostname`

`string` · default `null` · construct-only

Hostname to resolve.

_Available since 2.22._

### `port`

`number` · default `0` · construct-only

Network port.

_Available since 2.22._

### `scheme`

`string` · default `null` · construct-only

URI scheme.

_Available since 2.22._

## Methods

Methods are called on the `Gio.NetworkAddress` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getHostname`

```ts
getHostname(): string
```

Gets `addr`'s hostname. This might be either UTF-8 or ASCII-encoded,
depending on what `addr` was created with.

**Returns** `addr`'s hostname

_Available since 2.22._

### `getPort`

```ts
getPort(): number
```

Gets `addr`'s port number

**Returns** `addr`'s port (which may be 0)

_Available since 2.22._

### `getScheme`

```ts
getScheme(): string | null
```

Gets `addr`'s scheme

**Returns** `addr`'s scheme (`null` if not built from URI)

_Available since 2.26._
