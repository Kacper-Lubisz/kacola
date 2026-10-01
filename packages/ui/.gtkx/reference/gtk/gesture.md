---
description: "The base class for gesture recognition."
---

# GtkGesture

The base class for gesture recognition.

Although `GtkGesture` is quite generalized to serve as a base for
multi-touch gestures, it is suitable to implement single-touch and
pointer-based gestures (using the special `null` `GdkEventSequence`
value for these).

The number of touches that a `GtkGesture` need to be recognized is
controlled by the `Gtk.Gesture.nPoints` property, if a
gesture is keeping track of less or more than that number of sequences,
it won't check whether the gesture is recognized.

As soon as the gesture has the expected number of touches, it will check
regularly if it is recognized, the criteria to consider a gesture as
"recognized" is left to `GtkGesture` subclasses.

A recognized gesture will then emit the following signals:

- `Gtk.Gesture.begin` when the gesture is recognized.
- `Gtk.Gesture.update`, whenever an input event is processed.
- `Gtk.Gesture.end` when the gesture is no longer recognized.

### Event propagation

In order to receive events, a gesture needs to set a propagation phase
through `Gtk.EventController.setPropagationPhase()`.

In the capture phase, events are propagated from the toplevel down
to the target widget, and gestures that are attached to containers
above the widget get a chance to interact with the event before it
reaches the target.

In the bubble phase, events are propagated up from the target widget
to the toplevel, and gestures that are attached to containers above
the widget get a chance to interact with events that have not been
handled yet.

### States of a sequence

Whenever input interaction happens, a single event may trigger a cascade
of `GtkGesture`s, both across the parents of the widget receiving the
event and in parallel within an individual widget. It is a responsibility
of the widgets using those gestures to set the state of touch sequences
accordingly in order to enable cooperation of gestures around the
`GdkEventSequence`s triggering those.

Within a widget, gestures can be grouped through `Gtk.Gesture.group()`.
Grouped gestures synchronize the state of sequences, so calling
`Gtk.Gesture.setState()` on one will effectively propagate
the state throughout the group.

By default, all sequences start out in the `GTK_EVENT_SEQUENCE_NONE` state,
sequences in this state trigger the gesture event handler, but event
propagation will continue unstopped by gestures.

If a sequence enters into the `GTK_EVENT_SEQUENCE_DENIED` state, the gesture
group will effectively ignore the sequence, letting events go unstopped
through the gesture, but the "slot" will still remain occupied while
the touch is active.

If a sequence enters in the `GTK_EVENT_SEQUENCE_CLAIMED` state, the gesture
group will grab all interaction on the sequence, by:

- Setting the same sequence to `GTK_EVENT_SEQUENCE_DENIED` on every other
  gesture group within the widget, and every gesture on parent widgets
  in the propagation chain.
- Emitting `Gtk.Gesture.cancel` on every gesture in widgets
  underneath in the propagation chain.
- Stopping event propagation after the gesture group handles the event.

Note: if a sequence is set early to `GTK_EVENT_SEQUENCE_CLAIMED` on
`GDK_TOUCH_BEGIN`/`GDK_BUTTON_PRESS` (so those events are captured before
reaching the event widget, this implies `GTK_PHASE_CAPTURE`), one similar
event will be emulated if the sequence changes to `GTK_EVENT_SEQUENCE_DENIED`.
This way event coherence is preserved before event propagation is unstopped
again.

Sequence states can't be changed freely.
See `Gtk.Gesture.setState()` to know about the possible
lifetimes of a `GdkEventSequence`.

### Touchpad gestures

On the platforms that support it, `GtkGesture` will handle transparently
touchpad gesture events. The only precautions users of `GtkGesture` should
do to enable this support are:

- If the gesture has `GTK_PHASE_NONE`, ensuring events of type
  `GDK_TOUCHPAD_SWIPE` and `GDK_TOUCHPAD_PINCH` are handled by the `GtkGesture`

