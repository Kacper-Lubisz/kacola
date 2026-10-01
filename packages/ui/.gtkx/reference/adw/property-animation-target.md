---
description: "An AnimationTarget changing the value of a property of a GObject.Object instance."
---

# AdwPropertyAnimationTarget

An `AnimationTarget` changing the value of a property of a
`GObject.Object` instance.

_Available since 1.2._

```tsx
import { AdwPropertyAnimationTarget } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [AdwAnimationTarget](.gtkx/reference/adw/animation-target.md) → **AdwPropertyAnimationTarget**

## Props

`ref` receives the `Adw.PropertyAnimationTarget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `object`

`GObject.Object` · construct-only

The object whose property will be animated.

The `AdwPropertyAnimationTarget` instance does not hold a strong reference
on the object; make sure the object is kept alive throughout the target's
lifetime.

_Available since 1.2._

### `pspec`

`GObject.ParamSpec` · construct-only

The `GParamSpec` of the property to be animated.

_Available since 1.2._

## Methods

Methods are called on the `Adw.PropertyAnimationTarget` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getObject`

```ts
getObject(): GObject.Object
```

Gets the object animated by `self`.

The `AdwPropertyAnimationTarget` instance does not hold a strong reference on
the object; make sure the object is kept alive throughout the target's
lifetime.

**Returns** the animated object

_Available since 1.2._

### `getPspec`

```ts
getPspec(): GObject.ParamSpec
```

Gets the `GParamSpec` of the property animated by `self`.

**Returns** the animated property's `GParamSpec`

_Available since 1.2._
