---
description: "GInetAddress represents an IPv4 or IPv6 internet address."
---

# GInetAddress

`GInetAddress` represents an IPv4 or IPv6 internet address. Use
`Gio.Resolver.lookupByName()` or
`Gio.Resolver.lookupByNameAsync()` to look up the `GInetAddress` for
a hostname. Use `Gio.Resolver.lookupByAddress()` or
`Gio.Resolver.lookupByAddressAsync()` to look up the hostname for a
`GInetAddress`.

To actually connect to a remote host, you will need a
`Gio.InetSocketAddress` (which includes a `GInetAddress` as well as a
port number).

```tsx
import { GInetAddress } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GInetAddress**

## Props

`ref` receives the `Gio.InetAddress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bytes`

`bigint` · construct-only

The raw address data.

_Available since 2.22._

### `family`

`Gio.SocketFamily` · default `G_SOCKET_FAMILY_INVALID` · construct-only

The address family (IPv4 or IPv6).

_Available since 2.22._

### `flowinfo`

`number` · default `0` · construct-only

The flowinfo for an IPv6 address.
See `Gio.InetAddress.getFlowinfo()`.

_Available since 2.86._

### `isAny`

`boolean` · default `false` · read-only, observe with `onNotifyIsAny`

Whether this is the "any" address for its family.
See `g_inet_address_get_is_any()`.

_Available since 2.22._

### `isLinkLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsLinkLocal`

Whether this is a link-local address.
See `g_inet_address_get_is_link_local()`.

_Available since 2.22._

### `isLoopback`

`boolean` · default `false` · read-only, observe with `onNotifyIsLoopback`

Whether this is the loopback address for its family.
See `g_inet_address_get_is_loopback()`.

_Available since 2.22._

### `isMcGlobal`

`boolean` · default `false` · read-only, observe with `onNotifyIsMcGlobal`

Whether this is a global multicast address.
See `g_inet_address_get_is_mc_global()`.

_Available since 2.22._

### `isMcLinkLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsMcLinkLocal`

Whether this is a link-local multicast address.
See `g_inet_address_get_is_mc_link_local()`.

_Available since 2.22._

### `isMcNodeLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsMcNodeLocal`

Whether this is a node-local multicast address.
See `g_inet_address_get_is_mc_node_local()`.

_Available since 2.22._

### `isMcOrgLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsMcOrgLocal`

Whether this is an organization-local multicast address.
See `g_inet_address_get_is_mc_org_local()`.

_Available since 2.22._

### `isMcSiteLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsMcSiteLocal`

Whether this is a site-local multicast address.
See `g_inet_address_get_is_mc_site_local()`.

_Available since 2.22._

### `isMulticast`

`boolean` · default `false` · read-only, observe with `onNotifyIsMulticast`

Whether this is a multicast address.
See `g_inet_address_get_is_multicast()`.

_Available since 2.22._

### `isSiteLocal`

`boolean` · default `false` · read-only, observe with `onNotifyIsSiteLocal`

Whether this is a site-local address.
See `g_inet_address_get_is_loopback()`.

_Available since 2.22._

### `scopeId`

`number` · default `0` · construct-only

The scope-id for an IPv6 address.
See `Gio.InetAddress.getScopeId()`.

_Available since 2.86._

## Methods

Methods are called on the `Gio.InetAddress` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `equal`

```ts
equal(otherAddress: Gio.InetAddress): boolean
```

Checks if two `GInetAddress` instances are equal, e.g. the same address.

**Parameters**

- `otherAddress`: Another `GInetAddress`.

**Returns** `true` if `address` and `other_address` are equal, `false` otherwise.

_Available since 2.30._

### `getFamily`

```ts
getFamily(): Gio.SocketFamily
```

Gets `address`'s family

**Returns** `address`'s family

_Available since 2.22._

### `getFlowinfo`

```ts
getFlowinfo(): number
```

Gets the value of `Gio.InetAddress.flowinfo`.

**Returns** The flowinfo for the address, `0` if unset or not IPv6 address.

_Available since 2.86._

### `getIsAny`

```ts
getIsAny(): boolean
```

Tests whether `address` is the "any" address for its family.

**Returns** `true` if `address` is the "any" address for its family.

_Available since 2.22._

### `getIsLinkLocal`

```ts
getIsLinkLocal(): boolean
```

Tests whether `address` is a link-local address (that is, if it
identifies a host on a local network that is not connected to the
Internet).

**Returns** `true` if `address` is a link-local address.

_Available since 2.22._

### `getIsLoopback`

```ts
getIsLoopback(): boolean
```

Tests whether `address` is the loopback address for its family.

**Returns** `true` if `address` is the loopback address for its family.

_Available since 2.22._

### `getIsMcGlobal`

```ts
getIsMcGlobal(): boolean
```

Tests whether `address` is a global multicast address.

**Returns** `true` if `address` is a global multicast address.

_Available since 2.22._

### `getIsMcLinkLocal`

```ts
getIsMcLinkLocal(): boolean
```

Tests whether `address` is a link-local multicast address.

**Returns** `true` if `address` is a link-local multicast address.

_Available since 2.22._

### `getIsMcNodeLocal`

```ts
getIsMcNodeLocal(): boolean
```

Tests whether `address` is a node-local multicast address.

**Returns** `true` if `address` is a node-local multicast address.

_Available since 2.22._

### `getIsMcOrgLocal`

```ts
getIsMcOrgLocal(): boolean
```

Tests whether `address` is an organization-local multicast address.

**Returns** `true` if `address` is an organization-local multicast address.

_Available since 2.22._

### `getIsMcSiteLocal`

```ts
getIsMcSiteLocal(): boolean
```

Tests whether `address` is a site-local multicast address.

**Returns** `true` if `address` is a site-local multicast address.

_Available since 2.22._

### `getIsMulticast`

```ts
getIsMulticast(): boolean
```

Tests whether `address` is a multicast address.

**Returns** `true` if `address` is a multicast address.

_Available since 2.22._

### `getIsSiteLocal`

```ts
getIsSiteLocal(): boolean
```

Tests whether `address` is a site-local address such as 10.0.0.1
(that is, the address identifies a host on a local network that can
not be reached directly from the Internet, but which may have
outgoing Internet connectivity via a NAT or firewall).

**Returns** `true` if `address` is a site-local address.

_Available since 2.22._

### `getNativeSize`

```ts
getNativeSize(): number
```

Gets the size of the native raw binary address for `address`. This
is the size of the data that you get from `g_inet_address_to_bytes()`.

**Returns** the number of bytes used for the native version of `address`.

_Available since 2.22._

### `getScopeId`

```ts
getScopeId(): number
```

Gets the value of `Gio.InetAddress.scopeId`.

**Returns** The scope-id for the address, `0` if unset or not IPv6 address.

_Available since 2.86._

### `toString`

```ts
toString(): string
```

Converts `address` to string form.

**Returns** a representation of `address` as a string, which should be
freed after use.

_Available since 2.22._