```tsx
import { GtkGesture } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkGesture**

## Props

`ref` receives the `Gtk.Gesture` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `nPoints`

`number` · default `1` · construct-only

The number of touch points that trigger
recognition on this gesture.

## Signals

### `onBegin`

```ts
(sequence: Gdk.EventSequence | null, self: Gtk.Gesture) => void
```

Emitted when the gesture is recognized.

This means the number of touch sequences matches
`Gtk.Gesture.nPoints`.

Note: These conditions may also happen when an extra touch
(eg. a third touch on a 2-touches gesture) is lifted, in that
situation `sequence` won't pertain to the current set of active
touches, so don't rely on this being true.

**Parameters**

- `sequence`: the `GdkEventSequence` that made the gesture to be recognized
- `self`: The instance the signal was emitted on.

### `onCancel`

```ts
(sequence: Gdk.EventSequence | null, self: Gtk.Gesture) => void
```

Emitted whenever a sequence is cancelled.

This usually happens on active touches when
`Gtk.EventController.reset()` is called on `gesture`
(manually, due to grabs...), or the individual `sequence`
was claimed by parent widgets' controllers (see
`Gtk.Gesture.setSequenceState()`).

`gesture` must forget everything about `sequence` as in
response to this signal.

**Parameters**

- `sequence`: the `GdkEventSequence` that was cancelled
- `self`: The instance the signal was emitted on.

### `onEnd`

```ts
(sequence: Gdk.EventSequence | null, self: Gtk.Gesture) => void
```

Emitted when `gesture` either stopped recognizing the event
sequences as something to be handled, or the number of touch
sequences became higher or lower than `Gtk.Gesture.nPoints`.

Note: `sequence` might not pertain to the group of sequences that
were previously triggering recognition on `gesture` (ie. a just
pressed touch sequence that exceeds `Gtk.Gesture.nPoints`).
This situation may be detected by checking through
`Gtk.Gesture.handlesSequence()`.

**Parameters**

- `sequence`: the `GdkEventSequence` that made gesture recognition to finish
- `self`: The instance the signal was emitted on.

### `onSequenceStateChanged`

```ts
(sequence: Gdk.EventSequence | null, state: Gtk.EventSequenceState, self: Gtk.Gesture) => void
```

Emitted whenever a sequence state changes.

See `Gtk.Gesture.setSequenceState()` to know
more about the expectable sequence lifetimes.

**Parameters**

- `sequence`: the `GdkEventSequence` that was cancelled
- `state`: the new sequence state
- `self`: The instance the signal was emitted on.

### `onUpdate`

```ts
(sequence: Gdk.EventSequence | null, self: Gtk.Gesture) => void
```

Emitted whenever an event is handled while the gesture is recognized.

`sequence` is guaranteed to pertain to the set of active touches.

**Parameters**

- `sequence`: the `GdkEventSequence` that was updated
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Gesture` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getBoundingBox`

```ts
getBoundingBox(): [boolean, Gdk.Rectangle]
```

If there are touch sequences being currently handled by `gesture`,
returns `true` and fills in `rect` with the bounding box containing
all active touches.

Otherwise, `false` will be returned.

Note: This function will yield unexpected results on touchpad
gestures. Since there is no correlation between physical and
pixel distances, these will look as if constrained in an
infinitely small area, `rect` width and height will thus be 0
regardless of the number of touchpoints.

**Returns** Tuple of:

- `result`: `true` if there are active touches, `false` otherwise
- `rect`: bounding box containing all active touches.

### `getBoundingBoxCenter`

```ts
getBoundingBoxCenter(): [boolean, number, number]
```

If there are touch sequences being currently handled by `gesture`,
returns `true` and fills in `x` and `y` with the center of the bounding
box containing all active touches.

Otherwise, `false` will be returned.

**Returns** Tuple of:

- `result`: `false` if no active touches are present, `true` otherwise
- `x`: X coordinate for the bounding box center
- `y`: Y coordinate for the bounding box center

### `getDevice`

```ts
getDevice(): Gdk.Device | null
```

Returns the logical `GdkDevice` that is currently operating
on `gesture`.

This returns `null` if the gesture is not being interacted.

**Returns** a `GdkDevice`

### `getGroup`

```ts
getGroup(): Gtk.Gesture[]
```

Returns all gestures in the group of `gesture`

**Returns** The list
  of `GtkGesture`s, free with `g_list_free()`

### `getLastEvent`

```ts
getLastEvent(sequence: Gdk.EventSequence | null): Gdk.Event | null
```

Returns the last event that was processed for `sequence`.

Note that the returned pointer is only valid as long as the
`sequence` is still interpreted by the `gesture`. If in doubt,
you should make a copy of the event.

**Parameters**

- `sequence`: a `GdkEventSequence`

**Returns** The last event from `sequence`

### `getLastUpdatedSequence`

```ts
getLastUpdatedSequence(): Gdk.EventSequence | null
```

Returns the `GdkEventSequence` that was last updated on `gesture`.

**Returns** The last updated sequence

### `getPoint`

```ts
getPoint(sequence: Gdk.EventSequence | null): [boolean, number, number]
```

If `sequence` is currently being interpreted by `gesture`,
returns `true` and fills in `x` and `y` with the last coordinates
stored for that event sequence.

The coordinates are always relative to the widget allocation.

**Parameters**

- `sequence`: a `GdkEventSequence`, or `null` for pointer events

**Returns** Tuple of:

- `result`: `true` if `sequence` is currently interpreted
- `x`: return location for X axis of the sequence coordinates
- `y`: return location for Y axis of the sequence coordinates

### `getSequences`

```ts
getSequences(): Gdk.EventSequence[]
```

Returns the list of `GdkEventSequences` currently being interpreted
by `gesture`.

**Returns** A list
  of `GdkEventSequence`, the list elements are owned by GTK and must
  not be freed or modified, the list itself must be deleted
  through `g_list_free()`

### `getSequenceState`

```ts
getSequenceState(sequence: Gdk.EventSequence): Gtk.EventSequenceState
```

Returns the `sequence` state, as seen by `gesture`.

**Parameters**

- `sequence`: a `GdkEventSequence`

**Returns** The sequence state in `gesture`

### `group`

```ts
group(gesture: Gtk.Gesture): void
```

Adds `gesture` to the same group than `group_gesture`.

Gestures are by default isolated in their own groups.

Both gestures must have been added to the same widget before
they can be grouped.

When gestures are grouped, the state of `GdkEventSequences`
is kept in sync for all of those, so calling
`Gtk.Gesture.setSequenceState()`, on one will transfer
the same value to the others.

Groups also perform an "implicit grabbing" of sequences, if a
`GdkEventSequence` state is set to `GTK_EVENT_SEQUENCE_CLAIMED`
on one group, every other gesture group attached to the same
`GtkWidget` will switch the state for that sequence to
`GTK_EVENT_SEQUENCE_DENIED`.

**Parameters**

- `gesture`: a `GtkGesture`

### `handlesSequence`

```ts
handlesSequence(sequence: Gdk.EventSequence | null): boolean
```

Returns `true` if `gesture` is currently handling events
corresponding to `sequence`.

**Parameters**

- `sequence`: a `GdkEventSequence`

**Returns** `true` if `gesture` is handling `sequence`, `false` otherwise

### `isActive`

```ts
isActive(): boolean
```

Returns `true` if the gesture is currently active.

A gesture is active while there are touch sequences
interacting with it.

**Returns** `true` if gesture is active

### `isGroupedWith`

```ts
isGroupedWith(other: Gtk.Gesture): boolean
```

Returns `true` if both gestures pertain to the same group.

**Parameters**

- `other`: another `GtkGesture`

**Returns** whether the gestures are grouped

### `isRecognized`

```ts
isRecognized(): boolean
```

Returns `true` if the gesture is currently recognized.

A gesture is recognized if there are as many interacting
touch sequences as required by `gesture`.

**Returns** `true` if gesture is recognized

### `setSequenceState`

```ts
setSequenceState(sequence: Gdk.EventSequence, state: Gtk.EventSequenceState): boolean
```

Sets the state of `sequence` in `gesture`.

Sequences start in state `GTK_EVENT_SEQUENCE_NONE`, and whenever
they change state, they can never go back to that state. Likewise,
sequences in state `GTK_EVENT_SEQUENCE_DENIED` cannot turn back to
a not denied state. With these rules, the lifetime of an event
sequence is constrained to the next four:

* None
* None → Denied
* None → Claimed
* None → Claimed → Denied

Note: Due to event handling ordering, it may be unsafe to set the
state on another gesture within a `Gtk.Gesture.begin` signal
handler, as the callback might be executed before the other gesture
knows about the sequence. A safe way to perform this could be:

```c
static void
first_gesture_begin_cb (GtkGesture       *first_gesture,
                        GdkEventSequence *sequence,
                        gpointer          user_data)
{
  gtk_gesture_set_sequence_state (first_gesture, sequence, GTK_EVENT_SEQUENCE_CLAIMED);
  gtk_gesture_set_sequence_state (second_gesture, sequence, GTK_EVENT_SEQUENCE_DENIED);
}

