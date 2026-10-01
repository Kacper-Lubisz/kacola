---
description: "Context for populating HoverDisplay contents."
---

# GtkSourceHoverContext

Context for populating `HoverDisplay` contents.

`GtkSourceHoverContext` contains information about the request to populate
contents for a `HoverDisplay`.

It can be used to retrieve the `View`, `Buffer`, and
`Gtk.TextIter` for the regions of text which are being displayed.

Use `HoverContext.getBounds()` to get the word that was
requested. `HoverContext.getIter()` will get you the location
of the pointer when the request was made.

```tsx
import { GtkSourceHoverContext } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceHoverContext**

## Props

`ref` receives the `GtkSource.HoverContext` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GtkSource.HoverContext` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getBounds`

```ts
getBounds(): [boolean, Gtk.TextIter, Gtk.TextIter]
```

Gets the current word bounds of the hover.

If `begin` is non-`null`, it will be set to the start position of the
current word being hovered.

If `end` is non-`null`, it will be set to the end position for the
current word being hovered.

**Returns** Tuple of:

- `result`: `true` if the marks are still valid and `begin` or `end` was set.
- `begin`: a `GtkTextIter`
- `end`: a `GtkTextIter`

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

A convenience function to get the buffer.

**Returns** The `GtkSourceBuffer` for the view

### `getIter`

```ts
getIter(): [boolean, Gtk.TextIter]
```

Gets the location of the pointer where the request was made.

**Returns** Tuple of:

- `result`: `true` if the mark is still valid and `iter` was set.
- `iter`: a `GtkTextIter`

### `getView`

```ts
getView(): GtkSource.View
```

**Returns** the `GtkSourceView` that owns the context
