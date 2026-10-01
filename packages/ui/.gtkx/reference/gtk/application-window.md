---
description: "A GtkWindow subclass that integrates with GtkApplication."
---

# GtkApplicationWindow

A `GtkWindow` subclass that integrates with `GtkApplication`.

Notably, `GtkApplicationWindow` can handle an application menubar.

This class implements the `Gio.ActionGroup` and `Gio.ActionMap`
interfaces, to let you add window-specific actions that will be exported
by the associated `Gtk.Application`, together with its application-wide
actions. Window-specific actions are prefixed with the “win.”
prefix and application-wide actions are prefixed with the “app.”
prefix. Actions must be addressed with the prefixed name when
referring to them from a menu model.

Note that widgets that are placed inside a `GtkApplicationWindow`
can also activate these actions, if they implement the
`Gtk.Actionable` interface.

The settings `Gtk.Settings.gtkShellShowsAppMenu` and
`Gtk.Settings.gtkShellShowsMenubar` tell GTK whether the
desktop environment is showing the application menu and menubar
models outside the application as part of the desktop shell.
For instance, on OS X, both menus will be displayed remotely;
on Windows neither will be.

If the desktop environment does not display the menubar, it can be shown in
the `GtkApplicationWindow` by setting the
`Gtk.ApplicationWindow.showMenubar` property to true. If the
desktop environment does not display the application menu, then it will
automatically be included in the menubar or in the window’s client-side
decorations.

See `Gtk.PopoverMenu` for information about the XML language
used by `GtkBuilder` for menu models.

See also: `Gtk.Application.setMenubar()`.

### A GtkApplicationWindow with a menubar

The code sample below shows how to set up a `GtkApplicationWindow`
with a menu bar defined on the `Gtk.Application`:

```c
GtkApplication *app = gtk_application_new ("org.gtk.test", 0);

GtkBuilder *builder = gtk_builder_new_from_string (
    "<interface>"
    "  <menu id='menubar'>"
    "    <submenu>"
    "      <attribute name='label' translatable='yes'>_Edit</attribute>"
    "      <item>"
    "        <attribute name='label' translatable='yes'>_Copy</attribute>"
    "        <attribute name='action'>win.copy</attribute>"
    "      </item>"
    "      <item>"
    "        <attribute name='label' translatable='yes'>_Paste</attribute>"
    "        <attribute name='action'>win.paste</attribute>"
    "      </item>"
    "    </submenu>"
    "  </menu>"
    "</interface>",
    -1);

GMenuModel *menubar = G_MENU_MODEL (gtk_builder_get_object (builder, "menubar"));
gtk_application_set_menubar (GTK_APPLICATION (app), menubar);
g_object_unref (builder);

// ...

GtkWidget *window = gtk_application_window_new (app);
```

```tsx
import { GtkApplicationWindow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **GtkApplicationWindow**

Implements `GActionGroup`, `GActionMap`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.ApplicationWindow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`ReactNode | null` · from `GActionMap`

`Gio.Action` elements added to the map, removed again by their `name`.

### `prefix`

`string | null` · from `GActionGroup`

Prefix the group's actions are addressed by, such as `win`; defaults to the empty string.

### `showMenubar`

`boolean` · default `false`

If this property is true, the window will display a menubar
unless it is shown by the desktop shell.

See `Gtk.Application.setMenubar()`.

If false, the window will not display a menubar, regardless
of whether the desktop shell is showing it or not.

## Signals

### `onActionAdded`

```ts
(actionName: string, self: Gtk.ApplicationWindow) => void
```

From `GActionGroup`.

Signals that a new action was just added to the group.

This signal is emitted after the action has been added
and is now visible.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionEnabledChanged`

```ts
(actionName: string, enabled: boolean, self: Gtk.ApplicationWindow) => void
```

From `GActionGroup`.

Signals that the enabled status of the named action has changed.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `enabled`: whether the action is enabled
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionRemoved`

```ts
(actionName: string, self: Gtk.ApplicationWindow) => void
```

From `GActionGroup`.

Signals that an action is just about to be removed from the group.

This signal is emitted before the action is removed, so the action
is still visible and can be queried from the signal handler.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionStateChanged`

```ts
(actionName: string, value: GLib.Variant, self: Gtk.ApplicationWindow) => void
```

From `GActionGroup`.

Signals that the state of the named action has changed.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `value`: the new value of the state
- `self`: The instance the signal was emitted on.

_Available since 2.28._

## Methods

Methods are called on the `Gtk.ApplicationWindow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getHelpOverlay`

```ts
getHelpOverlay(): Gtk.ShortcutsWindow | null
```

Gets the `GtkShortcutsWindow` that is associated with `window`.

See `Gtk.ApplicationWindow.setHelpOverlay()`.

**Returns** the help overlay associated
  with the window

> **Deprecated since 4.18.** `GtkShortcutsWindow` will be removed in GTK 5

### `getId`

```ts
getId(): number
```

Returns the unique ID of the window.

 If the window has not yet been added to a `GtkApplication`, returns `0`.

**Returns** the unique ID for the window, or `0` if the window
  has not yet been added to an application

### `getShowMenubar`

```ts
getShowMenubar(): boolean
```

Returns whether the window will display a menubar for the app menu
and menubar as needed.

**Returns** True if the window will display a menubar when needed

### `setHelpOverlay`

```ts
setHelpOverlay(helpOverlay: Gtk.ShortcutsWindow | null): void
```

Associates a shortcuts window with the application window.

Additionally, sets up an action with the name
`win.show-help-overlay` to present it.

The window takes responsibility for destroying the help overlay.

**Parameters**

- `helpOverlay`: a shortcuts window

> **Deprecated since 4.18.** `GtkShortcutsWindow` will be removed in GTK 5

### `setShowMenubar`

```ts
setShowMenubar(showMenubar: boolean): void
```

Sets whether the window will display a menubar for the app menu
and menubar as needed.

**Parameters**

- `showMenubar`: whether to show a menubar when needed
