---
description: "Activates a named action."
---

# GtkNamedAction

Activates a named action.

See `Gtk.WidgetClass.installAction()` and
`Gtk.Widget.insertActionGroup()` for ways
to associate named actions with widgets.

```tsx
import { GtkNamedAction } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkShortcutAction](.gtkx/reference/gtk/shortcut-action.md) → **GtkNamedAction**

## Props

`ref` receives the `Gtk.NamedAction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · construct-only

The name of the action to activate.

## Methods

Methods are called on the `Gtk.NamedAction` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActionName`

```ts
getActionName(): string
```

Returns the name of the action that will be activated.

**Returns** the name of the action to activate
