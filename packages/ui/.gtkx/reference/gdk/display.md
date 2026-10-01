---
description: "A representation of a workstation."
---

# GdkDisplay

A representation of a workstation.

Their purpose are two-fold:

- To manage and provide information about input devices (pointers, keyboards, etc)
- To manage and provide information about output devices (monitors, projectors, etc)

Most of the input device handling has been factored out into separate
`Gdk.Seat` objects. Every display has a one or more seats, which
can be accessed with `Gdk.Display.getDefaultSeat()` and
`Gdk.Display.listSeats()`.

Output devices are represented by `Gdk.Monitor` objects, which can
be accessed with `Gdk.Display.getMonitorAtSurface()` and similar APIs.

```tsx
import { GdkDisplay } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDisplay**

## Props

`ref` receives the `Gdk.Display` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `composited`

`boolean` · default `true` · read-only, observe with `onNotifyComposited`

`true` if the display properly composites the alpha channel.

### `dmabufFormats`

`Gdk.DmabufFormats` · read-only, observe with `onNotifyDmabufFormats`

The dma-buf formats that are supported on this display

_Available since 4.14._

### `inputShapes`

`boolean` · default `true` · read-only, observe with `onNotifyInputShapes`

`true` if the display supports input shapes.

### `rgba`

`boolean` · default `true` · read-only, observe with `onNotifyRgba`

`true` if the display supports an alpha channel.

### `shadowWidth`

`boolean` · default `true` · read-only, observe with `onNotifyShadowWidth`

`true` if the display supports extensible frames.

_Available since 4.14._

## Signals

### `onClosed`

```ts
(isError: boolean, self: Gdk.Display) => void
```

Emitted when the connection to the windowing system for `display` is closed.

**Parameters**

- `isError`: `true` if the display was closed due to an error
- `self`: The instance the signal was emitted on.

### `onOpened`

```ts
(self: Gdk.Display) => void
```

Emitted when the connection to the windowing system for `display` is opened.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSeatAdded`

```ts
(seat: Gdk.Seat, self: Gdk.Display) => void
```

Emitted whenever a new seat is made known to the windowing system.

**Parameters**

- `seat`: the seat that was just added
- `self`: The instance the signal was emitted on.

### `onSeatRemoved`

```ts
(seat: Gdk.Seat, self: Gdk.Display) => void
```

Emitted whenever a seat is removed by the windowing system.

**Parameters**

- `seat`: the seat that was just removed
- `self`: The instance the signal was emitted on.

### `onSettingChanged`

```ts
(setting: string, self: Gdk.Display) => void
```

Emitted whenever a setting changes its value.

**Parameters**

