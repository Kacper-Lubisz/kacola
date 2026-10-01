---
description: "Renders a scene graph defined via a tree of Gsk.RenderNode instances."
---

# GskRenderer

Renders a scene graph defined via a tree of `Gsk.RenderNode` instances.

Typically you will use a `GskRenderer` instance to repeatedly call
`Gsk.Renderer.render()` to update the contents of its associated
`Gdk.Surface`.

It is necessary to realize a `GskRenderer` instance using
`Gsk.Renderer.realize()` before calling `Gsk.Renderer.render()`,
in order to create the appropriate windowing system resources needed
to render the scene.

```tsx
import { GskRenderer } from "@gtkx/jsx/gsk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GskRenderer**

## Props

`ref` receives the `Gsk.Renderer` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `realized`

`boolean` · default `false` · read-only, observe with `onNotifyRealized`

Whether the renderer has been associated with a surface or draw context.

### `surface`

`Gdk.Surface` · read-only, observe with `onNotifySurface`

The surface associated with renderer.

## Methods

Methods are called on the `Gsk.Renderer` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gsk`. Methods inherited from ancestors are documented on their own pages.

### `getSurface`

```ts
getSurface(): Gdk.Surface | null
```

Retrieves the surface that the renderer is associated with.

If the renderer has not been realized yet, `NULL` will be returned.

**Returns** the surface

### `isRealized`

```ts
isRealized(): boolean
```

Checks whether the renderer is realized or not.

**Returns** true if the renderer was realized, false otherwise

### `realize`

```ts
realize(surface: Gdk.Surface | null): boolean
```

Creates the resources needed by the renderer.

Since GTK 4.6, the surface may be `NULL`, which allows using
renderers without having to create a surface. Since GTK 4.14,
it is recommended to use `Gsk.Renderer.realizeForDisplay()`
for this case.

Note that it is mandatory to call `Gsk.Renderer.unrealize()`
before destroying the renderer.

**Parameters**

- `surface`: the surface that renderer will be used on

**Returns** whether the renderer was successfully realized

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `realizeForDisplay`

```ts
realizeForDisplay(display: Gdk.Display): boolean
```

Creates the resources needed by the renderer.

Note that it is mandatory to call `Gsk.Renderer.unrealize()`
before destroying the renderer.

**Parameters**

- `display`: the display that the renderer will be used on

**Returns** whether the renderer was successfully realized

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 4.14._

### `render`

```ts
render(root: Gsk.RenderNode, region: cairo.Region | null): void
```

Renders the scene graph, described by a tree of `GskRenderNode` instances
to the renderer's surface, ensuring that the given region gets redrawn.

If the renderer has no associated surface, this function does nothing.

Renderers must ensure that changes of the contents given by the `root`
node as well as the area given by `region` are redrawn. They are however
free to not redraw any pixel outside of `region` if they can guarantee that
it didn't change.

The renderer will acquire a reference on the `GskRenderNode` tree while
the rendering is in progress.

**Parameters**

- `root`: the render node to render
- `region`: the `cairo_region_t` that must be redrawn or `NULL` for the whole surface

### `renderTexture`

```ts
renderTexture(root: Gsk.RenderNode, viewport: Graphene.Rect | null): Gdk.Texture
```

Renders a scene graph, described by a tree of `GskRenderNode` instances,
to a texture.

The renderer will acquire a reference on the `GskRenderNode` tree while
the rendering is in progress.

If you want to apply any transformations to `root`, you should put it into a
transform node and pass that node instead.

**Parameters**

- `root`: the render node to render
- `viewport`: the section to draw or `NULL` to use `root`'s bounds

**Returns** a texture with the rendered contents of `root`

### `unrealize`

```ts
unrealize(): void
```

Releases all the resources created by `Gsk.Renderer.realize()`.
