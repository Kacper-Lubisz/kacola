---
description: "The GCredentials type is a reference-counted wrapper for native credentials."
---

# GCredentials

The `GCredentials` type is a reference-counted wrapper for native
credentials.

The information in `GCredentials` is typically used for identifying,
authenticating and authorizing other processes.

Some operating systems supports looking up the credentials of the remote
peer of a communication endpoint - see e.g. `Gio.Socket.getCredentials()`.

Some operating systems supports securely sending and receiving
credentials over a Unix Domain Socket, see `Gio.UnixCredentialsMessage`,
`Gio.UnixConnection.sendCredentials()` and
`Gio.UnixConnection.receiveCredentials()` for details.

On Linux, the native credential type is a `struct ucred` - see the
[`unix(7)` man page](man:unix(7)) for details. This corresponds to
`G_CREDENTIALS_TYPE_LINUX_UCRED`.

On Apple operating systems (including iOS, tvOS, and macOS), the native credential
type is a `struct xucred`. This corresponds to `G_CREDENTIALS_TYPE_APPLE_XUCRED`.

On FreeBSD, Debian GNU/kFreeBSD, and GNU/Hurd, the native credential type is a
`struct cmsgcred`. This corresponds to `G_CREDENTIALS_TYPE_FREEBSD_CMSGCRED`.

On NetBSD, the native credential type is a `struct unpcbid`.
This corresponds to `G_CREDENTIALS_TYPE_NETBSD_UNPCBID`.

On OpenBSD, the native credential type is a `struct sockpeercred`.
This corresponds to `G_CREDENTIALS_TYPE_OPENBSD_SOCKPEERCRED`.

On Solaris (including OpenSolaris and its derivatives), the native credential type
is a `ucred_t`. This corresponds to `G_CREDENTIALS_TYPE_SOLARIS_UCRED`.

Since GLib 2.72, on Windows, the native credentials may contain the PID of a
process. This corresponds to `G_CREDENTIALS_TYPE_WIN32_PID`.

_Available since 2.26._

```tsx
import { GCredentials } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GCredentials**

## Props

`ref` receives the `Gio.Credentials` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.Credentials` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getUnixPid`

```ts
getUnixPid(): number
```

Tries to get the UNIX process identifier from `credentials`. This
method is only available on UNIX platforms.

This operation can fail if `GCredentials` is not supported on the
OS or if the native credentials type does not contain information
about the UNIX process ID.

**Returns** The UNIX process ID, or `-1` if `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `getUnixUser`

```ts
getUnixUser(): number
```

Tries to get the UNIX user identifier from `credentials`. This
method is only available on UNIX platforms.

This operation can fail if `GCredentials` is not supported on the
OS or if the native credentials type does not contain information
about the UNIX user.

As the signedness of `uid_t` is not specified by POSIX, it is recommended to
check `error` for failure rather than trying to check the return value,
particularly in language bindings.

**Returns** The UNIX user identifier or `(uid_t) -1` if `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `isSameUser`

```ts
isSameUser(otherCredentials: Gio.Credentials): boolean
```

Checks if `credentials` and `other_credentials` is the same user.

This operation can fail if `GCredentials` is not supported on the
the OS.

**Parameters**

- `otherCredentials`: A `GCredentials`.

**Returns** `true` if `credentials` and `other_credentials` has the same
user, `false` otherwise or if `error` is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `setNative`

```ts
setNative(nativeType: Gio.CredentialsType, native: bigint): void
```

Copies the native credentials of type `native_type` from `native`
into `credentials`.

It is a programming error (which will cause a warning to be
logged) to use this method if there is no `GCredentials` support for
the OS or if `native_type` isn't supported by the OS.

**Parameters**

- `nativeType`: The type of native credentials to set.
- `native`: A pointer to native credentials.

_Available since 2.26._

### `setUnixUser`

```ts
setUnixUser(uid: number): boolean
```

Tries to set the UNIX user identifier on `credentials`. This method
is only available on UNIX platforms.

This operation can fail if `GCredentials` is not supported on the
OS or if the native credentials type does not contain information
about the UNIX user. It can also fail if the OS does not allow the
use of "spoofed" credentials.

**Parameters**

- `uid`: The UNIX user identifier to set.

**Returns** `true` if `uid` was set, `false` if error is set.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.26._

### `toString`

```ts
toString(): string
```

Creates a human-readable textual representation of `credentials`
that can be used in logging and debug messages. The format of the
returned string may change in future GLib release.

**Returns** A string that should be freed with `g_free()`.

_Available since 2.26._