- `setting`: the name of the setting that changed
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.Display` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `beep`

```ts
beep(): void
```

Emits a short beep on `display`

### `close`

```ts
close(): void
```

Closes the connection to the windowing system for the given display.

This cleans up associated resources.

### `createGlContext`

```ts
createGlContext(): Gdk.GLContext
```

Creates a new `GdkGLContext` for the `GdkDisplay`.

The context is disconnected from any particular surface or surface
and cannot be used to draw to any surface. It can only be used to
draw to non-surface framebuffers like textures.

If the creation of the `GdkGLContext` failed, `error` will be set.
Before using the returned `GdkGLContext`, you will need to
call `Gdk.GLContext.makeCurrent()` or `Gdk.GLContext.realize()`.

**Returns** the newly created `GdkGLContext`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.6._

### `deviceIsGrabbed`

```ts
deviceIsGrabbed(device: Gdk.Device): boolean
```

Returns `true` if there is an ongoing grab on `device` for `display`.

**Parameters**

- `device`: a `GdkDevice`

**Returns** `true` if there is a grab in effect for `device`.

### `flush`

```ts
flush(): void
```

Flushes any requests queued for the windowing system.

This happens automatically when the main loop blocks waiting for new events,
but if your application is drawing without returning control to the main loop,
you may need to call this function explicitly. A common case where this function
needs to be called is when an application is executing drawing commands
from a thread other than the thread where the main loop is running.

This is most useful for X11. On windowing systems where requests are
handled synchronously, this function will do nothing.

### `getAppLaunchContext`

```ts
getAppLaunchContext(): Gdk.AppLaunchContext
```

Returns a `GdkAppLaunchContext` suitable for launching
applications on the given display.

**Returns** a new `GdkAppLaunchContext` for `display`

### `getClipboard`

```ts
getClipboard(): Gdk.Clipboard
```

Gets the clipboard used for copy/paste operations.

**Returns** the display's clipboard

### `getDefaultSeat`

```ts
getDefaultSeat(): Gdk.Seat | null
```

Returns the default `GdkSeat` for this display.

Note that a display may not have a seat. In this case,
this function will return `null`.

**Returns** the default seat.

### `getDmabufFormats`

```ts
getDmabufFormats(): Gdk.DmabufFormats
```

Returns the dma-buf formats that are supported on this display.

GTK may use OpenGL or Vulkan to support some formats.
Calling this function will then initialize them if they aren't yet.

The formats returned by this function can be used for negotiating
buffer formats with producers such as v4l, pipewire or GStreamer.

To learn more about dma-bufs, see `Gdk.DmabufTextureBuilder`.

This function is threadsafe. It can be called from any thread.

**Returns** a `GdkDmabufFormats` object

_Available since 4.14._

### `getMonitorAtSurface`

```ts
getMonitorAtSurface(surface: Gdk.Surface): Gdk.Monitor | null
```

Gets the monitor in which the largest area of `surface`
resides.

**Parameters**

- `surface`: a `GdkSurface`

**Returns** the monitor with the largest
  overlap with `surface`

### `getMonitors`

```ts
getMonitors(): Gio.ListModel
```

Gets the list of monitors associated with this display.

Subsequent calls to this function will always return the
same list for the same display.

You can listen to the GListModel::items-changed signal on
this list to monitor changes to the monitor of this display.

**Returns** a `GListModel` of `GdkMonitor`

### `getName`

```ts
getName(): string
```

Gets the name of the display.

**Returns** a string representing the display name. This string is owned
  by GDK and should not be modified or freed.

### `getPrimaryClipboard`

```ts
getPrimaryClipboard(): Gdk.Clipboard
```

Gets the clipboard used for the primary selection.

On backends where the primary clipboard is not supported natively,
GDK emulates this clipboard locally.

**Returns** the primary clipboard

### `getSetting`

```ts
getSetting(name: string, value: GObject.Value): boolean
```

Retrieves a desktop-wide setting such as double-click time
for the `display`.

**Parameters**

- `name`: the name of the setting
- `value`: location to store the value of the setting

**Returns** `true` if the setting existed and a value was stored
  in `value`, `false` otherwise

### `getStartupNotificationId`

```ts
getStartupNotificationId(): string | null
```

Gets the startup notification ID for a Wayland display, or `null`
if no ID has been defined.

**Returns** the startup notification ID for `display`

> **Deprecated since 4.10.**

### `isClosed`

```ts
isClosed(): boolean
```

Finds out if the display has been closed.

**Returns** `true` if the display is closed.

### `isComposited`

```ts
isComposited(): boolean
```

Returns whether surfaces can reasonably be expected to have
their alpha channel drawn correctly on the screen.

Check `Gdk.Display.isRgba()` for whether the display
supports an alpha channel.

On X11 this function returns whether a compositing manager is
compositing on `display`.

On modern displays, this value is always `true`.

**Returns** Whether surfaces with RGBA visuals can reasonably
  be expected to have their alpha channels drawn correctly
  on the screen.

### `isRgba`

```ts
isRgba(): boolean
```

Returns whether surfaces on this `display` are created with an
alpha channel.

Even if a `true` is returned, it is possible that the
surface’s alpha channel won’t be honored when displaying the
surface on the screen: in particular, for X an appropriate
windowing manager and compositing manager must be running to
provide appropriate display. Use `Gdk.Display.isComposited()`
to check if that is the case.

On modern displays, this value is always `true`.

**Returns** `true` if surfaces are created with an alpha channel or
  `false` if the display does not support this functionality.

### `listSeats`

```ts
listSeats(): Gdk.Seat[]
```

Returns the list of seats known to `display`.

**Returns** the
  list of seats known to the `GdkDisplay`

### `mapKeycode`

```ts
mapKeycode(keycode: number): [boolean, Gdk.KeymapKey[], number[]]
```

Returns the keyvals bound to `keycode`.

The Nth `GdkKeymapKey` in `keys` is bound to the Nth keyval in `keyvals`.

When a keycode is pressed by the user, the keyval from
this list of entries is selected by considering the effective
keyboard group and level.

Free the returned arrays with `g_free()`.

**Parameters**

- `keycode`: a keycode

**Returns** Tuple of:

- `result`: `true` if there were any entries
- `keys`: return location for array of `GdkKeymapKey`
- `keyvals`: return location for array of keyvals

### `mapKeyval`

```ts
mapKeyval(keyval: number): [boolean, Gdk.KeymapKey[]]
```

Obtains a list of keycode/group/level combinations that will
generate `keyval`.

Groups and levels are two kinds of keyboard mode; in general, the level
determines whether the top or bottom symbol on a key is used, and the
group determines whether the left or right symbol is used.

On US keyboards, the shift key changes the keyboard level, and there
are no groups. A group switch key might convert a keyboard between
Hebrew to English modes, for example.

`GdkEventKey` contains a `group` field that indicates the active
keyboard group. The level is computed from the modifier mask.

The returned array should be freed with `g_free()`.

**Parameters**

- `keyval`: a keyval, such as `GDK_KEY_a`, `GDK_KEY_Up`, `GDK_KEY_Return`, etc.

**Returns** Tuple of:

- `result`: `true` if keys were found and returned
- `keys`: return location for an array of `GdkKeymapKey`

### `notifyStartupComplete`

```ts
notifyStartupComplete(startupId: string): void
```

Indicates to the GUI environment that the application has
finished loading, using a given identifier.

GTK will call this function automatically for [GtkWindow](../gtk4/class.Window.html)
with custom startup-notification identifier unless
[`gtk_window_set_auto_startup_notification()`](../gtk4/method.Window.set_auto_startup_notification.html)
is called to disable that feature.

**Parameters**

- `startupId`: a startup-notification identifier, for which notification process should be completed

> **Deprecated since 4.10.** Using `Gdk.Toplevel.setStartupId()` is sufficient

### `prepareGl`

```ts
prepareGl(): boolean
```

Checks that OpenGL is available for `self` and ensures that it is
properly initialized.
When this fails, an `error` will be set describing the error and this
function returns `false`.

Note that even if this function succeeds, creating a `GdkGLContext`
may still fail.

This function is idempotent. Calling it multiple times will just
return the same value or error.

You never need to call this function, GDK will call it automatically
as needed. But you can use it as a check when setting up code that
might make use of OpenGL.

**Returns** `true` if the display supports OpenGL

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.4._

### `putEvent`

```ts
putEvent(event: Gdk.Event): void
```

Adds the given event to the event queue for `display`.

**Parameters**

- `event`: a `GdkEvent`

> **Deprecated since 4.10.** This function is only useful in very special situations and should not be used by applications.

### `supportsInputShapes`

```ts
supportsInputShapes(): boolean
```

Returns `true` if the display supports input shapes.

This means that `Gdk.Surface.setInputRegion()` can
be used to modify the input shape of surfaces on `display`.

On modern displays, this value is always `true`.

**Returns** `true` if surfaces with modified input shape are supported

### `supportsShadowWidth`

```ts
supportsShadowWidth(): boolean
```

Returns whether it's possible for a surface to draw outside of the window area.

If `true` is returned the application decides if it wants to draw shadows.
If `false` is returned, the compositor decides if it wants to draw shadows.

**Returns** `true` if surfaces can draw shadows or
  `false` if the display does not support this functionality.

_Available since 4.14._

### `sync`

```ts
sync(): void
```

Flushes any requests queued for the windowing system and waits until all
requests have been handled.

This is often used for making sure that the display is synchronized
with the current state of the program. Calling `Gdk.Display.sync()`
before `GdkX11.Display.errorTrapPop()` makes sure that any errors
generated from earlier requests are handled before the error trap is removed.

This is most useful for X11. On windowing systems where requests are
handled synchronously, this function will do nothing.

### `translateKey`

```ts
translateKey(keycode: number, state: Gdk.ModifierType, group: number): [boolean, number, number, number, Gdk.ModifierType]
```

Translates the contents of a `GdkEventKey` into a keyval, effective group,
and level.

Modifiers that affected the translation and are thus unavailable for
application use are returned in `consumed_modifiers`.

The `effective_group` is the group that was actually used for the
translation; some keys such as Enter are not affected by the active
keyboard group. The `level` is derived from `state`.

`consumed_modifiers` gives modifiers that should be masked out
from `state` when comparing this key press to a keyboard shortcut.
For instance, on a US keyboard, the `plus` symbol is shifted, so
when comparing a key press to a `<Control>plus` accelerator `<Shift>`
should be masked out.

This function should rarely be needed, since `GdkEventKey` already
contains the translated keyval. It is exported for the benefit of
virtualized test environments.

**Parameters**

- `keycode`: a keycode
- `state`: a modifier state
- `group`: active keyboard group

**Returns** Tuple of:

- `result`: `true` if there was a keyval bound to keycode/state/group.
- `keyval`: return location for keyval
- `effectiveGroup`: return location for effective group
- `level`: return location for level
- `consumed`: return location for modifiers that were used to determine the group or level
