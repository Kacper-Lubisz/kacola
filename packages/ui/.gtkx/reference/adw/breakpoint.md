---
description: "Describes a breakpoint for Window or Dialog."
---

# AdwBreakpoint

Describes a breakpoint for `Window` or `Dialog`.

Breakpoints are used to create adaptive UI, allowing to change the layout
depending on available size.

Breakpoint is a size threshold, specified by its condition, as well as one or
more setters.

Each setter has a target object, a property and a value. When a breakpoint
is applied, each setter sets the target property on their target object to
the specified value, and reset it back to the original value when it's
unapplied.

For more complicated scenarios, `Breakpoint.apply` and
`Breakpoint.unapply` can be used instead.

Breakpoints can be used within `Window`, `ApplicationWindow`,
`Dialog` or `BreakpointBin`.

### `AdwBreakpoint` as `GtkBuildable`:

`AdwBreakpoint` supports specifying its condition via the `<condition>`
element. The contents of the element must be a string in a format accepted by
`BreakpointCondition.parse()`.

It also supports adding setters via the `<setter>` element. Each `<setter>`
element must have the `object` attribute specifying the target object, and
the `property` attribute specifying the property name. The contents of the
element are used as the setter value.

For `G_TYPE_OBJECT` and `G_TYPE_BOXED` derived properties, empty contents are
treated as `NULL`.

Setter values can be translated with the usual `translatable`, `context` and
`comments` attributes.

Example of an `AdwBreakpoint` UI definition:

```xml
<object class="AdwBreakpoint">
  <condition>max-width: 400px</condition>
  <setter object="button" property="visible">True</setter>
  <setter object="box" property="orientation">vertical</setter>
  <setter object="page" property="title" translatable="yes">Example</setter>
</object>
```

_Available since 1.4._

```tsx
import { AdwBreakpoint } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **AdwBreakpoint**

Implements `GtkBuildable`.

## Props

`ref` receives the `Adw.Breakpoint` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `condition`

`Adw.BreakpointCondition`

The breakpoint's condition.

_Available since 1.4._

## Signals

### `onApply`

```ts
(self: Adw.Breakpoint) => void
```

Emitted when the breakpoint is applied.

This signal is emitted after the setters have been applied.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

### `onUnapply`

```ts
(self: Adw.Breakpoint) => void
```

Emitted when the breakpoint is unapplied.

This signal is emitted before resetting the setter values.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 1.4._

## Methods

Methods are called on the `Adw.Breakpoint` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addSetter`

```ts
addSetter(object: GObject.Object, property: string, value: GObject.Value | JsValue | null): void
```

Adds a setter to `self`.

The setter will automatically set `property` on `object` to `value` when
applying the breakpoint, and set it back to its original value upon
unapplying it.

::: note
    Setting properties to their original values does not work for properties
    that have irreversible side effects. For example, changing
    `Gtk.Button.label` while `Gtk.Button.iconName` is set
    will reset the icon. However, resetting the label will not set
    `icon-name` to its original value.

Use the `Breakpoint.apply` and `Breakpoint.unapply` signals
for those properties instead, as follows:

```c
static void
breakpoint_apply_cb (MyWidget *self)
{
  gtk_button_set_icon_name (self->button, "go-previous-symbolic");
}

static void
breakpoint_apply_cb (MyWidget *self)
{
  gtk_button_set_label (self->button, _("_Back"));
}

// ...

g_signal_connect_swapped (breakpoint, "apply",
                          G_CALLBACK (breakpoint_apply_cb), self);
g_signal_connect_swapped (breakpoint, "unapply",
                          G_CALLBACK (breakpoint_unapply_cb), self);
```

**Parameters**

- `object`: the target object
- `property`: the target property
- `value`: the value to set

_Available since 1.4._

### `addSetters`

```ts
addSetters(objects: GObject.Object[], names: string[], values: (GObject.Value | JsValue)[]): void
```

Adds `n_setters` setters to `self`.

This is a convenience function for adding multiple setters at once.

See `Breakpoint.addSetter()`.

This function is meant to be used by language bindings.

**Parameters**

- `objects`: setter target object
- `names`: setter target properties
- `values`: setter values

_Available since 1.4._

### `getCondition`

```ts
getCondition(): Adw.BreakpointCondition | null
```

Gets the condition for `self`.

**Returns** the condition

_Available since 1.4._

### `setCondition`

```ts
setCondition(condition: Adw.BreakpointCondition | null): void
```

Sets the condition for `self`.

**Parameters**

- `condition`: the new condition

_Available since 1.4._
