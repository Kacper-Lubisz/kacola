---
description: "Widget for single cell of completion proposal."
---

# GtkSourceCompletionCell

Widget for single cell of completion proposal.

The `GtkSourceCompletionCell` widget provides a container to display various
types of information with the completion display.

Each proposal may consist of multiple cells depending on the complexity of
the proposal. For example, programming language proposals may contain a cell
for the "left-hand-side" of an operation along with the "typed-text" for a
function name and "parameters". They may also optionally set an icon to
signify the kind of result.

A `CompletionProvider` should implement the
`CompletionProvider.display()` virtual function to control
how to convert data from their `CompletionProposal` to content for
the `GtkSourceCompletionCell`.

```tsx
import { GtkSourceCompletionCell } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSourceCompletionCell**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `GtkSource.CompletionCell` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `column`

`GtkSource.CompletionColumn` · default `GTK_SOURCE_COMPLETION_COLUMN_TYPED_TEXT` · construct-only

### `markup`

`string` · default `null`

### `paintable`

`Gdk.Paintable | ReactElement`

### `text`

`string` · default `null`

### `widget`

`Gtk.Widget | ReactElement`

## Methods

Methods are called on the `GtkSource.CompletionCell` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getColumn`

```ts
getColumn(): GtkSource.CompletionColumn
```

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Gets the child `GtkWidget`, if any.

**Returns** a `GtkWidget` or `null`

### `setGicon`

```ts
setGicon(gicon: Gio.Icon): void
```

### `setIconName`

```ts
setIconName(iconName: string): void
```

### `setMarkup`

```ts
setMarkup(markup: string): void
```

### `setPaintable`

```ts
setPaintable(paintable: Gdk.Paintable): void
```

### `setText`

```ts
setText(text: string | null): void
```

Sets the text for the column cell. Use `null` to unset.

**Parameters**

- `text`: the text to set or `null`

### `setTextWithAttributes`

```ts
setTextWithAttributes(text: string, attrs: Pango.AttrList): void
```

### `setWidget`

```ts
setWidget(child: Gtk.Widget): void
```
