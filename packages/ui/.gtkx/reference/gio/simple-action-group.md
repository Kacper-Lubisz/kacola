---
description: "GSimpleActionGroup is a hash table filled with Gio.Action objects, implementing the Gio.ActionGroup and Gio.ActionMap interfaces."
---

# GSimpleActionGroup

`GSimpleActionGroup` is a hash table filled with `Gio.Action` objects,
implementing the `Gio.ActionGroup` and `Gio.ActionMap`
interfaces.

_Available since 2.28._

```tsx
import { GSimpleActionGroup } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSimpleActionGroup**

Implements `GActionGroup`, `GActionMap`.

## Props

`ref` receives the `Gio.SimpleActionGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actions`

`ReactNode | null` · from `GActionMap`

`Gio.Action` elements added to the map, removed again by their `name`.

### `prefix`

`string | null` · from `GActionGroup`

Prefix the group's actions are addressed by, such as `win`; defaults to the empty string.

## Signals

### `onActionAdded`

```ts
(actionName: string, self: Gio.SimpleActionGroup) => void
```

From `GActionGroup`.

Signals that a new action was just added to the group.

This signal is emitted after the action has been added
and is now visible.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionEnabledChanged`

```ts
(actionName: string, enabled: boolean, self: Gio.SimpleActionGroup) => void
```

From `GActionGroup`.

Signals that the enabled status of the named action has changed.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `enabled`: whether the action is enabled
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionRemoved`

```ts
(actionName: string, self: Gio.SimpleActionGroup) => void
```

From `GActionGroup`.

Signals that an action is just about to be removed from the group.

This signal is emitted before the action is removed, so the action
is still visible and can be queried from the signal handler.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `self`: The instance the signal was emitted on.

_Available since 2.28._

### `onActionStateChanged`

```ts
(actionName: string, value: GLib.Variant, self: Gio.SimpleActionGroup) => void
```

From `GActionGroup`.

Signals that the state of the named action has changed.

**Parameters**

- `actionName`: the name of the action in `action_group`
- `value`: the new value of the state
- `self`: The instance the signal was emitted on.

_Available since 2.28._

## Methods

Methods are called on the `Gio.SimpleActionGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `addEntries`

```ts
addEntries(entries: Gio.ActionEntry[], userData: bigint | null): void
```

A convenience function for creating multiple `GSimpleAction` instances
and adding them to the action group.

**Parameters**

- `entries`: a pointer to the first item in an array of `GActionEntry` structs
- `userData`: the user data for signal connections

> **Deprecated since 2.38.** Use `g_action_map_add_action_entries()`

_Available since 2.30._

### `insert`

```ts
insert(action: Gio.Action): void
```

Adds an action to the action group.

If the action group already contains an action with the same name as
`action` then the old action is dropped from the group.

The action group takes its own reference on `action`.

**Parameters**

- `action`: a `GAction`

> **Deprecated since 2.38.** Use `g_action_map_add_action()`

_Available since 2.28._

### `lookup`

```ts
lookup(actionName: string): Gio.Action
```

Looks up the action with the name `action_name` in the group.

If no such action exists, returns `null`.

**Parameters**

- `actionName`: the name of an action

**Returns** a `GAction`, or `null`

> **Deprecated since 2.38.** Use `g_action_map_lookup_action()`

_Available since 2.28._

### `remove`

```ts
remove(actionName: string): void
```

Removes the named action from the action group.

If no action of this name is in the group then nothing happens.

**Parameters**

- `actionName`: the name of the action

> **Deprecated since 2.38.** Use `g_action_map_remove_action()`

_Available since 2.28._
