---
description: "Describes sorting criteria for a Gtk.SortListModel."
---

# GtkSorter

Describes sorting criteria for a `Gtk.SortListModel`.

Its primary user is `Gtk.SortListModel`

The model will use a sorter to determine the order in which
its items should appear by calling `Gtk.Sorter.compare()`
for pairs of items.

Sorters may change their sorting behavior through their lifetime.
In that case, they will emit the `Gtk.Sorter.changed` signal
to notify that the sort order is no longer valid and should be updated
by calling `gtk_sorter_compare()` again.

GTK provides various pre-made sorter implementations for common sorting
operations. `Gtk.ColumnView` has built-in support for sorting lists
via the `Gtk.ColumnViewColumn.sorter` property, where the user can
change the sorting by clicking on list headers.

Of course, in particular for large lists, it is also possible to subclass
`GtkSorter` and provide one's own sorter.

```tsx
import { GtkSorter } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSorter**

## Props

`ref` receives the `Gtk.Sorter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onChanged`

```ts
(change: Gtk.SorterChange, self: Gtk.Sorter) => void
```

Emitted whenever the sorter changed.

Users of the sorter should then update the sort order
again via `gtk_sorter_compare()`.

`Gtk.SortListModel` handles this signal automatically.

Depending on the `change` parameter, it may be possible to update
the sort order without a full resorting. Refer to the
`Gtk.SorterChange` documentation for details.

**Parameters**

- `change`: how the sorter changed
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Sorter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `changed`

```ts
changed(change: Gtk.SorterChange): void
```

Notifies all users of the sorter that it has changed.

This emits the `Gtk.Sorter.changed` signal. Users
of the sorter should then update the sort order via
`Gtk.Sorter.compare()`.

Depending on the `change` parameter, it may be possible to
update the sort order without a full resorting. Refer to
the `Gtk.SorterChange` documentation for details.

This function is intended for implementers of `GtkSorter`
subclasses and should not be called from other functions.

**Parameters**

- `change`: How the sorter changed

### `compare`

```ts
compare(item1: GObject.Object, item2: GObject.Object): Gtk.Ordering
```

Compares two given items according to the sort order implemented
by the sorter.

Sorters implement a partial order:

* It is reflexive, ie a = a
* It is antisymmetric, ie if a < b and b < a, then a = b
* It is transitive, ie given any 3 items with a ≤ b and b ≤ c,
  then a ≤ c

The sorter may signal it conforms to additional constraints
via the return value of `Gtk.Sorter.getOrder()`.

**Parameters**

- `item1`: first item to compare
- `item2`: second item to compare

**Returns** `GTK_ORDERING_EQUAL` if `item1` == `item2`,
  `GTK_ORDERING_SMALLER` if `item1` < `item2`,
  `GTK_ORDERING_LARGER` if `item1` > `item2`

### `getOrder`

```ts
getOrder(): Gtk.SorterOrder
```

Gets the order that `self` conforms to.

See `Gtk.SorterOrder` for details
of the possible return values.

This function is intended to allow optimizations.

**Returns** The order
