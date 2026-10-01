---
description: "The GSettingsBackend interface defines a generic interface for non-strictly-typed data that is stored in a hierarchy."
---

# GSettingsBackend

The `GSettingsBackend` interface defines a generic interface for
non-strictly-typed data that is stored in a hierarchy. To implement
an alternative storage backend for `Gio.Settings`, you need to
implement the `GSettingsBackend` interface and then make it implement the
extension point `G_SETTINGS_BACKEND_EXTENSION_POINT_NAME`.

The interface defines methods for reading and writing values, a
method for determining if writing of certain values will fail
(lockdown) and a change notification mechanism.

The semantics of the interface are very precisely defined and
implementations must carefully adhere to the expectations of
callers that are documented on each of the interface methods.

Some of the `GSettingsBackend` functions accept or return a
`GLib.Tree`. These trees always have strings as keys and
`GLib.Variant` as values.

The `GSettingsBackend` API is exported to allow third-party
implementations, but does not carry the same stability guarantees
as the public GIO API. For this reason, you have to define the
C preprocessor symbol `G_SETTINGS_ENABLE_BACKEND` before including
`gio/gsettingsbackend.h`.

```tsx
import { GSettingsBackend } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSettingsBackend**

## Props

`ref` receives the `Gio.SettingsBackend` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.SettingsBackend` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(key: string, originTag: bigint | null): void
```

Signals that a single key has possibly changed.  Backend
implementations should call this if a key has possibly changed its
value.

`key` must be a valid key (ie starting with a slash, not containing
'//', and not ending with a slash).

The implementation must call this function during any call to
`g_settings_backend_write()`, before the call returns (except in the
case that no keys are actually changed and it cares to detect this
fact).  It may not rely on the existence of a mainloop for
dispatching the signal later.

The implementation may call this function at any other time it likes
in response to other events (such as changes occurring outside of the
program).  These calls may originate from a mainloop or may originate
in response to any other action (including from calls to
`g_settings_backend_write()`).

In the case that this call is in response to a call to
`g_settings_backend_write()` then `origin_tag` must be set to the same
value that was passed to that call.

**Parameters**

- `key`: the name of the key
- `originTag`: the origin tag

_Available since 2.26._

### `changedTree`

```ts
changedTree(tree: GLib.Tree, originTag: bigint | null): void
```

This call is a convenience wrapper.  It gets the list of changes from
`tree`, computes the longest common prefix and calls
`g_settings_backend_changed()`.

**Parameters**

- `tree`: a `GTree` containing the changes
- `originTag`: the origin tag

_Available since 2.26._

### `keysChanged`

```ts
keysChanged(path: string, items: string[], originTag: bigint | null): void
```

Signals that a list of keys have possibly changed.  Backend
implementations should call this if keys have possibly changed their
values.

`path` must be a valid path (ie starting and ending with a slash and
not containing '//').  Each string in `items` must form a valid key
name when `path` is prefixed to it (ie: each item must not start or
end with '/' and must not contain '//').

The meaning of this signal is that any of the key names resulting
from the concatenation of `path` with each item in `items` may have
changed.

The same rules for when notifications must occur apply as per
`g_settings_backend_changed()`.  These two calls can be used
interchangeably if exactly one item has changed (although in that
case `g_settings_backend_changed()` is definitely preferred).

For efficiency reasons, the implementation should strive for `path` to
be as long as possible (ie: the longest common prefix of all of the
keys that were changed) but this is not strictly required.

**Parameters**

- `path`: the path containing the changes
- `items`: the `null`-terminated list of changed keys
- `originTag`: the origin tag

_Available since 2.26._

### `pathChanged`

```ts
pathChanged(path: string, originTag: bigint | null): void
```

Signals that all keys below a given path may have possibly changed.
Backend implementations should call this if an entire path of keys
have possibly changed their values.

`path` must be a valid path (ie starting and ending with a slash and
not containing '//').

The meaning of this signal is that any of the key which has a name
starting with `path` may have changed.

The same rules for when notifications must occur apply as per
`g_settings_backend_changed()`.  This call might be an appropriate
reasponse to a 'reset' call but implementations are also free to
explicitly list the keys that were affected by that call if they can
easily do so.

For efficiency reasons, the implementation should strive for `path` to
be as long as possible (ie: the longest common prefix of all of the
keys that were changed) but this is not strictly required.  As an
example, if this function is called with the path of "/" then every
single key in the application will be notified of a possible change.

**Parameters**

- `path`: the path containing the changes
- `originTag`: the origin tag

_Available since 2.26._

### `pathWritableChanged`

```ts
pathWritableChanged(path: string): void
```

Signals that the writability of all keys below a given path may have
changed.

Since GSettings performs no locking operations for itself, this call
will always be made in response to external events.

**Parameters**

- `path`: the name of the path

_Available since 2.26._

### `writableChanged`

```ts
writableChanged(key: string): void
```

Signals that the writability of a single key has possibly changed.

Since GSettings performs no locking operations for itself, this call
will always be made in response to external events.

**Parameters**

- `key`: the name of the key

_Available since 2.26._
