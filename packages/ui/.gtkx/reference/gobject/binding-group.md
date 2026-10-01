---
description: "GBindingGroup can be used to bind multiple properties from an object collectively."
---

# GBindingGroup

`GBindingGroup` can be used to bind multiple properties
from an object collectively.

Use the various methods to bind properties from a single source
object to multiple destination objects. Properties can be bound
bidirectionally and are connected when the source object is set
with `GObject.BindingGroup.setSource()`.

_Available since 2.72._

```tsx
import { GBindingGroup } from "@gtkx/jsx/gobject";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GBindingGroup**

## Props

`ref` receives the `GObject.BindingGroup` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `source`

`GObject.Object | ReactElement`

The source object used for binding properties.

_Available since 2.72._

## Methods

Methods are called on the `GObject.BindingGroup` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gobject`. Methods inherited from ancestors are documented on their own pages.

### `bind`

```ts
bind(sourceProperty: string, target: GObject.Object, targetProperty: string, flags: GObject.BindingFlags): void
```

Creates a binding between `source_property` on the source object
and `target_property` on `target`. Whenever the `source_property`
is changed the `target_property` is updated using the same value.
The binding flag `G_BINDING_SYNC_CREATE` is automatically specified.

See `g_object_bind_property()` for more information.

**Parameters**

- `sourceProperty`: the property on the source to bind
- `target`: the target `GObject`
- `targetProperty`: the property on `target` to bind
- `flags`: the flags used to create the `GBinding`

_Available since 2.72._

### `bindFull`

```ts
bindFull(sourceProperty: string, target: GObject.Object, targetProperty: string, flags: GObject.BindingFlags, transformTo: GObject.Closure | null | ClosureCallback, transformFrom: GObject.Closure | null | ClosureCallback): void
```

Creates a binding between `source_property` on the source object and
`target_property` on `target`, allowing you to set the transformation
functions to be used by the binding. The binding flag
`G_BINDING_SYNC_CREATE` is automatically specified.

This function is the language bindings friendly version of
`g_binding_group_bind_property_full()`, using `GClosures`
instead of function pointers.

See `g_object_bind_property_with_closures()` for more information.

**Parameters**

- `sourceProperty`: the property on the source to bind
- `target`: the target `GObject`
- `targetProperty`: the property on `target` to bind
- `flags`: the flags used to create the `GBinding`
- `transformTo`: a `GClosure` wrapping the transformation function from the source object to the `target`, or `null` to use the default
- `transformFrom`: a `GClosure` wrapping the transformation function from the `target` to the source object, or `null` to use the default

_Available since 2.72._

### `dupSource`

```ts
dupSource(): GObject.Object | null
```

Gets the source object used for binding properties.

**Returns** a `GObject` or `null`.

_Available since 2.72._

### `setSource`

```ts
setSource(source: GObject.Object | null): void
```

Sets `source` as the source object used for creating property
bindings. If there is already a source object all bindings from it
will be removed.

Note that all properties that have been bound must exist on `source`.

**Parameters**

- `source`: the source `GObject`, or `null` to clear it

_Available since 2.72._
