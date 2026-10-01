---
description: "Offers notification when displays appear or disappear."
---

# GdkDisplayManager

Offers notification when displays appear or disappear.

`GdkDisplayManager` is a singleton object.

You can use `Gdk.DisplayManager.get()` to obtain the `GdkDisplayManager`
singleton, but that should be rarely necessary. Typically, initializing
GTK opens a display that you can work with without ever accessing the
`GdkDisplayManager`.

The GDK library can be built with support for multiple backends.
The `GdkDisplayManager` object determines which backend is used
at runtime.

In the rare case that you need to influence which of the backends
is being used, you can use `Gdk.setAllowedBackends()`. Note
that you need to call this function before initializing GTK.

### Backend-specific code

When writing backend-specific code that is supposed to work with
multiple GDK backends, you have to consider both compile time and
runtime. At compile time, use the `GDK_WINDOWING_X11`, `GDK_WINDOWING_WIN32`
macros, etc. to find out which backends are present in the GDK library
you are building your application against. At runtime, use type-check
macros like GDK_IS_X11_DISPLAY() to find out which backend is in use:

```c
#ifdef GDK_WINDOWING_X11
  if (GDK_IS_X11_DISPLAY (display))
    {
      // make X11-specific calls here
    }
  else
#endif
#ifdef GDK_WINDOWING_MACOS
  if (GDK_IS_MACOS_DISPLAY (display))
    {
      // make Quartz-specific calls here
    }
  else
#endif
  g_error ("Unsupported GDK backend");
```

```tsx
import { GdkDisplayManager } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkDisplayManager**

## Props

`ref` receives the `Gdk.DisplayManager` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `defaultDisplay`

`Gdk.Display | ReactElement`

The default display.

## Signals

### `onDisplayOpened`

```ts
(display: Gdk.Display, self: Gdk.DisplayManager) => void
```

Emitted when a display is opened.

**Parameters**

- `display`: the opened display
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.DisplayManager` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `getDefaultDisplay`

```ts
getDefaultDisplay(): Gdk.Display | null
```

Gets the default `GdkDisplay`.

**Returns** a `GdkDisplay`

### `listDisplays`

```ts
listDisplays(): Gdk.Display[]
```

List all currently open displays.

**Returns** a newly
  allocated `GSList` of `GdkDisplay` objects

### `openDisplay`

```ts
openDisplay(name: string | null): Gdk.Display | null
```

Opens a display.

**Parameters**

- `name`: the name of the display to open

**Returns** a `GdkDisplay`, or `null`
  if the display could not be opened

### `setDefaultDisplay`

```ts
setDefaultDisplay(display: Gdk.Display): void
```

Sets `display` as the default display.

**Parameters**

- `display`: a `GdkDisplay`
