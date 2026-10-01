---
description: "A widget that changes layout based on available size."
---

# AdwBreakpointBin

A widget that changes layout based on available size.



`AdwBreakpointBin` provides a way to use breakpoints without `Window`,
`ApplicationWindow` or `Dialog`. It can be useful for limiting
breakpoints to a single page and similar purposes. Most applications
shouldn't need it.

`AdwBreakpointBin` is similar to `Bin`. It has one child, set via the
`BreakpointBin.child` property.

When `AdwBreakpointBin` is resized, its child widget can rearrange its layout
at specific thresholds.

The thresholds and layout changes are defined via `Breakpoint` objects.
They can be added using `BreakpointBin.addBreakpoint()`.

Each breakpoint has a condition, specifying the bin's size and/or aspect
ratio, and setters that automatically set object properties when that
happens. The `Breakpoint.apply` and `Breakpoint.unapply` can
be used instead for more complex scenarios.

Breakpoints are only allowed to modify widgets inside the `AdwBreakpointBin`,
but not on the `AdwBreakpointBin` itself or any other widgets.

If multiple breakpoints can be used for the current size, the last one is
always picked. The current breakpoint can be tracked using the
`BreakpointBin.currentBreakpoint` property.

If none of the breakpoints can be used, that property will be set to `NULL`,
and the original property values will be used instead.

### Minimum Size

Adding a breakpoint to `AdwBreakpointBin` will result in it having no minimum
size. The `Gtk.Widget.widthRequest` and
`Gtk.Widget.heightRequest` properties must always be set when using
breakpoints, indicating the smallest size you want to support.

The minimum size and breakpoint conditions must be carefully selected so that
the child widget completely fits. If it doesn't, it will overflow and a
warning message will be printed.

When choosing minimum size, consider translations and text scale factor
changes. Make sure to leave enough space for text labels, and enable
ellipsizing or wrapping if they might not fit.

For `Gtk.Label` this can be done via `Gtk.Label.ellipsize`, or
via `Gtk.Label.wrap` together with `Gtk.Label.wrapMode`.

For buttons, use `Gtk.Button.canShrink`,
`Gtk.MenuButton.canShrink`, `Adw.SplitButton.canShrink`,
or `Adw.ButtonContent.canShrink`.

### Example

```c
GtkWidget *bin, *child;
AdwBreakpoint *breakpoint;

bin = adw_breakpoint_bin_new ();
gtk_widget_set_size_request (bin, 150, 150);

child = gtk_label_new ("Wide");
gtk_label_set_ellipsize (GTK_LABEL (label), PANGO_ELLIPSIZE_END);
gtk_widget_add_css_class (child, "title-1");
adw_breakpoint_bin_set_child (ADW_BREAKPOINT_BIN (bin), child);

breakpoint = adw_breakpoint_new (adw_breakpoint_condition_parse ("max-width: 200px"));
adw_breakpoint_add_setters (breakpoint,
                            G_OBJECT (child), "label", "Narrow",
                            NULL);
adw_breakpoint_bin_add_breakpoint (ADW_BREAKPOINT_BIN (bin), breakpoint);
```

The bin has a single label inside it, displaying "Wide". When the bin's width
is smaller than or equal to 200px, it changes to "Narrow".

### `AdwBreakpointBin` as `GtkBuildable`

`AdwBreakpointBin` allows adding `AdwBreakpoint` objects as children.

Example of an `AdwBreakpointBin` UI definition:

```xml
<object class="AdwBreakpointBin">
  <property name="width-request">150</property>
  <property name="height-request">150</property>
  <property name="child">
    <object class="GtkLabel" id="child">
      <property name="label">Wide</property>
      <property name="ellipsize">end</property>
      <style>
        <class name="title-1"/>
      </style>
    </object>
  </property>
  <child>
    <object class="AdwBreakpoint">
      <condition>max-width: 200px</condition>
      <setter object="child" property="label">Narrow</setter>
    </object>
  </child>
</object>
```

See `Breakpoint` documentation for details.

_Available since 1.4._

```tsx
import { AdwBreakpointBin } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwBreakpointBin**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.BreakpointBin` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `breakpoints`

`ReactNode | null`

`Adw.Breakpoint` elements added to the element, each applying while its condition holds.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `currentBreakpoint`

`Adw.Breakpoint` · read-only, observe with `onNotifyCurrentBreakpoint`

The current breakpoint.

_Available since 1.4._

## Methods

Methods are called on the `Adw.BreakpointBin` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addBreakpoint`

```ts
addBreakpoint(breakpoint: Adw.Breakpoint): void
```

Adds `breakpoint` to `self`.

**Parameters**

- `breakpoint`: the breakpoint to add

_Available since 1.4._

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `self`.

**Returns** the child widget of `self`

_Available since 1.4._

### `getCurrentBreakpoint`

```ts
getCurrentBreakpoint(): Adw.Breakpoint | null
```

Gets the current breakpoint.

**Returns** the current breakpoint

_Available since 1.4._

### `removeBreakpoint`

```ts
removeBreakpoint(breakpoint: Adw.Breakpoint): void
```

Removes `breakpoint` from `self`.

**Parameters**

- `breakpoint`: a breakpoint to remove

_Available since 1.5._

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `self`.

**Parameters**

- `child`: the child widget

_Available since 1.4._
