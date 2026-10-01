---
description: "A tag that can be applied to text in a Buffer."
---

# GtkSourceTag

A tag that can be applied to text in a `Buffer`.

`GtkSourceTag` is a subclass of `Gtk.TextTag` that adds properties useful for
the GtkSourceView library.

If, for a certain tag, `Gtk.TextTag` is sufficient, it's better that you create
a `Gtk.TextTag`, not a `Tag`.

```tsx
import { GtkSourceTag } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkTextTag](.gtkx/reference/gtk/text-tag.md) → **GtkSourceTag**

## Props

`ref` receives the `GtkSource.Tag` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `drawSpaces`

`boolean` · default `false`

Whether to draw white spaces.

This property takes precedence over the value defined by the `SpaceDrawer`'s
`SpaceDrawer.matrix` property (only where the tag is applied).

Setting this property also changes `Tag.drawSpacesSet` to
`true`.

### `drawSpacesSet`

`boolean` · default `false`

Whether the `Tag.drawSpaces` property is set and must be
taken into account.
