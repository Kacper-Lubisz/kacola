---
description: "The integration point for media playback inside GTK."
---

# GtkMediaStream

The integration point for media playback inside GTK.

GTK provides an implementation of the `GtkMediaStream` interface that
is called `Gtk.MediaFile`.

Apart from application-facing API for stream playback, `GtkMediaStream`
has a number of APIs that are only useful for implementations and should
not be used in applications:
`Gtk.MediaStream.prepared()`,
`Gtk.MediaStream.unprepared()`,
`Gtk.MediaStream.update()`,
`Gtk.MediaStream.ended()`,
`Gtk.MediaStream.seekSuccess()`,
`Gtk.MediaStream.seekFailed()`,
`Gtk.MediaStream.gerror()`,
`Gtk.MediaStream.error()`,
`Gtk.MediaStream.errorValist()`.

```tsx
import { GtkMediaStream } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkMediaStream**

Implements `GdkPaintable`.

## Props

`ref` receives the `Gtk.MediaStream` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `duration`

`bigint` · default `0` · read-only, observe with `onNotifyDuration`

The stream's duration in microseconds or 0 if unknown.

### `ended`

`boolean` · default `false` · read-only, observe with `onNotifyEnded`

Set when playback has finished.

### `error`

`GLib.Error` · read-only, observe with `onNotifyError`

`null` for a properly working stream or the `GError`
that the stream is in.

### `hasAudio`

`boolean` · default `false` · read-only, observe with `onNotifyHasAudio`

Whether the stream contains audio.

### `hasVideo`

`boolean` · default `false` · read-only, observe with `onNotifyHasVideo`

Whether the stream contains video.

### `loop`

`boolean` · default `false`

Try to restart the media from the beginning once it ended.

### `muted`

`boolean` · default `false`

Whether the audio stream should be muted.

### `playing`

`boolean` · default `false`

Whether the stream is currently playing.

### `prepared`

`boolean` · default `false` · read-only, observe with `onNotifyPrepared`

Whether the stream has finished initializing and existence of
audio and video is known.

### `seekable`

`boolean` · default `true` · read-only, observe with `onNotifySeekable`

Set unless the stream is known to not support seeking.

### `seeking`

`boolean` · default `false` · read-only, observe with `onNotifySeeking`

Set while a seek is in progress.

### `timestamp`

`bigint` · default `0` · read-only, observe with `onNotifyTimestamp`

The current presentation timestamp in microseconds.

### `volume`

`number` · default `1.000000`

Volume of the audio stream.

## Signals

### `onInvalidateContents`

```ts
(self: Gtk.MediaStream) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Gtk.MediaStream) => void
```

From `GdkPaintable`.

Emitted when the intrinsic size of the `paintable` changes.

This means the values reported by at least one of
`Gdk.Paintable.getIntrinsicWidth()`,
`Gdk.Paintable.getIntrinsicHeight()` or
`Gdk.Paintable.getIntrinsicAspectRatio()`
has changed.

Examples for such an event would be a paintable displaying
the contents of a toplevel surface being resized.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.MediaStream` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `gerror`

```ts
gerror(error: GLib.Error): void
```

Sets `self` into an error state.

This will pause the stream (you can check for an error
via `Gtk.MediaStream.getError()` in your
GtkMediaStream.`pause()` implementation), abort pending
seeks and mark the stream as prepared.

if the stream is already in an error state, this call
will be ignored and the existing error will be retained.

To unset an error, the stream must be reset via a call to
`Gtk.MediaStream.unprepared()`.

**Parameters**

- `error`: the `GError` to set

### `getDuration`

```ts
getDuration(): bigint
```

Gets the duration of the stream.

If the duration is not known, 0 will be returned.

**Returns** the duration of the stream or 0 if not known.

### `getEnded`

```ts
getEnded(): boolean
```

Returns whether the streams playback is finished.

**Returns** `true` if playback is finished

### `getError`

