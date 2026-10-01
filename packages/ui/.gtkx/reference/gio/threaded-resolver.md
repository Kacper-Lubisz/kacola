---
description: "GThreadedResolver is an implementation of GResolver which calls the libc lookup functions in threads to allow them to run asynchronously."
---

# GThreadedResolver

`GThreadedResolver` is an implementation of `GResolver` which calls the libc
lookup functions in threads to allow them to run asynchronously.

_Available since 2.20._

```tsx
import { GThreadedResolver } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GResolver](.gtkx/reference/gio/resolver.md) → **GThreadedResolver**

## Props

`ref` receives the `Gio.ThreadedResolver` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
