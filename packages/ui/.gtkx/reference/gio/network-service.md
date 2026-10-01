---
description: "Like Gio.NetworkAddress does with hostnames, GNetworkService provides an easy way to resolve a SRV record, and then attempt to connect to one of the hosts that implements that service, handling service priority/weight..."
---

# GNetworkService

Like `Gio.NetworkAddress` does with hostnames, `GNetworkService`
provides an easy way to resolve a SRV record, and then attempt to
connect to one of the hosts that implements that service, handling
service priority/weighting, multiple IP addresses, and multiple
address families.

See `Gio.SrvTarget` for more information about SRV records, and see
`Gio.SocketConnectable` for an example of using the connectable
interface.

```tsx
import { GNetworkService } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GNetworkService**

Implements `GSocketConnectable`.

## Props

`ref` receives the `Gio.NetworkService` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `domain`

`string` · default `null` · construct-only

Network domain, for example `example.com`.

_Available since 2.22._

### `protocol`

`string` · default `null` · construct-only

Network protocol, for example `tcp`.

_Available since 2.22._

### `scheme`

`string` · default `null`

Network scheme (default is to use service).

_Available since 2.22._

### `service`

`string` · default `null` · construct-only

Service name, for example `ldap`.

_Available since 2.22._

## Methods

Methods are called on the `Gio.NetworkService` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDomain`

```ts
getDomain(): string
```

Gets the domain that `srv` serves. This might be either UTF-8 or
ASCII-encoded, depending on what `srv` was created with.

**Returns** `srv`'s domain name

_Available since 2.22._

### `getProtocol`

```ts
getProtocol(): string
```

Gets `srv`'s protocol name (eg, "tcp").

**Returns** `srv`'s protocol name

_Available since 2.22._

### `getScheme`

```ts
getScheme(): string
```

Gets the URI scheme used to resolve proxies. By default, the service name
is used as scheme.

**Returns** `srv`'s scheme name

_Available since 2.26._

### `getService`

```ts
getService(): string
```

Gets `srv`'s service name (eg, "ldap").

**Returns** `srv`'s service name

_Available since 2.22._

### `setScheme`

```ts
setScheme(scheme: string): void
```

Set's the URI scheme used to resolve proxies. By default, the service name
is used as scheme.

**Parameters**

- `scheme`: a URI scheme

_Available since 2.26._
