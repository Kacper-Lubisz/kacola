---
description: "Assists in creating Gsk.RenderNodes for widgets."
---

# GtkSnapshot

Assists in creating `Gsk.RenderNode`s for widgets.

It functions in a similar way to a cairo context, and maintains a stack
of render nodes and their associated transformations.

The node at the top of the stack is the one that `gtk_snapshot_append_…()`
functions operate on. Use the `gtk_snapshot_push_…()` functions and
`Snapshot.pop()` to change the current node.

The typical way to obtain a `GtkSnapshot` object is as an argument to
the `Gtk.Widget.snapshot()` vfunc. If you need to create your own
`GtkSnapshot`, use `Gtk.Snapshot.new()`.

Note that `GtkSnapshot` applies some optimizations, so the node
it produces may not match the API calls 1:1. For example, it will
omit clip nodes if the child node is entirely contained within the
clip rectangle.

```tsx
import { GtkSnapshot } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkSnapshot](.gtkx/reference/gdk/snapshot.md) → **GtkSnapshot**

## Props

`ref` receives the `Gtk.Snapshot` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gtk.Snapshot` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `appendBorder`

```ts
appendBorder(outline: Gsk.RoundedRect, borderWidth: number[], borderColor: Gdk.RGBA[]): void
```

Appends a stroked border rectangle inside the given `outline`.

The four sides of the border can have different widths and colors.

**Parameters**

- `outline`: the outline of the border
- `borderWidth`: the stroke width of the border on the top, right, bottom and left side respectively.
- `borderColor`: the color used on the top, right, bottom and left side.

### `appendCairo`

```ts
appendCairo(bounds: Graphene.Rect): cairo.Context
```

Creates a new `Gsk.CairoNode` and appends it to the current
render node of `snapshot`, without changing the current node.

**Parameters**

- `bounds`: the bounds for the new node

**Returns** a `cairo_t` suitable for drawing the contents of
  the newly created render node

### `appendColor`

```ts
appendColor(color: Gdk.RGBA, bounds: Graphene.Rect): void
```

Creates a new render node drawing the `color` into the
given `bounds` and appends it to the current render node
of `snapshot`.

You should try to avoid calling this function if
`color` is transparent.

**Parameters**

- `color`: the color to draw
- `bounds`: the bounds for the new node

### `appendConicGradient`

```ts
appendConicGradient(bounds: Graphene.Rect, center: Graphene.Point, rotation: number, stops: Gsk.ColorStop[]): void
```

Appends a conic gradient node with the given stops to `snapshot`.

**Parameters**

- `bounds`: the rectangle to render the gradient into
- `center`: the center point of the conic gradient
- `rotation`: the clockwise rotation in degrees of the starting angle. 0 means the starting angle is the top.
- `stops`: the color stops defining the gradient

### `appendFill`

```ts
appendFill(path: Gsk.Path, fillRule: Gsk.FillRule, color: Gdk.RGBA): void
```

A convenience method to fill a path with a color.

See `Gtk.Snapshot.pushFill()` if you need
to fill a path with more complex content than
a color.

**Parameters**

- `path`: The path describing the area to fill
- `fillRule`: The fill rule to use
- `color`: the color to fill the path with

_Available since 4.14._

### `appendInsetShadow`

```ts
appendInsetShadow(outline: Gsk.RoundedRect, color: Gdk.RGBA, dx: number, dy: number, spread: number, blurRadius: number): void
```

Appends an inset shadow into the box given by `outline`.

**Parameters**

- `outline`: outline of the region surrounded by shadow
- `color`: color of the shadow
- `dx`: horizontal offset of shadow
- `dy`: vertical offset of shadow
- `spread`: how far the shadow spreads towards the inside
- `blurRadius`: how much blur to apply to the shadow

### `appendLayout`

```ts
appendLayout(layout: Pango.Layout, color: Gdk.RGBA): void
```

Creates render nodes for rendering `layout` in the given foregound `color`
and appends them to the current node of `snapshot` without changing the
current node. The current theme's foreground color for a widget can be
obtained with `Gtk.Widget.getColor()`.

