---
description: "Instances of the GDBusMethodInvocation class are used when handling D-Bus method calls."
---

# GDBusMethodInvocation

Instances of the `GDBusMethodInvocation` class are used when
handling D-Bus method calls. It provides a way to asynchronously
return results and errors.

The normal way to obtain a `GDBusMethodInvocation` object is to receive
it as an argument to the `handle_method_call()` function in a
`Gio.DBusInterfaceVTable` that was passed to
`Gio.DBusConnection.registerObject()`.

_Available since 2.26._

```tsx
import { GDBusMethodInvocation } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusMethodInvocation**

## Props

`ref` receives the `Gio.DBusMethodInvocation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.DBusMethodInvocation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getConnection`

```ts
getConnection(): Gio.DBusConnection
```

Gets the `GDBusConnection` the method was invoked on.

**Returns** A `GDBusConnection`. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getInterfaceName`

```ts
getInterfaceName(): string | null
```

Gets the name of the D-Bus interface the method was invoked on.

This can be `NULL` if it was not specified by the sender. See
`Gio.DBusInterfaceMethodCallFunc` or the
[D-Bus Specification](https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-types-method)
for details on when this can happen and how it should be handled.

If this method call is a property Get, Set or GetAll call that has
been redirected to the method call handler then
"org.freedesktop.DBus.Properties" will be returned.  See
`GDBusInterfaceVTable` for more information.

**Returns** A string. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getMessage`

```ts
getMessage(): Gio.DBusMessage
```

Gets the `GDBusMessage` for the method invocation. This is useful if
you need to use low-level protocol features, such as UNIX file
descriptor passing, that cannot be properly expressed in the
`GVariant` API.

See this [server]`Gio.DBusConnection#an-example-d-bus-server`
and [client]`Gio.DBusConnection#an-example-for-file-descriptor-passing`
for an example of how to use this low-level API to send and receive
UNIX file descriptors.

**Returns** `GDBusMessage`. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getMethodInfo`

```ts
getMethodInfo(): Gio.DBusMethodInfo | null
```

Gets information about the method call, if any.

If this method invocation is a property Get, Set or GetAll call that
has been redirected to the method call handler then `null` will be
returned.  See `g_dbus_method_invocation_get_property_info()` and
`GDBusInterfaceVTable` for more information.

**Returns** A `GDBusMethodInfo` or `null`. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getMethodName`

```ts
getMethodName(): string
```

Gets the name of the method that was invoked.

**Returns** A string. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getObjectPath`

```ts
getObjectPath(): string
```

Gets the object path the method was invoked on.

**Returns** A string. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `getParameters`

```ts
getParameters(): GLib.Variant
```

Gets the parameters of the method invocation. If there are no input
parameters then this will return a GVariant with 0 children rather than NULL.

**Returns** A `GVariant` tuple. Do not unref this because it is owned by `invocation`.

_Available since 2.26._

### `getPropertyInfo`

```ts
getPropertyInfo(): Gio.DBusPropertyInfo | null
```

Gets information about the property that this method call is for, if
any.

This will only be set in the case of an invocation in response to a
property Get or Set call that has been directed to the method call
handler for an object on account of its `property_get()` or
`property_set()` vtable pointers being unset.

See `GDBusInterfaceVTable` for more information.

If the call was GetAll, `null` will be returned.

**Returns** a `GDBusPropertyInfo` or `null`

_Available since 2.38._

### `getSender`

```ts
getSender(): string | null
```

Gets the bus name that invoked the method.

This can return `null` if not specified by the caller, e.g. on peer-to-peer
connections.

**Returns** A string. Do not free, it is owned by `invocation`.

_Available since 2.26._

### `returnDbusError`

```ts
returnDbusError(errorName: string, errorMessage: string): void
```

Finishes handling a D-Bus method call by returning an error.

This method will take ownership of `invocation`. See
`GDBusInterfaceVTable` for more information about the ownership of
`invocation`.

**Parameters**

- `errorName`: A valid D-Bus error name.
- `errorMessage`: A valid D-Bus error message.

_Available since 2.26._

### `returnErrorLiteral`

```ts
returnErrorLiteral(domain: GLib.Quark, code: number, message: string): void
```

Like `g_dbus_method_invocation_return_error()` but without `printf()`-style formatting.

This method will take ownership of `invocation`. See
`GDBusInterfaceVTable` for more information about the ownership of
`invocation`.

**Parameters**

- `domain`: A `GQuark` for the `GError` error domain.
- `code`: The error code.
- `message`: The error message.

_Available since 2.26._

### `returnGerror`

```ts
returnGerror(error: GLib.Error): void
```

Like `g_dbus_method_invocation_return_error()` but takes a `GError`
instead of the error domain, error code and message.

This method will take ownership of `invocation`. See
`GDBusInterfaceVTable` for more information about the ownership of
`invocation`.

**Parameters**

- `error`: A `GError`.

_Available since 2.26._

### `returnValue`

```ts
returnValue(parameters: GLib.Variant | null): void
```

Finishes handling a D-Bus method call by returning `parameters`.
If the `parameters` GVariant is floating, it is consumed.

It is an error if `parameters` is not of the right format: it must be a tuple
containing the out-parameters of the D-Bus method. Even if the method has a
single out-parameter, it must be contained in a tuple. If the method has no
out-parameters, `parameters` may be `null` or an empty tuple.

```c
GDBusMethodInvocation *invocation = some_invocation;
g_autofree gchar *result_string = NULL;
g_autoptr (GError) error = NULL;

result_string = calculate_result (&error);

if (error != NULL)
  g_dbus_method_invocation_return_gerror (invocation, error);
else
  g_dbus_method_invocation_return_value (invocation,
                                         g_variant_new ("(s)", result_string));

// Do not free @invocation here; returning a value does that
```

This method will take ownership of `invocation`. See
`GDBusInterfaceVTable` for more information about the ownership of
`invocation`.

Since 2.48, if the method call requested for a reply not to be sent
then this call will sink `parameters` and free `invocation`, but
otherwise do nothing (as per the recommendations of the D-Bus
specification).

**Parameters**

- `parameters`: A `GVariant` tuple with out parameters for the method or `null` if not passing any parameters.

_Available since 2.26._

### `returnValueWithUnixFdList`

```ts
returnValueWithUnixFdList(parameters: GLib.Variant | null, fdList: Gio.UnixFDList | null): void
```

Like `g_dbus_method_invocation_return_value()` but also takes a `GUnixFDList`.

This method is only available on UNIX.

This method will take ownership of `invocation`. See
`GDBusInterfaceVTable` for more information about the ownership of
`invocation`.

**Parameters**

- `parameters`: A `GVariant` tuple with out parameters for the method or `null` if not passing any parameters.
- `fdList`: A `GUnixFDList` or `null`.

_Available since 2.30._
