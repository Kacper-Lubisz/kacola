---
description: "GDBusAuthObserver provides a mechanism for participating in how a Gio.DBusServer (or a Gio.DBusConnection) authenticates remote peers."
---

# GDBusAuthObserver

`GDBusAuthObserver` provides a mechanism for participating
in how a `Gio.DBusServer` (or a `Gio.DBusConnection`)
authenticates remote peers.

Simply instantiate a `GDBusAuthObserver` and connect to the
signals you are interested in. Note that new signals may be added
in the future.

### Controlling Authentication Mechanisms

By default, a `GDBusServer` or server-side `GDBusConnection` will allow
any authentication mechanism to be used. If you only want to allow D-Bus
connections with the `EXTERNAL` mechanism, which makes use of credentials
passing and is the recommended mechanism for modern Unix platforms such
as Linux and the BSD family, you would use a signal handler like this:

```c
static gboolean
on_allow_mechanism (GDBusAuthObserver *observer,
                    const gchar       *mechanism,
                    gpointer           user_data)
{
  if (g_strcmp0 (mechanism, "EXTERNAL") == 0)
    {
      return TRUE;
    }

  return FALSE;
}
```

### Controlling Authorization

By default, a `GDBusServer` or server-side `GDBusConnection` will accept
connections from any successfully authenticated user (but not from
anonymous connections using the `ANONYMOUS` mechanism). If you only
want to allow D-Bus connections from processes owned by the same uid
as the server, since GLib 2.68, you should use the
`G_DBUS_SERVER_FLAGS_AUTHENTICATION_REQUIRE_SAME_USER` flag. It’s equivalent
to the following signal handler:

```c
static gboolean
on_authorize_authenticated_peer (GDBusAuthObserver *observer,
                                 GIOStream         *stream,
                                 GCredentials      *credentials,
                                 gpointer           user_data)
{
  gboolean authorized;

  authorized = FALSE;
  if (credentials != NULL)
    {
      GCredentials *own_credentials;
      own_credentials = g_credentials_new ();
      if (g_credentials_is_same_user (credentials, own_credentials, NULL))
        authorized = TRUE;
      g_object_unref (own_credentials);
    }

  return authorized;
}
```

_Available since 2.26._

```tsx
import { GDBusAuthObserver } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusAuthObserver**

## Props

`ref` receives the `Gio.DBusAuthObserver` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onAllowMechanism`

```ts
(mechanism: string, self: Gio.DBusAuthObserver) => boolean | undefined
```

Emitted to check if `mechanism` is allowed to be used.

**Parameters**

- `mechanism`: The name of the mechanism, e.g. `DBUS_COOKIE_SHA1`.
- `self`: The instance the signal was emitted on.

**Returns** `true` if `mechanism` can be used to authenticate the other peer, `false` if not.

_Available since 2.34._

### `onAuthorizeAuthenticatedPeer`

```ts
(stream: Gio.IOStream, credentials: Gio.Credentials | null, self: Gio.DBusAuthObserver) => boolean | undefined
```

Emitted to check if a peer that is successfully authenticated
is authorized.

**Parameters**

- `stream`: A `GIOStream` for the `GDBusConnection`.
- `credentials`: Credentials received from the peer or `null`.
- `self`: The instance the signal was emitted on.

**Returns** `true` if the peer is authorized, `false` if not.

_Available since 2.26._

## Methods

Methods are called on the `Gio.DBusAuthObserver` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `allowMechanism`

```ts
allowMechanism(mechanism: string): boolean
```

Emits the `GDBusAuthObserver.allow-mechanism` signal on `observer`.

**Parameters**

- `mechanism`: The name of the mechanism, e.g. `DBUS_COOKIE_SHA1`.

**Returns** `true` if `mechanism` can be used to authenticate the other peer, `false` if not.

_Available since 2.34._

### `authorizeAuthenticatedPeer`

```ts
authorizeAuthenticatedPeer(stream: Gio.IOStream, credentials: Gio.Credentials | null): boolean
```

Emits the `GDBusAuthObserver.authorize-authenticated-peer` signal on `observer`.

**Parameters**

- `stream`: A `GIOStream` for the `GDBusConnection`.
- `credentials`: Credentials received from the peer or `null`.

**Returns** `true` if the peer is authorized, `false` if not.

_Available since 2.26._