```ts
getError(): GLib.Error | null
```

If the stream is in an error state, returns the `GError`
explaining that state.

Any type of error can be reported here depending on the
implementation of the media stream.

A media stream in an error cannot be operated on, calls
like `Gtk.MediaStream.play()` or
`Gtk.MediaStream.seek()` will not have any effect.

`GtkMediaStream` itself does not provide a way to unset
an error, but implementations may provide options. For example,
a `Gtk.MediaFile` will unset errors when a new source is
set, e.g. with `Gtk.MediaFile.setFile()`.

**Returns** `null` if not in an
  error state or the `GError` of the stream

### `getLoop`

```ts
getLoop(): boolean
```

Returns whether the stream is set to loop.

See `Gtk.MediaStream.setLoop()` for details.

**Returns** `true` if the stream should loop

### `getMuted`

```ts
getMuted(): boolean
```

Returns whether the audio for the stream is muted.

See `Gtk.MediaStream.setMuted()` for details.

**Returns** `true` if the stream is muted

### `getPlaying`

```ts
getPlaying(): boolean
```

Return whether the stream is currently playing.

**Returns** `true` if the stream is playing

### `getTimestamp`

```ts
getTimestamp(): bigint
```

Returns the current presentation timestamp in microseconds.

**Returns** the timestamp in microseconds

### `getVolume`

```ts
getVolume(): number
```

Returns the volume of the audio for the stream.

See `Gtk.MediaStream.setVolume()` for details.

**Returns** volume of the stream from 0.0 to 1.0

### `hasAudio`

```ts
hasAudio(): boolean
```

Returns whether the stream has audio.

**Returns** `true` if the stream has audio

### `hasVideo`

```ts
hasVideo(): boolean
```

Returns whether the stream has video.

**Returns** `true` if the stream has video

### `isPrepared`

```ts
isPrepared(): boolean
```

Returns whether the stream has finished initializing.

At this point the existence of audio and video is known.

**Returns** `true` if the stream is prepared

### `isSeekable`

```ts
isSeekable(): boolean
```

Checks if a stream may be seekable.

This is meant to be a hint. Streams may not allow seeking even if
this function returns `true`. However, if this function returns
`false`, streams are guaranteed to not be seekable and user interfaces
may hide controls that allow seeking.

It is allowed to call `Gtk.MediaStream.seek()` on a non-seekable
stream, though it will not do anything.

**Returns** `true` if the stream may support seeking

### `isSeeking`

```ts
isSeeking(): boolean
```

Checks if there is currently a seek operation going on.

**Returns** `true` if a seek operation is ongoing.

### `pause`

```ts
pause(): void
```

Pauses playback of the stream.

If the stream is not playing, do nothing.

### `play`

```ts
play(): void
```

Starts playing the stream.

If the stream is in error or already playing, do nothing.

### `realize`

```ts
realize(surface: Gdk.Surface): void
```

Called by users to attach the media stream to a `GdkSurface` they manage.

The stream can then access the resources of `surface` for its
rendering purposes. In particular, media streams might want to
create a `GdkGLContext` or sync to the `GdkFrameClock`.

Whoever calls this function is responsible for calling
`Gtk.MediaStream.unrealize()` before either the stream
or `surface` get destroyed.

Multiple calls to this function may happen from different
users of the video, even with the same `surface`. Each of these
calls must be followed by its own call to
`Gtk.MediaStream.unrealize()`.

It is not required to call this function to make a media stream work.

**Parameters**

- `surface`: a `GdkSurface`

### `seek`

```ts
seek(timestamp: bigint): void
```

Start a seek operation on `self` to `timestamp`.

If `timestamp` is out of range, it will be clamped.

Seek operations may not finish instantly. While a
seek operation is in process, the `Gtk.MediaStream.seeking`
property will be set.

When calling `gtk_media_stream_seek()` during an
ongoing seek operation, the new seek will override
any pending seek.

