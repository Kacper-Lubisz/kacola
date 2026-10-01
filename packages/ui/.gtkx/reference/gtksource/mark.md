---
description: "Mark object for Buffer."
---

# GtkSourceMark

Mark object for `Buffer`.

A `GtkSourceMark` marks a position in the text where you want to display
additional info. It is based on `Gtk.TextMark` and thus is still valid after
the text has changed though its position may change.

`GtkSourceMark`s are organized in categories which you have to set
when you create the mark. Each category can have a priority, a pixbuf and
other associated attributes. See `View.setMarkAttributes()`.
The pixbuf will be displayed in the margin at the line where the mark
residents if the `View.showLineMarks` property is set to `true`. If
there are multiple marks in the same line, the pixbufs will be drawn on top
of each other. The mark with the highest priority will be drawn on top.

```tsx
import { GtkSourceMark } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkTextMark](.gtkx/reference/gtk/text-mark.md) → **GtkSourceMark**

## Props

`ref` receives the `GtkSource.Mark` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `category`

`string` · default `null` · construct-only

The category of the `GtkSourceMark`, classifies the mark and controls
which pixbuf is used and with which priority it is drawn.

## Methods

Methods are called on the `GtkSource.Mark` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getCategory`

```ts
getCategory(): string
```

Returns the mark category.

**Returns** the category of the `GtkSourceMark`.

### `next`

```ts
next(category: string | null): GtkSource.Mark | null
```

Returns the next `GtkSourceMark` in the buffer or `null` if the mark
was not added to a buffer.

 If there is no next mark, `null` will be returned.

If `category` is `null`, looks for marks of any category.

**Parameters**

- `category`: a string specifying the mark category, or `null`.

**Returns** the next `GtkSourceMark`, or `null`.

### `prev`

```ts
prev(category: string | null): GtkSource.Mark | null
```

Returns the previous `GtkSourceMark` in the buffer or `null` if the mark
was not added to a buffer.

If there is no previous mark, `null` is returned.

If `category` is `null`, looks for marks of any category

**Parameters**

- `category`: a string specifying the mark category, or `null`.

**Returns** the previous `GtkSourceMark`, or `null`.
