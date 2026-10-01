---
description: "The base class for event controllers."
---

# GtkEventController

The base class for event controllers.

These are ancillary objects associated to widgets, which react
to `GdkEvents`, and possibly trigger actions as a consequence.

Event controllers are added to a widget with
`Gtk.Widget.addController()`. It is rarely necessary to
explicitly remove a controller with `Gtk.Widget.removeController()`.

See the chapter on [input handling](input-handling.html) for
an overview of the basic concepts, such as the capture and bubble
phases of event propagation.

```tsx
import { GtkEventController } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkEventController**

## Props

`ref` receives the `Gtk.EventController` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `name`

`string` · default `null`

The name for this controller, typically used for debugging purposes.

### `propagationLimit`

`Gtk.PropagationLimit` · default `GTK_LIMIT_SAME_NATIVE`

The limit for which events this controller will handle.

### `propagationPhase`

`Gtk.PropagationPhase` · default `GTK_PHASE_BUBBLE`

The propagation phase at which this controller will handle events.

### `widget`

`Gtk.Widget` · read-only, observe with `onNotifyWidget`

The widget receiving the `GdkEvents` that the controller will handle.

## Methods

Methods are called on the `Gtk.EventController` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getCurrentEvent`

```ts
getCurrentEvent(): Gdk.Event | null
```

Returns the event that is currently being handled by the controller.

At other times, `null` is returned.

**Returns** the event that is currently
  handled by `controller`

### `getCurrentEventDevice`

```ts
getCurrentEventDevice(): Gdk.Device | null
```

Returns the device of the event that is currently being
handled by the controller.

At other times, `null` is returned.

**Returns** device of the event is
  currently handled by `controller`

### `getCurrentEventState`

```ts
getCurrentEventState(): Gdk.ModifierType
```

Returns the modifier state of the event that is currently being
handled by the controller.

At other times, 0 is returned.

**Returns** modifier state of the event is currently handled by `controller`

### `getCurrentEventTime`

```ts
getCurrentEventTime(): number
```

Returns the timestamp of the event that is currently being
handled by the controller.

At other times, 0 is returned.

**Returns** timestamp of the event is currently handled by `controller`

### `getName`

```ts
getName(): string | null
```

Gets the name of `controller`.

**Returns** The controller name

### `getPropagationLimit`

```ts
getPropagationLimit(): Gtk.PropagationLimit
```

Gets the propagation limit of the event controller.

**Returns** the propagation limit

### `getPropagationPhase`

```ts
getPropagationPhase(): Gtk.PropagationPhase
```

Gets the propagation phase at which `controller` handles events.

**Returns** the propagation phase

### `getWidget`

```ts
getWidget(): Gtk.Widget | null
```

Returns the `GtkWidget` this controller relates to.

**Returns** a `GtkWidget`

### `reset`

```ts
reset(): void
```

Resets the `controller` to a clean state.

### `setName`

```ts
setName(name: string | null): void
```

Sets a name on the controller that can be used for debugging.

**Parameters**

- `name`: a name for `controller`

### `setPropagationLimit`

```ts
setPropagationLimit(limit: Gtk.PropagationLimit): void
```

Sets the event propagation limit on the event controller.

If the limit is set to `GTK_LIMIT_SAME_NATIVE`, the controller
won't handle events that are targeted at widgets on a different
surface, such as popovers.

**Parameters**

- `limit`: the propagation limit

### `setPropagationPhase`

```ts
setPropagationPhase(phase: Gtk.PropagationPhase): void
```

Sets the propagation phase at which a controller handles events.

If `phase` is `GTK_PHASE_NONE`, no automatic event handling will be
performed, but other additional gesture maintenance will.

**Parameters**

- `phase`: a propagation phase

### `setStaticName`

```ts
setStaticName(name: string | null): void
```

Sets a name on the controller that can be used for debugging.

**Parameters**

- `name`: a name for `controller`, must be a static string

_Available since 4.8._
