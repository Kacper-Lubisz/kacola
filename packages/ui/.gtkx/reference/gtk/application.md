---
description: "A high-level API for writing applications."
---

# GtkApplication

A high-level API for writing applications.

`GtkApplication` supports many aspects of writing a GTK application
in a convenient fashion, without enforcing a one-size-fits-all model.

Currently, it handles GTK initialization, application uniqueness, session
management, provides some basic scriptability and desktop shell integration
by exporting actions and menus and manages a list of toplevel windows whose
life-cycle is automatically tied to the life-cycle of your application.

While `GtkApplication` works fine with plain `Gtk.Window`s,
it is recommended to use it together with `Gtk.ApplicationWindow`.

### Initialization

A typical `GtkApplication` will create a window in its
`GIO.Application.activate`, `GIO.Application.open`
or `GIO.Application.command-line` handlers. Note that all
of these signals may be emitted multiple times, so handlers must
be careful to take existing windows into account.

A typical ::activate handler should look like this:

```
static void
activate (GApplication *gapp)
{
  GtkApplication *app = GTK_APPLICATION (gapp);
  GtkWindow *window;

  window = gtk_application_get_active_window (app);
  if (!window)
    window = create_window (app);

  gtk_window_present (window);
}
```

### Automatic resources

`GtkApplication` will automatically load menus from the `GtkBuilder`
resource located at "gtk/menus.ui", relative to the application's
resource base path (see `Gio.Application.setResourceBasePath()`).
The menu with the ID "menubar" is taken as the application's
menubar. Additional menus (most interesting submenus) can be named
and accessed via `Gtk.Application.getMenuById()` which allows for
dynamic population of a part of the menu structure.

Note that automatic resource loading uses the resource base path
that is set at construction time and will not work if the resource
base path is changed at a later time.

It is also possible to provide the menubar manually using
`Gtk.Application.setMenubar()`.

`GtkApplication` will also automatically setup an icon search path for
the default icon theme by appending "icons" to the resource base
path. This allows your application to easily store its icons as
resources. See `Gtk.IconTheme.addResourcePath()` for more
information.

If there is a resource located at `gtk/help-overlay.ui` which
defines a `Gtk.ShortcutsWindow` with ID `help_overlay` then
`GtkApplication` associates an instance of this shortcuts window with
each `Gtk.ApplicationWindow` and sets up the keyboard accelerator
<kbd>Control</kbd>+<kbd>?</kbd> to open it. To create a menu item that
displays the shortcuts window, associate the item with the action
`win.show-help-overlay`.

`GtkApplication` will also automatically set the application id as the
default window icon. Use `Gtk.Window.setDefaultIconName()` or
`Gtk.Window.iconName` to override that behavior.

## Inhibiting

An application can block various ways to end the session with
the `Gtk.Application.inhibit()` function. Typical use cases for
this kind of inhibiting are long-running, uninterruptible operations,
such as burning a CD or performing a disk backup. The session
manager may not honor the inhibitor, but it can be expected to
inform the user about the negative consequences of ending the
session while inhibitors are present.

### A simple application

