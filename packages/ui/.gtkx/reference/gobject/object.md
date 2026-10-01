---
description: "The base object type."
---

# GObject

The base object type.

`GObject` is the fundamental type providing the common attributes and
methods for all object types in GTK, Pango and other libraries
based on GObject. The `GObject` class provides methods for object
construction and destruction, property access methods, and signal
support. Signals are described in detail [here](signals.html).

For a tutorial on implementing a new `GObject` class, see [How to define and
implement a new GObject](tutorial.html#how-to-define-and-implement-a-new-gobject).
For a list of naming conventions for GObjects and their methods, see the
[GType conventions](concepts.html#conventions). For the high-level concepts
behind GObject, read
[Instantiatable classed types: Objects](concepts.html#instantiatable-classed-types-objects).

Since GLib 2.72, all `GObject`s are guaranteed to be aligned to at least the
alignment of the largest basic GLib type (typically this is `guint64` or
`gdouble`). If you need larger alignment for an element in a `GObject`, you
should allocate it on the heap (aligned), or arrange for your `GObject` to be
appropriately padded. This guarantee applies to the `GObject` (or derived)
struct, the `GObjectClass` (or derived) struct, and any private data allocated
by `G_ADD_PRIVATE()`.

```tsx
import { GObject } from "@gtkx/jsx/gobject";
```

## Props

`ref` receives the `GObject.Object` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onNotify`

```ts
(pspec: GObject.ParamSpec, self: GObject.Object) => void
```

The notify signal is emitted on an object when one of its properties has
its value set through `g_object_set_property()`, `g_object_set()`, et al.

Note that getting this signal doesn’t itself guarantee that the value of
the property has actually changed. When it is emitted is determined by the
derived GObject class. If the implementor did not create the property with
`G_PARAM_EXPLICIT_NOTIFY`, then any call to `g_object_set_property()` results
in ::notify being emitted, even if the new value is the same as the old.
If they did pass `G_PARAM_EXPLICIT_NOTIFY`, then this signal is emitted only
when they explicitly call `g_object_notify()` or `g_object_notify_by_pspec()`,
and common practice is to do that only when the value has actually changed.

This signal is typically used to obtain change notification for a
single property, by specifying the property name as a detail in the
`g_signal_connect()` call, like this:

```c
g_signal_connect (text_view->buffer, "notify::paste-target-list",
                  G_CALLBACK (gtk_text_view_target_list_notify),
                  text_view)
```

It is important to note that you must use
[canonical parameter names]`GObject.ParamSpec#parameter-names` as
detail strings for the notify signal.

**Parameters**

- `pspec`: the `GParamSpec` of the property which changed.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GObject.Object` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gobject`. Methods inherited from ancestors are documented on their own pages.

### `bindProperty`

```ts
bindProperty(sourceProperty: string, target: GObject.Object, targetProperty: string, flags: GObject.BindingFlags): GObject.Binding
```

Creates a binding between `source_property` on `source` and `target_property`
on `target`.

Whenever the `source_property` is changed the `target_property` is
updated using the same value. For instance:

```c
g_object_bind_property (action, "active", widget, "sensitive", 0);
```

Will result in the "sensitive" property of the widget `GObject` instance to be
updated with the same value of the "active" property of the action `GObject`
instance.

If `flags` contains `G_BINDING_BIDIRECTIONAL` then the binding will be mutual:
if `target_property` on `target` changes then the `source_property` on `source`
will be updated as well.

The binding will automatically be removed when either the `source` or the
`target` instances are finalized. To remove the binding without affecting the
`source` and the `target` you can just call `g_object_unref()` on the returned
`GBinding` instance.

Removing the binding by calling `g_object_unref()` on it must only be done if
the binding, `source` and `target` are only used from a single thread and it
is clear that both `source` and `target` outlive the binding. Especially it
is not safe to rely on this if the binding, `source` or `target` can be
finalized from different threads. Keep another reference to the binding and
use `g_binding_unbind()` instead to be on the safe side.

A `GObject` can have multiple bindings.

**Parameters**

- `sourceProperty`: the property on `source` to bind
- `target`: the target `GObject`
- `targetProperty`: the property on `target` to bind
- `flags`: flags to pass to `GBinding`

**Returns** the `GBinding` instance representing the
    binding between the two `GObject` instances. The binding is released
    whenever the `GBinding` reference count reaches zero.

_Available since 2.26._

### `bindPropertyFull`

```ts
bindPropertyFull(sourceProperty: string, target: GObject.Object, targetProperty: string, flags: GObject.BindingFlags, transformTo: GObject.Closure | ClosureCallback, transformFrom: GObject.Closure | ClosureCallback): GObject.Binding
```

Creates a binding between `source_property` on `source` and `target_property`
on `target`, allowing you to set the transformation functions to be used by
the binding.

This function is the language bindings friendly version of
`g_object_bind_property_full()`, using `GClosures` instead of
function pointers.

**Parameters**

- `sourceProperty`: the property on `source` to bind
- `target`: the target `GObject`
- `targetProperty`: the property on `target` to bind
- `flags`: flags to pass to `GBinding`
- `transformTo`: a `GClosure` wrapping the transformation function from the `source` to the `target`, or `null` to use the default
- `transformFrom`: a `GClosure` wrapping the transformation function from the `target` to the `source`, or `null` to use the default

**Returns** the `GBinding` instance representing the
    binding between the two `GObject` instances. The binding is released
    whenever the `GBinding` reference count reaches zero.

_Available since 2.26._

### `freezeNotify`

```ts
freezeNotify(): void
```

Increases the freeze count on `object`. If the freeze count is
non-zero, the emission of "notify" signals on `object` is
stopped. The signals are queued until the freeze count is decreased
to zero. Duplicate notifications are squashed so that at most one
`GObject.notify` signal is emitted for each property modified while the
object is frozen.

This is necessary for accessors that modify multiple properties to prevent
premature notification while the object is still being modified.

### `getProperty`

```ts
getProperty(propertyName: string, value: GObject.Value): void
```

Gets a property of an object.

The `value` can be:

 - an empty `GValue` initialized by `G_VALUE_INIT`, which will be
   automatically initialized with the expected type of the property
   (since GLib 2.60)
 - a `GValue` initialized with the expected type of the property
 - a `GValue` initialized with a type to which the expected type
   of the property can be transformed

In general, a copy is made of the property contents and the caller is
responsible for freeing the memory by calling `g_value_unset()`.

Note that `g_object_get_property()` is really intended for language
bindings, `g_object_get()` is much more convenient for C programming.

**Parameters**

- `propertyName`: the name of the property to get
- `value`: return location for the property value

### `getv`

```ts
getv(names: string[], values: GObject.Value[]): void
```

Gets `n_properties` properties for an `object`.
Obtained properties will be set to `values`. All properties must be valid.
Warnings will be emitted and undefined behaviour may result if invalid
properties are passed in.

**Parameters**

- `names`: the names of each property to get
- `values`: the values of each property to get

_Available since 2.54._

### `isFloating`

```ts
isFloating(): boolean
```

Checks whether `object` has a [floating](floating-refs.html) reference.

**Returns** `true` if `object` has a floating reference

_Available since 2.10._

### `notify`

```ts
notify(propertyName: string): void
```

Emits a "notify" signal for the property `property_name` on `object`.

When possible, eg. when signaling a property change from within the class
that registered the property, you should use `g_object_notify_by_pspec()`
instead.

Note that emission of the notify signal may be blocked with
`g_object_freeze_notify()`. In this case, the signal emissions are queued
and will be emitted (in reverse order) when `g_object_thaw_notify()` is
called.

**Parameters**

- `propertyName`: the name of a property installed on the class of `object`.

### `notifyByPspec`

```ts
notifyByPspec(pspec: GObject.ParamSpec): void
```

Emits a "notify" signal for the property specified by `pspec` on `object`.

This function omits the property name lookup, hence it is faster than
`g_object_notify()`.

One way to avoid using `g_object_notify()` from within the
class that registered the properties, and using `g_object_notify_by_pspec()`
instead, is to store the GParamSpec used with
`g_object_class_install_property()` inside a static array, e.g.:

```c
typedef enum
  {
    PROP_FOO = 1,
    PROP_LAST
  } MyObjectProperty;

  static GParamSpec *properties[PROP_LAST];

  static void
  my_object_class_init (MyObjectClass *klass)
  {
    properties[PROP_FOO] = g_param_spec_int ("foo", NULL, NULL,
                                             0, 100,
                                             50,
                                             G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS);
    g_object_class_install_property (gobject_class,
                                     PROP_FOO,
                                     properties[PROP_FOO]);
  }
```

and then notify a change on the "foo" property with:

```c
g_object_notify_by_pspec (self, properties[PROP_FOO]);
```

**Parameters**

- `pspec`: the `GParamSpec` of a property installed on the class of `object`.

_Available since 2.26._

### `runDispose`

```ts
runDispose(): void
```

Releases all references to other objects. This can be used to break
reference cycles.

This function should only be called from object system implementations.

### `setProperty`

```ts
setProperty(propertyName: string, value: GObject.Value | JsValue): void
```

Sets a property on an object.

**Parameters**

- `propertyName`: the name of the property to set
- `value`: the value

### `thawNotify`

```ts
thawNotify(): void
```

Reverts the effect of a previous call to
`g_object_freeze_notify()`. The freeze count is decreased on `object`
and when it reaches zero, queued "notify" signals are emitted.

Duplicate notifications for each property are squashed so that at most one
`GObject.notify` signal is emitted for each property, in the reverse order
in which they have been queued.

It is an error to call this function when the freeze count is zero.

### `watchClosure`

```ts
watchClosure(closure: GObject.Closure): void
```

This function essentially limits the life time of the `closure` to
the life time of the object. That is, when the object is finalized,
the `closure` is invalidated by calling `g_closure_invalidate()` on
it, in order to prevent invocations of the closure with a finalized
(nonexisting) object. Also, `g_object_ref()` and `g_object_unref()` are
added as marshal guards to the `closure`, to ensure that an extra
reference count is held on `object` during invocation of the
`closure`.  Usually, this function will be called on closures that
use this `object` as closure data.

**Parameters**

- `closure`: `GClosure` to watch
