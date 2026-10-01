---
description: "A socket address of some unknown native type."
---

# GNativeSocketAddress

A socket address of some unknown native type.

This corresponds to a general `struct sockaddr` of a type not otherwise
handled by GLib.

_Available since 2.46._

```tsx
import { GNativeSocketAddress } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GSocketAddress](.gtkx/reference/gio/socket-address.md) → **GNativeSocketAddress**

Implements `GSocketConnectable`.

## Props

`ref` receives the `Gio.NativeSocketAddress` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