static void
second_gesture_begin_cb (GtkGesture       *second_gesture,
                         GdkEventSequence *sequence,
                         gpointer          user_data)
{
  if (gtk_gesture_get_sequence_state (first_gesture, sequence) == GTK_EVENT_SEQUENCE_CLAIMED)
    gtk_gesture_set_sequence_state (second_gesture, sequence, GTK_EVENT_SEQUENCE_DENIED);
}
```

If both gestures are in the same group, just set the state on
the gesture emitting the event, the sequence will be already
be initialized to the group's global state when the second
gesture processes the event.

**Parameters**

- `sequence`: a `GdkEventSequence`
- `state`: the sequence state

**Returns** `true` if `sequence` is handled by `gesture`,
  and the state is changed successfully

> **Deprecated since 4.10..** Use `Gtk.Gesture.setState()`

### `setState`

```ts
setState(state: Gtk.EventSequenceState): boolean
```

Sets the state of all sequences that `gesture` is currently
interacting with.

Sequences start in state `GTK_EVENT_SEQUENCE_NONE`, and whenever
they change state, they can never go back to that state. Likewise,
sequences in state `GTK_EVENT_SEQUENCE_DENIED` cannot turn back to
a not denied state. With these rules, the lifetime of an event
sequence is constrained to the next four:

* None
* None → Denied
* None → Claimed
* None → Claimed → Denied

Note: Due to event handling ordering, it may be unsafe to set the
state on another gesture within a `Gtk.Gesture.begin` signal
handler, as the callback might be executed before the other gesture
knows about the sequence. A safe way to perform this could be:

```c
static void
first_gesture_begin_cb (GtkGesture       *first_gesture,
                        GdkEventSequence *sequence,
                        gpointer          user_data)
{
  gtk_gesture_set_state (first_gesture, GTK_EVENT_SEQUENCE_CLAIMED);
  gtk_gesture_set_state (second_gesture, GTK_EVENT_SEQUENCE_DENIED);
}

static void
second_gesture_begin_cb (GtkGesture       *second_gesture,
                         GdkEventSequence *sequence,
                         gpointer          user_data)
{
  if (gtk_gesture_get_sequence_state (first_gesture, sequence) == GTK_EVENT_SEQUENCE_CLAIMED)
    gtk_gesture_set_state (second_gesture, GTK_EVENT_SEQUENCE_DENIED);
}
```

If both gestures are in the same group, just set the state on
the gesture emitting the event, the sequence will be already
be initialized to the group's global state when the second
gesture processes the event.

**Parameters**

- `state`: the sequence state

**Returns** `true` if the state of at least one sequence
  was changed successfully

### `ungroup`

```ts
ungroup(): void
```

Separates `gesture` into an isolated group.
