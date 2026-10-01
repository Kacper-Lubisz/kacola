---
description: "The GDBusConnection type is used for D-Bus connections to remote peers such as a message buses."
---

# GDBusConnection

The `GDBusConnection` type is used for D-Bus connections to remote
peers such as a message buses.

It is a low-level API that offers a lot of flexibility. For instance,
it lets you establish a connection over any transport that can by represented
as a `Gio.IOStream`.

This class is rarely used directly in D-Bus clients. If you are writing
a D-Bus client, it is often easier to use the `Gio.busOwnName()`,
`Gio.busWatchName()` or `Gio.DBusProxy.newForBus()` APIs.

As an exception to the usual GLib rule that a particular object must not
be used by two threads at the same time, `GDBusConnection`s methods may be
called from any thread. This is so that `Gio.busGet()` and
`Gio.busGetSync()` can safely return the same `GDBusConnection` when
called from any thread.

Most of the ways to obtain a `GDBusConnection` automatically initialize it
(i.e. connect to D-Bus): for instance, `Gio.DBusConnection.new()` and
`Gio.busGet()`, and the synchronous versions of those methods, give you
an initialized connection. Language bindings for GIO should use
`Gio.Initable.new()` or `Gio.AsyncInitable.newAsync()`, which also
initialize the connection.

If you construct an uninitialized `GDBusConnection`, such as via
`GObject.Object.new()`, you must initialize it via `Gio.Initable.init()` or
`Gio.AsyncInitable.initAsync()` before using its methods or properties.
Calling methods or accessing properties on a `GDBusConnection` that has not
completed initialization successfully is considered to be invalid, and leads
to undefined behaviour. In particular, if initialization fails with a
`GError`, the only valid thing you can do with that `GDBusConnection` is to
free it with `GObject.Object.unref()`.

### An example D-Bus server

Here is an example for a D-Bus server:
[gdbus-example-server.c](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-server.c)

### An example for exporting a subtree

Here is an example for exporting a subtree:
[gdbus-example-subtree.c](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-subtree.c)

### An example for file descriptor passing

Here is an example for passing UNIX file descriptors:
[gdbus-unix-fd-client.c](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-unix-fd-client.c)

### An example for exporting a GObject