**Parameters**

- `timestamp`: timestamp to seek to.

### `seekFailed`

```ts
seekFailed(): void
```

Ends a seek operation started via GtkMediaStream.`seek()` as a failure.

This will not cause an error on the stream and will assume that
playback continues as if no seek had happened.

See `Gtk.MediaStream.seekSuccess()` for the other way of
ending a seek.

### `seekSuccess`

```ts
seekSuccess(): void
```

Ends a seek operation started via GtkMediaStream.`seek()` successfully.

This function will unset the GtkMediaStream:ended property
if it was set.

See `Gtk.MediaStream.seekFailed()` for the other way of
ending a seek.

### `setLoop`

```ts
setLoop(loop: boolean): void
```

Sets whether the stream should loop.

In this case, it will attempt to restart playback
from the beginning instead of stopping at the end.

Not all streams may support looping, in particular
non-seekable streams. Those streams will ignore the
loop setting and just end.

**Parameters**

- `loop`: `true` if the stream should loop

### `setMuted`

```ts
setMuted(muted: boolean): void
```

Sets whether the audio stream should be muted.

Muting a stream will cause no audio to be played, but it
does not modify the volume. This means that muting and
then unmuting the stream will restore the volume settings.

If the stream has no audio, calling this function will
still work but it will not have an audible effect.

**Parameters**

- `muted`: `true` if the stream should be muted

### `setPlaying`

```ts
setPlaying(playing: boolean): void
```

Starts or pauses playback of the stream.

**Parameters**

- `playing`: whether to start or pause playback

### `setVolume`

```ts
setVolume(volume: number): void
```

Sets the volume of the audio stream.

This function call will work even if the stream is muted.

The given `volume` should range from 0.0 for silence to 1.0
for as loud as possible. Values outside of this range will
be clamped to the nearest value.

If the stream has no audio or is muted, calling this function
will still work but it will not have an immediate audible effect.
When the stream is unmuted, the new volume setting will take effect.

**Parameters**

- `volume`: New volume of the stream from 0.0 to 1.0

### `streamEnded`

```ts
streamEnded(): void
```

Pauses the media stream and marks it as ended.

This is a hint only, calls to `Gtk.MediaStream.play()`
may still happen.

The media stream must be prepared when this function is called.

_Available since 4.4._

### `streamPrepared`

```ts
streamPrepared(hasAudio: boolean, hasVideo: boolean, seekable: boolean, duration: bigint): void
```

Called by `GtkMediaStream` implementations to advertise the stream
being ready to play and providing details about the stream.

Note that the arguments are hints. If the stream implementation
cannot determine the correct values, it is better to err on the
side of caution and return `true`. User interfaces will use those
values to determine what controls to show.

This function may not be called again until the stream has been
reset via `Gtk.MediaStream.streamUnprepared()`.

**Parameters**

- `hasAudio`: `true` if the stream should advertise audio support
- `hasVideo`: `true` if the stream should advertise video support
- `seekable`: `true` if the stream should advertise seekability
- `duration`: The duration of the stream or 0 if unknown

_Available since 4.4._

### `streamUnprepared`

```ts
streamUnprepared(): void
```

Resets a given media stream implementation.

`Gtk.MediaStream.streamPrepared()` can then be called again.

This function will also reset any error state the stream was in.

_Available since 4.4._

### `unrealize`

```ts
unrealize(surface: Gdk.Surface): void
```

Undoes a previous call to `gtk_media_stream_realize()`.

This causes the stream to release all resources it had
allocated from `surface`.

**Parameters**

- `surface`: the `GdkSurface` the stream was realized with

### `update`

```ts
update(timestamp: bigint): void
```

Media stream implementations should regularly call this
function to update the timestamp reported by the stream.

It is up to implementations to call this at the frequency
they deem appropriate.

The media stream must be prepared when this function is called.

**Parameters**

- `timestamp`: the new timestamp
