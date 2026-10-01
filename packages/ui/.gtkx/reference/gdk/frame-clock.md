---
description: "Tells the application when to update and repaint a surface."
---

# GdkFrameClock

Tells the application when to update and repaint a surface.

This may be synced to the vertical refresh rate of the monitor, for example.
Even when the frame clock uses a simple timer rather than a hardware-based
vertical sync, the frame clock helps because it ensures everything paints at
the same time (reducing the total number of frames).

The frame clock can also automatically stop painting when it knows the frames
will not be visible, or scale back animation framerates.

`GdkFrameClock` is designed to be compatible with an OpenGL-based implementation
or with mozRequestAnimationFrame in Firefox, for example.

A frame clock is idle until someone requests a frame with
`Gdk.FrameClock.requestPhase()`. At some later point that makes sense
for the synchronization being implemented, the clock will process a frame and
emit signals for each phase that has been requested. (See the signals of the
`GdkFrameClock` class for documentation of the phases.
`GDK_FRAME_CLOCK_PHASE_UPDATE` and the `Gdk.FrameClock.update` signal
are most interesting for application writers, and are used to update the
animations, using the frame time given by `Gdk.FrameClock.getFrameTime()`.

The frame time is reported in microseconds and generally in the same
timescale as `g_get_monotonic_time()`, however, it is not the same
as `g_get_monotonic_time()`. The frame time does not advance during
the time a frame is being painted, and outside of a frame, an attempt
is made so that all calls to `Gdk.FrameClock.getFrameTime()` that
are called at a “similar” time get the same value. This means that
if different animations are timed by looking at the difference in
time between an initial value from `Gdk.FrameClock.getFrameTime()`
and the value inside the `Gdk.FrameClock.update` signal of the clock,
they will stay exactly synchronized.

```tsx
import { GdkFrameClock } from "@gtkx/jsx/gdk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GdkFrameClock**

## Props

`ref` receives the `Gdk.FrameClock` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onAfterPaint`

```ts
(self: Gdk.FrameClock) => void
```

This signal ends processing of the frame.

Applications should generally not handle this signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onBeforePaint`

```ts
(self: Gdk.FrameClock) => void
```

Begins processing of the frame.

Applications should generally not handle this signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onFlushEvents`

```ts
(self: Gdk.FrameClock) => void
```

Used to flush pending motion events that are being batched up and
compressed together.

Applications should not handle this signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onLayout`

```ts
(self: Gdk.FrameClock) => void
```

Emitted as the second step of toolkit and application processing
of the frame.

Any work to update sizes and positions of application elements
should be performed. GTK normally handles this internally.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPaint`

```ts
(self: Gdk.FrameClock) => void
```

Emitted as the third step of toolkit and application processing
of the frame.

The frame is repainted. GDK normally handles this internally and
emits `Gdk.Surface.render` signals which are turned into
[GtkWidget::snapshot](../gtk4/signal.Widget.snapshot.html) signals
by GTK.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onResumeEvents`

```ts
(self: Gdk.FrameClock) => void
```

Emitted after processing of the frame is finished.

This signal is handled internally by GTK to resume normal
event processing. Applications should not handle this signal.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUpdate`

```ts
(self: Gdk.FrameClock) => void
```

Emitted as the first step of toolkit and application processing
of the frame.

Animations should be updated using `Gdk.FrameClock.getFrameTime()`.
Applications can connect directly to this signal, or use
[`gtk_widget_add_tick_callback()`](../gtk4/method.Widget.add_tick_callback.html)
as a more convenient interface.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gdk.FrameClock` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdk`. Methods inherited from ancestors are documented on their own pages.

### `beginUpdating`

```ts
beginUpdating(): void
```

Starts updates for an animation.

Until a matching call to `Gdk.FrameClock.endUpdating()` is made,
the frame clock will continually request a new frame with the
`GDK_FRAME_CLOCK_PHASE_UPDATE` phase. This function may be called multiple
times and frames will be requested until `gdk_frame_clock_end_updating()`
is called the same number of times.

### `endUpdating`

```ts
endUpdating(): void
```

Stops updates for an animation.

See the documentation for `Gdk.FrameClock.beginUpdating()`.

### `getCurrentTimings`

```ts
getCurrentTimings(): Gdk.FrameTimings | null
```

Gets the frame timings for the current frame.

**Returns** the `GdkFrameTimings` for the
  frame currently being processed, or even no frame is being
  processed, for the previous frame. Before any frames have been
  processed, returns `null`.

### `getFps`

```ts
getFps(): number
```

Calculates the current frames-per-second, based on the
frame timings of `frame_clock`.

**Returns** the current fps, as a `double`

### `getFrameCounter`

```ts
getFrameCounter(): bigint
```

`GdkFrameClock` maintains a 64-bit counter that increments for
each frame drawn.

**Returns** inside frame processing, the value of the frame counter
  for the current frame. Outside of frame processing, the frame
  counter for the last frame.

### `getFrameTime`

```ts
getFrameTime(): bigint
```

Gets the time that should currently be used for animations.

Inside the processing of a frame, it’s the time used to compute the
animation position of everything in a frame. Outside of a frame, it's
the time of the conceptual “previous frame,” which may be either
the actual previous frame time, or if that’s too old, an updated
time.

**Returns** a timestamp in microseconds, in the timescale of
 of `g_get_monotonic_time()`.

### `getHistoryStart`

```ts
getHistoryStart(): bigint
```

Returns the frame counter for the oldest frame available in history.

`GdkFrameClock` internally keeps a history of `GdkFrameTimings`
objects for recent frames that can be retrieved with
`Gdk.FrameClock.getTimings()`. The set of stored frames
is the set from the counter values given by
`Gdk.FrameClock.getHistoryStart()` and
`Gdk.FrameClock.getFrameCounter()`, inclusive.

**Returns** the frame counter value for the oldest frame
 that is available in the internal frame history of the
 `GdkFrameClock`

### `getRefreshInfo`

```ts
getRefreshInfo(baseTime: bigint): [bigint, bigint]
```

Predicts a presentation time, based on history.

Using the frame history stored in the frame clock, finds the last
known presentation time and refresh interval, and assuming that
presentation times are separated by the refresh interval,
predicts a presentation time that is a multiple of the refresh
interval after the last presentation time, and later than `base_time`.

**Parameters**

- `baseTime`: base time for determining a presentaton time

**Returns** Tuple of:

- `refreshIntervalReturn`: a location to store the determined refresh interval, or `null`. A default refresh interval of 1/60th of a second will be stored if no history is present.
- `presentationTimeReturn`: a location to store the next candidate presentation time after the given base time. 0 will be will be stored if no history is present.

### `getTimings`

```ts
getTimings(frameCounter: bigint): Gdk.FrameTimings | null
```

Retrieves a `GdkFrameTimings` object holding timing information
for the current frame or a recent frame.

The `GdkFrameTimings` object may not yet be complete: see
`Gdk.FrameTimings.getComplete()` and
`Gdk.FrameClock.getHistoryStart()`.

**Parameters**

- `frameCounter`: the frame counter value identifying the frame to be received

**Returns** the `GdkFrameTimings` object
  for the specified frame, or `null` if it is not available

### `requestPhase`

```ts
requestPhase(phase: Gdk.FrameClockPhase): void
```

Asks the frame clock to run a particular phase.

The signal corresponding the requested phase will be emitted the next
time the frame clock processes. Multiple calls to
`gdk_frame_clock_request_phase()` will be combined together
and only one frame processed. If you are displaying animated
content and want to continually request the
`GDK_FRAME_CLOCK_PHASE_UPDATE` phase for a period of time,
you should use `Gdk.FrameClock.beginUpdating()` instead,
since this allows GTK to adjust system parameters to get maximally
smooth animations.

**Parameters**

- `phase`: the phase that is requested
