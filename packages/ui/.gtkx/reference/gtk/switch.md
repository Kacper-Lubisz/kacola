---
description: "Shows a \"light switch\" that has two states: on or off."
---

# GtkSwitch

Shows a "light switch" that has two states: on or off.



The user can control which state should be active by clicking the
empty area, or by dragging the slider.

`GtkSwitch` can also express situations where the underlying state changes
with a delay. In this case, the slider position indicates the user's recent
change (represented by the `Gtk.Switch.active` property), while the
trough color indicates the present underlying state (represented by the
`Gtk.Switch.state` property).



See `Gtk.Switch.state-set` for details.

## Shortcuts and Gestures

`GtkSwitch` supports pan and drag gestures to move the slider.

## CSS nodes

```
switch
├── image
├── image
╰── slider
```

`GtkSwitch` has four css nodes, the main node with the name switch and
subnodes for the slider and the on and off images. Neither of them is
using any style classes.

## Accessibility

`GtkSwitch` uses the `Gtk.AccessibleRole.switch` role.

```tsx
import { GtkSwitch } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkSwitch**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Switch` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `active`

`boolean` · default `false`

Whether the `GtkSwitch` widget is in its on or off state.

### `state`

`boolean` · default `false`

The backend state that is controlled by the switch.

Applications should usually set the `Gtk.Switch.active` property,
except when indicating a change to the backend state which occurs
separately from the user's interaction.

See `Gtk.Switch.state-set` for details.

## Signals

### `onActivate`

```ts
(self: Gtk.Switch) => void
```

Emitted to animate the switch.

Applications should never connect to this signal,
but use the `Gtk.Switch.active` property.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onStateSet`

```ts
(state: boolean, self: Gtk.Switch) => boolean | undefined
```

Emitted to change the underlying state.

The ::state-set signal is emitted when the user changes the switch
position. The default handler calls `Gtk.Switch.setState()` with the
value of `state`.

To implement delayed state change, applications can connect to this
signal, initiate the change of the underlying state, and call
`Gtk.Switch.setState()` when the underlying state change is
complete. The signal handler should return `true` to prevent the
default handler from running.

**Parameters**

- `state`: the new state of the switch
- `self`: The instance the signal was emitted on.

**Returns** `true` to stop the signal emission

## Methods

Methods are called on the `Gtk.Switch` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Gets whether the `GtkSwitch` is in its “on” or “off” state.

**Returns** `true` if the `GtkSwitch` is active, and `false` otherwise

### `getState`

```ts
getState(): boolean
```

Gets the underlying state of the `GtkSwitch`.

**Returns** the underlying state

### `setActive`

```ts
setActive(isActive: boolean): void
```

Changes the state of `self` to the desired one.

**Parameters**

- `isActive`: `true` if `self` should be active, and `false` otherwise

### `setState`

```ts
setState(state: boolean): void
```

Sets the underlying state of the `GtkSwitch`.

This function is typically called from a `Gtk.Switch.state-set`
signal handler in order to set up delayed state changes.

See `Gtk.Switch.state-set` for details.

**Parameters**

- `state`: the new state
