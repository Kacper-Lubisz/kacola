---
description: "A toplevel window which can contain other widgets."
---

# GtkWindow

A toplevel window which can contain other widgets.



Windows normally have decorations that are under the control
of the windowing system and allow the user to manipulate the window
(resize it, move it, close it,...).

## GtkWindow as GtkBuildable

The `GtkWindow` implementation of the `Gtk.Buildable` interface supports
setting a child as the titlebar by specifying “titlebar” as the “type”
attribute of a `<child>` element.

## Shortcuts and Gestures

`GtkWindow` supports the following keyboard shortcuts:

- <kbd>F10</kbd> activates the menubar, if present.
- <kbd>Alt</kbd> makes the mnemonics visible while pressed.

The following signals have default keybindings:

- `Gtk.Window.activate-default`
- `Gtk.Window.activate-focus`
- `Gtk.Window.enable-debugging`

## Actions

`GtkWindow` defines a set of built-in actions:

- `default.activate` activates the default widget.
- `window.minimize` minimizes the window.
- `window.toggle-maximized` maximizes or restores the window.
- `window.close` closes the window.

## CSS nodes

```
window.background [.csd / .solid-csd / .ssd] [.maximized / .fullscreen / .tiled]
├── <child>
╰── <titlebar child>.titlebar [.default-decoration]
```

`GtkWindow` has a main CSS node with name window and style class .background.

Style classes that are typically used with the main CSS node are .csd (when
client-side decorations are in use), .solid-csd (for client-side decorations
without invisible borders), .ssd (used by mutter when rendering server-side
decorations). GtkWindow also represents window states with the following
style classes on the main node: .maximized, .fullscreen, .tiled (when supported,
also .tiled-top, .tiled-left, .tiled-right, .tiled-bottom).

`GtkWindow` subclasses often add their own discriminating style classes,
such as .dialog, .popup or .tooltip.

Generally, some CSS properties don't make sense on the toplevel window node,
such as margins or padding. When client-side decorations without invisible
borders are in use (i.e. the .solid-csd style class is added to the
main window node), the CSS border of the toplevel window is used for
resize drags. In the .csd case, the shadow area outside of the window
can be used to resize it.

`GtkWindow` adds the .titlebar and .default-decoration style classes to the
widget that is added as a titlebar child.

## Accessibility

`GtkWindow` uses the `Gtk.AccessibleRole.window` role.

From GTK 4.12 to 4.18, it used the `Gtk.AccessibleRole.application` role.

```tsx
import { GtkWindow } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkWindow**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.Window` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `application`

`Gtk.Application | ReactElement`

The `GtkApplication` associated with the window.

The application will be kept alive for at least as long as it
has any windows associated with it (see `g_application_hold()`
for a way to keep it alive without windows).

Normally, the connection between the application and the window
will remain until the window is destroyed, but you can explicitly
remove it by setting the this property to `NULL`.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `decorated`

`boolean` · default `true`

Whether the window should have a frame (also known as *decorations*).

### `defaultHeight`

`number` · default `0`

The default height of the window.

### `defaultWidget`

`Gtk.Widget | ReactElement`

The default widget.

### `defaultWidth`

`number` · default `0`

The default width of the window.

### `deletable`

`boolean` · default `true`

Whether the window frame should have a close button.

### `destroyWithParent`

`boolean` · default `false`

If this window should be destroyed when the parent is destroyed.

### `display`

`Gdk.Display | ReactElement`

The display that will display this window.

### `focusVisible`

`boolean` · default `true`

Whether 'focus rectangles' are currently visible in this window.

This property is maintained by GTK based on user input
and should not be set by applications.

### `focusWidget`

`Gtk.Widget | ReactElement`

The focus widget.

### `fullscreened`

`boolean` · default `false`

Whether the window is fullscreen.

Setting this property is the equivalent of calling
`Gtk.Window.fullscreen()` or `Gtk.Window.unfullscreen()`;
either operation is asynchronous, which means you will need to
connect to the ::notify signal in order to know whether the
operation was successful.

### `gravity`

`Gtk.WindowGravity` · default `GTK_WINDOW_GRAVITY_TOP_START`

The gravity to use when resizing the window programmatically.

Gravity describes which point of the window we want to keep
fixed (meaning that the window will grow in the opposite direction).
For example, a gravity of `GTK_WINDOW_GRAVITY_TOP_RIGHT` means that we
want the to fix top right corner of the window.

_Available since 4.20._

