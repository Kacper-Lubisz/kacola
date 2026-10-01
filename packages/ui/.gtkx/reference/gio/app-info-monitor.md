---
description: "GAppInfoMonitor monitors application information for changes."
---

# GAppInfoMonitor

`GAppInfoMonitor` monitors application information for changes.

`GAppInfoMonitor` is a very simple object used for monitoring the app
info database for changes (newly installed or removed applications).

Call `Gio.AppInfoMonitor.get()` to get a `GAppInfoMonitor` and connect
to the `Gio.AppInfoMonitor.changed` signal. The signal will be emitted once when
the app info database changes, and will not be emitted again until after the
next call to `Gio.AppInfo.getAll()` or another `g_app_info_*()` function.
This is because monitoring the app info database for changes is expensive.

The following functions will re-arm the `Gio.AppInfoMonitor.changed`
signal so it can be emitted again:

 - `Gio.AppInfo.getAll()`
 - `Gio.AppInfo.getAllForType()`
 - `Gio.AppInfo.getDefaultForType()`
 - `Gio.AppInfo.getFallbackForType()`
 - `Gio.AppInfo.getRecommendedForType()`
 - [`g_desktop_app_info_get_implementations()`](../gio-unix/type_func.DesktopAppInfo.get_implementation.html)
 - [`g_desktop_app_info_new()`](../gio-unix/ctor.DesktopAppInfo.new.html)
 - [`g_desktop_app_info_new_from_filename()`](../gio-unix/ctor.DesktopAppInfo.new_from_filename.html)
 - [`g_desktop_app_info_new_from_keyfile()`](../gio-unix/ctor.DesktopAppInfo.new_from_keyfile.html)
 - [`g_desktop_app_info_search()`](../gio-unix/type_func.DesktopAppInfo.search.html)

The latter functions are available if using
[`GDesktopAppInfo`](../gio-unix/class.DesktopAppInfo.html) from
`gio-unix-2.0.pc` (GIR namespace `GioUnix-2.0`).

In the usual case, applications should try to make note of the change
(doing things like invalidating caches) but not act on it. In
particular, applications should avoid making calls to `GAppInfo` APIs
in response to the change signal, deferring these until the time that
the updated data is actually required. The exception to this case is when
application information is actually being displayed on the screen
(for example, during a search or when the list of all applications is shown).
The reason for this is that changes to the list of installed applications
often come in groups (like during system updates) and rescanning the list
on every change is pointless and expensive.

_Available since 2.40._

```tsx
import { GAppInfoMonitor } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GAppInfoMonitor**

## Props

`ref` receives the `Gio.AppInfoMonitor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onChanged`

```ts
(self: Gio.AppInfoMonitor) => void
```

Signal emitted when the app info database changes, when applications are
installed or removed.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 2.40._
