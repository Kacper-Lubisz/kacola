---
description: "GSimplePermission is a trivial implementation of Gio.Permission that represents a permission that is either always or never allowed."
---

# GSimplePermission

`GSimplePermission` is a trivial implementation of `Gio.Permission`
that represents a permission that is either always or never allowed.  The
value is given at construction and doesn’t change.

Calling `Gio.Permission.acquire()` or `Gio.Permission.release()`
on a `GSimplePermission` will result in errors.

```tsx
import { GSimplePermission } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GPermission](.gtkx/reference/gio/permission.md) → **GSimplePermission**

## Props

`ref` receives the `Gio.SimplePermission` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
