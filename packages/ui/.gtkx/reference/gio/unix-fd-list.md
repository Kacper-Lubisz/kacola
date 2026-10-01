---
description: "A GUnixFDList contains a list of file descriptors."
---

# GUnixFDList

A `GUnixFDList` contains a list of file descriptors.  It owns the file
descriptors that it contains, closing them when finalized.

It may be wrapped in a
[`GUnixFDMessage`](../gio-unix/class.UnixFDMessage.html) and sent over a
`Gio.Socket` in the `G_SOCKET_FAMILY_UNIX` family by using
`Gio.Socket.sendMessage()` and received using
`Gio.Socket.receiveMessage()`.

Before 2.74, `<gio/gunixfdlist.h>` belonged to the UNIX-specific GIO
interfaces, thus you had to use the `gio-unix-2.0.pc` pkg-config file when
using it.

Since 2.74, the API is available for Windows.

```tsx
import { GUnixFDList } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GUnixFDList**

## Props

`ref` receives the `Gio.UnixFDList` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.UnixFDList` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `append`

```ts
append(fd: number): number
```

Adds a file descriptor to `list`.

The file descriptor is duplicated using `dup()`. You keep your copy
of the descriptor and the copy contained in `list` will be closed
when `list` is finalized.

A possible cause of failure is exceeding the per-process or
system-wide file descriptor limit.

The index of the file descriptor in the list is returned.  If you use
this index with `g_unix_fd_list_get()` then you will receive back a
duplicated copy of the same file descriptor.

**Parameters**

- `fd`: a valid open file descriptor

**Returns** the index of the appended fd in case of success, else -1
         (and `error` is set)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.24._

### `get`

```ts
get(index: number): number
```

Gets a file descriptor out of `list`.

`index_` specifies the index of the file descriptor to get.  It is a
programmer error for `index_` to be out of range; see
`g_unix_fd_list_get_length()`.

The file descriptor is duplicated using `dup()` and set as
close-on-exec before being returned.  You must call `close()` on it
when you are done.

A possible cause of failure is exceeding the per-process or
system-wide file descriptor limit.

**Parameters**

- `index`: the index into the list

**Returns** the file descriptor, or -1 in case of error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.24._

### `getLength`

```ts
getLength(): number
```

Gets the length of `list` (ie: the number of file descriptors
contained within).

**Returns** the length of `list`

_Available since 2.24._

### `peekFds`

```ts
peekFds(): number[]
```

Returns the array of file descriptors that is contained in this
object.

After this call, the descriptors remain the property of `list`.  The
caller must not close them and must not free the array.  The array is
valid only until `list` is changed in any way.

If `length` is non-`null` then it is set to the number of file
descriptors in the returned array. The returned array is also
terminated with -1.

This function never returns `null`. In case there are no file
descriptors contained in `list`, an empty array is returned.

**Returns** an array of file
    descriptors

_Available since 2.24._

### `stealFds`

```ts
stealFds(): number[]
```

Returns the array of file descriptors that is contained in this
object.

After this call, the descriptors are no longer contained in
`list`. Further calls will return an empty list (unless more
descriptors have been added).

The return result of this function must be freed with `g_free()`.
The caller is also responsible for closing all of the file
descriptors.  The file descriptors in the array are set to
close-on-exec.

If `length` is non-`null` then it is set to the number of file
descriptors in the returned array. The returned array is also
terminated with -1.

This function never returns `null`. In case there are no file
descriptors contained in `list`, an empty array is returned.

**Returns** an array of file
    descriptors

_Available since 2.24._
