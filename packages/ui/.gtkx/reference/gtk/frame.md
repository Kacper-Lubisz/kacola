---
description: "Surrounds its child with a decorative frame and an optional label."
---

# GtkFrame

Surrounds its child with a decorative frame and an optional label.



If present, the label is drawn inside the top edge of the frame.
The horizontal position of the label can be controlled with
`Gtk.Frame.setLabelAlign()`.

`GtkFrame` clips its child. You can use this to add rounded corners
to widgets, but be aware that it also cuts off shadows.

## GtkFrame as GtkBuildable

An example of a UI definition fragment with GtkFrame:

```xml
<object class="GtkFrame">
  <property name="label-widget">
    <object class="GtkLabel" id="frame_label"/>
  </property>
  <property name="child">
    <object class="GtkEntry" id="frame_content"/>
  </property>
</object>
```

## CSS nodes

```
frame
├── <label widget>
╰── <child>
```

`GtkFrame` has a main CSS node with name “frame”, which is used to draw the
visible border. You can set the appearance of the border using CSS properties
like “border-style” on this node.

## Accessibility

`GtkFrame` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { GtkFrame } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkFrame**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Frame` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `label`

`string` · default `null`

Text of the frame's label.

### `labelWidget`

`Gtk.Widget | ReactElement`

Widget to display in place of the usual frame label.

### `labelXalign`

`number` · default `0.000000`

The horizontal alignment of the label.

## Methods

Methods are called on the `Gtk.Frame` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `frame`.

**Returns** the child widget of `frame`

### `getLabel`

```ts
getLabel(): string | null
```

Returns the frame labels text.

If the frame's label widget is not a `GtkLabel`, `null`
is returned.

**Returns** the text in the label, or `null` if there
   was no label widget or the label widget was not a `GtkLabel`.
   This string is owned by GTK and must not be modified or freed.

### `getLabelAlign`

```ts
getLabelAlign(): number
```

Retrieves the X alignment of the frame’s label.

**Returns** the frames X alignment

### `getLabelWidget`

```ts
getLabelWidget(): Gtk.Widget | null
```

Retrieves the label widget for the frame.

**Returns** the label widget

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `frame`.

**Parameters**

- `child`: the child widget

### `setLabel`

```ts
setLabel(label: string | null): void
```

Creates a new `GtkLabel` with the `label` and sets it as the frame's
label widget.

**Parameters**

- `label`: the text to use as the label of the frame

### `setLabelAlign`

```ts
setLabelAlign(xalign: number): void
```

Sets the X alignment of the frame widget’s label.

The default value for a newly created frame is 0.0.

**Parameters**

- `xalign`: The position of the label along the top edge of the widget. A value of 0.0 represents left alignment; 1.0 represents right alignment.

### `setLabelWidget`

```ts
setLabelWidget(labelWidget: Gtk.Widget | null): void
```

Sets the label widget for the frame.

This is the widget that will appear embedded in the top edge
of the frame as a title.

**Parameters**

- `labelWidget`: the new label widget
