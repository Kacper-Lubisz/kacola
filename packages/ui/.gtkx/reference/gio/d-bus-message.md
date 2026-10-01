---
description: "A type for representing D-Bus messages that can be sent or received on a Gio.DBusConnection."
---

# GDBusMessage

A type for representing D-Bus messages that can be sent or received
on a `Gio.DBusConnection`.

_Available since 2.26._

```tsx
import { GDBusMessage } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GDBusMessage**

## Props

`ref` receives the `Gio.DBusMessage` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `locked`

`boolean` · default `false` · read-only, observe with `onNotifyLocked`

## Methods

Methods are called on the `Gio.DBusMessage` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `copy`

```ts
copy(): Gio.DBusMessage
```

Copies `message`. The copy is a deep copy and the returned
`GDBusMessage` is completely identical except that it is guaranteed
to not be locked.

This operation can fail if e.g. `message` contains file descriptors
and the per-process or system-wide open files limit is reached.

**Returns** A new `GDBusMessage` or `null` if `error` is set.
    Free with `g_object_unref()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `getArg0`

```ts
getArg0(): string | null
```

Convenience to get the first item in the body of `message`.

See `Gio.DBusMessage.getArg0Path()` for returning object-path-typed
arg0 values.

**Returns** The string item or `null` if the first item in the body of
`message` is not a string.

_Available since 2.26._

### `getArg0Path`

```ts
getArg0Path(): string | null
```

Convenience to get the first item in the body of `message`.

See `Gio.DBusMessage.getArg0()` for returning string-typed arg0 values.

**Returns** The object path item or `NULL` if the first item in the
  body of `message` is not an object path.

_Available since 2.80._

### `getBody`

```ts
getBody(): GLib.Variant | null
```

Gets the body of a message.

**Returns** A `GVariant` or `null` if the body is
empty. Do not free, it is owned by `message`.

_Available since 2.26._

### `getByteOrder`

```ts
getByteOrder(): Gio.DBusMessageByteOrder
```

Gets the byte order of `message`.

**Returns** The byte order.

### `getDestination`

```ts
getDestination(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_DESTINATION` header field.

**Returns** The value.

_Available since 2.26._

### `getErrorName`

```ts
getErrorName(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_ERROR_NAME` header field.

**Returns** The value.

_Available since 2.26._

### `getFlags`

```ts
getFlags(): Gio.DBusMessageFlags
```

Gets the flags for `message`.

**Returns** Flags that are set (typically values from the `GDBusMessageFlags` enumeration bitwise ORed together).

_Available since 2.26._

### `getHeader`

```ts
getHeader(headerField: Gio.DBusMessageHeaderField): GLib.Variant | null
```

Gets a header field on `message`.

The caller is responsible for checking the type of the returned `GVariant`
matches what is expected.

**Parameters**

- `headerField`: A 8-bit unsigned integer (typically a value from the `GDBusMessageHeaderField` enumeration)

**Returns** A `GVariant` with the value if the header was found, `null`
otherwise. Do not free, it is owned by `message`.

_Available since 2.26._

### `getHeaderFields`

```ts
getHeaderFields(): Uint8Array
```

Gets an array of all header fields on `message` that are set.

**Returns** An array of header fields
terminated by `G_DBUS_MESSAGE_HEADER_FIELD_INVALID`.  Each element
is a `guchar`. Free with `g_free()`.

_Available since 2.26._

### `getInterface`

```ts
getInterface(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_INTERFACE` header field.

**Returns** The value.

_Available since 2.26._

### `getLocked`

```ts
getLocked(): boolean
```

Checks whether `message` is locked. To monitor changes to this
value, connect to the `GObject.notify` signal to listen for changes
on the `GDBusMessage.locked` property.

**Returns** `true` if `message` is locked, `false` otherwise.

_Available since 2.26._

### `getMember`

```ts
getMember(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_MEMBER` header field.

**Returns** The value.

_Available since 2.26._

### `getMessageType`

```ts
getMessageType(): Gio.DBusMessageType
```

Gets the type of `message`.

