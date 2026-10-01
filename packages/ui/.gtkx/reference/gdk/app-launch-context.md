---
description: "Handles launching an application in a graphical context."
---

# GdkAppLaunchContext

Handles launching an application in a graphical context.

It is an implementation of `GAppLaunchContext` that provides startup
notification and allows to launch applications on a specific workspace.

### Launching an application

```c
GdkAppLaunchContext *context;

context = gdk_display_get_app_launch_context (display);

gdk_app_launch_context_set_timestamp (gdk_event_get_time (event));

if (!g_app_info_launch_default_for_uri ("http://www.gtk.org", context, &error))
  g_warning ("Launching failed: %s\n", error->message);

g_object_unref (context);
```

```tsx
import { GdkAppLaunchContext } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GAppLaunchContext](.gtkx/reference/gio/app-launch-context.md) → **GdkAppLaunchContext**

## Props

`ref` receives the `Gdk.AppLaunchContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display` · construct-only

The display that the `GdkAppLaunchContext` is on.

## Methods

Methods are called on the `Gdk.AppLaunchContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `appLaunchContextGetDisplay`

```ts
appLaunchContextGetDisplay(): Gdk.Display
```

Gets the `GdkDisplay` that `context` is for.

**Returns** the display of `context`

### `setDesktop`

```ts
setDesktop(desktop: number): void
```

Sets the workspace on which applications will be launched.

This only works when running under a window manager that
supports multiple workspaces, as described in the
[Extended Window Manager Hints](http://www.freedesktop.org/Standards/wm-spec).
Specifically this sets the `_NET_WM_DESKTOP` property described
in that spec.

This only works when using the X11 backend.

When the workspace is not specified or `desktop` is set to -1,
it is up to the window manager to pick one, typically it will
be the current workspace.

**Parameters**

- `desktop`: the number of a workspace, or -1

### `setIcon`

```ts
setIcon(icon: Gio.Icon | null): void
```

Sets the icon for applications that are launched with this
context.

Window Managers can use this information when displaying startup
notification.

See also `Gdk.AppLaunchContext.setIconName()`.

**Parameters**

- `icon`: a `GIcon`

### `setIconName`

```ts
setIconName(iconName: string | null): void
```

Sets the icon for applications that are launched with this context.

The `icon_name` will be interpreted in the same way as the Icon field
in desktop files. See also `Gdk.AppLaunchContext.setIcon()`.

If both `icon` and `icon_name` are set, the `icon_name` takes priority.
If neither `icon` or `icon_name` is set, the icon is taken from either
the file that is passed to launched application or from the `GAppInfo`
for the launched application itself.

**Parameters**

- `iconName`: an icon name

### `setTimestamp`

```ts
setTimestamp(timestamp: number): void
```

Sets the timestamp of `context`.

The timestamp should ideally be taken from the event that
triggered the launch.

Window managers can use this information to avoid moving the
focus to the newly launched application when the user is busy
typing in another window. This is also known as 'focus stealing
prevention'.

**Parameters**

- `timestamp`: a timestamp
