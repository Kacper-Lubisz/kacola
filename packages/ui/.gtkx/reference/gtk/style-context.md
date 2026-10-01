---
description: "GtkStyleContext stores styling information affecting a widget."
---

# GtkStyleContext

`GtkStyleContext` stores styling information affecting a widget.

In order to construct the final style information, `GtkStyleContext`
queries information from all attached `GtkStyleProviders`. Style
providers can be either attached explicitly to the context through
`Gtk.StyleContext.addProvider()`, or to the display through
`Gtk.StyleContext.addProviderForDisplay()`. The resulting
style is a combination of all providers’ information in priority order.

For GTK widgets, any `GtkStyleContext` returned by
`Gtk.Widget.getStyleContext()` will already have a `GdkDisplay`
and RTL/LTR information set. The style context will also be updated
automatically if any of these settings change on the widget.

### Style Classes

Widgets can add style classes to their context, which can be used to associate
different styles by class. The documentation for individual widgets lists
which style classes it uses itself, and which style classes may be added by
applications to affect their appearance.

## Custom styling in UI libraries and applications

If you are developing a library with custom widgets that render differently
than standard components, you may need to add a `GtkStyleProvider` yourself
with the `GTK_STYLE_PROVIDER_PRIORITY_FALLBACK` priority, either a
`GtkCssProvider` or a custom object implementing the `GtkStyleProvider`
interface. This way themes may still attempt to style your UI elements in
a different way if needed so.

If you are using custom styling on an applications, you probably want then
to make your style information prevail to the theme’s, so you must use
a `GtkStyleProvider` with the `GTK_STYLE_PROVIDER_PRIORITY_APPLICATION`
priority, keep in mind that the user settings in
`XDG_CONFIG_HOME/gtk-4.0/gtk.css` will
still take precedence over your changes, as it uses the
`GTK_STYLE_PROVIDER_PRIORITY_USER` priority.

> **Deprecated since 4.10.** The relevant API has been moved to `Gtk.Widget` where applicable; otherwise, there is no replacement for querying the style machinery. Stylable UI elements should use widgets.

```tsx
import { GtkStyleContext } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkStyleContext**

## Props

`ref` receives the `Gtk.StyleContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `display`

`Gdk.Display | ReactElement`

The display of the style context.

## Methods

Methods are called on the `Gtk.StyleContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addClass`

```ts
addClass(className: string): void
```

Adds a style class to `context`, so later uses of the
style context will make use of this new class for styling.

In the CSS file format, a `GtkEntry` defining a “search”
class, would be matched by:

```css
entry.search { ... }
```

While any widget defining a “search” class would be
matched by:
```css
.search { ... }
```

**Parameters**

- `className`: class name to use in styling

> **Deprecated since 4.10.** Use `Gtk.Widget.addCssClass()` instead

### `addProvider`

```ts
addProvider(provider: Gtk.StyleProvider, priority: number): void
```

Adds a style provider to `context`, to be used in style construction.

Note that a style provider added by this function only affects
the style of the widget to which `context` belongs. If you want
to affect the style of all widgets, use
`Gtk.StyleContext.addProviderForDisplay()`.

Note: If both priorities are the same, a `GtkStyleProvider`
added through this function takes precedence over another added
through `Gtk.StyleContext.addProviderForDisplay()`.

**Parameters**

- `provider`: a `GtkStyleProvider`
- `priority`: the priority of the style provider. The lower it is, the earlier it will be used in the style construction. Typically this will be in the range between `GTK_STYLE_PROVIDER_PRIORITY_FALLBACK` and `GTK_STYLE_PROVIDER_PRIORITY_USER`

> **Deprecated since 4.10.** Use style classes instead

### `getBorder`

```ts
getBorder(): Gtk.Border
```

Gets the border for a given state as a `GtkBorder`.

**Returns** return value for the border settings

> **Deprecated since 4.10.** This api will be removed in GTK 5

### `getColor`

```ts
getColor(): Gdk.RGBA
```

Gets the foreground color for a given state.

**Returns** return value for the foreground color

> **Deprecated since 4.10.** Use `Gtk.Widget.getColor()` instead

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Returns the `GdkDisplay` to which `context` is attached.

**Returns** a `GdkDisplay`.

> **Deprecated since 4.10.** Use `Gtk.Widget.getDisplay()` instead

### `getMargin`

```ts
getMargin(): Gtk.Border
```