**Returns** A 8-bit unsigned integer (typically a value from the `GDBusMessageType` enumeration).

_Available since 2.26._

### `getNumUnixFds`

```ts
getNumUnixFds(): number
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_NUM_UNIX_FDS` header field.

**Returns** The value.

_Available since 2.26._

### `getPath`

```ts
getPath(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_PATH` header field.

**Returns** The value.

_Available since 2.26._

### `getReplySerial`

```ts
getReplySerial(): number
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_REPLY_SERIAL` header field.

**Returns** The value.

_Available since 2.26._

### `getSender`

```ts
getSender(): string | null
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_SENDER` header field.

**Returns** The value.

_Available since 2.26._

### `getSerial`

```ts
getSerial(): number
```

Gets the serial for `message`.

**Returns** A `guint32`.

_Available since 2.26._

### `getSignature`

```ts
getSignature(): string
```

Convenience getter for the `G_DBUS_MESSAGE_HEADER_FIELD_SIGNATURE` header field.

This will always be non-`null`, but may be an empty string.

**Returns** The value.

_Available since 2.26._

### `getUnixFdList`

```ts
getUnixFdList(): Gio.UnixFDList | null
```

Gets the UNIX file descriptors associated with `message`, if any.

This method is only available on UNIX.

The file descriptors normally correspond to `G_VARIANT_TYPE_HANDLE`
values in the body of the message. For example,
if `g_variant_get_handle()` returns 5, that is intended to be a reference
to the file descriptor that can be accessed by
`g_unix_fd_list_get (list, 5, ...)`.

**Returns** A `GUnixFDList` or `null` if no file descriptors are
associated. Do not free, this object is owned by `message`.

_Available since 2.26._

### `lock`

```ts
lock(): void
```

If `message` is locked, does nothing. Otherwise locks the message.

_Available since 2.26._

### `newMethodErrorLiteral`

```ts
newMethodErrorLiteral(errorName: string, errorMessage: string): Gio.DBusMessage
```

Creates a new `GDBusMessage` that is an error reply to `method_call_message`.

**Parameters**

- `errorName`: A valid D-Bus error name.
- `errorMessage`: The D-Bus error message.

**Returns** A `GDBusMessage`. Free with `g_object_unref()`.

_Available since 2.26._

### `newMethodReply`

```ts
newMethodReply(): Gio.DBusMessage
```

Creates a new `GDBusMessage` that is a reply to `method_call_message`.

**Returns** `GDBusMessage`. Free with `g_object_unref()`.

_Available since 2.26._

### `print`

```ts
print(indent: number): string
```

Produces a human-readable multi-line description of `message`.

The contents of the description has no ABI guarantees, the contents
and formatting is subject to change at any time. Typical output
looks something like this:
```
Flags:   none
Version: 0
Serial:  4
Headers:
  path -> objectpath '/org/gtk/GDBus/TestObject'
  interface -> 'org.gtk.GDBus.TestInterface'
  member -> 'GimmeStdout'
  destination -> ':1.146'
Body: ()
UNIX File Descriptors:
  (none)
```
or
```
Flags:   no-reply-expected
Version: 0
Serial:  477
Headers:
  reply-serial -> uint32 4
  destination -> ':1.159'
  sender -> ':1.146'
  num-unix-fds -> uint32 1
Body: ()
UNIX File Descriptors:
  fd 12: dev=0:10,mode=020620,ino=5,uid=500,gid=5,rdev=136:2,size=0,atime=1273085037,mtime=1273085851,ctime=1272982635
```

**Parameters**

- `indent`: Indentation level.

**Returns** A string that should be freed with `GLib.free()`.

_Available since 2.26._

### `setBody`

```ts
setBody(body: GLib.Variant): void
```

Sets the body `message`. As a side-effect the
`G_DBUS_MESSAGE_HEADER_FIELD_SIGNATURE` header field is set to the
type string of `body` (or cleared if `body` is `null`).

If `body` is floating, `message` assumes ownership of `body`.

**Parameters**

- `body`: Either `null` or a `GVariant` that is a tuple.

