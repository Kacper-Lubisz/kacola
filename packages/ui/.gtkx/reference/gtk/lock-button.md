---
description: "GtkLockButton is a widget to obtain and revoke authorizations needed to operate the controls."
---

# GtkLockButton

`GtkLockButton` is a widget to obtain and revoke authorizations
needed to operate the controls.



It is typically used in preference dialogs or control panels.

The required authorization is represented by a `GPermission` object.
Concrete implementations of `GPermission` may use PolicyKit or some
other authorization framework. To obtain a PolicyKit-based
`GPermission`, use `polkit_permission_new()`.

If the user is not currently allowed to perform the action, but can
obtain the permission, the widget looks like this:



and the user can click the button to request the permission. Depending
on the platform, this may pop up an authentication dialog or ask the user
to authenticate in some other way. Once the user has obtained the permission,
the widget changes to this:



and the permission can be dropped again by clicking the button. If the user
is not able to obtain the permission at all, the widget looks like this:



If the user has the permission and cannot drop it, the button is hidden.

The text (and tooltips) that are shown in the various cases can be adjusted
with the `Gtk.LockButton.textLock`,
`Gtk.LockButton.textUnlock`,
`Gtk.LockButton.tooltipLock`,
`Gtk.LockButton.tooltipUnlock` and
`Gtk.LockButton.tooltipNotAuthorized` properties.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

```tsx
import { GtkLockButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkButton](.gtkx/reference/gtk/button.md) → **GtkLockButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.LockButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `permission`

`Gio.Permission | ReactElement` · deprecated since 4.10

The `GPermission object controlling this button.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `textLock`

`string` · default `Lock` · deprecated since 4.10

The text to display when prompting the user to lock.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `textUnlock`

`string` · default `Unlock` · deprecated since 4.10

The text to display when prompting the user to unlock.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `tooltipLock`

`string` · default `Dialog is unlocked.\nClick to prevent further changes` · deprecated since 4.10

The tooltip to display when prompting the user to lock.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `tooltipNotAuthorized`

`string` · default `System policy prevents changes.\nContact your system administrator` · deprecated since 4.10

The tooltip to display when the user cannot obtain authorization.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `tooltipUnlock`

`string` · default `Dialog is locked.\nClick to make changes` · deprecated since 4.10

The tooltip to display when prompting the user to unlock.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.LockButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getPermission`

```ts
getPermission(): Gio.Permission | null
```

Obtains the `GPermission` object that controls `button`.

**Returns** the `GPermission` of `button`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setPermission`

```ts
setPermission(permission: Gio.Permission | null): void
```

Sets the `GPermission` object that controls `button`.

**Parameters**

- `permission`: a `GPermission` object

> **Deprecated since 4.10.** This widget will be removed in GTK 5