Note that if the layout does not produce any visible output, then nodes
may not be added to the `snapshot`.

**Parameters**

- `layout`: the `PangoLayout` to render
- `color`: the foreground color to render the layout in

### `appendLinearGradient`

```ts
appendLinearGradient(bounds: Graphene.Rect, startPoint: Graphene.Point, endPoint: Graphene.Point, stops: Gsk.ColorStop[]): void
```

Appends a linear gradient node with the given stops to `snapshot`.

**Parameters**

- `bounds`: the rectangle to render the linear gradient into
- `startPoint`: the point at which the linear gradient will begin
- `endPoint`: the point at which the linear gradient will finish
- `stops`: the color stops defining the gradient

### `appendNode`

```ts
appendNode(node: Gsk.RenderNode): void
```

Appends `node` to the current render node of `snapshot`,
without changing the current node.

If `snapshot` does not have a current node yet, `node`
will become the initial node.

**Parameters**

- `node`: a `GskRenderNode`

### `appendOutsetShadow`

```ts
appendOutsetShadow(outline: Gsk.RoundedRect, color: Gdk.RGBA, dx: number, dy: number, spread: number, blurRadius: number): void
```

Appends an outset shadow node around the box given by `outline`.

**Parameters**

- `outline`: outline of the region surrounded by shadow
- `color`: color of the shadow
- `dx`: horizontal offset of shadow
- `dy`: vertical offset of shadow
- `spread`: how far the shadow spreads towards the outside
- `blurRadius`: how much blur to apply to the shadow

### `appendPaste`

```ts
appendPaste(bounds: Graphene.Rect, nth: number): void
```

Creates a new render node that pastes the contents
copied by a previous call to `Gtk.Snapshot.pushCopy()`

**Parameters**

- `bounds`: the bounds for the new node
- `nth`: the index of the copy, with 0 being the latest copy, 1 being the copy before that, and so on.

_Available since 4.22._

### `appendRadialGradient`

```ts
appendRadialGradient(bounds: Graphene.Rect, center: Graphene.Point, hradius: number, vradius: number, start: number, end: number, stops: Gsk.ColorStop[]): void
```

Appends a radial gradient node with the given stops to `snapshot`.

**Parameters**

- `bounds`: the rectangle to render the readial gradient into
- `center`: the center point for the radial gradient
- `hradius`: the horizontal radius
- `vradius`: the vertical radius
- `start`: the start position (on the horizontal axis)
- `end`: the end position (on the horizontal axis)
- `stops`: the color stops defining the gradient

### `appendRepeatingLinearGradient`

```ts
appendRepeatingLinearGradient(bounds: Graphene.Rect, startPoint: Graphene.Point, endPoint: Graphene.Point, stops: Gsk.ColorStop[]): void
```

Appends a repeating linear gradient node with the given stops to `snapshot`.

**Parameters**

- `bounds`: the rectangle to render the linear gradient into
- `startPoint`: the point at which the linear gradient will begin
- `endPoint`: the point at which the linear gradient will finish
- `stops`: the color stops defining the gradient

### `appendRepeatingRadialGradient`

```ts
appendRepeatingRadialGradient(bounds: Graphene.Rect, center: Graphene.Point, hradius: number, vradius: number, start: number, end: number, stops: Gsk.ColorStop[]): void
```

Appends a repeating radial gradient node with the given stops to `snapshot`.

**Parameters**

- `bounds`: the rectangle to render the readial gradient into
- `center`: the center point for the radial gradient
- `hradius`: the horizontal radius
- `vradius`: the vertical radius
- `start`: the start position (on the horizontal axis)
- `end`: the end position (on the horizontal axis)
- `stops`: the color stops defining the gradient

### `appendScaledTexture`

```ts
appendScaledTexture(texture: Gdk.Texture, filter: Gsk.ScalingFilter, bounds: Graphene.Rect): void
```

