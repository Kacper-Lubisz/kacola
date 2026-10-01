---
description: "A GSocketControlMessage is a special-purpose utility message that can be sent to or received from a Gio.Socket."
---

# GSocketControlMessage

A `GSocketControlMessage` is a special-purpose utility message that
can be sent to or received from a `Gio.Socket`. These types of
messages are often called ‘ancillary data’.

The message can represent some sort of special instruction to or
information from the socket or can represent a special kind of
transfer to the peer (for example, sending a file descriptor over
a UNIX socket).

These messages are sent with `Gio.Socket.sendMessage()` and received
with `Gio.Socket.receiveMessage()`.

To extend the set of control messages that can be sent, subclass this
class and override the `get_size`, `get_level`, `get_type` and `serialize`
methods.

To extend the set of control messages that can be received, subclass
this class and implement the `deserialize` method. Also, make sure your
class is registered with the `GObject.Type` type system before calling
`Gio.Socket.receiveMessage()` to read such a message.

_Available since 2.22._

```tsx
import { GSocketControlMessage } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSocketControlMessage**

## Props

`ref` receives the `Gio.SocketControlMessage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.SocketControlMessage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getLevel`

```ts
getLevel(): number
```

Returns the "level" (i.e. the originating protocol) of the control message.
This is often SOL_SOCKET.

**Returns** an integer describing the level

_Available since 2.22._

### `getMsgType`

```ts
getMsgType(): number
```

Returns the protocol specific type of the control message.
For instance, for UNIX fd passing this would be SCM_RIGHTS.

**Returns** an integer describing the type of control message

_Available since 2.22._

### `getSize`

```ts
getSize(): number
```

Returns the space required for the control message, not including
headers or alignment.

**Returns** The number of bytes required.

_Available since 2.22._

### `serialize`

```ts
serialize(data: bigint): void
```

Converts the data in the message to bytes placed in the
message.

`data` is guaranteed to have enough space to fit the size
returned by `g_socket_control_message_get_size()` on this
object.

**Parameters**

- `data`: A buffer to write data to

_Available since 2.22._
