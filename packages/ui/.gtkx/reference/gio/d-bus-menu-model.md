---
description: "GDBusMenuModel is an implementation of Gio.MenuModel that can be used as a proxy for a menu model that is exported over D-Bus with Gio.DBusConnection.exportMenuModel()."
---

# GDBusMenuModel

`GDBusMenuModel` is an implementation of `Gio.MenuModel` that can be
used as a proxy for a menu model that is exported over D-Bus with
`Gio.DBusConnection.exportMenuModel()`.

```tsx
import { GDBusMenuModel } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GMenuModel](.gtkx/reference/gio/menu-model.md) → **GDBusMenuModel**

## Props

`ref` receives the `Gio.DBusMenuModel` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.