Creates a new render node drawing the `texture`
into the given `bounds` and appends it to the
current render node of `snapshot`.

In contrast to `Gtk.Snapshot.appendTexture()`,
this function provides control about how the filter
that is used when scaling.

**Parameters**

- `texture`: the texture to render
- `filter`: the filter to use
- `bounds`: the bounds for the new node

_Available since 4.10._

### `appendStroke`

```ts
appendStroke(path: Gsk.Path, stroke: Gsk.Stroke, color: Gdk.RGBA): void
```

A convenience method to stroke a path with a color.

See `Gtk.Snapshot.pushStroke()` if you need
to stroke a path with more complex content than
a color.

**Parameters**

- `path`: The path describing the area to fill
- `stroke`: The stroke attributes
- `color`: the color to fill the path with

_Available since 4.14._

### `appendTexture`

```ts
appendTexture(texture: Gdk.Texture, bounds: Graphene.Rect): void
```

Creates a new render node drawing the `texture`
into the given `bounds` and appends it to the
current render node of `snapshot`.

If the texture needs to be scaled to fill `bounds`,
linear filtering is used. See `Gtk.Snapshot.appendScaledTexture()`
if you need other filtering, such as nearest-neighbour.

**Parameters**

- `texture`: the texture to render
- `bounds`: the bounds for the new node

### `glShaderPopTexture`

```ts
glShaderPopTexture(): void
```

Removes the top element from the stack of render nodes and
adds it to the nearest `Gsk.GLShaderNode` below it.

This must be called the same number of times as the number
of textures is needed for the shader in
`Gtk.Snapshot.pushGlShader()`.

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use `Gtk.GLArea` for OpenGL rendering.

### `perspective`

```ts
perspective(depth: number): void
```

Applies a perspective projection transform.

See `Gsk.Transform.perspective()` for a discussion on the details.

**Parameters**

- `depth`: distance of the z=0 plane

### `pop`

```ts
pop(): void
```

Removes the top element from the stack of render nodes,
and appends it to the node underneath it.

### `pushBlend`

```ts
pushBlend(blendMode: Gsk.BlendMode): void
```

Blends together two images with the given blend mode.

Until the first call to `Gtk.Snapshot.pop()`, the
bottom image for the blend operation will be recorded.
After that call, the top image to be blended will be
recorded until the second call to `Gtk.Snapshot.pop()`.

Calling this function requires two subsequent calls
to `Gtk.Snapshot.pop()`.

**Parameters**

- `blendMode`: blend mode to use

### `pushBlur`

```ts
pushBlur(radius: number): void
```

Blurs an image.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `radius`: the blur radius to use. Must be positive

### `pushClip`

```ts
pushClip(bounds: Graphene.Rect): void
```

Clips an image to a rectangle.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `bounds`: the rectangle to clip to

### `pushColorMatrix`

```ts
pushColorMatrix(colorMatrix: Graphene.Matrix, colorOffset: Graphene.Vec4): void
```

Modifies the colors of an image by applying an affine transformation
in RGB space.

In particular, the colors will be transformed by applying

    pixel = transpose(color_matrix) * pixel + color_offset

for every pixel. The transformation operates on unpremultiplied
colors, with color components ordered R, G, B, A.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `colorMatrix`: the color matrix to use
- `colorOffset`: the color offset to use

### `pushComponentTransfer`

```ts
pushComponentTransfer(red: Gsk.ComponentTransfer, green: Gsk.ComponentTransfer, blue: Gsk.ComponentTransfer, alpha: Gsk.ComponentTransfer): void
```

Modifies the colors of an image by applying a transfer
function for each component.

The transfer functions operate on unpremultiplied colors.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `red`: the transfer for the red component
- `green`: the transfer for the green component
- `blue`: the transfer for the blue component
- `alpha`: the transfer for the alpha component

_Available since 4.20._

### `pushComposite`

```ts
pushComposite(op: Gsk.PorterDuff): void
```

Until the first call to `Gtk.Snapshot.pop()`, the
mask image for the mask operation will be recorded.

