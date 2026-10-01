---
description: "A GPropertyAction is a way to get a Gio.Action with a state value reflecting and controlling the value of a GObject.Object property."
---

# GPropertyAction

A `GPropertyAction` is a way to get a `Gio.Action` with a state value
reflecting and controlling the value of a `GObject.Object` property.

The state of the action will correspond to the value of the property.
Changing it will change the property (assuming the requested value
matches the requirements as specified in the `GObject.ParamSpec`).

Only the most common types are presently supported.  Booleans are
mapped to booleans, strings to strings, signed/unsigned integers to
int32/uint32 and floats and doubles to doubles.

If the property is an enum then the state will be string-typed and
conversion will automatically be performed between the enum value and
‘nick’ string as per the `GObject.EnumValue` table.

Flags types are not currently supported.

Properties of object types, boxed types and pointer types are not
supported and probably never will be.

Properties of `GLib.Variant` types are not currently supported.

If the property is boolean-valued then the action will have a `NULL`
parameter type, and activating the action (with no parameter) will
toggle the value of the property.

In all other cases, the parameter type will correspond to the type of
the property.

The general idea here is to reduce the number of locations where a
particular piece of state is kept (and therefore has to be synchronised
between). `GPropertyAction` does not have a separate state that is kept
in sync with the property value — its state is the property value.

For example, it might be useful to create a `Gio.Action` corresponding
to the `visible-child-name` property of a [`GtkStack`](https://docs.gtk.org/gtk4/class.Stack.html)
so that the current page can be switched from a menu.  The active radio
indication in the menu is then directly determined from the active page of
the `GtkStack`.

An anti-example would be binding the `active-id` property on a
[`GtkComboBox`](https://docs.gtk.org/gtk4/class.ComboBox.html). This is
because the state of the combo box itself is probably uninteresting and is
actually being used to control something else.

Another anti-example would be to bind to the `visible-child-name`
property of a [`GtkStack`](https://docs.gtk.org/gtk4/class.Stack.html) if
this value is actually stored in `Gio.Settings`.  In that case, the
real source of the value is* `Gio.Settings`.  If you want
a `Gio.Action` to control a setting stored in `Gio.Settings`,
see `Gio.Settings.createAction()` instead, and possibly combine its
use with `Gio.Settings.bind()`.

_Available since 2.38._

```tsx
import { GPropertyAction } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GPropertyAction**

Implements `GAction`.

## Props

`ref` receives the `Gio.PropertyAction` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `enabled`

`boolean` · default `true` · read-only, observe with `onNotifyEnabled`

If `action` is currently enabled.

If the action is disabled then calls to `g_action_activate()` and
`g_action_change_state()` have no effect.

_Available since 2.38._

### `invertBoolean`

`boolean` · default `false` · construct-only

If `true`, the state of the action will be the negation of the
property value, provided the property is boolean.

_Available since 2.46._

### `name`

`string` · default `null` · construct-only

The name of the action.  This is mostly meaningful for identifying
the action once it has been added to a `GActionMap`.

_Available since 2.38._

### `object`

`GObject.Object` · construct-only

The object to wrap a property on.

The object must be a non-`null` `GObject` with properties.

_Available since 2.38._

### `parameterType`

`GLib.VariantType` · read-only, observe with `onNotifyParameterType`

The type of the parameter that must be given when activating the
action.

_Available since 2.38._

### `propertyName`

`string` · default `null` · construct-only

The name of the property to wrap on the object.

The property must exist on the passed-in object and it must be
readable and writable (and not construct-only).

_Available since 2.38._

### `state`

`GLib.Variant` · read-only, observe with `onNotifyState`

The state of the action, or `null` if the action is stateless.

_Available since 2.38._

### `stateType`

`GLib.VariantType` · read-only, observe with `onNotifyStateType`

The `GVariantType` of the state that the action has, or `null` if the
action is stateless.

_Available since 2.38._
