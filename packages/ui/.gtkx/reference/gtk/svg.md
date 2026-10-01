---
description: "A paintable implementation that renders SVG, with animations."
---

# GtkSvg

A paintable implementation that renders SVG, with animations.

`GtkSvg` objects are created by parsing a subset of SVG,
including SVG animations.

`GtkSvg` fills or strokes paths with symbolic or fixed colors.
It can have multiple states, and paths can be included in a subset
of the states. States can have animations, and the transition
between different states can also be animated.

To show a static SVG image, it is enough to load the
the SVG and use it like any other paintable.

To play an SVG animation, use `Gtk.Svg.setFrameClock()`
to connect the paintable to a frame clock, and call
`Gtk.Svg.play()` after loading the SVG. The animation can
be paused using `Gtk.Svg.pause()`.

To set the current state, use `Gtk.Svg.setState()`.


### Error handling

Loading an SVG into `GtkSvg` will always produce a (possibly empty)
paintable. GTK will drop things that it can't handle and try to make
sense of the rest.

To track errors during parsing or rendering, connect to the
`Gtk.Svg.error` signal.

For parsing errors in the `GTK_SVG_ERROR` domain, the functions
`Gtk.SvgError.getStart()`, `Gtk.SvgError.getEnd()`,
`Gtk.SvgError.getElement()` and `Gtk.SvgError.getAttribute()`
can be used to obtain information about where the error occurred.


### The supported subset of SVG

The paintable supports much of SVG 2, with some exceptions.

Among the graphical elements, `<textPath>` and `<foreignObject>`
are not supported.

Among the structural elements, `<a>` and `<view>` are not supported.

In the `<filter>` element, the following primitives are not
supported: feConvolveMatrix, feDiffuseLighting,
feMorphology, feSpecularLighting and feTurbulence.

Support for the `mask` attribute is limited to just a url
referring to the `<mask>` element by ID.

In animation elements, the parsing of `begin` and `end` attributes
is limited, and the `min` and `max` attributes are not supported.

Lastly, there is only minimal CSS support (the style attribute,
but not `<style>`), and no interactivity.


### SVG Extensions

The paintable supports a number of [custom attributes](icon-format.html)
that offer a convenient way to define states, transitions and animations.
For example,

    <circle cx='5' cy='5' r='5'
            gpa:states='0 1'
            gpa:animation-type='automatic'
            gpa:animation-direction='segment'
            gpa:animation-duration='600ms'/>

defines the circle to be shown in states 0 and 1, and animates a segment
of the circle.

<image src="svg-renderer1.svg">

