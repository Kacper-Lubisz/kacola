---
description: "Integrating the launch with the launching application."
---

# GAppLaunchContext

Integrating the launch with the launching application. This is used to
handle for instance startup notification and launching the new application
on the same screen as the launching window.

```tsx
import { GAppLaunchContext } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GAppLaunchContext**

## Props

`ref` receives the `Gio.AppLaunchContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onLaunched`

```ts
(info: Gio.AppInfo, platformData: GLib.Variant, self: Gio.AppLaunchContext) => void
```

The `Gio.AppLaunchContext.launched` signal is emitted when a
`Gio.AppInfo` is successfully launched.

Because a launch operation may involve spawning multiple instances of the
target application, you should expect this signal to be emitted multiple
times, one time for each spawned instance.

The `platform_data` is an GVariant dictionary mapping
strings to variants (ie `a{sv}`), which contains additional,
platform-specific data about this launch. On UNIX, at least the
`pid` and `startup-notification-id` keys will be present.

Since 2.72 the `pid` may be 0 if the process id wasn’t known (for
example if the process was launched via D-Bus). The `pid` may not be
set at all in subsequent releases.

On Windows, `pid` is guaranteed to be valid only for the duration of the
`Gio.AppLaunchContext.launched` signal emission; after the signal
is emitted, GLib will call `GLib.spawnClosePid()`. If you need to
keep the `GLib.Pid` after the signal has been emitted, then you can
duplicate `pid` using `DuplicateHandle()`.

**Parameters**

- `info`: the `Gio.AppInfo` that was just launched
- `platformData`: additional platform-specific data for this launch
- `self`: The instance the signal was emitted on.

_Available since 2.36._

### `onLaunchFailed`

```ts
(startupNotifyId: string, self: Gio.AppLaunchContext) => void
```

The `Gio.AppLaunchContext.launch-failed` signal is emitted when a
`Gio.AppInfo` launch fails. The startup notification id is provided,
so that the launcher can cancel the startup notification.

Because a launch operation may involve spawning multiple instances of the
target application, you should expect this signal to be emitted multiple
times, one for each spawned instance.

**Parameters**

- `startupNotifyId`: the startup notification id for the failed launch
- `self`: The instance the signal was emitted on.

_Available since 2.36._

### `onLaunchStarted`

```ts
(info: Gio.AppInfo, platformData: GLib.Variant | null, self: Gio.AppLaunchContext) => void
```

The `Gio.AppLaunchContext.launch-started` signal is emitted when a
`Gio.AppInfo` is about to be launched. If non-null the
`platform_data` is an GVariant dictionary mapping strings to variants
(ie `a{sv}`), which contains additional, platform-specific data about this
launch. On UNIX, at least the `startup-notification-id` keys will be
present.

The value of the `startup-notification-id` key (type `s`) is a startup
notification ID corresponding to the format from the [startup-notification
specification](https://specifications.freedesktop.org/startup-notification-spec/startup-notification-0.1.txt).
It allows tracking the progress of the launchee through startup.

It is guaranteed that this signal is followed by either a
`Gio.AppLaunchContext.launched` or
`Gio.AppLaunchContext.launch-failed` signal.

Because a launch operation may involve spawning multiple instances of the
target application, you should expect this signal to be emitted multiple
times, one for each spawned instance.

**Parameters**

- `info`: the `Gio.AppInfo` that is about to be launched
- `platformData`: additional platform-specific data for this launch
- `self`: The instance the signal was emitted on.

_Available since 2.72._

## Methods

Methods are called on the `Gio.AppLaunchContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getDisplay`

```ts
getDisplay(info: Gio.AppInfo, files: Gio.File[]): string | null
```

Gets the display string for the `context`. This is used to ensure new
applications are started on the same display as the launching
application, by setting the `DISPLAY` environment variable.

**Parameters**

- `info`: the app info
- `files`: a list of `Gio.File` objects

**Returns** a display string for the display.

### `getEnvironment`

```ts
getEnvironment(): string[]
```

Gets the complete environment variable list to be passed to
the child process when `context` is used to launch an application.
This is a `NULL`-terminated array of strings, where each string has
the form `KEY=VALUE`.

**Returns** the child’s environment

_Available since 2.32._

### `getStartupNotifyId`

```ts
getStartupNotifyId(info: Gio.AppInfo | null, files: Gio.File[] | null): string | null
```

Initiates startup notification for the application and returns the
`XDG_ACTIVATION_TOKEN` or `DESKTOP_STARTUP_ID` for the launched operation,
if supported.

The returned token may be referred to equivalently as an ‘activation token’
(using Wayland terminology) or a ‘startup sequence ID’ (using X11 terminology).
The two [are interoperable](https://gitlab.freedesktop.org/wayland/wayland-protocols/-/blob/main/staging/xdg-activation/x11-interoperation.rst).

Activation tokens are defined in the [XDG Activation Protocol](https://wayland.app/protocols/xdg-activation-v1),
and startup notification IDs are defined in the
[freedesktop.org Startup Notification Protocol](http://standards.freedesktop.org/startup-notification-spec/startup-notification-latest.txt).

Support for the XDG Activation Protocol was added in GLib 2.76.
Since GLib 2.82 `info` and `files` can be `NULL`. If that’s not supported by the backend,
the returned token will be `NULL`.

**Parameters**

- `info`: the app info
- `files`: a list of `Gio.File` objects

**Returns** a startup notification ID for the application, or `NULL` if
  not supported.

### `launchFailed`

```ts
launchFailed(startupNotifyId: string): void
```

Called when an application has failed to launch, so that it can cancel
the application startup notification started in
`Gio.AppLaunchContext.getStartupNotifyId()`.

**Parameters**

- `startupNotifyId`: the startup notification id that was returned by `Gio.AppLaunchContext.getStartupNotifyId()`.

### `setenv`

```ts
setenv(variable: string, value: string): void
```

Arranges for `variable` to be set to `value` in the child’s environment when
`context` is used to launch an application.

**Parameters**

- `variable`: the environment variable to set
- `value`: the value for to set the variable to.

_Available since 2.32._

### `unsetenv`

```ts
unsetenv(variable: string): void
```

Arranges for `variable` to be unset in the child’s environment when `context`
is used to launch an application.

**Parameters**

- `variable`: the environment variable to remove

_Available since 2.32._
