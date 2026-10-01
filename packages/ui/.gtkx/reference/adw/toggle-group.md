---
description: "A group of exclusive toggles."
---

# AdwToggleGroup

A group of exclusive toggles.



`AdwToggleGroup` presents a set of exclusive toggles, represented as
`Toggle` objects. Each toggle can display an icon, a label, an icon
and a label, or a custom child.

Toggles are indexed by their position, with the first toggle being equivalent
to 0, and so on. Use the `ToggleGroup.active` to get that position.

Toggles can also have optional names, set via the `Toggle.name`
property. The name of the active toggle can be accessed via the
`ToggleGroup.activeName` property.

`AdwToggle` objects can be retrieved via their index or name, using
`ToggleGroup.getToggle()` or `ToggleGroup.getToggleByName()`
respectively. `AdwToggleGroup` also provides a `Gtk.SelectionModel` of
its toggles via the `ToggleGroup.toggles` property.

`AdwToggleGroup` is orientable, and the toggles can be displayed horizontally
or vertically. This is mostly useful for icon-only toggles.

Use the `ToggleGroup.homogeneous` property to make the toggles take
the same size, and the `ToggleGroup.canShrink` to control whether
the toggles can ellipsize.

Example of an `AdwToggleGroup` UI definition:

```xml
 <object class="AdwToggleGroup">
   <property name="active-name">picture</property>
   <child>
     <object class="AdwToggle">
       <property name="icon-name">camera-photo-symbolic</property>
       <property name="tooltip" translatable="yes">Picture Mode</property>
       <property name="name">picture</property>
     </object>
   </child>
   <child>
     <object class="AdwToggle">
       <property name="icon-name">camera-video-symbolic</property>
       <property name="tooltip" translatable="yes">Recording Mode</property>
       <property name="name">recording</property>
     </object>
   </child>
 </object>
```

See also: `InlineViewSwitcher`.

### CSS nodes

`AdwToggleGroup` has a main CSS node with the name `toggle-group`.

Its toggles have CSS nodes with the name `toggle`, and its separators have nodes
with the name `separator`.

Toggle nodes will have a different style classes depending on their content:
`.text-button` for labels, `.image-button` for icons, `.image-text-button`
for both or no style class for custom children.

The hidden separators use the `.hidden` style class.

### Style classes

`AdwToggleGroup` can use the [`.flat`](style-classes.html#flat_1) style class
to remove its background and make it look like a group of buttons.



It can also use the [`.round`](style-classes.html#round) style class to make
its toggles and the group itself rounded.



They can also be combined with each other.



### Accessibility

`AdwToggleGroup` uses the `Gtk.AccessibleRole.radio-group` role. Its
toggles use the `Gtk.AccessibleRole.radio` role.

_Available since 1.7._

```tsx
import { AdwToggleGroup } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwToggleGroup**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkOrientable`.

## Props

`ref` receives the `Adw.ToggleGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`number` · default `4294967295`

The index of the active toggle.

Setting the index to a larger value than the number of toggles in the group
unsets the current active toggle.

If no toggle is active, the property will be set to
`Gtk.INVALID_LIST_POSITION`.

_Available since 1.7._

### `activeName`

`string` · default `null`

The name of the active toggle.

The name can be set via `Toggle.name`. If the currently active
toggle doesn't have a name, the property will be set to `NULL`.

Set it to `NULL` to unset the current active toggle.

_Available since 1.7._

### `canShrink`

`boolean` · default `true`

Whether the toggles can be smaller than the natural size of their contents.

If set to `TRUE`, the toggle labels will ellipsize.

See `Gtk.Button.canShrink`.

_Available since 1.7._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `homogeneous`

`boolean` · default `false`

Whether all toggles take the same size.

_Available since 1.7._

### `nToggles`

`number` · default `0` · read-only, observe with `onNotifyNToggles`

The number of toggles within the group.

_Available since 1.7._

### `orientation`

`Gtk.Orientation` · default `GTK_ORIENTATION_HORIZONTAL` · from `GtkOrientable`

The orientation of the orientable.

### `toggles`

`Gtk.SelectionModel` · read-only, observe with `onNotifyToggles`

A selection model with the groups's toggles.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track and change the active
toggle.

_Available since 1.7._

## Methods

Methods are called on the `Adw.ToggleGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(toggle: Adw.Toggle): void
```

Adds a toggle to `self`.

**Parameters**

- `toggle`: the toggle to add

_Available since 1.7._

### `getActive`

```ts
getActive(): number
```

Gets the index of the active toggle in `self`.

Returns `Gtk.INVALID_LIST_POSITION` if no toggle is active.

**Returns** the active toggle index

_Available since 1.7._

### `getActiveName`

```ts
getActiveName(): string | null
```

Gets the name of the active toggle in `self`.

Can be `NULL` if the currently active toggle doesn't have a name.

See `Toggle.name`.

**Returns** the active toggle name

_Available since 1.7._

### `getCanShrink`

```ts
getCanShrink(): boolean
```

Gets whether the toggles can be smaller than the natural size of their
contents.

**Returns** whether the toggles can shrink

_Available since 1.7._

### `getHomogeneous`

```ts
getHomogeneous(): boolean
```

Gets whether all toggles take the same size.

**Returns** whether all toggles take the same size

_Available since 1.7._

### `getNToggles`

```ts
getNToggles(): number
```

Gets the number of toggles within `self`.

**Returns** the number of toggles

_Available since 1.7._

### `getToggle`

```ts
getToggle(index: number): Adw.Toggle | null
```

Gets the toggle with `index` from `self`.

**Parameters**

- `index`: toggle's index

**Returns** the toggle

_Available since 1.7._

### `getToggleByName`

```ts
getToggleByName(name: string): Adw.Toggle | null
```

Gets the toggle with the name `name` from `self`.

**Parameters**

- `name`: toggle name

**Returns** the toggle

_Available since 1.7._

### `getToggles`

```ts
getToggles(): Gtk.SelectionModel
```

Returns a `Gio.ListModel` that contains the toggles of the group.

This can be used to keep an up-to-date view. The model also implements
`Gtk.SelectionModel` and can be used to track and change the active
toggle.

**Returns** a `GtkSelectionModel` for the group's toggles

### `remove`

```ts
remove(toggle: Adw.Toggle): void
```

Removes `toggle` from `self`.

**Parameters**

- `toggle`: a toggle to remove

_Available since 1.7._

### `removeAll`

```ts
removeAll(): void
```

Removes all toggles from `self`.

_Available since 1.7._

### `setActive`

```ts
setActive(active: number): void
```

Sets the active toggle for `self`.

If the index is larger than the number of toggles in `self`, unsets the
current active toggle.

**Parameters**

- `active`: toggle index

_Available since 1.7._

### `setActiveName`

```ts
setActiveName(name: string | null): void
```

Sets the active toggle for `self`.

The name can be set via `Toggle.name`.

If `name` is `NULL`, unset the current active toggle instead.

**Parameters**

- `name`: toggle name

_Available since 1.7._

### `setCanShrink`

```ts
setCanShrink(canShrink: boolean): void
```

Sets whether the toggles can be smaller than the natural size of their
contents.

If `can_shrink` is `TRUE`, the toggle labels will ellipsize.

See `Gtk.Button.canShrink`.

**Parameters**

- `canShrink`: whether the toggles can shrink

_Available since 1.7._

### `setHomogeneous`

```ts
setHomogeneous(homogeneous: boolean): void
```

Sets whether all toggles take the same size.

**Parameters**

- `homogeneous`: whether all toggles should take the same size

_Available since 1.7._