_Available since 2.26._

### `setByteOrder`

```ts
setByteOrder(byteOrder: Gio.DBusMessageByteOrder): void
```

Sets the byte order of `message`.

**Parameters**

- `byteOrder`: The byte order.

### `setDestination`

```ts
setDestination(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_DESTINATION` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setErrorName`

```ts
setErrorName(value: string): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_ERROR_NAME` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setFlags`

```ts
setFlags(flags: Gio.DBusMessageFlags): void
```

Sets the flags to set on `message`.

**Parameters**

- `flags`: Flags for `message` that are set (typically values from the `GDBusMessageFlags` enumeration bitwise ORed together).

_Available since 2.26._

### `setHeader`

```ts
setHeader(headerField: Gio.DBusMessageHeaderField, value: GLib.Variant | null): void
```

Sets a header field on `message`.

If `value` is floating, `message` assumes ownership of `value`.

**Parameters**

- `headerField`: A 8-bit unsigned integer (typically a value from the `GDBusMessageHeaderField` enumeration)
- `value`: A `GVariant` to set the header field or `null` to clear the header field.

_Available since 2.26._

### `setInterface`

```ts
setInterface(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_INTERFACE` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setMember`

```ts
setMember(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_MEMBER` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setMessageType`

```ts
setMessageType(type: Gio.DBusMessageType): void
```

Sets `message` to be of `type`.

**Parameters**

- `type`: A 8-bit unsigned integer (typically a value from the `GDBusMessageType` enumeration).

_Available since 2.26._

### `setNumUnixFds`

```ts
setNumUnixFds(value: number): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_NUM_UNIX_FDS` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setPath`

```ts
setPath(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_PATH` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setReplySerial`

```ts
setReplySerial(value: number): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_REPLY_SERIAL` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setSender`

```ts
setSender(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_SENDER` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setSerial`

```ts
setSerial(serial: number): void
```

Sets the serial for `message`.

The [D-Bus specification](https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-messages)
does not allow the `serial` to be zero.

**Parameters**

- `serial`: A `guint32`, which must not be zero.

_Available since 2.26._

### `setSignature`

```ts
setSignature(value: string | null): void
```

Convenience setter for the `G_DBUS_MESSAGE_HEADER_FIELD_SIGNATURE` header field.

**Parameters**

- `value`: The value to set.

_Available since 2.26._

### `setUnixFdList`

```ts
setUnixFdList(fdList: Gio.UnixFDList | null): void
```

Sets the UNIX file descriptors associated with `message`. As a
side-effect the `G_DBUS_MESSAGE_HEADER_FIELD_NUM_UNIX_FDS` header
field is set to the number of fds in `fd_list` (or cleared if
`fd_list` is `null`).

This method is only available on UNIX.

When designing D-Bus APIs that are intended to be interoperable,
please note that non-GDBus implementations of D-Bus can usually only
access file descriptors if they are referenced by a value of type
`G_VARIANT_TYPE_HANDLE` in the body of the message.

**Parameters**

- `fdList`: A `GUnixFDList` or `null`.

_Available since 2.26._

### `toBlob`

```ts
toBlob(capabilities: Gio.DBusCapabilityFlags): Uint8Array
```

Serializes `message` to a blob. The byte order returned by
`g_dbus_message_get_byte_order()` will be used.

**Parameters**

- `capabilities`: A `GDBusCapabilityFlags` describing what protocol features are supported.

**Returns** A pointer to a
valid binary D-Bus message of `out_size` bytes generated by `message`
or `null` if `error` is set. Free with `g_free()`.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `toGerror`

```ts
toGerror(): boolean
```

If `message` is not of type `G_DBUS_MESSAGE_TYPE_ERROR` does
nothing and returns `false`.

Otherwise this method encodes the error in `message` as a `GError`
using `g_dbus_error_set_dbus_error()` using the information in the
`G_DBUS_MESSAGE_HEADER_FIELD_ERROR_NAME` header field of `message` as
well as the first string item in `message`'s body.

**Returns** `true` if `error` was set, `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._