Note that the generated animations are implemented using standard
SVG attributes (`visibility`, `stroke-dasharray, `stroke-dashoffset`,
`pathLength` and `filter`). Setting these attributes in your SVG
is therefore going to interfere with generated animations.

To connect general SVG animations to the states of the paintable,
use the custom `gpa:states(...)` condition in the `begin` and `end`
attributes of SVG animation elements. For example,

    <animate href='path1'
             attributeName='fill'
             begin='gpa:states(0).begin'
             dur='300ms'
             fill='freeze'
             from='black'
             to='magenta'/>

will make the fill color of path1 transition from black to
magenta when the renderer enters state 0.

<image src="svg-renderer2.svg">

The `gpa:states(...)` condition triggers for upcoming state changes
as well, to support fade-out transitions. For example,

    <animate href='path1'
             attributeName='opacity'
             begin='gpa:states(0).end -300ms'
             dur='300ms'
             fill='freeze'
             from='1'
             to='0'/>

will start a fade-out of path1 300ms before state 0 ends.

A variant of the `gpa:states(...)` condition allows specifying
both before and after states:

    <animate href='path1'
             attributeName='opacity'
             begin='gpa:states(0, 1 2)'
             dur='300ms'
             fill='freeze'
             from='1'
             to='0'/>

will start the animation when the state changes from 0 to 1 or
from 0 to 2, but not when it changes from 0 to 3.

In addition to the `gpa:fill` and `gpa:stroke` attributes, symbolic
colors can also be specified as a custom paint server reference,
like this: `url(#gpa:warning)`. This works in `fill` and `stroke`
attributes, but also when specifying colors in SVG animation
attributes like `to` or `values`.

Note that the SVG syntax allows for a fallback RGB color to be
specified after the url, for compatibility with other SVG consumers:

    fill='url(`gpa.warning`) orange'

In contrast to SVG 1.1 and 2.0, we allow the `transform` attribute
to be animated with `<animate>`.

_Available since 4.22._

```tsx
import { GtkSvg } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSvg**

Implements `GdkPaintable`, `GtkSymbolicPaintable`.

## Props

`ref` receives the `Gtk.Svg` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `features`

`Gtk.SvgFeatures` · default `GTK_SVG_ANIMATIONS | GTK_SVG_SYSTEM_RESOURCES | GTK_SVG_EXTERNAL_RESOURCES | GTK_SVG_EXTENSIONS`

Enabled features for this paintable.

Note that features have to be set before
loading SVG data to take effect.

_Available since 4.22._

### `playing`

`boolean` · default `false`

Whether the paintable is currently animating its content.

To set this property, use the `Gtk.Svg.play()` and
`Gtk.Svg.pause()` functions.

_Available since 4.22._

### `resource`

`string` · default `null`

Resource to load SVG data from.

This property is meant to create a paintable
from a resource in ui files.

_Available since 4.22._

### `state`

`number` · default `0`

The current state of the renderer.

This can be a number between 0 and 63.

_Available since 4.22._

### `weight`

`number` · default `-1.000000`

If not set to -1, this value overrides the weight used
when rendering the paintable.

_Available since 4.22._

## Signals

### `onError`

```ts
(error: GLib.Error, self: Gtk.Svg) => void
```

Signals that an error occurred.

Errors can occur both during parsing and during rendering.

The expected error values are in the `Gtk.SvgError` enumeration,
context information about the location of parsing errors can
be obtained with the various `gtk_svg_error` functions.

Parsing errors are never fatal, so the parsing will resume after
the error. Errors may however cause parts of the given data or
even all of it to not be parsed at all. So it is a useful idea
to check that the parsing succeeds by connecting to this signal.

::: note
    This signal is emitted in the middle of parsing or rendering,
    and if you handle it, you must be careful. Logging the errors
    you receive is fine, but modifying the widget hierarchy or
    changing the paintable state definitively isn't.

    If in doubt, defer to an idle.

**Parameters**

- `error`: the error
- `self`: The instance the signal was emitted on.

_Available since 4.22._

### `onInvalidateContents`

```ts
(self: Gtk.Svg) => void
```

From `GdkPaintable`.

Emitted when the contents of the `paintable` change.

Examples for such an event would be videos changing to the next frame or
the icon theme for an icon changing.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onInvalidateSize`

```ts
(self: Gtk.Svg) => void
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

Methods are called on the `Gtk.Svg` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getFeatures`

```ts
getFeatures(): Gtk.SvgFeatures
```

Returns the currently enabled features.

**Returns** the enabled features

_Available since 4.22._

### `getState`

```ts
getState(): number
```

Gets the current state of the paintable.

**Returns** the state

_Available since 4.22._

### `getStateNames`

```ts
getStateNames(): [string[] | null, number]
```

Returns a `NULL`-terminated array of
state names, if available.

Note that the returned array and the strings
contained in it will only be valid until the
`GtkSvg` is cleared or reloaded, so if you
want to keep it around, you should make a copy.

**Returns** Tuple of:

- `result`: the state names
- `length`: return location for the number of strings that are returned

_Available since 4.22._

### `getWeight`

```ts
getWeight(): number
```

Gets the value of the weight property.

**Returns** the weight

_Available since 4.22._

### `loadFromBytes`

```ts
loadFromBytes(bytes: GLib.Bytes): void
```

Loads SVG content into an existing SVG paintable.

To track errors while loading SVG content,
connect to the `Gtk.Svg.error` signal.

This clears any previously loaded content.

**Parameters**

- `bytes`: the data to load

_Available since 4.22._

### `loadFromResource`

```ts
loadFromResource(path: string): void
```

Loads SVG content into an existing SVG paintable.

To track errors while loading SVG content,
connect to the `Gtk.Svg.error` signal.

This clears any previously loaded content.

**Parameters**

- `path`: the resource path

_Available since 4.22._

### `pause`

```ts
pause(): void
```

Stop any playing animations and state transitions.

Animations can be paused and started repeatedly.

_Available since 4.22._

### `play`

```ts
play(): void
```

Start playing animations and state transitions.

Animations can be paused and started repeatedly.

_Available since 4.22._

### `serialize`

```ts
serialize(): GLib.Bytes
```

Serializes the content of the renderer as SVG.

The SVG will be similar to the orignally loaded one,
but is not guaranteed to be 100% identical.

This function serializes the DOM, i.e. the results
of parsing the SVG. It does not reflect the effect
of applying animations.

**Returns** the serialized contents

_Available since 4.22._

### `setFeatures`

```ts
setFeatures(features: Gtk.SvgFeatures): void
```

Enables or disables features of the SVG paintable.

By default, all features are enabled.

Note that this call only has an effect before the
SVG is loaded.

**Parameters**

- `features`: features to enable

_Available since 4.22._

### `setFrameClock`

```ts
setFrameClock(clock: Gdk.FrameClock): void
```

Sets a frame clock.

Without a frame clock, GtkSvg will not advance animations.

**Parameters**

- `clock`: the frame clock

_Available since 4.22._

### `setState`

```ts
setState(state: number): void
```

Sets the state of the paintable.

If the paintable is currently playing, the state change
will apply transitions that are defined in the SVG. If
the paintable is not playing, the state change will take
effect instantaneously.

**Parameters**

- `state`: the state to set, as a value between 0 and 63

_Available since 4.22._

### `setWeight`

```ts
setWeight(weight: number): void
```

Sets the weight that is used when rendering.

The weight affects the effective linewidth when stroking
paths.

The default value of -1 means to use the font weight
from CSS.

**Parameters**

- `weight`: the font weight, as a value between -1 and 1000

_Available since 4.22._

### `writeToFile`

```ts
writeToFile(filename: string): boolean
```

Serializes the paintable, and saves the result to a file.

**Parameters**

- `filename`: the file to save to

**Returns** true, unless an error occurred

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.22._
