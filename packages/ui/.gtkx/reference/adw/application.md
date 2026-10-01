---
description: "A base class for Adwaita applications."
---

# AdwApplication

A base class for Adwaita applications.

`AdwApplication` handles library initialization by calling `init()` in the
default `Gio.Application.startup` signal handler, in turn chaining up
as required by `Gtk.Application`. Therefore, any subclass of
`AdwApplication` should always chain up its `startup` handler before using
any Adwaita or GTK API.

### Automatic Resources

`AdwApplication` will automatically load certain resources located in the
application's resource base path (see
`Gio.Application.setResourceBasePath()`, if they're present.

#### Shortcuts Dialog

If there's a resource located at `shortcuts-dialog.ui` which defines an
`ShortcutsDialog` with the ID `shortcuts_dialog`, `AdwApplication`
will set up an `app.shortcuts` action that creates and presents this dialog,
as well as a <kbd>Ctrl</kbd><kbd>?</kbd> accelerator for it.

#### Stylesheet

If there's a resource located at `style.css`, `AdwApplication` will load
styles from it. This can be used to add custom styles to the application.

##### Additional styles (deprecated)

`AdwApplication` will also load the following stylesheets conditionally:

- `style-dark.css` when `StyleManager.dark` is `TRUE`.

- `style-hc.css` when the system high contrast preference is enabled.

- `style-hc-dark.css` when the system high contrast preference is enabled and
  `StyleManager.dark` is `TRUE`.

:::warning
    These resources are deprecated since 1.9.

    Use `style.css` with the following media queries instead:

    - `prefers-color-scheme: dark` for styles used only for dark appearance.
    - `prefers-contrast: more` for styles used only when the system high
      contrast preference is enabled.

```tsx
import { AdwApplication } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GApplication](.gtkx/reference/gio/application.md) → [GtkApplication](.gtkx/reference/gtk/application.md) → **AdwApplication**

Implements `GActionGroup`, `GActionMap`.

## Props

`ref` receives the `Adw.Application` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `styleManager`

`Adw.StyleManager` · read-only, observe with `onNotifyStyleManager`

The style manager for this application.

This is a convenience property allowing to access `AdwStyleManager` through
property bindings or expressions.

## Methods

Methods are called on the `Adw.Application` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getStyleManager`

```ts
getStyleManager(): Adw.StyleManager
```

Gets the style manager for `self`.

This is a convenience property allowing to access `AdwStyleManager` through
property bindings or expressions.

**Returns** the style manager
