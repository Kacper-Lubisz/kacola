---
description: "GDebugControllerDBus is an implementation of Gio.DebugController which exposes debug settings as a D-Bus object."
---

# GDebugControllerDBus

`GDebugControllerDBus` is an implementation of `Gio.DebugController`
which exposes debug settings as a D-Bus object.

It is a `Gio.Initable` object, and will register an object at
`/org/gtk/Debugging` on the bus given as
`Gio.DebugControllerDBus.connection` once it’s initialized. The
object will be unregistered when the last reference to the
`GDebugControllerDBus` is dropped.

This D-Bus object can be used by remote processes to enable or disable debug
output in this process. Remote processes calling
`org.gtk.Debugging.SetDebugEnabled()` will affect the value of
`Gio.DebugController.debugEnabled` and, by default,
`GLib.logGetDebugEnabled()`.

By default, no processes are allowed to call `SetDebugEnabled()` unless a
`Gio.DebugControllerDBus.authorize` signal handler is installed. This
is because the process may be privileged, or might expose sensitive
information in its debug output. You may want to restrict the ability to
enable debug output to privileged users or processes.

One option is to install a D-Bus security policy which restricts access to
`SetDebugEnabled()`, installing something like the following in
`$datadir/dbus-1/system.d/`:

```xml
<?xml version="1.0"?> <!--*-nxml-*-->
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN"
     "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <policy user="root">
    <allow send_destination="com.example.MyService" send_interface="org.gtk.Debugging"/>
  </policy>
  <policy context="default">
    <deny send_destination="com.example.MyService" send_interface="org.gtk.Debugging"/>
  </policy>
</busconfig>
```

This will prevent the `SetDebugEnabled()` method from being called by all
except root. It will not prevent the `DebugEnabled` property from being read,
as it’s accessed through the `org.freedesktop.DBus.Properties` interface.

Another option is to use polkit to allow or deny requests on a case-by-case
basis, allowing for the possibility of dynamic authorisation. To do this,
connect to the `Gio.DebugControllerDBus.authorize` signal and query
polkit in it:

```c
  g_autoptr(GError) child_error = NULL;
  g_autoptr(GDBusConnection) connection = g_bus_get_sync (G_BUS_TYPE_SYSTEM, NULL, NULL);
  gulong debug_controller_authorize_id = 0;

  // Set up the debug controller.
  debug_controller = G_DEBUG_CONTROLLER (g_debug_controller_dbus_new (priv->connection, NULL, &child_error));
  if (debug_controller == NULL)
    {
      g_error ("Could not register debug controller on bus: %s",
               child_error->message);
    }

  debug_controller_authorize_id = g_signal_connect (debug_controller,
                                                    "authorize",
                                                    G_CALLBACK (debug_controller_authorize_cb),
                                                    self);

  static gboolean
  debug_controller_authorize_cb (GDebugControllerDBus  *debug_controller,
                                 GDBusMethodInvocation *invocation,
                                 gpointer               user_data)
  {
    g_autoptr(PolkitAuthority) authority = NULL;
    g_autoptr(PolkitSubject) subject = NULL;
    g_autoptr(PolkitAuthorizationResult) auth_result = NULL;
    g_autoptr(GError) local_error = NULL;
    GDBusMessage *message;
    GDBusMessageFlags message_flags;
    PolkitCheckAuthorizationFlags flags = POLKIT_CHECK_AUTHORIZATION_FLAGS_NONE;

    message = g_dbus_method_invocation_get_message (invocation);
    message_flags = g_dbus_message_get_flags (message);

    authority = polkit_authority_get_sync (NULL, &local_error);
    if (authority == NULL)
      {
        g_warning ("Failed to get polkit authority: %s", local_error->message);
        return FALSE;
      }

    if (message_flags & G_DBUS_MESSAGE_FLAGS_ALLOW_INTERACTIVE_AUTHORIZATION)
      flags |= POLKIT_CHECK_AUTHORIZATION_FLAGS_ALLOW_USER_INTERACTION;

    subject = polkit_system_bus_name_new (g_dbus_method_invocation_get_sender (invocation));

    auth_result = polkit_authority_check_authorization_sync (authority,
                                                             subject,
                                                             "com.example.MyService.set-debug-enabled",
                                                             NULL,
                                                             flags,
                                                             NULL,
                                                             &local_error);
    if (auth_result == NULL)
      {
        g_warning ("Failed to get check polkit authorization: %s", local_error->message);
        return FALSE;
      }

    return polkit_authorization_result_get_is_authorized (auth_result);
  }
```

_Available since 2.72._

```tsx
import { GDebugControllerDBus } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDebugControllerDBus**

Implements `GDebugController`, `GInitable`.

## Props

`ref` receives the `Gio.DebugControllerDBus` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `connection`

`Gio.DBusConnection` · construct-only

The D-Bus connection to expose the debugging interface on.

Typically this will be the same connection (to the system or session bus)
which the rest of the application or service’s D-Bus objects are registered
on.

_Available since 2.72._

### `debugEnabled`

`boolean` · default `false` · from `GDebugController`

`true` if debug output should be exposed (for example by forwarding it to
the journal), `false` otherwise.

_Available since 2.72._

## Signals

### `onAuthorize`

```ts
(invocation: Gio.DBusMethodInvocation, self: Gio.DebugControllerDBus) => boolean | undefined
```

Emitted when a D-Bus peer is trying to change the debug settings and used
to determine if that is authorized.

This signal is emitted in a dedicated worker thread, so handlers are
allowed to perform blocking I/O. This means that, for example, it is
appropriate to call `polkit_authority_check_authorization_sync()` to check
authorization using polkit.

If `false` is returned then no further handlers are run and the request to
change the debug settings is rejected.

Otherwise, if `true` is returned, signal emission continues. If no handlers
return `false`, then the debug settings are allowed to be changed.

Signal handlers must not modify `invocation`, or cause it to return a value.

The default class handler just returns `true`.

**Parameters**

- `invocation`: A `GDBusMethodInvocation`.
- `self`: The instance the signal was emitted on.

**Returns** `true` if the call is authorized, `false` otherwise.

_Available since 2.72._

## Methods

Methods are called on the `Gio.DebugControllerDBus` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `stop`

```ts
stop(): void
```

Stop the debug controller, unregistering its object from the bus.

Any pending method calls to the object will complete successfully, but new
ones will return an error. This method will block until all pending
`GDebugControllerDBus.authorize` signals have been handled. This is expected
to not take long, as it will just be waiting for threads to join. If any
`GDebugControllerDBus.authorize` signal handlers are still executing in other
threads, this will block until after they have returned.

This method will be called automatically when the final reference to the
`GDebugControllerDBus` is dropped. You may want to call it explicitly to know
when the controller has been fully removed from the bus, or to break
reference count cycles.

Calling this method from within a `GDebugControllerDBus.authorize` signal
handler will cause a deadlock and must not be done.

_Available since 2.72._
