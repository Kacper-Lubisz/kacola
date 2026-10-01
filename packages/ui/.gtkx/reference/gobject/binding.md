---
description: "GObject instance (or source) and another property on another GObject instance (or target)."
---

# GBinding

`GObject` instance (or source) and another property on another `GObject`
instance (or target).

Whenever the source property changes, the same value is applied to the
target property; for instance, the following binding:

```c
  g_object_bind_property (object1, "property-a",
                          object2, "property-b",
                          G_BINDING_DEFAULT);
```

will cause the property named "property-b" of `object2` to be updated
every time `GObject.set()` or the specific accessor changes the value of
the property "property-a" of `object1`.

It is possible to create a bidirectional binding between two properties
of two `GObject` instances, so that if either property changes, the
other is updated as well, for instance:

```c
  g_object_bind_property (object1, "property-a",
                          object2, "property-b",
                          G_BINDING_BIDIRECTIONAL);
```

will keep the two properties in sync.

It is also possible to set a custom transformation function (in both
directions, in case of a bidirectional binding) to apply a custom
transformation from the source value to the target value before
applying it; for instance, the following binding:

```c
  g_object_bind_property_full (adjustment1, "value",
                               adjustment2, "value",
                               G_BINDING_BIDIRECTIONAL,
                               celsius_to_fahrenheit,
                               fahrenheit_to_celsius,
                               NULL, NULL);
```

will keep the "value" property of the two adjustments in sync; the
`celsius_to_fahrenheit` function will be called whenever the "value"
property of `adjustment1` changes and will transform the current value
of the property before applying it to the "value" property of `adjustment2`.

Vice versa, the `fahrenheit_to_celsius` function will be called whenever
the "value" property of `adjustment2` changes, and will transform the
current value of the property before applying it to the "value" property
of `adjustment1`.

Note that `GBinding` does not resolve cycles by itself; a cycle like

```
  object1:propertyA -> object2:propertyB
  object2:propertyB -> object3:propertyC
  object3:propertyC -> object1:propertyA
```

might lead to an infinite loop. The loop, in this particular case,
can be avoided if the objects emit the `GObject::notify` signal only
if the value has effectively been changed. A binding is implemented
using the `GObject::notify` signal, so it is susceptible to all the
various ways of blocking a signal emission, like `GObject.signalStopEmission()`
or `GObject.signalHandlerBlock()`.

A binding will be severed, and the resources it allocates freed, whenever
either one of the `GObject` instances it refers to are finalized, or when
the `GBinding` instance loses its last reference.

Bindings for languages with garbage collection can use
`GObject.Binding.unbind()` to explicitly release a binding between the source
and target properties, instead of relying on the last reference on the
binding, source, and target instances to drop.

_Available since 2.26._

```tsx
import { GBinding } from "@gtkx/jsx/gobject";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GBinding**

## Props

`ref` receives the `GObject.Binding` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `flags`

`GObject.BindingFlags` · default `G_BINDING_DEFAULT` · construct-only

Flags to be used to control the `GBinding`

_Available since 2.26._

### `source`

`GObject.Object` · construct-only

The `GObject` that should be used as the source of the binding

_Available since 2.26._

### `sourceProperty`

`string` · default `null` · construct-only

The name of the property of `GBinding.source` that should be used
as the source of the binding.

This should be in [canonical form]`GObject.ParamSpec#parameter-names` to get the
best performance.

_Available since 2.26._

### `target`

`GObject.Object` · construct-only

The `GObject` that should be used as the target of the binding

_Available since 2.26._

### `targetProperty`

`string` · default `null` · construct-only

The name of the property of `GBinding.target` that should be used
as the target of the binding.

This should be in [canonical form]`GObject.ParamSpec#parameter-names` to get the
best performance.

_Available since 2.26._

## Methods

Methods are called on the `GObject.Binding` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gobject`. Methods inherited from ancestors are documented on their own pages.

### `dupSource`

```ts
dupSource(): GObject.Object | null
```

Retrieves the `GObject` instance used as the source of the binding.

A `GBinding` can outlive the source `GObject` as the binding does not hold a
strong reference to the source. If the source is destroyed before the
binding then this function will return `null`.

**Returns** the source `GObject`, or `null` if the
    source does not exist any more.

_Available since 2.68._

### `dupTarget`

```ts
dupTarget(): GObject.Object | null
```

Retrieves the `GObject` instance used as the target of the binding.

A `GBinding` can outlive the target `GObject` as the binding does not hold a
strong reference to the target. If the target is destroyed before the
binding then this function will return `null`.

**Returns** the target `GObject`, or `null` if the
    target does not exist any more.

_Available since 2.68._

### `getFlags`

```ts
getFlags(): GObject.BindingFlags
```

Retrieves the flags passed when constructing the `GBinding`.

**Returns** the `GBindingFlags` used by the `GBinding`

_Available since 2.26._

### `getSource`

```ts
getSource(): GObject.Object | null
```

Retrieves the `GObject` instance used as the source of the binding.

A `GBinding` can outlive the source `GObject` as the binding does not hold a
strong reference to the source. If the source is destroyed before the
binding then this function will return `null`.

Use `g_binding_dup_source()` if the source or binding are used from different
threads as otherwise the pointer returned from this function might become
invalid if the source is finalized from another thread in the meantime.

**Returns** the source `GObject`, or `null` if the
    source does not exist any more.

> **Deprecated since 2.68.** Use `g_binding_dup_source()` for a safer version of this function.

_Available since 2.26._

### `getSourceProperty`

```ts
getSourceProperty(): string
```

Retrieves the name of the property of `GBinding.source` used as the source
of the binding.

**Returns** the name of the source property

_Available since 2.26._

### `getTarget`

```ts
getTarget(): GObject.Object | null
```

Retrieves the `GObject` instance used as the target of the binding.

A `GBinding` can outlive the target `GObject` as the binding does not hold a
strong reference to the target. If the target is destroyed before the
binding then this function will return `null`.

Use `g_binding_dup_target()` if the target or binding are used from different
threads as otherwise the pointer returned from this function might become
invalid if the target is finalized from another thread in the meantime.

**Returns** the target `GObject`, or `null` if the
    target does not exist any more.

> **Deprecated since 2.68.** Use `g_binding_dup_target()` for a safer version of this function.

_Available since 2.26._

### `getTargetProperty`

```ts
getTargetProperty(): string
```

Retrieves the name of the property of `GBinding.target` used as the target
of the binding.

**Returns** the name of the target property

_Available since 2.26._

### `unbind`

```ts
unbind(): void
```

Explicitly releases the binding between the source and the target
property expressed by `binding`.

This function will release the reference that is being held on
the `binding` instance if the binding is still bound; if you want to hold on
to the `GBinding` instance after calling `g_binding_unbind()`, you will need
to hold a reference to it.

Note however that this function does not take ownership of `binding`, it
only unrefs the reference that was initially created by
`g_object_bind_property()` and is owned by the binding.

_Available since 2.38._
