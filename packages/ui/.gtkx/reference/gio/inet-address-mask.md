---
description: "GInetAddressMask represents a range of IPv4 or IPv6 addresses described by a base address and a length indicating how many bits of the base address are relevant for matching purposes."
---

# GInetAddressMask

`GInetAddressMask` represents a range of IPv4 or IPv6 addresses
described by a base address and a length indicating how many bits
of the base address are relevant for matching purposes. These are
often given in string form. For example, `10.0.0.0/8`, or `fe80::/10`.

_Available since 2.32._

```tsx
import { GInetAddressMask } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GInetAddressMask**

Implements `GInitable`.

## Props

`ref` receives the `Gio.InetAddressMask` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `address`

`Gio.InetAddress | ReactElement`

The base address.

_Available since 2.32._

### `family`

`Gio.SocketFamily` · default `G_SOCKET_FAMILY_INVALID` · read-only, observe with `onNotifyFamily`

The address family (IPv4 or IPv6).

_Available since 2.32._

### `length`

`number` · default `0`

The prefix length, in bytes.

_Available since 2.32._

## Methods

Methods are called on the `Gio.InetAddressMask` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `equal`

```ts
equal(mask2: Gio.InetAddressMask): boolean
```

Tests if `mask` and `mask2` are the same mask.

**Parameters**

- `mask2`: another `GInetAddressMask`

**Returns** whether `mask` and `mask2` are the same mask

_Available since 2.32._

### `getAddress`

```ts
getAddress(): Gio.InetAddress
```

Gets `mask`'s base address

**Returns** `mask`'s base address

_Available since 2.32._

### `getFamily`

```ts
getFamily(): Gio.SocketFamily
```

Gets the `GSocketFamily` of `mask`'s address

**Returns** the `GSocketFamily` of `mask`'s address

_Available since 2.32._

### `getLength`

```ts
getLength(): number
```

Gets `mask`'s length

**Returns** `mask`'s length

_Available since 2.32._

### `matches`

```ts
matches(address: Gio.InetAddress): boolean
```

Tests if `address` falls within the range described by `mask`.

**Parameters**

- `address`: a `GInetAddress`

**Returns** whether `address` falls within the range described by
`mask`.

_Available since 2.32._

### `toString`

```ts
toString(): string
```

Converts `mask` back to its corresponding string form.

**Returns** a string corresponding to `mask`.

_Available since 2.32._