Here is an example for exporting a `GObject`:
[gdbus-example-export.c](https://gitlab.gnome.org/GNOME/glib/-/blob/HEAD/gio/tests/gdbus-example-export.c)

_Available since 2.26._

```tsx
import { GDBusConnection } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusConnection**

Implements `GAsyncInitable`, `GInitable`.

## Props

`ref` receives the `Gio.DBusConnection` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `address`

`string` · default `null` · construct-only

A D-Bus address specifying potential endpoints that can be used
when establishing the connection.

_Available since 2.26._

### `authenticationObserver`

`Gio.DBusAuthObserver` · construct-only

A `GDBusAuthObserver` object to assist in the authentication process or `null`.

_Available since 2.26._

### `capabilities`

`Gio.DBusCapabilityFlags` · default `G_DBUS_CAPABILITY_FLAGS_NONE` · read-only, observe with `onNotifyCapabilities`

Flags from the `GDBusCapabilityFlags` enumeration
representing connection features negotiated with the other peer.

_Available since 2.26._

### `closed`

`boolean` · default `false` · read-only, observe with `onNotifyClosed`

A boolean specifying whether the connection has been closed.

_Available since 2.26._

### `exitOnClose`

`boolean` · default `false`

A boolean specifying whether the process will be terminated (by
calling `raise(SIGTERM)`) if the connection is closed by the
remote peer.

Note that `GDBusConnection` objects returned by `g_bus_get_finish()`
and `g_bus_get_sync()` will (usually) have this property set to `true`.

_Available since 2.26._

### `flags`

`Gio.DBusConnectionFlags` · default `G_DBUS_CONNECTION_FLAGS_NONE` · construct-only

Flags from the `GDBusConnectionFlags` enumeration.

_Available since 2.26._

### `guid`

`string` · default `null` · construct-only

The GUID of the peer performing the role of server when
authenticating.

If you are constructing a `GDBusConnection` and pass
`G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_SERVER` in the
`GDBusConnection.flags` property then you **must** also set this
property to a valid guid.

If you are constructing a `GDBusConnection` and pass
`G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_CLIENT` in the
`GDBusConnection.flags` property you will be able to read the GUID
of the other peer here after the connection has been successfully
initialized.

Note that the
[D-Bus specification](https://dbus.freedesktop.org/doc/dbus-specification.html#addresses)
uses the term ‘UUID’ to refer to this, whereas GLib consistently uses the
term ‘GUID’ for historical reasons.

Despite its name, the format of `GDBusConnection.guid` does not follow
[RFC 4122](https://datatracker.ietf.org/doc/html/rfc4122) or the Microsoft
GUID format.

_Available since 2.26._

### `stream`

`Gio.IOStream` · construct-only

The underlying `GIOStream` used for I/O.

If this is passed on construction and is a `GSocketConnection`,
then the corresponding `GSocket` will be put into non-blocking mode.

While the `GDBusConnection` is active, it will interact with this
stream from a worker thread, so it is not safe to interact with
the stream directly.

_Available since 2.26._

### `uniqueName`

`string` · default `null` · read-only, observe with `onNotifyUniqueName`

The unique name as assigned by the message bus or `null` if the
connection is not open or not a message bus connection.

_Available since 2.26._

## Signals

### `onClosed`

```ts
(remotePeerVanished: boolean, error: GLib.Error | null, self: Gio.DBusConnection) => void
```

Emitted when the connection is closed.

The cause of this event can be

- If `g_dbus_connection_close()` is called. In this case
  `remote_peer_vanished` is set to `false` and `error` is `null`.

- If the remote peer closes the connection. In this case
  `remote_peer_vanished` is set to `true` and `error` is set.

- If the remote peer sends invalid or malformed data. In this
  case `remote_peer_vanished` is set to `false` and `error` is set.

Upon receiving this signal, you should give up your reference to
`connection`. You are guaranteed that this signal is emitted only
once.

**Parameters**

- `remotePeerVanished`: `true` if `connection` is closed because the remote peer closed its end of the connection
- `error`: a `GError` with more details about the event or `null`
- `self`: The instance the signal was emitted on.

_Available since 2.26._

## Methods

Methods are called on the `Gio.DBusConnection` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addFilter`

```ts
addFilter(filterFunction: Gio.DBusMessageFilterFunction): number
```

Adds a message filter. Filters are handlers that are run on all
incoming and outgoing messages, prior to standard dispatch. Filters
are run in the order that they were added.  The same handler can be
added as a filter more than once, in which case it will be run more
than once.  Filters added during a filter callback won't be run on
the message being processed. Filter functions are allowed to modify
and even drop messages.

Note that filters are run in a dedicated message handling thread so
they can't block and, generally, can't do anything but signal a
worker thread. Also note that filters are rarely needed - use API
such as `g_dbus_connection_send_message_with_reply()`,
`g_dbus_connection_signal_subscribe()` or `g_dbus_connection_call()` instead.

If a filter consumes an incoming message the message is not
dispatched anywhere else - not even the standard dispatch machinery
(that API such as `g_dbus_connection_signal_subscribe()` and
`g_dbus_connection_send_message_with_reply()` relies on) will see the
message. Similarly, if a filter consumes an outgoing message, the
message will not be sent to the other peer.

If `user_data_free_func` is non-`null`, it will be called (in the
thread-default main context of the thread you are calling this
method from) at some point after `user_data` is no longer
needed. (It is not guaranteed to be called synchronously when the
filter is removed, and may be called after `connection` has been
destroyed.)

**Parameters**

- `filterFunction`: a filter function

**Returns** a filter identifier that can be used with
    `g_dbus_connection_remove_filter()`

_Available since 2.26._

### `call`

```ts
call(busName: string | null, objectPath: string, interfaceName: string, methodName: string, parameters: GLib.Variant | null, replyType: GLib.VariantType | null, flags: Gio.DBusCallFlags, timeoutMsec: number, cancellable?: Gio.Cancellable | null): Promise<GLib.Variant>
```

Asynchronously invokes the `method_name` method on the
`interface_name` D-Bus interface on the remote object at
`object_path` owned by `bus_name`.

If `connection` is closed then the operation will fail with
`G_IO_ERROR_CLOSED`. If `cancellable` is canceled, the operation will
fail with `G_IO_ERROR_CANCELLED`. If `parameters` contains a value
not compatible with the D-Bus protocol, the operation fails with
`G_IO_ERROR_INVALID_ARGUMENT`.

If `reply_type` is non-`null` then the reply will be checked for having this type and an
error will be raised if it does not match.  Said another way, if you give a `reply_type`
then any non-`null` return value will be of this type. Unless it’s
`G_VARIANT_TYPE_UNIT`, the `reply_type` will be a tuple containing one or more
values.

If the `parameters` `GVariant` is floating, it is consumed. This allows
convenient 'inline' use of `g_variant_new()`, e.g.:
```c
g_dbus_connection_call (connection,
                         "org.freedesktop.StringThings",
                         "/org/freedesktop/StringThings",
                         "org.freedesktop.StringThings",
                         "TwoStrings",
                         g_variant_new ("(ss)",
                                        "Thing One",
                                        "Thing Two"),
                         NULL,
                         G_DBUS_CALL_FLAGS_NONE,
                         -1,
                         NULL,
                         (GAsyncReadyCallback) two_strings_done,
                         NULL);
```

This is an asynchronous method. When the operation is finished,
`callback` will be invoked in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from. You can then call
`g_dbus_connection_call_finish()` to get the result of the operation.
See `g_dbus_connection_call_sync()` for the synchronous version of this
function.

If `callback` is `null` then the D-Bus method call message will be sent with
the `G_DBUS_MESSAGE_FLAGS_NO_REPLY_EXPECTED` flag set.

**Parameters**

- `busName`: a unique or well-known bus name or `null` if `connection` is not a message bus connection
- `objectPath`: path of remote object
- `interfaceName`: D-Bus interface to invoke method on
- `methodName`: the name of the method to invoke
- `parameters`: a `GVariant` tuple with parameters for the method or `null` if not passing parameters
- `replyType`: the expected type of the reply (which will be a tuple), or `null`
- `flags`: flags from the `GDBusCallFlags` enumeration
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `cancellable`: a `GCancellable` or `null`

**Returns** `null` if `error` is set. Otherwise a non-floating
    `GVariant` tuple with return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callFinish`

```ts
callFinish(res: Gio.AsyncResult): GLib.Variant
```

Finishes an operation started with `g_dbus_connection_call()`.

**Parameters**

- `res`: a `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_connection_call()`

**Returns** `null` if `error` is set. Otherwise a non-floating
    `GVariant` tuple with return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callSync`

```ts
callSync(busName: string | null, objectPath: string, interfaceName: string, methodName: string, parameters: GLib.Variant | null, replyType: GLib.VariantType | null, flags: Gio.DBusCallFlags, timeoutMsec: number, cancellable: Gio.Cancellable | null): GLib.Variant
```

Synchronously invokes the `method_name` method on the
`interface_name` D-Bus interface on the remote object at
`object_path` owned by `bus_name`.

If `connection` is closed then the operation will fail with
`G_IO_ERROR_CLOSED`. If `cancellable` is canceled, the
operation will fail with `G_IO_ERROR_CANCELLED`. If `parameters`
contains a value not compatible with the D-Bus protocol, the operation
fails with `G_IO_ERROR_INVALID_ARGUMENT`.

If `reply_type` is non-`null` then the reply will be checked for having
this type and an error will be raised if it does not match.  Said
another way, if you give a `reply_type` then any non-`null` return
value will be of this type.

If the `parameters` `GVariant` is floating, it is consumed.
This allows convenient 'inline' use of `g_variant_new()`, e.g.:
```c
g_dbus_connection_call_sync (connection,
                              "org.freedesktop.StringThings",
                              "/org/freedesktop/StringThings",
                              "org.freedesktop.StringThings",
                              "TwoStrings",
                              g_variant_new ("(ss)",
                                             "Thing One",
                                             "Thing Two"),
                              NULL,
                              G_DBUS_CALL_FLAGS_NONE,
                              -1,
                              NULL,
                              &error);
```

The calling thread is blocked until a reply is received. See
`g_dbus_connection_call()` for the asynchronous version of
this method.

**Parameters**

- `busName`: a unique or well-known bus name or `null` if `connection` is not a message bus connection
- `objectPath`: path of remote object
- `interfaceName`: D-Bus interface to invoke method on
- `methodName`: the name of the method to invoke
- `parameters`: a `GVariant` tuple with parameters for the method or `null` if not passing parameters
- `replyType`: the expected type of the reply, or `null`
- `flags`: flags from the `GDBusCallFlags` enumeration
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `cancellable`: a `GCancellable` or `null`

**Returns** `null` if `error` is set. Otherwise a non-floating
    `GVariant` tuple with return values. Free with `g_variant_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `callWithUnixFdList`

```ts
callWithUnixFdList(busName: string | null, objectPath: string, interfaceName: string, methodName: string, parameters: GLib.Variant | null, replyType: GLib.VariantType | null, flags: Gio.DBusCallFlags, timeoutMsec: number, fdList: Gio.UnixFDList | null, cancellable?: Gio.Cancellable | null): Promise<[GLib.Variant, Gio.UnixFDList | null]>
```

Like `g_dbus_connection_call()` but also takes a `GUnixFDList` object.

The file descriptors normally correspond to `G_VARIANT_TYPE_HANDLE`
values in the body of the message. For example, if a message contains
two file descriptors, `fd_list` would have length 2, and
`g_variant_new_handle (0)` and `g_variant_new_handle (1)` would appear
somewhere in the body of the message (not necessarily in that order!)
to represent the file descriptors at indexes 0 and 1 respectively.

When designing D-Bus APIs that are intended to be interoperable,
please note that non-GDBus implementations of D-Bus can usually only
access file descriptors if they are referenced in this way by a
value of type `G_VARIANT_TYPE_HANDLE` in the body of the message.

This method is only available on UNIX.

**Parameters**

- `busName`: a unique or well-known bus name or `null` if `connection` is not a message bus connection
- `objectPath`: path of remote object
- `interfaceName`: D-Bus interface to invoke method on
- `methodName`: the name of the method to invoke
- `parameters`: a `GVariant` tuple with parameters for the method or `null` if not passing parameters
- `replyType`: the expected type of the reply, or `null`
- `flags`: flags from the `GDBusCallFlags` enumeration
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `fdList`: a `GUnixFDList` or `null`
- `cancellable`: a `GCancellable` or `null`

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a non-floating `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: return location for a `GUnixFDList` or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `callWithUnixFdListFinish`

```ts
callWithUnixFdListFinish(res: Gio.AsyncResult): [GLib.Variant, Gio.UnixFDList | null]
```

Finishes an operation started with `g_dbus_connection_call_with_unix_fd_list()`.

The file descriptors normally correspond to `G_VARIANT_TYPE_HANDLE`
values in the body of the message. For example,
if `g_variant_get_handle()` returns 5, that is intended to be a reference
to the file descriptor that can be accessed by
`g_unix_fd_list_get (*out_fd_list, 5, ...)`.

When designing D-Bus APIs that are intended to be interoperable,
please note that non-GDBus implementations of D-Bus can usually only
access file descriptors if they are referenced in this way by a
value of type `G_VARIANT_TYPE_HANDLE` in the body of the message.

**Parameters**

- `res`: a `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_connection_call_with_unix_fd_list()`

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a non-floating `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: return location for a `GUnixFDList` or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `callWithUnixFdListSync`

```ts
callWithUnixFdListSync(busName: string | null, objectPath: string, interfaceName: string, methodName: string, parameters: GLib.Variant | null, replyType: GLib.VariantType | null, flags: Gio.DBusCallFlags, timeoutMsec: number, fdList: Gio.UnixFDList | null, cancellable: Gio.Cancellable | null): [GLib.Variant, Gio.UnixFDList | null]
```

Like `g_dbus_connection_call_sync()` but also takes and returns `GUnixFDList` objects.
See `g_dbus_connection_call_with_unix_fd_list()` and
`g_dbus_connection_call_with_unix_fd_list_finish()` for more details.

This method is only available on UNIX.

**Parameters**

- `busName`: a unique or well-known bus name or `null` if `connection` is not a message bus connection
- `objectPath`: path of remote object
- `interfaceName`: D-Bus interface to invoke method on
- `methodName`: the name of the method to invoke
- `parameters`: a `GVariant` tuple with parameters for the method or `null` if not passing parameters
- `replyType`: the expected type of the reply, or `null`
- `flags`: flags from the `GDBusCallFlags` enumeration
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `fdList`: a `GUnixFDList` or `null`
- `cancellable`: a `GCancellable` or `null`

**Returns** Tuple of:

- `result`: `null` if `error` is set. Otherwise a non-floating `GVariant` tuple with return values. Free with `g_variant_unref()`.
- `outFdList`: return location for a `GUnixFDList` or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.30._

### `close`

```ts
close(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Closes `connection`. Note that this never causes the process to
exit (this might only happen if the other end of a shared message
bus connection disconnects, see `GDBusConnection.exitOnClose`).

Once the connection is closed, operations such as sending a message
will return with the error `G_IO_ERROR_CLOSED`. Closing a connection
will not automatically flush the connection so queued messages may
be lost. Use `g_dbus_connection_flush()` if you need such guarantees.

If `connection` is already closed, this method fails with
`G_IO_ERROR_CLOSED`.

When `connection` has been closed, the `GDBusConnection.closed`
signal is emitted in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread that `connection` was constructed in.

This is an asynchronous method. When the operation is finished,
`callback` will be invoked in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from. You can
then call `g_dbus_connection_close_finish()` to get the result of the
operation. See `g_dbus_connection_close_sync()` for the synchronous
version.

**Parameters**

- `cancellable`: a `GCancellable` or `null`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `closeFinish`

```ts
closeFinish(res: Gio.AsyncResult): boolean
```

Finishes an operation started with `g_dbus_connection_close()`.

**Parameters**

- `res`: a `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_connection_close()`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `closeSync`

```ts
closeSync(cancellable: Gio.Cancellable | null): boolean
```

Synchronously closes `connection`. The calling thread is blocked
until this is done. See `g_dbus_connection_close()` for the
asynchronous version of this method and more details about what it
does.

**Parameters**

- `cancellable`: a `GCancellable` or `null`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `emitSignal`

```ts
emitSignal(destinationBusName: string | null, objectPath: string, interfaceName: string, signalName: string, parameters: GLib.Variant | null): boolean
```

Emits a signal.

If the parameters GVariant is floating, it is consumed.

This can only fail if `parameters` is not compatible with the D-Bus protocol
(`G_IO_ERROR_INVALID_ARGUMENT`), or if `connection` has been closed
(`G_IO_ERROR_CLOSED`).

**Parameters**

- `destinationBusName`: the unique bus name for the destination for the signal or `null` to emit to all listeners
- `objectPath`: path of remote object
- `interfaceName`: D-Bus interface to emit a signal on
- `signalName`: the name of the signal to emit
- `parameters`: a `GVariant` tuple with parameters for the signal or `null` if not passing parameters

**Returns** `true` unless `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `exportActionGroup`

```ts
exportActionGroup(objectPath: string, actionGroup: Gio.ActionGroup): number
```

Exports `action_group` on `connection` at `object_path`.

The implemented D-Bus API should be considered private.  It is
subject to change in the future.

A given object path can only have one action group exported on it.
If this constraint is violated, the export will fail and 0 will be
returned (with `error` set accordingly).

You can unexport the action group using
`Gio.DBusConnection.unexportActionGroup()` with the return value of
this function.

The thread default main context is taken at the time of this call.
All incoming action activations and state change requests are
reported from this context.  Any changes on the action group that
cause it to emit signals must also come from this same context.
Since incoming action activations and state change requests are
rather likely to cause changes on the action group, this effectively
limits a given action group to being exported from only one main
context.

**Parameters**

- `objectPath`: a D-Bus object path
- `actionGroup`: an action group

**Returns** the ID of the export (never zero), or 0 in case of failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `exportMenuModel`

```ts
exportMenuModel(objectPath: string, menu: Gio.MenuModel): number
```

Exports `menu` on `connection` at `object_path`.

The implemented D-Bus API should be considered private.
It is subject to change in the future.

An object path can only have one menu model exported on it. If this
constraint is violated, the export will fail and 0 will be
returned (with `error` set accordingly).

Exporting menus with sections containing more than
`G_MENU_EXPORTER_MAX_SECTION_SIZE` items is not supported and results in
undefined behavior.

You can unexport the menu model using
`g_dbus_connection_unexport_menu_model()` with the return value of
this function.

**Parameters**

- `objectPath`: a D-Bus object path
- `menu`: a `GMenuModel`

**Returns** the ID of the export (never zero), or 0 in case of failure

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.32._

### `flush`

```ts
flush(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Asynchronously flushes `connection`, that is, writes all queued
outgoing messages to the transport and then flushes the transport
(using `g_output_stream_flush_async()`). This is useful in programs
that want to emit a D-Bus signal and then exit immediately. Without
flushing the connection, there is no guarantee that the message has
been sent to the networking buffers in the OS kernel.

This is an asynchronous method. When the operation is finished,
`callback` will be invoked in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from. You can
then call `g_dbus_connection_flush_finish()` to get the result of the
operation. See `g_dbus_connection_flush_sync()` for the synchronous
version.

**Parameters**

- `cancellable`: a `GCancellable` or `null`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `flushFinish`

```ts
flushFinish(res: Gio.AsyncResult): boolean
```

Finishes an operation started with `g_dbus_connection_flush()`.

**Parameters**

- `res`: a `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_connection_flush()`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `flushSync`

```ts
flushSync(cancellable: Gio.Cancellable | null): boolean
```

Synchronously flushes `connection`. The calling thread is blocked
until this is done. See `g_dbus_connection_flush()` for the
asynchronous version of this method and more details about what it
does.

**Parameters**

- `cancellable`: a `GCancellable` or `null`

**Returns** `true` if the operation succeeded, `false` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `getCapabilities`

```ts
getCapabilities(): Gio.DBusCapabilityFlags
```

Gets the capabilities negotiated with the remote peer

**Returns** zero or more flags from the `GDBusCapabilityFlags` enumeration

_Available since 2.26._

### `getExitOnClose`

```ts
getExitOnClose(): boolean
```

Gets whether the process is terminated when `connection` is
closed by the remote peer. See
`GDBusConnection.exitOnClose` for more details.

**Returns** whether the process is terminated when `connection` is
    closed by the remote peer

_Available since 2.26._

### `getFlags`

```ts
getFlags(): Gio.DBusConnectionFlags
```

Gets the flags used to construct this connection

**Returns** zero or more flags from the `GDBusConnectionFlags` enumeration

_Available since 2.60._

### `getGuid`

```ts
getGuid(): string
```

The GUID of the peer performing the role of server when
authenticating. See `GDBusConnection.guid` for more details.

**Returns** The GUID. Do not free this string, it is owned by
    `connection`.

_Available since 2.26._

### `getLastSerial`

```ts
getLastSerial(): number
```

Retrieves the last serial number assigned to a `GDBusMessage` on
the current thread. This includes messages sent via both low-level
API such as `g_dbus_connection_send_message()` as well as
high-level API such as `g_dbus_connection_emit_signal()`,
`g_dbus_connection_call()` or `g_dbus_proxy_call()`.

**Returns** the last used serial or zero when no message has been sent
    within the current thread

_Available since 2.34._

### `getPeerCredentials`

```ts
getPeerCredentials(): Gio.Credentials | null
```

Gets the credentials of the authenticated peer. This will always
return `null` unless `connection` acted as a server
(e.g. `G_DBUS_CONNECTION_FLAGS_AUTHENTICATION_SERVER` was passed)
when set up and the client passed credentials as part of the
authentication process.

In a message bus setup, the message bus is always the server and
each application is a client. So this method will always return
`null` for message bus clients.

**Returns** a `GCredentials` or `null` if not
    available. Do not free this object, it is owned by `connection`.

_Available since 2.26._

### `getStream`

```ts
getStream(): Gio.IOStream
```

Gets the underlying stream used for IO.

While the `GDBusConnection` is active, it will interact with this
stream from a worker thread, so it is not safe to interact with
the stream directly.

**Returns** the stream used for IO

_Available since 2.26._

### `getUniqueName`

```ts
getUniqueName(): string | null
```

Gets the unique name of `connection` as assigned by the message
bus. This can also be used to figure out if `connection` is a
message bus connection.

**Returns** the unique name or `null` if `connection` is not a message
    bus connection. Do not free this string, it is owned by
    `connection`.

_Available since 2.26._

### `isClosed`

```ts
isClosed(): boolean
```

Gets whether `connection` is closed.

**Returns** `true` if the connection is closed, `false` otherwise

_Available since 2.26._

### `registerObject`

```ts
registerObject(objectPath: string, interfaceInfo: Gio.DBusInterfaceInfo, methodCallClosure: GObject.Closure | null | ClosureCallback, getPropertyClosure: GObject.Closure | null | ClosureCallback, setPropertyClosure: GObject.Closure | null | ClosureCallback): number
```

Version of `g_dbus_connection_register_object()` using closures instead of a
`GDBusInterfaceVTable` for easier binding in other languages.

Note that the reference counting semantics of the function wrapped by
`method_call_closure` are the same as those of
`Gio.DBusInterfaceMethodCallFunc`: ownership of a reference to the
`Gio.DBusMethodInvocation` is transferred to the function.

**Parameters**

- `objectPath`: The object path to register at.
- `interfaceInfo`: Introspection data for the interface.
- `methodCallClosure`: `GClosure` for handling incoming method calls.
- `getPropertyClosure`: `GClosure` for getting a property.
- `setPropertyClosure`: `GClosure` for setting a property.

**Returns** 0 if `error` is set, otherwise a registration ID (never 0)
that can be used with `g_dbus_connection_unregister_object()` .

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 2.84.** Deprecated in favour of `Gio.DBusConnection.registerObjectWithClosures2()`, which has more binding-friendly reference counting semantics.

_Available since 2.46._

### `registerObjectWithClosures2`

```ts
registerObjectWithClosures2(objectPath: string, interfaceInfo: Gio.DBusInterfaceInfo, methodCallClosure: GObject.Closure | null | ClosureCallback, getPropertyClosure: GObject.Closure | null | ClosureCallback, setPropertyClosure: GObject.Closure | null | ClosureCallback): number
```

Version of `Gio.DBusConnection.registerObject()` using closures instead
of a `Gio.DBusInterfaceVTable` for easier binding in other languages.

In contrast to `Gio.DBusConnection.registerObject()` and
`Gio.DBusConnection.registerObjectWithClosures()`, the reference
counting semantics of the function wrapped by `method_call_closure` are *not*
the same as those of `Gio.DBusInterfaceMethodCallFunc`. Ownership of
a reference to the `Gio.DBusMethodInvocation` is *not* transferred to
the function. Bindings must ensure that they add a reference to the
`Gio.DBusMethodInvocation` before calling any
`g_dbus_method_invocation_return_*()` methods on it. This should be automatic
as a result of the introspection annotations on those methods.

**Parameters**

- `objectPath`: The object path to register at.
- `interfaceInfo`: Introspection data for the interface.
- `methodCallClosure`: `GObject.Closure` for handling incoming method calls.
- `getPropertyClosure`: `GObject.Closure` for getting a property.
- `setPropertyClosure`: `GObject.Closure` for setting a property.

**Returns** `0` if `error` is set, otherwise a registration ID (never `0`)
that can be used with `Gio.DBusConnection.unregisterObject()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.84._

### `registerSubtree`

```ts
registerSubtree(objectPath: string, vtable: Gio.DBusSubtreeVTable, flags: Gio.DBusSubtreeFlags, userData: bigint | null, userDataFreeFunc: GLib.DestroyNotify): number
```

Registers a whole subtree of dynamic objects.

The `enumerate` and `introspection` functions in `vtable` are used to
convey, to remote callers, what nodes exist in the subtree rooted
by `object_path`.

When handling remote calls into any node in the subtree, first the
`enumerate` function is used to check if the node exists. If the node exists
or the `G_DBUS_SUBTREE_FLAGS_DISPATCH_TO_UNENUMERATED_NODES` flag is set
the `introspection` function is used to check if the node supports the
requested method. If so, the `dispatch` function is used to determine
where to dispatch the call. The collected `GDBusInterfaceVTable` and
`gpointer` will be used to call into the interface vtable for processing
the request.

All calls into user-provided code will be invoked in the thread-default
main context (see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from.

If an existing subtree is already registered at `object_path` or
then `error` is set to `G_IO_ERROR_EXISTS`.

Note that it is valid to register regular objects (using
`g_dbus_connection_register_object()`) in a subtree registered with
`g_dbus_connection_register_subtree()` - if so, the subtree handler
is tried as the last resort. One way to think about a subtree
handler is to consider it a fallback handler for object paths not
registered via `g_dbus_connection_register_object()` or other bindings.

Note that `vtable` will be copied so you cannot change it after
registration.

See this [server]`Gio.DBusConnection#an-example-for-exporting-a-subtree`
for an example of how to use this method.

**Parameters**

- `objectPath`: the object path to register the subtree at
- `vtable`: a `GDBusSubtreeVTable` to enumerate, introspect and dispatch nodes in the subtree
- `flags`: flags used to fine tune the behavior of the subtree
- `userData`: data to pass to functions in `vtable`
- `userDataFreeFunc`: function to call when the subtree is unregistered

**Returns** 0 if `error` is set, otherwise a subtree registration ID (never 0)
that can be used with `g_dbus_connection_unregister_subtree()`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `removeFilter`

```ts
removeFilter(filterId: number): void
```

Removes a filter.

Note that since filters run in a different thread, there is a race
condition where it is possible that the filter will be running even
after calling `g_dbus_connection_remove_filter()`, so you cannot just
free data that the filter might be using. Instead, you should pass
a `GDestroyNotify` to `g_dbus_connection_add_filter()`, which will be
called when it is guaranteed that the data is no longer needed.

**Parameters**

- `filterId`: an identifier obtained from `g_dbus_connection_add_filter()`

_Available since 2.26._

### `sendMessage`

```ts
sendMessage(message: Gio.DBusMessage, flags: Gio.DBusSendMessageFlags): [boolean, number]
```

Asynchronously sends `message` to the peer represented by `connection`.

Unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag, the serial number
will be assigned by `connection` and set on `message` via
`g_dbus_message_set_serial()`. If `out_serial` is not `null`, then the
serial number used will be written to this location prior to
submitting the message to the underlying transport. While it has a `volatile`
qualifier, this is a historical artifact and the argument passed to it should
not be `volatile`.

If `connection` is closed then the operation will fail with
`G_IO_ERROR_CLOSED`. If `message` is not well-formed,
the operation fails with `G_IO_ERROR_INVALID_ARGUMENT`.

See this [server]`Gio.DBusConnection#an-example-d-bus-server`
and [client]`Gio.DBusConnection#an-example-for-file-descriptor-passing`
for an example of how to use this low-level API to send and receive
UNIX file descriptors.

Note that `message` must be unlocked, unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag.

**Parameters**

- `message`: a `GDBusMessage`
- `flags`: flags affecting how the message is sent

**Returns** Tuple of:

- `result`: `true` if the message was well-formed and queued for transmission, `false` if `error` is set
- `outSerial`: return location for serial number assigned to `message` when sending it or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `sendMessageWithReply`

```ts
sendMessageWithReply(message: Gio.DBusMessage, flags: Gio.DBusSendMessageFlags, timeoutMsec: number, cancellable?: Gio.Cancellable | null): Promise<Gio.DBusMessage>
```

Asynchronously sends `message` to the peer represented by `connection`.

Unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag, the serial number
will be assigned by `connection` and set on `message` via
`g_dbus_message_set_serial()`. If `out_serial` is not `null`, then the
serial number used will be written to this location prior to
submitting the message to the underlying transport. While it has a `volatile`
qualifier, this is a historical artifact and the argument passed to it should
not be `volatile`.

If `connection` is closed then the operation will fail with
`G_IO_ERROR_CLOSED`. If `cancellable` is canceled, the operation will
fail with `G_IO_ERROR_CANCELLED`. If `message` is not well-formed,
the operation fails with `G_IO_ERROR_INVALID_ARGUMENT`.

This is an asynchronous method. When the operation is finished, `callback`
will be invoked in the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from. You can then call
`g_dbus_connection_send_message_with_reply_finish()` to get the result of the operation.
See `g_dbus_connection_send_message_with_reply_sync()` for the synchronous version.

Note that `message` must be unlocked, unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag.

See this [server]`Gio.DBusConnection#an-example-d-bus-server`
and [client]`Gio.DBusConnection#an-example-for-file-descriptor-passing`
for an example of how to use this low-level API to send and receive
UNIX file descriptors.

**Parameters**

- `message`: a `GDBusMessage`
- `flags`: flags affecting how the message is sent
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `cancellable`: a `GCancellable` or `null`

**Returns** a locked `GDBusMessage` or `null` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `sendMessageWithReplyFinish`

```ts
sendMessageWithReplyFinish(res: Gio.AsyncResult): Gio.DBusMessage
```

Finishes an operation started with `g_dbus_connection_send_message_with_reply()`.

Note that `error` is only set if a local in-process error
occurred. That is to say that the returned `GDBusMessage` object may
be of type `G_DBUS_MESSAGE_TYPE_ERROR`. Use
`g_dbus_message_to_gerror()` to transcode this to a `GError`.

See this [server]`Gio.DBusConnection#an-example-d-bus-server`
and [client]`Gio.DBusConnection#an-example-for-file-descriptor-passing`
for an example of how to use this low-level API to send and receive
UNIX file descriptors.

**Parameters**

- `res`: a `GAsyncResult` obtained from the `GAsyncReadyCallback` passed to `g_dbus_connection_send_message_with_reply()`

**Returns** a locked `GDBusMessage` or `null` if `error` is set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `sendMessageWithReplySync`

```ts
sendMessageWithReplySync(message: Gio.DBusMessage, flags: Gio.DBusSendMessageFlags, timeoutMsec: number, cancellable: Gio.Cancellable | null): [Gio.DBusMessage, number]
```

Synchronously sends `message` to the peer represented by `connection`
and blocks the calling thread until a reply is received or the
timeout is reached. See `g_dbus_connection_send_message_with_reply()`
for the asynchronous version of this method.

Unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag, the serial number
will be assigned by `connection` and set on `message` via
`g_dbus_message_set_serial()`. If `out_serial` is not `null`, then the
serial number used will be written to this location prior to
submitting the message to the underlying transport. While it has a `volatile`
qualifier, this is a historical artifact and the argument passed to it should
not be `volatile`.

If `connection` is closed then the operation will fail with
`G_IO_ERROR_CLOSED`. If `cancellable` is canceled, the operation will
fail with `G_IO_ERROR_CANCELLED`. If `message` is not well-formed,
the operation fails with `G_IO_ERROR_INVALID_ARGUMENT`.

Note that `error` is only set if a local in-process error
occurred. That is to say that the returned `GDBusMessage` object may
be of type `G_DBUS_MESSAGE_TYPE_ERROR`. Use
`g_dbus_message_to_gerror()` to transcode this to a `GError`.

See this [server]`Gio.DBusConnection#an-example-d-bus-server`
and [client]`Gio.DBusConnection#an-example-for-file-descriptor-passing`
for an example of how to use this low-level API to send and receive
UNIX file descriptors.

Note that `message` must be unlocked, unless `flags` contain the
`G_DBUS_SEND_MESSAGE_FLAGS_PRESERVE_SERIAL` flag.

**Parameters**

- `message`: a `GDBusMessage`
- `flags`: flags affecting how the message is sent.
- `timeoutMsec`: the timeout in milliseconds, -1 to use the default timeout or `G_MAXINT` for no timeout
- `cancellable`: a `GCancellable` or `null`

**Returns** Tuple of:

- `result`: a locked `GDBusMessage` that is the reply to `message` or `null` if `error` is set
- `outSerial`: return location for serial number assigned to `message` when sending it or `null`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `setExitOnClose`

```ts
setExitOnClose(exitOnClose: boolean): void
```

Sets whether the process should be terminated when `connection` is
closed by the remote peer. See `GDBusConnection.exitOnClose` for
more details.

Note that this function should be used with care. Most modern UNIX
desktops tie the notion of a user session with the session bus, and expect
all of a user's applications to quit when their bus connection goes away.
If you are setting `exit_on_close` to `false` for the shared session
bus connection, you should make sure that your application exits
when the user session ends.

**Parameters**

- `exitOnClose`: whether the process should be terminated when `connection` is closed by the remote peer

_Available since 2.26._

### `signalSubscribe`

```ts
signalSubscribe(sender: string | null, interfaceName: string | null, member: string | null, objectPath: string | null, arg0: string | null, flags: Gio.DBusSignalFlags, callback: Gio.DBusSignalCallback): number
```

Subscribes to signals on `connection` and invokes `callback` whenever
the signal is received. Note that `callback` will be invoked in the
thread-default main context (see `GLib.MainContext.pushThreadDefault()`)
of the thread you are calling this method from.

If `connection` is not a message bus connection, `sender` must be
`null`.

If `sender` is a well-known name note that `callback` is invoked with
the unique name for the owner of `sender`, not the well-known name
as one would expect. This is because the message bus rewrites the
name. As such, to avoid certain race conditions, users should be
tracking the name owner of the well-known name and use that when
processing the received signal.

If one of `G_DBUS_SIGNAL_FLAGS_MATCH_ARG0_NAMESPACE` or
`G_DBUS_SIGNAL_FLAGS_MATCH_ARG0_PATH` are given, `arg0` is
interpreted as part of a namespace or path.  The first argument
of a signal is matched against that part as specified by D-Bus.

If `user_data_free_func` is non-`null`, it will be called (in the
thread-default main context of the thread you are calling this
method from) at some point after `user_data` is no longer
needed. (It is not guaranteed to be called synchronously when the
signal is unsubscribed from, and may be called after `connection`
has been destroyed.)

As `callback` is potentially invoked in a different thread from where it’s
emitted, it’s possible for this to happen after
`g_dbus_connection_signal_unsubscribe()` has been called in another thread.
Due to this, `user_data` should have a strong reference which is freed with
`user_data_free_func`, rather than pointing to data whose lifecycle is tied
to the signal subscription. For example, if a `GObject` is used to store the
subscription ID from `g_dbus_connection_signal_subscribe()`, a strong reference
to that `GObject` must be passed to `user_data`, and `g_object_unref()` passed to
`user_data_free_func`. You are responsible for breaking the resulting
reference count cycle by explicitly unsubscribing from the signal when
dropping the last external reference to the `GObject`. Alternatively, a weak
reference may be used.

It is guaranteed that if you unsubscribe from a signal using
`g_dbus_connection_signal_unsubscribe()` from the same thread which made the
corresponding `g_dbus_connection_signal_subscribe()` call, `callback` will not
be invoked after `g_dbus_connection_signal_unsubscribe()` returns.

The returned subscription identifier is an opaque value which is guaranteed
to never be zero.

This function can never fail.

**Parameters**

- `sender`: sender name to match on (unique or well-known name) or `null` to listen from all senders
- `interfaceName`: D-Bus interface name to match on or `null` to match on all interfaces
- `member`: D-Bus signal name to match on or `null` to match on all signals
- `objectPath`: object path to match on or `null` to match on all object paths
- `arg0`: contents of first string argument to match on or `null` to match on all kinds of arguments
- `flags`: `GDBusSignalFlags` describing how arg0 is used in subscribing to the signal
- `callback`: callback to invoke when there is a signal matching the requested data

**Returns** a subscription identifier that can be used with `g_dbus_connection_signal_unsubscribe()`

_Available since 2.26._

### `signalUnsubscribe`

```ts
signalUnsubscribe(subscriptionId: number): void
```

Unsubscribes from signals.

Note that there may still be D-Bus traffic to process (relating to this
signal subscription) in the current thread-default `GMainContext` after this
function has returned. You should continue to iterate the `GMainContext`
until the `GDestroyNotify` function passed to
`g_dbus_connection_signal_subscribe()` is called, in order to avoid memory
leaks through callbacks queued on the `GMainContext` after it’s stopped being
iterated.
Alternatively, any idle source with a priority lower than `G_PRIORITY_DEFAULT`
that was scheduled after unsubscription, also indicates that all resources
of this subscription are released.

**Parameters**

- `subscriptionId`: a subscription id obtained from `g_dbus_connection_signal_subscribe()`

_Available since 2.26._

### `startMessageProcessing`

```ts
startMessageProcessing(): void
```

If `connection` was created with
`G_DBUS_CONNECTION_FLAGS_DELAY_MESSAGE_PROCESSING`, this method
starts processing messages. Does nothing on if `connection` wasn't
created with this flag or if the method has already been called.

_Available since 2.26._

### `unexportActionGroup`

```ts
unexportActionGroup(exportId: number): void
```

Reverses the effect of a previous call to
`Gio.DBusConnection.exportActionGroup()`.

It is an error to call this function with an ID that wasn’t returned from
`Gio.DBusConnection.exportActionGroup()` or to call it with the same
ID more than once.

**Parameters**

- `exportId`: the ID from `Gio.DBusConnection.exportActionGroup()`

_Available since 2.32._

### `unexportMenuModel`

```ts
unexportMenuModel(exportId: number): void
```

Reverses the effect of a previous call to
`g_dbus_connection_export_menu_model()`.

It is an error to call this function with an ID that wasn't returned
from `g_dbus_connection_export_menu_model()` or to call it with the
same ID more than once.

**Parameters**

- `exportId`: the ID from `g_dbus_connection_export_menu_model()`

_Available since 2.32._

### `unregisterObject`

```ts
unregisterObject(registrationId: number): boolean
```

Unregisters an object.

**Parameters**

- `registrationId`: a registration id obtained from `g_dbus_connection_register_object()`

**Returns** `true` if the object was unregistered, `false` otherwise

_Available since 2.26._

### `unregisterSubtree`

```ts
unregisterSubtree(registrationId: number): boolean
```

Unregisters a subtree.

**Parameters**

- `registrationId`: a subtree registration id obtained from `g_dbus_connection_register_subtree()`

**Returns** `true` if the subtree was unregistered, `false` otherwise

_Available since 2.26._