### `handleMenubarAccel`

`boolean` · default `true`

Whether the window frame should handle <kbd>F10</kbd> for activating
menubars.

_Available since 4.2._

### `hideOnClose`

`boolean` · default `false`

If this window should be hidden instead of destroyed when the user clicks
the close button.

### `iconName`

`string` · default `null`

Specifies the name of the themed icon to use as the window icon.

See `Gtk.IconTheme` for more details.

### `isActive`

`boolean` · default `false` · read-only, observe with `onNotifyIsActive`

Whether the toplevel is the currently active window.

### `maximized`

`boolean` · default `false`

Whether the window is maximized.

Setting this property is the equivalent of calling
`Gtk.Window.maximize()` or `Gtk.Window.unmaximize()`;
either operation is asynchronous, which means you will need to
connect to the ::notify signal in order to know whether the
operation was successful.

### `mnemonicsVisible`

`boolean` · default `false`

Whether mnemonics are currently visible in this window.

This property is maintained by GTK based on user input,
and should not be set by applications.

### `modal`

`boolean` · default `false`

If true, the window is modal.

### `resizable`

`boolean` · default `true`

If true, users can resize the window.

### `startupId`

`string` · default `null`

A write-only property for setting window's startup notification identifier.

### `suspended`

`boolean` · default `false` · read-only, observe with `onNotifySuspended`

Whether the window is suspended.

See `Gtk.Window.isSuspended()` for details about what suspended means.

_Available since 4.12._

### `title`

`string` · default `null`

The title of the window.

### `titlebar`

`Gtk.Widget | ReactElement`

The titlebar widget.

_Available since 4.6._

### `transientFor`

`Gtk.Window | ReactElement`

The transient parent of the window.

## Signals

### `onActivateDefault`

```ts
(self: Gtk.Window) => void
```

Emitted when the user activates the default widget.

This is a [keybinding signal](class.SignalAction.html).

The keybindings for this signal are all forms of the <kbd>Enter</kbd> key.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onActivateFocus`

```ts
(self: Gtk.Window) => void
```

Emitted when the user activates the currently focused
widget of `window`.

This is a [keybinding signal](class.SignalAction.html).

The default binding for this signal is <kbd>␣</kbd>.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onCloseRequest`

```ts
(self: Gtk.Window) => boolean | undefined
```

Emitted when the user clicks on the close button of the window.

**Parameters**

- `self`: The instance the signal was emitted on.

**Returns** true to stop other handlers from being invoked for the signal

### `onEnableDebugging`

```ts
(toggle: boolean, self: Gtk.Window) => boolean | undefined
```

Emitted when the user enables or disables interactive debugging.

When `toggle` is true, interactive debugging is toggled on or off,
when it is false, the debugger will be pointed at the widget
under the pointer.

This is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> and
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>.

**Parameters**

- `toggle`: toggle the debugger
- `self`: The instance the signal was emitted on.

**Returns** true if the key binding was handled

### `onKeysChanged`

```ts
(self: Gtk.Window) => void
```

Emitted when the set of accelerators or mnemonics that
are associated with the window changes.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** Use `Gtk.Shortcut` and `Gtk.EventController` to implement keyboard shortcuts

## Methods

Methods are called on the `Gtk.Window` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `close`

```ts
close(): void
```

Requests that the window is closed.

This is similar to what happens when a window manager
close button is clicked.

This function can be used with close buttons in custom
titlebars.

### `destroy`

```ts
destroy(): void
```

Drops the internal reference GTK holds on toplevel windows.

### `fullscreen`

```ts
fullscreen(): void
```

Asks to place the window in the fullscreen state.

Note that you shouldn’t assume the window is definitely fullscreen
afterward, because other entities (e.g. the user or window manager)
unfullscreen it again, and not all window managers honor requests
to fullscreen windows.

If a window is not explicitly fullscreened or unfullscreened before
it is shown, the initial state is at the window managers discretion.

You can track the result of this operation via the
`Gdk.Toplevel.state` property, or by listening to
notifications of the `Gtk.Window.fullscreened` property.

### `fullscreenOnMonitor`

```ts
fullscreenOnMonitor(monitor: Gdk.Monitor): void
```

Asks to place the window in the fullscreen state on the given monitor.

Note that you shouldn't assume the window is definitely fullscreen
afterward, or that the windowing system allows fullscreen windows on
any given monitor.

You can track the result of this operation via the
`Gdk.Toplevel.state` property, or by listening to
notifications of the `Gtk.Window.fullscreened` property.