[A simple example](https://gitlab.gnome.org/GNOME/gtk/tree/main/examples/bp/bloatpad.c)
is available in the GTK source code repository

### See Also

- [Using GtkApplication](https://developer.gnome.org/documentation/tutorials/application.html)
- [Getting Started with GTK: Basics](getting_started.html#basics)

```tsx
import { GtkApplication } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GApplication](.gtkx/reference/gio/application.md) → **GtkApplication**

Implements `GActionGroup`, `GActionMap`.

## Props

`ref` receives the `Gtk.Application` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionAccels`

`ActionAccel[] | null`

Accelerators bound to the application's actions.

### `activeWindow`

`Gtk.Window` · read-only, observe with `onNotifyActiveWindow`

The currently focused window of the application.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `mainOptions`

`MainOption[] | null`

Command-line options the application parses, registered before it starts. GLib offers no way to unregister one, so the list cannot change once it has been applied.

### `menubar`

`Gio.MenuModel | ReactElement`

The menu model to be used for the application's menu bar.

### `registerSession`

`boolean` · default `false` · deprecated since 4.22

Set this property to true to register with the session manager.

This will make GTK track the session state (such as the
`Gtk.Application.screensaverActive` property).

> **Deprecated since 4.22.** This property is ignored. GTK always registers with the session manager

### `screensaverActive`

`boolean` · default `false` · read-only, observe with `onNotifyScreensaverActive`

This property is true if GTK believes that the screensaver
is currently active.

Tracking the screensaver state is currently only supported on
Linux.

## Signals

### `onQueryEnd`

```ts
(self: Gtk.Application) => void
```

Emitted when the session manager is about to end the session.

Applications can connect to this signal and call
`Gtk.Application.inhibit()` with `Gtk.ApplicationInhibitFlags.logout`
to delay the end of the session until state has been saved.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onWindowAdded`

```ts
(window: Gtk.Window, self: Gtk.Application) => void
```

Emitted when a window is added to an application.

See `Gtk.Application.addWindow()`.

**Parameters**

- `window`: the newly-added window
- `self`: The instance the signal was emitted on.

### `onWindowRemoved`

```ts
(window: Gtk.Window, self: Gtk.Application) => void
```

Emitted when a window is removed from an application.

This can happen as a side-effect of the window being destroyed
or explicitly through `Gtk.Application.removeWindow()`.

**Parameters**

- `window`: the window that is being removed
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Application` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addWindow`

```ts
addWindow(window: Gtk.Window): void
```

Adds a window to the application.

This call can only happen after the application has started;
typically, you should add new application windows in response
to the emission of the `GIO.Application.activate` signal.

This call is equivalent to setting the `Gtk.Window.application`
property of the window to `application`.

Normally, the connection between the application and the window
will remain until the window is destroyed, but you can explicitly
remove it with `Gtk.Application.removeWindow()`.

GTK will keep the application running as long as it has any windows.

**Parameters**

- `window`: a window

### `getAccelsForAction`

```ts
getAccelsForAction(detailedActionName: string): string[]
```

Gets the accelerators that are currently associated with
the given action.

**Parameters**

- `detailedActionName`: a detailed action name, specifying an action and target to obtain accelerators for

**Returns** accelerators for `detailed_action_name`

### `getActionsForAccel`

```ts
getActionsForAccel(accel: string): string[]
```

Returns the list of actions (possibly empty) that the accelerator maps to.

Each item in the list is a detailed action name in the usual form.

This might be useful to discover if an accel already exists in
order to prevent installation of a conflicting accelerator (from
an accelerator editor or a plugin system, for example). Note that
having more than one action per accelerator may not be a bad thing
and might make sense in cases where the actions never appear in the
same context.

In case there are no actions for a given accelerator, an empty array
is returned. `NULL` is never returned.

It is a programmer error to pass an invalid accelerator string.

If you are unsure, check it with `Gtk.acceleratorParse()` first.

**Parameters**

- `accel`: an accelerator that can be parsed by `Gtk.acceleratorParse()`

**Returns** actions for `accel`

### `getActiveWindow`

```ts
getActiveWindow(): Gtk.Window | null
```

Gets the “active” window for the application.

The active window is the one that was most recently focused
(within the application). This window may not have the focus
at the moment if another application has it — this is just
the most recently-focused window within this application.

**Returns** the active window

### `getMenubar`

```ts
getMenubar(): Gio.MenuModel | null
```

Returns the menu model for the menu bar of the application.

**Returns** the menubar for windows of the application

### `getMenuById`

```ts
getMenuById(id: string): Gio.Menu | null
```

Gets a menu from automatically loaded resources.

See [the section on Automatic resources](class.Application.html#automatic-resources)
for more information.

**Parameters**

- `id`: the ID of the menu to look up

**Returns** Gets the menu with the
  given ID from the automatically loaded resources

### `getWindowById`

```ts
getWindowById(id: number): Gtk.Window | null
```

Returns the window with the given ID.

The ID of a `GtkApplicationWindow` can be retrieved with
`Gtk.ApplicationWindow.getId()`.

**Parameters**

- `id`: an identifier number

**Returns** the window for the given ID

### `getWindows`

```ts
getWindows(): Gtk.Window[]
```

Gets a list of the window associated with the application.

The list is sorted by most recently focused window, such that the first
element is the currently focused window. (Useful for choosing a parent
for a transient window.)

The list that is returned should not be modified in any way. It will
only remain valid until the next focus change or window creation or
deletion.

**Returns** the list of windows

### `inhibit`

```ts
inhibit(window: Gtk.Window | null, flags: Gtk.ApplicationInhibitFlags, reason: string | null): number
```

Informs the session manager that certain types of actions should be
inhibited.

This is not guaranteed to work on all platforms and for all types of
actions.

Applications should invoke this method when they begin an operation
that should not be interrupted, such as creating a CD or DVD. The
types of actions that may be blocked are specified by the `flags`
parameter. When the application completes the operation it should
call `Gtk.Application.uninhibit()` to remove the inhibitor. Note
that an application can have multiple inhibitors, and all of them must
be individually removed. Inhibitors are also cleared when the
application exits.

Applications should not expect that they will always be able to block
the action. In most cases, users will be given the option to force
the action to take place.

The `reason` message should be short and to the point.

If a window is given, the session manager may point the user to
this window to find out more about why the action is inhibited.

The cookie that is returned by this function  should be used as an
argument to `Gtk.Application.uninhibit()` in order to remove
the request.

**Parameters**

- `window`: a window
- `flags`: what types of actions should be inhibited
- `reason`: a short, human-readable string that explains why these operations are inhibited

**Returns** A non-zero cookie that is used to uniquely identify this, or
  0 if the platform does not support inhibiting or the request failed
  for some reason

### `listActionDescriptions`

```ts
listActionDescriptions(): string[]
```

Lists the detailed action names which have associated accelerators.

See `Gtk.Application.setAccelsForAction()`.

**Returns** the detailed action names

### `removeWindow`

```ts
removeWindow(window: Gtk.Window): void
```

Remove a window from the application.

If the window belongs to the application then this call is
equivalent to setting the `Gtk.Window.application`
property of the window to `NULL`.

The application may stop running as a result of a call to this
function, if the window was the last window of the application.

**Parameters**

- `window`: a window

### `setAccelsForAction`

```ts
setAccelsForAction(detailedActionName: string, accels: string[]): void
```

Sets zero or more keyboard accelerators that will trigger the
given action.

The first item in `accels` will be the primary accelerator,
which may be displayed in the UI.

To remove all accelerators for an action, use an empty,
zero-terminated array for `accels`.

For the `detailed_action_name`, see `Gio.Action.parseDetailedName()`
and [Gio.Action.print_detailed_name].

**Parameters**

- `detailedActionName`: a detailed action name, specifying an action and target to associate accelerators with
- `accels`: a list of accelerators in the format understood by `Gtk.acceleratorParse()`

### `setMenubar`

```ts
setMenubar(menubar: Gio.MenuModel | null): void
```

Sets or unsets the menubar for windows of the application.

This is a menubar in the traditional sense.

This can only be done in the primary instance of the application,
after it has been registered. `GIO.Application.startup()` is
a good place to call this.

Depending on the desktop environment, this may appear at the top of
each window, or at the top of the screen. In some environments, if
both the application menu and the menubar are set, the application
menu will be presented as if it were the first item of the menubar.
Other environments treat the two as completely separate — for example,
the application menu may be rendered by the desktop shell while the
menubar (if set) remains in each individual window.

Use the base `GActionMap` interface to add actions, to respond to the
user selecting these menu items.

**Parameters**

- `menubar`: a menu model

### `uninhibit`

```ts
uninhibit(cookie: number): void
```

Removes an inhibitor that has been previously established.

See `Gtk.Application.inhibit()`.

Inhibitors are also cleared when the application exits.

**Parameters**

- `cookie`: a cookie that was returned by `Gtk.Application.inhibit()`
