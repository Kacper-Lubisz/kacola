---
description: "Collects the tags in a GtkTextBuffer."
---

# GtkTextTagTable

Collects the tags in a `GtkTextBuffer`.

You may wish to begin by reading the
[text widget conceptual overview](section-text-widget.html),
which gives an overview of all the objects and data types
related to the text widget and how they work together.

## GtkTextTagTables as GtkBuildable

The `GtkTextTagTable` implementation of the `GtkBuildable` interface
supports adding tags by specifying “tag” as the “type” attribute
of a `<child>` element.

An example of a UI definition fragment specifying tags:
```xml
<object class="GtkTextTagTable">
 <child type="tag">
   <object class="GtkTextTag"/>
 </child>
</object>
```

```tsx
import { GtkTextTagTable } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkTextTagTable**

Implements `GtkBuildable`.

## Props

`ref` receives the `Gtk.TextTagTable` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onTagAdded`

```ts
(tag: Gtk.TextTag, self: Gtk.TextTagTable) => void
```

Emitted every time a new tag is added in the `GtkTextTagTable`.

**Parameters**

- `tag`: the added tag.
- `self`: The instance the signal was emitted on.

### `onTagChanged`

```ts
(tag: Gtk.TextTag, sizeChanged: boolean, self: Gtk.TextTagTable) => void
```

Emitted every time a tag in the `GtkTextTagTable` changes.

**Parameters**

- `tag`: the changed tag.
- `sizeChanged`: whether the change affects the `GtkTextView` layout.
- `self`: The instance the signal was emitted on.

### `onTagRemoved`

```ts
(tag: Gtk.TextTag, self: Gtk.TextTagTable) => void
```

Emitted every time a tag is removed from the `GtkTextTagTable`.

The `tag` is still valid by the time the signal is emitted, but
it is not associated with a tag table any more.

**Parameters**

- `tag`: the removed tag.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.TextTagTable` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(tag: Gtk.TextTag): boolean
```

Add a tag to the table.

The tag is assigned the highest priority in the table.

`tag` must not be in a tag table already, and may not have
the same name as an already-added tag.

**Parameters**

- `tag`: a `GtkTextTag`

**Returns** `true` on success.

### `foreach`

```ts
foreach(func: Gtk.TextTagTableForeach): void
```

Calls `func` on each tag in `table`, with user data `data`.

Note that the table may not be modified while iterating
over it (you can’t add/remove tags).

**Parameters**

- `func`: a function to call on each tag

### `getSize`

```ts
getSize(): number
```

Returns the size of the table (number of tags)

**Returns** number of tags in `table`

### `lookup`

```ts
lookup(name: string): Gtk.TextTag | null
```

Look up a named tag.

**Parameters**

- `name`: name of a tag

**Returns** The tag

### `remove`

```ts
remove(tag: Gtk.TextTag): void
```

Remove a tag from the table.

If a `GtkTextBuffer` has `table` as its tag table, the tag is
removed from the buffer. The table’s reference to the tag is
removed, so the tag will end up destroyed if you don’t have
a reference to it.

**Parameters**

- `tag`: a `GtkTextTag`