**Parameters**

- `monitor`: which monitor to go fullscreen on

### `getApplication`

```ts
getApplication(): Gtk.Application | null
```

Gets the application object associated with the window.

**Returns** the application

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of the window.

**Returns** the child widget of `window`

### `getDecorated`

```ts
getDecorated(): boolean
```

Returns whether the window has been set to have decorations.

**Returns** true if the window has been set to have decorations

### `getDefaultSize`

```ts
getDefaultSize(): [number, number]
```

Gets the default size of the window.

A value of 0 for the width or height indicates that a default
size has not been explicitly set for that dimension, so the
“natural” size of the window will be used.

This function is the recommended way for [saving window state
across restarts of applications](https://developer.gnome.org/documentation/tutorials/save-state.html).

**Returns** Tuple of:

- `width`: location to store the default width
- `height`: location to store the default height

### `getDefaultWidget`

```ts
getDefaultWidget(): Gtk.Widget | null
```

Returns the default widget for `window`.

**Returns** the default widget

### `getDeletable`

```ts
getDeletable(): boolean
```

Returns whether the window has been set to have a close button.

**Returns** true if the window has been set to have a close button

### `getDestroyWithParent`

```ts
getDestroyWithParent(): boolean
```

Returns whether the window will be destroyed with its transient parent.

**Returns** true if the window will be destroyed with its transient parent

### `getFocus`

```ts
getFocus(): Gtk.Widget | null
```

Retrieves the current focused widget within the window.

Note that this is the widget that would have the focus
if the toplevel window focused; if the toplevel window
is not focused then `gtk_widget_has_focus (widget)` will
not be false for the widget.

**Returns** the currently focused widget

### `getFocusVisible`

```ts
getFocusVisible(): boolean
```

Gets whether “focus rectangles” are supposed to be visible.

**Returns** true if “focus rectangles” are supposed to be visible
  in this window

### `getGravity`

```ts
getGravity(): Gtk.WindowGravity
```

Returns the gravity that is used when changing the window size programmatically.

**Returns** the gravity

_Available since 4.20._

### `getGroup`

```ts
getGroup(): Gtk.WindowGroup
```

Returns the group for the window.

If the window has no group, then the default group is returned.

**Returns** the window group for `window`
  or the default group

### `getHandleMenubarAccel`

```ts
getHandleMenubarAccel(): boolean
```

Returns whether this window reacts to <kbd>F10</kbd>
presses by activating a menubar it contains.

**Returns** true if the window handles <kbd>F10</kbd>

_Available since 4.2._

### `getHideOnClose`

```ts
getHideOnClose(): boolean
```

Returns whether the window will be hidden instead of destroyed when the close
button is clicked.

**Returns** true if the window will be hidden

### `getIconName`

```ts
getIconName(): string | null
```

Returns the name of the themed icon for the window.

**Returns** the icon name

### `getMnemonicsVisible`

```ts
getMnemonicsVisible(): boolean
```

Gets whether mnemonics are supposed to be visible.

**Returns** true if mnemonics are supposed to be visible
  in this window

### `getModal`

```ts
getModal(): boolean
```

Returns whether the window is modal.

**Returns** true if the window is set to be modal and
  establishes a grab when shown

### `getResizable`

```ts
getResizable(): boolean
```

Gets whether the user can resize the window.

**Returns** true if the user can resize the window

### `getTitle`

```ts
getTitle(): string | null
```

Retrieves the title of the window.

**Returns** the title

### `getTitlebar`

```ts
getTitlebar(): Gtk.Widget | null
```

Returns the titlebar that has been set with
`Gtk.Window.setTitlebar()`.

**Returns** the titlebar

### `getTransientFor`

```ts
getTransientFor(): Gtk.Window | null
```

Fetches the transient parent for this window.

**Returns** the transient parent

### `hasGroup`

```ts
hasGroup(): boolean
```

Returns whether the window has an explicit window group.

**Returns** true if `window` has an explicit window group

### `isActive`

```ts
isActive(): boolean
```

Returns whether the window is part of the current active toplevel.

The active toplevel is the window receiving keystrokes.

The return value is `true` if the window is active toplevel itself.
You might use this function if you wanted to draw a widget
differently in an active window from a widget in an inactive window.

**Returns** true if the window part of the current active window.

### `isFullscreen`

```ts
isFullscreen(): boolean
```

Retrieves the current fullscreen state of the window.

Note that since fullscreening is ultimately handled by the window
manager and happens asynchronously to an application request, you
shouldn’t assume the return value of this function changing
immediately (or at all), as an effect of calling
`Gtk.Window.fullscreen()` or `Gtk.Window.unfullscreen()`.

If the window isn't yet mapped, the value returned will whether the
initial requested state is fullscreen.

**Returns** whether the window is fullscreen

### `isMaximized`

```ts
isMaximized(): boolean
```

Retrieves the current maximized state of the window.

Note that since maximization is ultimately handled by the window
manager and happens asynchronously to an application request, you
shouldn’t assume the return value of this function changing
immediately (or at all), as an effect of calling
`Gtk.Window.maximize()` or `Gtk.Window.unmaximize()`.

If the window isn't yet mapped, the value returned will whether the
initial requested state is maximized.

**Returns** whether the window is maximized

### `isSuspended`

```ts
isSuspended(): boolean
```

Retrieves the current suspended state of the window.

A window being suspended means it's currently not visible
to the user, for example by being on a inactive workspace,
minimized, obstructed.

**Returns** whether the window is suspended

_Available since 4.12._

### `maximize`

```ts
maximize(): void
```

Asks to maximize the window, so that it fills the screen.

Note that you shouldn’t assume the window is definitely maximized
afterward, because other entities (e.g. the user or window manager)
could unmaximize it again, and not all window managers support
maximization.

It’s permitted to call this function before showing a window,
in which case the window will be maximized when it appears onscreen
initially.

If a window is not explicitly maximized or unmaximized before it is
shown, the initial state is at the window managers discretion. For
example, it might decide to maximize a window that almost fills the
screen.

You can track the result of this operation via the
`Gdk.Toplevel.state` property, or by listening to
notifications on the `Gtk.Window.maximized`
property.

### `minimize`

```ts
minimize(): void
```

Asks to minimize the window.

Note that you shouldn’t assume the window is definitely minimized
afterward, because the windowing system might not support this
functionality; other entities (e.g. the user or the window manager)
could unminimize it again, or there may not be a window manager in
which case minimization isn’t possible, etc.

It’s permitted to call this function before showing a window,
in which case the window will be minimized before it ever appears
onscreen.

You can track result of this operation via the
`Gdk.Toplevel.state` property.

### `present`

```ts
present(): void
```

Presents a window to the user.

This may mean raising the window in the stacking order,
unminimizing it, moving it to the current desktop and/or
giving it the keyboard focus (possibly dependent on the user’s
platform, window manager and preferences).

If `window` is hidden, this function also makes it visible.

### `presentWithTime`

```ts
presentWithTime(timestamp: number): void
```

Presents a window to the user in response to an user interaction.

See `Gtk.Window.present()` for more details.

The timestamp should be gathered when the window was requested
to be shown (when clicking a link for example), rather than once
the window is ready to be shown.

**Parameters**

- `timestamp`: the timestamp of the user interaction (typically a button or key press event) which triggered this call

> **Deprecated since 4.14.** Use `Gtk.Window.present()`

### `setApplication`

```ts
setApplication(application: Gtk.Application | null): void
```

Sets or unsets the application object associated with the window.

The application will be kept alive for at least as long as it has
any windows associated with it (see `Gio.Application.hold()`
for a way to keep it alive without windows).

Normally, the connection between the application and the window will
remain until the window is destroyed, but you can explicitly remove
it by setting the `application` to `null`.

This is equivalent to calling `Gtk.Application.removeWindow()`
and/or `Gtk.Application.addWindow()` on the old/new applications
as relevant.

**Parameters**

- `application`: a `GtkApplication`

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of the window.

**Parameters**

- `child`: the child widget

### `setDecorated`

```ts
setDecorated(setting: boolean): void
```

Sets whether the window should be decorated.

By default, windows are decorated with a title bar, resize
controls, etc. Some window managers allow GTK to disable these
decorations, creating a borderless window. If you set the decorated
property to false using this function, GTK will do its best to
convince the window manager not to decorate the window. Depending on
the system, this function may not have any effect when called on a
window that is already visible, so you should call it before calling
`Gtk.Widget.show()`.

On Windows, this function always works, since there’s no window manager
policy involved.

**Parameters**

- `setting`: true to decorate the window

### `setDefaultSize`

```ts
setDefaultSize(width: number, height: number): void
```

Sets the default size of a window.

The default size of a window is the size that will be used
if no other constraints apply.

The default size will be updated whenever the window is resized
to reflect the new size, unless the window is forced to a size,
like when it is maximized or fullscreened.

If the window’s minimum size request is larger than
the default, the default will be ignored.

Setting the default size to a value <= 0 will cause it to be
ignored and the natural size request will be used instead. It
is possible to do this while the window is showing to "reset"
it to its initial size.

Unlike `Gtk.Widget.setSizeRequest()`, which sets a size
request for a widget and thus would keep users from shrinking
the window, this function only sets the initial size, just as
if the user had resized the window themselves. Users can still
shrink the window again as they normally would. Setting a default
size of -1 means to use the “natural” default size (the size request
of the window).

If you use this function to reestablish a previously saved window size,
note that the appropriate size to save is the one returned by
`Gtk.Window.getDefaultSize()`. Using the window allocation
directly will not work in all circumstances and can lead to growing
or shrinking windows.

**Parameters**

- `width`: width in pixels, or -1 to unset the default width
- `height`: height in pixels, or -1 to unset the default height

### `setDefaultWidget`

```ts
setDefaultWidget(defaultWidget: Gtk.Widget | null): void
```

Sets the default widget.

The default widget is the widget that is activated
when the user presses <kbd>Enter</kbd> in a dialog
(for example).

**Parameters**

- `defaultWidget`: widget to be the default

### `setDeletable`

```ts
setDeletable(setting: boolean): void
```

Sets whether the window should be deletable.

By default, windows have a close button in the window frame.
Some  window managers allow GTK to disable this button. If you
set the deletable property to false using this function, GTK
will do its best to convince the window manager not to show a
close button. Depending on the system, this function may not
have any effect when called on a window that is already visible,
so you should call it before calling `Gtk.Widget.show()`.

On Windows, this function always works, since there’s no window
manager policy involved.

**Parameters**

- `setting`: true to decorate the window as deletable

### `setDestroyWithParent`

```ts
setDestroyWithParent(setting: boolean): void
```

Sets whether to destroy the window when the transient parent is destroyed.

This is useful for dialogs that shouldn’t persist beyond the lifetime
of the main window they are associated with, for example.

**Parameters**

- `setting`: whether to destroy the window with its transient parent

### `setDisplay`

```ts
setDisplay(display: Gdk.Display): void
```

Sets the display where the window is displayed.

If the window is already mapped, it will be unmapped,
and then remapped on the new display.

**Parameters**

- `display`: a display

### `setFocus`

```ts
setFocus(focus: Gtk.Widget | null): void
```

Sets the focus widget.

If `focus` is not the current focus widget, and is focusable,
sets it as the focus widget for the window. If `focus` is `null`,
unsets the focus widget for this window. To set the focus to a
particular widget in the toplevel, it is usually more convenient
to use `Gtk.Widget.grabFocus()` instead of this function.

**Parameters**

- `focus`: the new focus widget

### `setFocusVisible`

```ts
setFocusVisible(setting: boolean): void
```

Sets whether “focus rectangles” are supposed to be visible.

This property is maintained by GTK based on user input,
and should not be set by applications.

**Parameters**

- `setting`: the new value

### `setGravity`

```ts
setGravity(gravity: Gtk.WindowGravity): void
```

Sets the gravity that is used when changing the window size programmatically.

**Parameters**

- `gravity`: the new gravity

_Available since 4.20._

### `setHandleMenubarAccel`

```ts
setHandleMenubarAccel(handleMenubarAccel: boolean): void
```

Sets whether this window should react to <kbd>F10</kbd>
presses by activating a menubar it contains.

**Parameters**

- `handleMenubarAccel`: true to make `window` handle <kbd>F10</kbd>

_Available since 4.2._

### `setHideOnClose`

```ts
setHideOnClose(setting: boolean): void
```

Sets whether clicking the close button will hide the window instead
of destroying it.

**Parameters**

- `setting`: whether to hide the window when it is closed

### `setIconName`

```ts
setIconName(name: string | null): void
```

Sets the icon for the window from a named themed icon.

See the docs for `Gtk.IconTheme` for more details.
On some platforms, the window icon is not used at all.

Note that this has nothing to do with the WM_ICON_NAME
property which is mentioned in the ICCCM.

**Parameters**

- `name`: the name of the themed icon

### `setMnemonicsVisible`

```ts
setMnemonicsVisible(setting: boolean): void
```

Sets whether mnemonics are supposed to be visible.

This property is maintained by GTK based on user input,
and should not be set by applications.

**Parameters**

- `setting`: the new value

### `setModal`

```ts
setModal(modal: boolean): void
```

Sets a window modal or non-modal.

Modal windows prevent interaction with other windows in the same
application. To keep modal dialogs on top of main application windows,
use `Gtk.Window.setTransientFor()` to make the dialog transient
for the parent; most window managers will then disallow lowering the
dialog below the parent.

**Parameters**

- `modal`: whether the window is modal

### `setResizable`

```ts
setResizable(resizable: boolean): void
```

Sets whether the user can resize a window.

Windows are user resizable by default.

**Parameters**

- `resizable`: true if the user can resize this window

### `setStartupId`

```ts
setStartupId(startupId: string): void
```

Sets the startup notification ID.

Startup notification identifiers are used by desktop environment
to track application startup, to provide user feedback and other
features. This function changes the corresponding property on the
underlying `GdkSurface`.

Normally, startup identifier is managed automatically and you should
only use this function in special cases like transferring focus from
other processes. You should use this function before calling
`Gtk.Window.present()` or any equivalent function generating
a window map event.

This function is only useful on Wayland or X11, not with other GDK
backends.

**Parameters**

- `startupId`: a string with startup-notification identifier

### `setTitle`

```ts
setTitle(title: string | null): void
```

Sets the title of the window.

The title of a window will be displayed in its title bar; on the
X Window System, the title bar is rendered by the window manager
so exactly how the title appears to users may vary according to a
user’s exact configuration. The title should help a user distinguish
this window from other windows they may have open. A good title might
include the application name and current document filename, for example.

Passing `NULL` does the same as setting the title to an empty string.

**Parameters**

- `title`: title of the window

### `setTitlebar`

```ts
setTitlebar(titlebar: Gtk.Widget | null): void
```

Sets a custom titlebar for the window.

A typical widget used here is `Gtk.HeaderBar`, as it
provides various features expected of a titlebar while allowing
the addition of child widgets to it.

If you set a custom titlebar, GTK will do its best to convince
the window manager not to put its own titlebar on the window.
Depending on the system, this function may not work for a window
that is already visible, so you set the titlebar before calling
`Gtk.Widget.show()`.

**Parameters**

- `titlebar`: the widget to use as titlebar

### `setTransientFor`

```ts
setTransientFor(parent: Gtk.Window | null): void
```

Sets a transient parent for the window.

Dialog windows should be set transient for the main application
window they were spawned from. This allows window managers to e.g.
keep the dialog on top of the main window, or center the dialog
over the main window. `Gtk.Dialog.newWithButtons()` and other
convenience functions in GTK will sometimes call this function on
your behalf.

Passing `NULL` for `parent` unsets the current transient window.

On Windows, this function puts the child window on top of the parent,
much as the window manager would have done on X.

**Parameters**

- `parent`: parent window

### `unfullscreen`

```ts
unfullscreen(): void
```

Asks to remove the fullscreen state for the window, and return to
its previous state.

Note that you shouldn’t assume the window is definitely not
fullscreen afterward, because other entities (e.g. the user or
window manager) could fullscreen it again, and not all window
managers honor requests to unfullscreen windows; normally the
window will end up restored to its normal state. Just don’t
write code that crashes if not.

If a window is not explicitly fullscreened or unfullscreened before
it is shown, the initial state is at the window managers discretion.

You can track the result of this operation via the
`Gdk.Toplevel.state` property, or by listening to
notifications of the `Gtk.Window.fullscreened` property.

### `unmaximize`

```ts
unmaximize(): void
```

Asks to unmaximize the window.

Note that you shouldn’t assume the window is definitely unmaximized
afterward, because other entities (e.g. the user or window manager)
maximize it again, and not all window managers honor requests to
unmaximize.

If a window is not explicitly maximized or unmaximized before it is
shown, the initial state is at the window managers discretion. For
example, it might decide to maximize a window that almost fills the
screen.

You can track the result of this operation via the
`Gdk.Toplevel.state` property, or by listening to
notifications on the `Gtk.Window.maximized` property.

### `unminimize`

```ts
unminimize(): void
```

Asks to unminimize the window.

Note that you shouldn’t assume the window is definitely unminimized
afterward, because the windowing system might not support this
functionality; other entities (e.g. the user or the window manager)
could minimize it again, or there may not be a window manager in
which case minimization isn’t possible, etc.

You can track result of this operation via the
`Gdk.Toplevel.state` property.
