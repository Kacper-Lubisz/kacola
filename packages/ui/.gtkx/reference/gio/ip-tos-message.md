---
description: "Contains the type of service (ToS) byte of an IPv4 header."
---

# GIPTosMessage

Contains the type of service (ToS) byte of an IPv4 header.

This consists of the DSCP field as per
[RFC 2474](https://www.rfc-editor.org/rfc/rfc2474#section-3),
and the ECN field as per
[RFC 3168](https://www.rfc-editor.org/rfc/rfc3168#section-5).

It may be received using `Gio.Socket.receiveMessage()` over UDP sockets
(i.e. sockets in the `G_SOCKET_FAMILY_IPV4` family with
`G_SOCKET_TYPE_DATAGRAM` type). The message is not meant for sending. To set
ToS field to be used in datagrams sent on a `Gio.Socket` use:
```c
g_socket_set_option (socket, IPPROTO_IP, IP_TOS, <ToS value>, &error);
```

_Available since 2.88._

```tsx
import { GIPTosMessage } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketControlMessage](.gtkx/reference/gio/socket-control-message.md) → **GIPTosMessage**

## Props

`ref` receives the `Gio.IPTosMessage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.IPTosMessage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDscp`

```ts
getDscp(): number
```

Gets the differentiated services code point stored in `message`.

**Returns** A DSCP value as described in [RFC 2474](https://www.rfc-editor.org/rfc/rfc2474.html#section-3).

_Available since 2.88._

### `getEcn`

```ts
getEcn(): Gio.EcnCodePoint
```

Gets the Explicit Congestion Notification code point stored in `message`.

**Returns** An ECN value as described in [RFC 3168](https://www.rfc-editor.org/rfc/rfc3168#section-5).

_Available since 2.88._