Gets the margin for a given state as a `GtkBorder`.

**Returns** return value for the margin settings

> **Deprecated since 4.10.** This api will be removed in GTK 5

### `getPadding`

```ts
getPadding(): Gtk.Border
```

Gets the padding for a given state as a `GtkBorder`.

**Returns** return value for the padding settings

> **Deprecated since 4.10.** This api will be removed in GTK 5

### `getScale`

```ts
getScale(): number
```

Returns the scale used for assets.

**Returns** the scale

> **Deprecated since 4.10.** Use `Gtk.Widget.getScaleFactor()` instead

### `getState`

```ts
getState(): Gtk.StateFlags
```

Returns the state used for style matching.

This method should only be used to retrieve the `GtkStateFlags`
to pass to `GtkStyleContext` methods, like
`Gtk.StyleContext.getPadding()`.
If you need to retrieve the current state of a `GtkWidget`, use
`Gtk.Widget.getStateFlags()`.

**Returns** the state flags

> **Deprecated since 4.10.** Use `Gtk.Widget.getStateFlags()` instead

### `hasClass`

```ts
hasClass(className: string): boolean
```

Returns `true` if `context` currently has defined the
given class name.

**Parameters**

- `className`: a class name

**Returns** `true` if `context` has `class_name` defined

> **Deprecated since 4.10.** Use `Gtk.Widget.hasCssClass()` instead

### `lookupColor`

```ts
lookupColor(colorName: string): [boolean, Gdk.RGBA]
```

Looks up and resolves a color name in the `context` color map.

**Parameters**

- `colorName`: color name to lookup

**Returns** Tuple of:

- `result`: `true` if `color_name` was found and resolved, `false` otherwise
- `color`: Return location for the looked up color

> **Deprecated since 4.10.** This api will be removed in GTK 5

### `removeClass`

```ts
removeClass(className: string): void
```

Removes `class_name` from `context`.

**Parameters**

- `className`: class name to remove

> **Deprecated since 4.10.** Use `Gtk.Widget.removeCssClass()` instead

### `removeProvider`

```ts
removeProvider(provider: Gtk.StyleProvider): void
```

Removes `provider` from the style providers list in `context`.

**Parameters**

- `provider`: a `GtkStyleProvider`

> **Deprecated since 4.10.**

### `restore`

```ts
restore(): void
```

Restores `context` state to a previous stage.

See `Gtk.StyleContext.save()`.

> **Deprecated since 4.10.** This API will be removed in GTK 5

### `save`

```ts
save(): void
```

Saves the `context` state.

This allows temporary modifications done through
`Gtk.StyleContext.addClass()`,
`Gtk.StyleContext.removeClass()`,
`Gtk.StyleContext.setState()` to be quickly
reverted in one go through `Gtk.StyleContext.restore()`.

The matching call to `Gtk.StyleContext.restore()`
must be done before GTK returns to the main loop.

> **Deprecated since 4.10.** This API will be removed in GTK 5

### `setDisplay`

```ts
setDisplay(display: Gdk.Display): void
```

Attaches `context` to the given display.

The display is used to add style information from “global”
style providers, such as the display's `GtkSettings` instance.

If you are using a `GtkStyleContext` returned from
`Gtk.Widget.getStyleContext()`, you do not need to
call this yourself.

**Parameters**

- `display`: a `GdkDisplay`

> **Deprecated since 4.10.** You should not use this api

### `setScale`

```ts
setScale(scale: number): void
```

Sets the scale to use when getting image assets for the style.

**Parameters**

- `scale`: scale

> **Deprecated since 4.10.** You should not use this api

### `setState`

```ts
setState(flags: Gtk.StateFlags): void
```

Sets the state to be used for style matching.

**Parameters**

- `flags`: state to represent

> **Deprecated since 4.10.** You should not use this api

### `toString`

```ts
toString(flags: Gtk.StyleContextPrintFlags): string
```

Converts the style context into a string representation.

The string representation always includes information about
the name, state, id, visibility and style classes of the CSS
node that is backing `context`. Depending on the flags, more
information may be included.

This function is intended for testing and debugging of the
CSS implementation in GTK. There are no guarantees about
the format of the returned string, it may change.

**Parameters**

- `flags`: Flags that determine what to print

**Returns** a newly allocated string representing `context`

> **Deprecated since 4.10.** This api will be removed in GTK 5
