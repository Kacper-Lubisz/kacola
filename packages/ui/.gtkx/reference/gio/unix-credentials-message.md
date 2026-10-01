---
description: "This Gio.SocketControlMessage contains a Gio.Credentials instance."
---

# GUnixCredentialsMessage

This `Gio.SocketControlMessage` contains a `Gio.Credentials`
instance.  It may be sent using `Gio.Socket.sendMessage()` and received
using `Gio.Socket.receiveMessage()` over UNIX sockets (ie: sockets in
the `G_SOCKET_FAMILY_UNIX` family).

For an easier way to send and receive credentials over
stream-oriented UNIX sockets, see
`Gio.UnixConnection.sendCredentials()` and
`Gio.UnixConnection.receiveCredentials()`. To receive credentials of
a foreign process connected to a socket, use
`Gio.Socket.getCredentials()`.

Since GLib 2.72, `GUnixCredentialMessage` is available on all platforms. It
requires underlying system support (such as Windows 10 with `AF_UNIX`) at run
time.

Before GLib 2.72, `<gio/gunixcredentialsmessage.h>` belonged to the UNIX-specific
GIO interfaces, thus you had to use the `gio-unix-2.0.pc` pkg-config file
when using it. This is no longer necessary since GLib 2.72.

_Available since 2.26._

```tsx
import { GUnixCredentialsMessage } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketControlMessage](.gtkx/reference/gio/socket-control-message.md) → **GUnixCredentialsMessage**

## Props

`ref` receives the `Gio.UnixCredentialsMessage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `credentials`

`Gio.Credentials` · construct-only

The credentials stored in the message.

_Available since 2.26._

## Methods

Methods are called on the `Gio.UnixCredentialsMessage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getCredentials`

```ts
getCredentials(): Gio.Credentials
```

Gets the credentials stored in `message`.

**Returns** A `GCredentials` instance. Do not free, it is owned by `message`.

_Available since 2.26._
