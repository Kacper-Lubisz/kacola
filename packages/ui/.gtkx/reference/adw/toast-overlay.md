---
description: "A widget showing toasts above its content."
---

# AdwToastOverlay

A widget showing toasts above its content.



Much like `Gtk.Overlay`, `AdwToastOverlay` is a container with a single
main child, on top of which it can display a `Toast`, overlaid.
Toasts can be shown with `ToastOverlay.addToast()`.

Use `ToastOverlay.dismissAll()` to dismiss all toasts at once, or
`Toast.dismiss()` to dismiss a single toast.

See `Toast` for details.

### CSS nodes

```
toastoverlay
├── [child]
├── toast
┊   ├── widget
┊   │   ├── [label.heading]
    │   ╰── [custom title]
    ├── [button]
    ╰── button.circular.flat
```

`AdwToastOverlay`'s CSS node is called `toastoverlay`. It contains the child,
as well as zero or more `toast` subnodes.

Each of the `toast` nodes contains a `widget` subnode, optionally a `button`
subnode, and another `button` subnode with `.circular` and `.flat` style
classes.

The `widget` subnode contains a `label` subnode with the `.heading` style
class, or a custom widget provided by the application.

### Accessibility

`AdwToastOverlay` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwToastOverlay } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwToastOverlay**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ToastOverlay` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Methods

Methods are called on the `Adw.ToastOverlay` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addToast`

```ts
addToast(toast: Adw.Toast): void
```

Displays `toast`.

Only one toast can be shown at a time; if a toast is already being displayed,
either `toast` or the original toast will be placed in a queue, depending on
the priority of `toast`. See `Toast.priority`.

If called on a toast that's already displayed, its timeout will be reset.

If called on a toast currently in the queue, the toast will be bumped
forward to be shown as soon as possible.

**Parameters**

- `toast`: a toast

### `dismissAll`

```ts
dismissAll(): void
```

Dismisses all displayed toasts.

Use `Toast.dismiss()` to dismiss a single toast.

_Available since 1.7._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget
