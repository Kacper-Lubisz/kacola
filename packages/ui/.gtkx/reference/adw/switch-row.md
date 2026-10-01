---
description: "A Gtk.ListBoxRow used to represent two states."
---

# AdwSwitchRow

A `Gtk.ListBoxRow` used to represent two states.



The `AdwSwitchRow` widget contains a `Gtk.Switch` that allows the user
to select between two states: "on" or "off". When activated, the row will
invert its active state.

The user can control the switch by activating the row or by dragging on the
switch handle.

See `Gtk.Switch` for details.

Example of an `AdwSwitchRow` UI definition:
```xml
<object class="AdwSwitchRow">
  <property name="title" translatable="yes">Switch Row</property>
  <signal name="notify::active" handler="switch_row_notify_active_cb"/>
</object>
```

The `SwitchRow.active` property should be connected to in order to
monitor changes to the active state.

### Accessibility

`AdwSwitchRow` uses the `Gtk.AccessibleRole.switch` role.

_Available since 1.4._

```tsx
import { AdwSwitchRow } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkListBoxRow](.gtkx/reference/gtk/list-box-row.md) → [AdwPreferencesRow](.gtkx/reference/adw/preferences-row.md) → [AdwActionRow](.gtkx/reference/adw/action-row.md) → **AdwSwitchRow**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.SwitchRow` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `active`

`boolean` · default `false`

Whether the switch row is in the "on" or "off" position.

_Available since 1.4._

## Methods

Methods are called on the `Adw.SwitchRow` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Gets whether `self` is in its "on" or "off" position.

**Returns** whether `self` is active or not

_Available since 1.4._

### `setActive`

```ts
setActive(isActive: boolean): void
```

Sets whether `self` is in its "on" or "off" position

**Parameters**

- `isActive`: whether `self` should be active

_Available since 1.4._
