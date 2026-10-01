---
description: "Emits signals to manage listitems."
---

# GtkSignalListItemFactory

Emits signals to manage listitems.

Signals are emitted for every listitem in the same order:

 1. `Gtk.SignalListItemFactory.setup` is emitted to set up permanent
 things on the listitem. This usually means constructing the widgets used in
 the row and adding them to the listitem.

 2. `Gtk.SignalListItemFactory.bind` is emitted to bind the item passed
 via `Gtk.ListItem.item` to the widgets that have been created in
 step 1 or to add item-specific widgets. Signals are connected to listen to
 changes - both to changes in the item to update the widgets or to changes
 in the widgets to update the item. After this signal has been called, the
 listitem may be shown in a list widget.

 3. `Gtk.SignalListItemFactory.unbind` is emitted to undo everything
 done in step 2. Usually this means disconnecting signal handlers. Once this
 signal has been called, the listitem will no longer be used in a list
 widget.

 4. `Gtk.SignalListItemFactory.bind` and
 `Gtk.SignalListItemFactory.unbind` may be emitted multiple times
 again to bind the listitem for use with new items. By reusing listitems,
 potentially costly setup can be avoided. However, it means code needs to
 make sure to properly clean up the listitem in step 3 so that no information
 from the previous use leaks into the next one.

 5. `Gtk.SignalListItemFactory.teardown` is emitted to allow undoing
 the effects of `Gtk.SignalListItemFactory.setup`. After this signal
 was emitted on a listitem, the listitem will be destroyed and not be used again.

Note that during the signal emissions, changing properties on the listitems
passed will not trigger notify signals as the listitem's notifications are
frozen. See `GObject.Object.freezeNotify()` for details.

For tracking changes in other properties in the listitem, the
::notify signal is recommended. The signal can be connected in the
`Gtk.SignalListItemFactory.setup` signal and removed again during
`Gtk.SignalListItemFactory.teardown`.

```tsx
import { GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkListItemFactory](.gtkx/reference/gtk/list-item-factory.md) → **GtkSignalListItemFactory**

## Props

`ref` receives the `Gtk.SignalListItemFactory` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onBind`

```ts
(object: GObject.Object, self: Gtk.SignalListItemFactory) => void
```

Emitted when an object has been bound to an item.

The handler for this signal must set
to populate the listitem with widgets.

After this signal was emitted, the object might be shown in
a `Gtk.ListView` or other widget.

The `Gtk.SignalListItemFactory.unbind` signal is the
opposite of this signal and can be used to undo everything done
in this signal.

**Parameters**

- `object`: The `GObject` to bind
- `self`: The instance the signal was emitted on.

### `onSetup`

```ts
(object: GObject.Object, self: Gtk.SignalListItemFactory) => void
```

Emitted when a newly created listitem needs to be prepared for use.

It is the first signal emitted for every listitem.

The handler for this signal must call `Gtk.ListItem.setChild()`
to populate the listitem with widgets.

The `Gtk.SignalListItemFactory.teardown` signal is the opposite
of this signal and can be used to undo everything done in this signal.

**Parameters**

- `object`: the `GObject` to set up
- `self`: The instance the signal was emitted on.

### `onTeardown`

```ts
(object: GObject.Object, self: Gtk.SignalListItemFactory) => void
```

Emitted when an object is about to be destroyed.

It is the last signal ever emitted for this `object`.

This signal is the opposite of the `Gtk.SignalListItemFactory.setup`
signal and should be used to undo everything done in that signal.

**Parameters**

- `object`: The `GObject` to tear down
- `self`: The instance the signal was emitted on.

### `onUnbind`

```ts
(object: GObject.Object, self: Gtk.SignalListItemFactory) => void
```

Emitted when an object has been unbound from its item.

This happens for example when a listitem was removed from use
in a list widget and its `Gtk.ListItem.item` is about
to be unset.

This signal is the opposite of the `Gtk.SignalListItemFactory.bind`
signal and should be used to undo everything done in that signal.

**Parameters**

- `object`: The `GObject` to unbind
- `self`: The instance the signal was emitted on.
