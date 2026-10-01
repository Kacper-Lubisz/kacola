---
description: "An opaque struct representing a simple animation."
---

# GdkPixbufSimpleAnim

An opaque struct representing a simple animation.

```tsx
import { GdkPixbufSimpleAnim } from "@gtkx/jsx/gdkpixbuf";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GdkPixbufAnimation](.gtkx/reference/gdkpixbuf/pixbuf-animation.md) → **GdkPixbufSimpleAnim**

## Props

`ref` receives the `GdkPixbuf.PixbufSimpleAnim` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `loop`

`boolean` · default `false` · deprecated since 2.44

Whether the animation should loop when it reaches the end.

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

_Available since 2.18._

## Methods

Methods are called on the `GdkPixbuf.PixbufSimpleAnim` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gdkpixbuf`. Methods inherited from ancestors are documented on their own pages.

### `addFrame`

```ts
addFrame(pixbuf: GdkPixbuf.Pixbuf): void
```

Adds a new frame to `animation`. The `pixbuf` must
have the dimensions specified when the animation
was constructed.

**Parameters**

- `pixbuf`: the pixbuf to add

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

_Available since 2.8._

### `getLoop`

```ts
getLoop(): boolean
```

Gets whether `animation` should loop indefinitely when it reaches the end.

**Returns** `true` if the animation loops forever, `false` otherwise

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

_Available since 2.18._

### `setLoop`

```ts
setLoop(loop: boolean): void
```

Sets whether `animation` should loop indefinitely when it reaches the end.

**Parameters**

- `loop`: whether to loop the animation

> **Deprecated since 2.44.** Use a different image loading library for animatable assets

_Available since 2.18._
