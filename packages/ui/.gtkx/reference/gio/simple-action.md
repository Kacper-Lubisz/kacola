---
description: "A GSimpleAction is the obvious simple implementation of the Gio.Action interface."
---

# GSimpleAction

A `GSimpleAction` is the obvious simple implementation of the
`Gio.Action` interface. This is the easiest way to create an action for
purposes of adding it to a `Gio.SimpleActionGroup`.

```tsx
import { GSimpleAction } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSimpleAction**

Implements `GAction`.

## Props

`ref` receives the `Gio.SimpleAction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enabled`

`boolean` · default `true`

If `action` is currently enabled.

If the action is disabled then calls to `g_action_activate()` and
`g_action_change_state()` have no effect.

_Available since 2.28._

### `name`

`string` · default `null` · construct-only

The name of the action. This is mostly meaningful for identifying
the action once it has been added to a `GSimpleActionGroup`.

_Available since 2.28._

### `parameterType`

`GLib.VariantType` · construct-only

The type of the parameter that must be given when activating the
action.

_Available since 2.28._

### `state`

`GLib.Variant`

The state of the action, or `null` if the action is stateless.

_Available since 2.28._

### `stateType`

`GLib.VariantType` · read-only, observe with `onNotifyStateType`

The `GVariantType` of the state that the action has, or `null` if the
action is stateless.

_Available since 2.28._

## Signals

### `onActivate`

```ts
(parameter: GLib.Variant | null, self: Gio.SimpleAction) => void
```

Indicates that the action was just activated.

`parameter` will always be of the expected type, i.e. the parameter type
specified when the action was created. If an incorrect type is given when
activating the action, this signal is not emitted.

Since GLib 2.40, if no handler is connected to this signal then the
default behaviour for boolean-stated actions with a `null` parameter
type is to toggle them via the `GSimpleAction.change-state` signal.
For stateful actions where the state type is equal to the parameter
type, the default is to forward them directly to
`GSimpleAction.change-state`.  This should allow almost all users
of `GSimpleAction` to connect only one handler or the other.

**Parameters**

- `parameter`: the parameter to the activation, or `null` if it has no parameter
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onChangeState`

```ts
(value: GLib.Variant | null, self: Gio.SimpleAction) => void
```

Indicates that the action just received a request to change its
state.

`value` will always be of the correct state type, i.e. the type of the
initial state passed to `g_simple_action_new_stateful()`. If an incorrect
type is given when requesting to change the state, this signal is not
emitted.

If no handler is connected to this signal then the default
behaviour is to call `g_simple_action_set_state()` to set the state
to the requested value. If you connect a signal handler then no
default action is taken. If the state should change then you must
call `g_simple_action_set_state()` from the handler.

An example of a 'change-state' handler:
```c
static void
change_volume_state (GSimpleAction *action,
                     GVariant      *value,
                     gpointer       user_data)
{
  gint requested;

  requested = g_variant_get_int32 (value);

  // Volume only goes from 0 to 10
  if (0 <= requested && requested <= 10)
    g_simple_action_set_state (action, value);
}
```

The handler need not set the state to the requested value.
It could set it to any value at all, or take some other action.

**Parameters**

- `value`: the requested value for the state
- `self`: The instance the signal was emitted on.

_Available since 2.30._

## Methods

Methods are called on the `Gio.SimpleAction` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `setEnabled`

```ts
setEnabled(enabled: boolean): void
```

Sets the action as enabled or not.

An action must be enabled in order to be activated or in order to
have its state changed from outside callers.

This should only be called by the implementor of the action.  Users
of the action should not attempt to modify its enabled flag.

**Parameters**

- `enabled`: whether the action is enabled

_Available since 2.28._

### `setState`

```ts
setState(value: GLib.Variant): void
```

Sets the state of the action.

This directly updates the 'state' property to the given value.

This should only be called by the implementor of the action.  Users
of the action should not attempt to directly modify the 'state'
property.  Instead, they should call `g_action_change_state()` to
request the change.

If the `value` GVariant is floating, it is consumed.

**Parameters**

- `value`: the new `GVariant` for the state

_Available since 2.30._

### `setStateHint`

```ts
setStateHint(stateHint: GLib.Variant | null): void
```

Sets the state hint for the action.

See `g_action_get_state_hint()` for more information about
action state hints.

**Parameters**

- `stateHint`: a `GVariant` representing the state hint

_Available since 2.44._
