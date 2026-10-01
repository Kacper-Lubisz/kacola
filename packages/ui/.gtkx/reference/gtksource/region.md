---
description: "Region utility."
---

# GtkSourceRegion

Region utility.

A `GtkSourceRegion` permits to store a group of subregions of a
`Gtk.TextBuffer`. `GtkSourceRegion` stores the subregions with pairs of
`Gtk.TextMark`'s, so the region is still valid after insertions and deletions
in the `Gtk.TextBuffer`.

The `Gtk.TextMark` for the start of a subregion has a left gravity, while the
`Gtk.TextMark` for the end of a subregion has a right gravity.

The typical use-case of `GtkSourceRegion` is to scan a `Gtk.TextBuffer` chunk by
chunk, not the whole buffer at once to not block the user interface. The
`GtkSourceRegion` represents in that case the remaining region to scan. You
can listen to the `Gtk.TextBuffer.insert-text` and
`Gtk.TextBuffer.delete-range` signals to update the `GtkSourceRegion`
accordingly.

To iterate through the subregions, you need to use a `RegionIter`,
for example:
```c
GtkSourceRegion *region;
GtkSourceRegionIter region_iter;

gtk_source_region_get_start_region_iter (region, &region_iter);

while (!gtk_source_region_iter_is_end (&region_iter))
{
        GtkTextIter subregion_start;
        GtkTextIter subregion_end;

        if (!gtk_source_region_iter_get_subregion (&region_iter,
                                                   &subregion_start,
                                                   &subregion_end))
        {
                break;
        }

        // Do something useful with the subregion.

        gtk_source_region_iter_next (&region_iter);
}
```
```python
buffer: GtkSource.Buffer = GtkSource.Buffer()
region: GtkSource.Region = GtkSource.Region(buffer=buffer)
region_iter = region.get_start_region_iter()

while not region_iter.is_end():
    success, start, end = region_iter.get_subregion()
    if not success:
        break

    # Do something useful with the subregion

    region_iter.next()
```

```tsx
import { GtkSourceRegion } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceRegion**

## Props

`ref` receives the `GtkSource.Region` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`Gtk.TextBuffer` · construct-only

The `Gtk.TextBuffer`. The `GtkSourceRegion` has a weak reference to the
buffer.

## Methods

Methods are called on the `GtkSource.Region` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addRegion`

```ts
addRegion(regionToAdd: GtkSource.Region | null): void
```

Adds `region_to_add` to `region`.

`region_to_add` is not modified.

**Parameters**

- `regionToAdd`: the `GtkSourceRegion` to add to `region`, or `null`.

### `addSubregion`

```ts
addSubregion(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Adds the subregion delimited by `_start` and `_end` to `region`.

**Parameters**

- `start`: the start of the subregion.
- `end`: the end of the subregion.

### `getBounds`

```ts
getBounds(): [boolean, Gtk.TextIter, Gtk.TextIter]
```

Gets the `start` and `end` bounds of the `region`.

**Returns** Tuple of:

- `result`: `true` if `start` and `end` have been set successfully (if non-`null`), or `false` if the `region` is empty.
- `start`: iterator to initialize with the start of `region`, or `null`.
- `end`: iterator to initialize with the end of `region`, or `null`.

### `getBuffer`

```ts
getBuffer(): Gtk.TextBuffer | null
```

**Returns** the `GtkTextBuffer`.

### `getStartRegionIter`

```ts
getStartRegionIter(): GtkSource.RegionIter
```

Initializes a `RegionIter` to the first subregion of `region`.

If `region` is empty, `iter` will be initialized to the end iterator.

**Returns** iterator to initialize to the first subregion.

### `intersectRegion`

```ts
intersectRegion(region2: GtkSource.Region | null): GtkSource.Region | null
```

Returns the intersection between `region1` and `region2`.

`region1` and `region2` are not modified.

**Parameters**

- `region2`: a `GtkSourceRegion`, or `null`.

**Returns** the intersection as a `GtkSourceRegion`
  object.

### `intersectSubregion`

```ts
intersectSubregion(start: Gtk.TextIter, end: Gtk.TextIter): GtkSource.Region | null
```

Returns the intersection between `region` and the subregion delimited by
`_start` and `_end`.

`region` is not modified.

**Parameters**

- `start`: the start of the subregion.
- `end`: the end of the subregion.

**Returns** the intersection as a new
  `GtkSourceRegion`.

### `isEmpty`

```ts
isEmpty(): boolean
```

Returns whether the `region` is empty.

A `null` `region` is considered empty.

**Returns** whether the `region` is empty.

### `subtractRegion`

```ts
subtractRegion(regionToSubtract: GtkSource.Region | null): void
```

Subtracts `region_to_subtract` from `region`.

`region_to_subtract` is not modified.

**Parameters**

- `regionToSubtract`: the `GtkSourceRegion` to subtract from `region`, or `null`.

### `subtractSubregion`

```ts
subtractSubregion(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Subtracts the subregion delimited by `_start` and `_end` from `region`.

**Parameters**

- `start`: the start of the subregion.
- `end`: the end of the subregion.

### `toString`

```ts
toString(): string | null
```

Gets a string represention of `region`, for debugging purposes.

The returned string contains the character offsets of the subregions. It
doesn't include a newline character at the end of the string.

**Returns** a string represention of `region`. Free
  with `g_free()` when no longer needed.
