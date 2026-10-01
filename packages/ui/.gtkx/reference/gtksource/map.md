---
description: "Widget that displays a map for a specific View."
---

# GtkSourceMap

Widget that displays a map for a specific `View`.

`GtkSourceMap` is a widget that maps the content of a `View` into
a smaller view so the user can have a quick overview of the whole document.

This works by connecting a `View` to to the `GtkSourceMap` using
the `Map.view` property or `Map.setView()`.

`GtkSourceMap` is a `View` object. This means that you can add a
`GutterRenderer` to a gutter in the same way you would for a
`View`. One example might be a `GutterRenderer` that shows
which lines have changed in the document.

Additionally, it is desirable to match the font of the `GtkSourceMap` and
the `View` used for editing. Therefore, `Map.fontDesc`
should be used to set the target font. You will need to adjust this to the
desired font size for the map. A 1pt font generally seems to be an
appropriate font size. "Monospace 1" is the default. See
`Pango.FontDescription.setSize()` for how to alter the size of an existing
`Pango.FontDescription`.

When FontConfig is available, `GtkSourceMap` will try to use a bundled
"block" font to make the map more legible.

```tsx
import { GtkSourceMap } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkTextView](.gtkx/reference/gtk/text-view.md) → [GtkSourceView](.gtkx/reference/gtksource/view.md) → **GtkSourceMap**

Implements `GtkAccessible`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `GtkSource.Map` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `fontDesc`

`Pango.FontDescription`

### `view`

`GtkSource.View | ReactElement`

## Methods

Methods are called on the `GtkSource.Map` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getView`

```ts
getView(): GtkSource.View | null
```

Gets the `Map.view` property, which is the view this widget is mapping.

**Returns** a `GtkSourceView` or `null`.

### `setView`

```ts
setView(view: GtkSource.View): void
```

Sets the view that `map` will be doing the mapping to.

**Parameters**

- `view`: a `GtkSourceView`