After that call, the child image will be recorded until
the second call to `Gtk.Snapshot.pop()`.

Calling this function requires 2 subsequent calls to `gtk_snapshot_pop()`.

**Parameters**

- `op`: The Porter/Duff compositing operator to use

_Available since 4.22._

### `pushCopy`

```ts
pushCopy(): void
```

Stores the current rendering state for later pasting via
`Gtk.Snapshot.appendPaste()`.

Pasting is possible until the matching call to `Gtk.Snapshot.pop()`.

_Available since 4.22._

### `pushCrossFade`

```ts
pushCrossFade(progress: number): void
```

Snapshots a cross-fade operation between two images with the
given `progress`.

Until the first call to `Gtk.Snapshot.pop()`, the start image
will be snapshot. After that call, the end image will be recorded
until the second call to `Gtk.Snapshot.pop()`.

Calling this function requires two subsequent calls
to `Gtk.Snapshot.pop()`.

**Parameters**

- `progress`: progress between 0.0 and 1.0

### `pushFill`

```ts
pushFill(path: Gsk.Path, fillRule: Gsk.FillRule): void
```

Fills the area given by `path` and `fill_rule` with an image and discards everything
outside of it.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

If you want to fill the path with a color, `Gtk.Snapshot.appendFill()`
than rendering new ones, use `Gtk.Snapshot.appendFill()`
may be more convenient.

**Parameters**

- `path`: The path describing the area to fill
- `fillRule`: The fill rule to use

_Available since 4.14._

### `pushGlShader`

```ts
pushGlShader(shader: Gsk.GLShader, bounds: Graphene.Rect, takeArgs: GLib.Bytes): void
```

Push a `Gsk.GLShaderNode`.

The node uses the given `Gsk.GLShader` and uniform values
Additionally this takes a list of `n_children` other nodes
which will be passed to the `Gsk.GLShaderNode`.

The `take_args` argument is a block of data to use for uniform
arguments, as per types and offsets defined by the `shader`.
Normally this is generated by `Gsk.GLShader.formatArgs()`
or `Gsk.ShaderArgsBuilder`.

The snapshotter takes ownership of `take_args`, so the caller should
not free it after this.

If the renderer doesn't support GL shaders, or if there is any
problem when compiling the shader, then the node will draw pink.
You should use `Gsk.GLShader.compile()` to ensure the `shader`
will work for the renderer before using it.

If the shader requires textures (see `Gsk.GLShader.getNTextures()`),
then it is expected that you call `Gtk.Snapshot.glShaderPopTexture()`
the number of times that are required. Each of these calls will generate
a node that is added as a child to the `GskGLShaderNode`, which in turn
will render these offscreen and pass as a texture to the shader.

Once all textures (if any) are pop:ed, you must call the regular
`Gtk.Snapshot.pop()`.

If you want to use pre-existing textures as input to the shader rather
than rendering new ones, use `Gtk.Snapshot.appendTexture()` to
push a texture node. These will be used directly rather than being
re-rendered.

For details on how to write shaders, see `Gsk.GLShader`.

**Parameters**

- `shader`: The code to run
- `bounds`: the rectangle to render into
- `takeArgs`: Data block with arguments for the shader.

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use `Gtk.GLArea` for OpenGL rendering.

### `pushIsolation`

```ts
pushIsolation(features: Gsk.Isolation): void
```

Isolates the following drawing operations from previous ones.

You can express "everything but these flags" in a forward compatible
way by using bit math:
`GSK_ISOLATION_ALL & ~(GSK_ISOLATION_BACKGROUND | GSK_ISOLATION_COPY_PASTE)`
will isolate everything but background and copy/paste.

For what isolation features exist, see `Gsk.Isolation`.

Content is isolated until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `features`: features that are isolated

_Available since 4.22._

### `pushMask`

```ts
pushMask(maskMode: Gsk.MaskMode): void
```

Until the first call to `Gtk.Snapshot.pop()`, the
mask image for the mask operation will be recorded.

