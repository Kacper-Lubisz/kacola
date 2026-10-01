---
description: "GSignalGroup manages a collection of signals on a GObject."
---

# GSignalGroup

`GSignalGroup` manages a collection of signals on a `GObject`.

`GSignalGroup` simplifies the process of connecting  many signals to a `GObject`
as a group. As such there is no API to disconnect a signal from the group.

In particular, this allows you to:

 - Change the target instance, which automatically causes disconnection
   of the signals from the old instance and connecting to the new instance.
 - Block and unblock signals as a group
 - Ensuring that blocked state transfers across target instances.

One place you might want to use such a structure is with `GtkTextView` and
`GtkTextBuffer`. Often times, you'll need to connect to many signals on
`GtkTextBuffer` from a `GtkTextView` subclass. This allows you to create a
signal group during instance construction, simply bind the
`GtkTextView:buffer` property to `GSignalGroup:target` and connect
all the signals you need. When the `GtkTextView:buffer` property changes
all of the signals will be transitioned correctly.

_Available since 2.72._

```tsx
import { GSignalGroup } from "@gtkx/jsx/gobject";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSignalGroup**

## Props

`ref` receives the `GObject.SignalGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `target`

`GObject.Object | ReactElement`

The target instance used when connecting signals.

_Available since 2.72._

### `targetType`

`GObject.Type` · construct-only

The `GType` of the target property.

_Available since 2.72._

## Signals

### `onBind`

```ts
(instance: GObject.Object, self: GObject.SignalGroup) => void
```

This signal is emitted when `GSignalGroup.target` is set to a new value
other than `null`. It is similar to `GObject.notify` on `target` except it
will not emit when `GSignalGroup.target` is `null` and also allows for
receiving the `GObject` without a data-race.

**Parameters**

- `instance`: a `GObject` containing the new value for `GSignalGroup.target`
- `self`: The instance the signal was emitted on.

_Available since 2.72._

### `onUnbind`

```ts
(self: GObject.SignalGroup) => void
```

This signal is emitted when the target instance of `self` is set to a
new `GObject`.

This signal will only be emitted if the previous target of `self` is
non-`null`.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 2.72._

## Methods

Methods are called on the `GObject.SignalGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gobject`. Methods inherited from ancestors are documented on their own pages.

### `block`

```ts
block(): void
```

Blocks all signal handlers managed by `self` so they will not
be called during any signal emissions. Must be unblocked exactly
the same number of times it has been blocked to become active again.

This blocked state will be kept across changes of the target instance.

_Available since 2.72._

### `connectClosure`

```ts
connectClosure(detailedSignal: string, closure: GObject.Closure | ClosureCallback, after: boolean): void
```

Connects `closure` to the signal `detailed_signal` on `GSignalGroup.target`.

You cannot connect a signal handler after `GSignalGroup.target` has been set.

**Parameters**

- `detailedSignal`: a string of the form `signal-name` with optional `::signal-detail`
- `closure`: the closure to connect.
- `after`: whether the handler should be called before or after the default handler of the signal.

_Available since 2.74._

### `dupTarget`

```ts
dupTarget(): GObject.Object | null
```

Gets the target instance used when connecting signals.

**Returns** The target instance

_Available since 2.72._

### `setTarget`

```ts
setTarget(target: GObject.Object | null): void
```

Sets the target instance used when connecting signals. Any signal
that has been registered with `g_signal_group_connect_object()` or
similar functions will be connected to this object.

If the target instance was previously set, signals will be
disconnected from that object prior to connecting to `target`.

**Parameters**

- `target`: The target instance used when connecting signals.

_Available since 2.72._

### `unblock`

```ts
unblock(): void
```

Unblocks all signal handlers managed by `self` so they will be
called again during any signal emissions unless it is blocked
again. Must be unblocked exactly the same number of times it
has been blocked to become active again.

_Available since 2.72._
