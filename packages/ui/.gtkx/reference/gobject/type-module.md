---
description: "GTypeModule provides a simple implementation of the GTypePlugin interface."
---

# GTypeModule

`GTypeModule` provides a simple implementation of the `GTypePlugin`
interface.

The model of `GTypeModule` is a dynamically loaded module which
implements some number of types and interface implementations.

When the module is loaded, it registers its types and interfaces
using `GObject.TypeModule.registerType()` and
`GObject.TypeModule.addInterface()`.
As long as any instances of these types and interface implementations
are in use, the module is kept loaded. When the types and interfaces
are gone, the module may be unloaded. If the types and interfaces
become used again, the module will be reloaded. Note that the last
reference cannot be released from within the module code, since that
would lead to the caller's code being unloaded before `g_object_unref()`
returns to it.

Keeping track of whether the module should be loaded or not is done by
using a use count - it starts at zero, and whenever it is greater than
zero, the module is loaded. The use count is maintained internally by
the type system, but also can be explicitly controlled by
`GObject.TypeModule.use()` and `GObject.TypeModule.unuse()`.
Typically, when loading a module for the first type, `g_type_module_use()`
will be used to load it so that it can initialize its types. At some later
point, when the module no longer needs to be loaded except for the type
implementations it contains, `g_type_module_unuse()` is called.

`GTypeModule` does not actually provide any implementation of module
loading and unloading. To create a particular module type you must
derive from `GTypeModule` and implement the load and unload functions
in `GTypeModuleClass`.

```tsx
import { GTypeModule } from "@gtkx/jsx/gobject";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GTypeModule**

Implements `GTypePlugin`.

## Props

`ref` receives the `GObject.TypeModule` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `GObject.TypeModule` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gobject`. Methods inherited from ancestors are documented on their own pages.

### `addInterface`

```ts
addInterface(instanceType: bigint | AnyClass<TypedClass>, interfaceType: bigint | AnyClass<TypedClass>, interfaceInfo: GObject.InterfaceInfo): void
```

Registers an additional interface for a type, whose interface lives
in the given type plugin. If the interface was already registered
for the type in this plugin, nothing will be done.

As long as any instances of the type exist, the type plugin will
not be unloaded.

Since 2.56 if `module` is `null` this will call `g_type_add_interface_static()`
instead. This can be used when making a static build of the module.

**Parameters**

- `instanceType`: type to which to add the interface.
- `interfaceType`: interface type to add
- `interfaceInfo`: type information structure

### `registerEnum`

```ts
registerEnum(name: string, constStaticValues: GObject.EnumValue[]): bigint
```

Looks up or registers an enumeration that is implemented with a particular
type plugin. If a type with name `type_name` was previously registered,
the `GType` identifier for the type is returned, otherwise the type
is newly registered, and the resulting `GType` identifier returned.

As long as any instances of the type exist, the type plugin will
not be unloaded.

Since 2.56 if `module` is `null` this will call `g_type_register_static()`
instead. This can be used when making a static build of the module.

**Parameters**

- `name`: name for the type
- `constStaticValues`: an array of `GEnumValue` structs for the possible enumeration values. The array is terminated by a struct with all members being 0.

**Returns** the new or existing type ID

_Available since 2.6._

### `registerFlags`

```ts
registerFlags(name: string, constStaticValues: GObject.FlagsValue[]): bigint
```

Looks up or registers a flags type that is implemented with a particular
type plugin. If a type with name `type_name` was previously registered,
the `GType` identifier for the type is returned, otherwise the type
is newly registered, and the resulting `GType` identifier returned.

As long as any instances of the type exist, the type plugin will
not be unloaded.

Since 2.56 if `module` is `null` this will call `g_type_register_static()`
instead. This can be used when making a static build of the module.

**Parameters**

- `name`: name for the type
- `constStaticValues`: an array of `GFlagsValue` structs for the possible flags values. The array is terminated by a struct with all members being 0.

**Returns** the new or existing type ID

_Available since 2.6._

### `registerType`

```ts
registerType(parentType: bigint | AnyClass<TypedClass>, typeName: string, typeInfo: GObject.TypeInfo, flags: GObject.TypeFlags): bigint
```

Looks up or registers a type that is implemented with a particular
type plugin. If a type with name `type_name` was previously registered,
the `GType` identifier for the type is returned, otherwise the type
is newly registered, and the resulting `GType` identifier returned.

When reregistering a type (typically because a module is unloaded
then reloaded, and reinitialized), `module` and `parent_type` must
be the same as they were previously.

As long as any instances of the type exist, the type plugin will
not be unloaded.

Since 2.56 if `module` is `null` this will call `g_type_register_static()`
instead. This can be used when making a static build of the module.

**Parameters**

- `parentType`: the type for the parent class
- `typeName`: name for the type
- `typeInfo`: type information structure
- `flags`: flags field providing details about the type

**Returns** the new or existing type ID

### `setName`

```ts
setName(name: string): void
```

Sets the name for a `GTypeModule`

**Parameters**

- `name`: a human-readable name to use in error messages.

### `typeModuleUse`

```ts
typeModuleUse(): boolean
```

Increases the use count of a `GTypeModule` by one. If the
use count was zero before, the plugin will be loaded.
If loading the plugin fails, the use count is reset to
its prior value.

**Returns** `false` if the plugin needed to be loaded and
 loading the plugin failed.

### `unuse`

```ts
unuse(): void
```

Decreases the use count of a `GTypeModule` by one. If the
result is zero, the module will be unloaded. (However, the
`GTypeModule` will not be freed, and types associated with the
`GTypeModule` are not unregistered. Once a `GTypeModule` is
initialized, it must exist forever.)