After that call, the source image will be recorded until
the second call to `Gtk.Snapshot.pop()`.

Calling this function requires 2 subsequent calls to `gtk_snapshot_pop()`.

**Parameters**

- `maskMode`: mask mode to use

_Available since 4.10._

### `pushOpacity`

```ts
pushOpacity(opacity: number): void
```

Modifies the opacity of an image.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `opacity`: the opacity to use

### `pushRepeat`

```ts
pushRepeat(bounds: Graphene.Rect, childBounds: Graphene.Rect | null): void
```

Creates a node that repeats the child node.

The child is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `bounds`: the bounds within which to repeat
- `childBounds`: the bounds of the child or `null` to use the full size of the collected child node

### `pushRoundedClip`

```ts
pushRoundedClip(bounds: Gsk.RoundedRect): void
```

Clips an image to a rounded rectangle.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `bounds`: the rounded rectangle to clip to

### `pushShadow`

```ts
pushShadow(shadow: Gsk.Shadow[]): void
```

Applies a shadow to an image.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

**Parameters**

- `shadow`: the first shadow specification

### `pushStroke`

```ts
pushStroke(path: Gsk.Path, stroke: Gsk.Stroke): void
```

Strokes the given `path` with the attributes given by `stroke` and
an image.

The image is recorded until the next call to `Gtk.Snapshot.pop()`.

Note that the strokes are subject to the same transformation as
everything else, so uneven scaling will cause horizontal and vertical
strokes to have different widths.

If you want to stroke the path with a color, `Gtk.Snapshot.appendStroke()`
may be more convenient.

**Parameters**

- `path`: The path to stroke
- `stroke`: The stroke attributes

_Available since 4.14._

### `renderBackground`

```ts
renderBackground(context: Gtk.StyleContext, x: number, y: number, width: number, height: number): void
```

Creates a render node for the CSS background according to `context`,
and appends it to the current node of `snapshot`, without changing
the current node.

**Parameters**

- `context`: the style context that defines the background
- `x`: X origin of the rectangle
- `y`: Y origin of the rectangle
- `width`: rectangle width
- `height`: rectangle height

> **Deprecated since 4.10.**

### `renderFocus`

```ts
renderFocus(context: Gtk.StyleContext, x: number, y: number, width: number, height: number): void
```

Creates a render node for the focus outline according to `context`,
and appends it to the current node of `snapshot`, without changing
the current node.

**Parameters**

- `context`: the style context that defines the focus ring
- `x`: X origin of the rectangle
- `y`: Y origin of the rectangle
- `width`: rectangle width
- `height`: rectangle height

> **Deprecated since 4.10.**

### `renderFrame`

```ts
renderFrame(context: Gtk.StyleContext, x: number, y: number, width: number, height: number): void
```

Creates a render node for the CSS border according to `context`,
and appends it to the current node of `snapshot`, without changing
the current node.

**Parameters**

- `context`: the style context that defines the frame
- `x`: X origin of the rectangle
- `y`: Y origin of the rectangle
- `width`: rectangle width
- `height`: rectangle height

> **Deprecated since 4.10.**

### `renderInsertionCursor`

```ts
renderInsertionCursor(context: Gtk.StyleContext, x: number, y: number, layout: Pango.Layout, index: number, direction: Pango.Direction): void
```

Draws a text caret using `snapshot` at the specified index of `layout`.

**Parameters**

- `context`: a `GtkStyleContext`
- `x`: X origin
- `y`: Y origin
- `layout`: the `PangoLayout` of the text
- `index`: the index in the `PangoLayout`
- `direction`: the `PangoDirection` of the text

> **Deprecated since 4.10.**

### `renderLayout`

```ts
renderLayout(context: Gtk.StyleContext, x: number, y: number, layout: Pango.Layout): void
```

Creates a render node for rendering `layout` according to the style
information in `context`, and appends it to the current node of `snapshot`,
without changing the current node.

**Parameters**

- `context`: the style context that defines the text
- `x`: X origin of the rectangle
- `y`: Y origin of the rectangle
- `layout`: the `PangoLayout` to render

