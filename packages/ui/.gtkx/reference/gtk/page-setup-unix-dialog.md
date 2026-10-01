---
description: "Presents a page setup dialog for platforms which don’t provide a native page setup dialog, like Unix."
---

# GtkPageSetupUnixDialog

Presents a page setup dialog for platforms which don’t provide
a native page setup dialog, like Unix.



It can be used very much like any other GTK dialog, at the
cost of the portability offered by the high-level printing
API in `Gtk.PrintOperation`.

### CSS nodes

`GtkPageSetupUnixDialog` has a single CSS node with the name `window` and
style class `.pagesetup`.

```tsx
import { GtkPageSetupUnixDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkDialog](.gtkx/reference/gtk/dialog.md) → **GtkPageSetupUnixDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.PageSetupUnixDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.PageSetupUnixDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getPageSetup`

```ts
getPageSetup(): Gtk.PageSetup
```

Gets the currently selected page setup from the dialog.

**Returns** the current page setup

### `getPrintSettings`

```ts
getPrintSettings(): Gtk.PrintSettings | null
```

Gets the current print settings from the dialog.

**Returns** the current print settings

### `setPageSetup`

```ts
setPageSetup(pageSetup: Gtk.PageSetup): void
```

Sets the `GtkPageSetup` from which the page setup
dialog takes its values.

**Parameters**

- `pageSetup`: a `GtkPageSetup`

### `setPrintSettings`

```ts
setPrintSettings(printSettings: Gtk.PrintSettings | null): void
```

Sets the `GtkPrintSettings` from which the page setup dialog
takes its values.

**Parameters**

- `printSettings`: a `GtkPrintSettings`