> **Deprecated since 4.10.**

### `restore`

```ts
restore(): void
```

Restores `snapshot` to the state saved by a preceding call to
`Snapshot.save()` and removes that state from the stack of
saved states.

### `rotate`

```ts
rotate(angle: number): void
```

Rotates @`snapshot`'s coordinate system by `angle` degrees in 2D space -
or in 3D speak, rotates around the Z axis. The rotation happens around
the origin point of (0, 0) in the `snapshot`'s current coordinate system.

To rotate around axes other than the Z axis, use `Gsk.Transform.rotate3d()`.

**Parameters**

- `angle`: the rotation angle, in degrees (clockwise)

### `rotate3d`

```ts
rotate3d(angle: number, axis: Graphene.Vec3): void
```

Rotates `snapshot`'s coordinate system by `angle` degrees around `axis`.

For a rotation in 2D space, use `Gsk.Transform.rotate()`.

**Parameters**

- `angle`: the rotation angle, in degrees (clockwise)
- `axis`: The rotation axis

### `save`

```ts
save(): void
```

Makes a copy of the current state of `snapshot` and saves it
on an internal stack.

When `Gtk.Snapshot.restore()` is called, `snapshot` will
be restored to the saved state.

Multiple calls to `Gtk.Snapshot.save()` and `Gtk.Snapshot.restore()`
can be nested; each call to `gtk_snapshot_restore()` restores the state from
the matching paired `gtk_snapshot_save()`.

It is necessary to clear all saved states with corresponding
calls to `gtk_snapshot_restore()`.

### `scale`

```ts
scale(factorX: number, factorY: number): void
```

Scales `snapshot`'s coordinate system in 2-dimensional space by
the given factors.

Use `Gtk.Snapshot.scale3d()` to scale in all 3 dimensions.

**Parameters**

- `factorX`: scaling factor on the X axis
- `factorY`: scaling factor on the Y axis

### `scale3d`

```ts
scale3d(factorX: number, factorY: number, factorZ: number): void
```

Scales `snapshot`'s coordinate system by the given factors.

**Parameters**

- `factorX`: scaling factor on the X axis
- `factorY`: scaling factor on the Y axis
- `factorZ`: scaling factor on the Z axis

### `toNode`

```ts
toNode(): Gsk.RenderNode | null
```

Returns the render node that was constructed
by `snapshot`.

Note that this function may return `null` if nothing has been
added to the snapshot or if its content does not produce pixels
to be rendered.

After calling this function, it is no longer possible to
add more nodes to `snapshot`. The only function that should
be called after this is `GObject.Object.unref()`.

**Returns** the constructed `GskRenderNode` or
  `null` if there are no nodes to render.

### `toPaintable`

```ts
toPaintable(size: Graphene.Size | null): Gdk.Paintable | null
```

Returns a paintable encapsulating the render node
that was constructed by `snapshot`.

After calling this function, it is no longer possible to
add more nodes to `snapshot`. The only function that should
be called after this is `GObject.Object.unref()`.

**Parameters**

- `size`: The size of the resulting paintable or `null` to use the bounds of the snapshot

**Returns** a new `GdkPaintable`

### `transform`

```ts
transform(transform: Gsk.Transform | null): void
```

Transforms `snapshot`'s coordinate system with the given `transform`.

**Parameters**

- `transform`: the transform to apply

### `transformMatrix`

```ts
transformMatrix(matrix: Graphene.Matrix): void
```

Transforms `snapshot`'s coordinate system with the given `matrix`.

**Parameters**

- `matrix`: the matrix to multiply the transform with

### `translate`

```ts
translate(point: Graphene.Point): void
```

Translates `snapshot`'s coordinate system by `point` in 2-dimensional space.

**Parameters**

- `point`: the point to translate the snapshot by

### `translate3d`

```ts
translate3d(point: Graphene.Point3D): void
```

Translates `snapshot`'s coordinate system by `point`.

**Parameters**

- `point`: the point to translate the snapshot by
