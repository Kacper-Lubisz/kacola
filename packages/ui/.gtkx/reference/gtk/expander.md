---
description: "Allows the user to reveal or conceal a child widget."
---

# GtkExpander

Allows the user to reveal or conceal a child widget.



This is similar to the triangles used in a `GtkTreeView`.

Normally you use an expander as you would use a frame; you create
the child widget and use `Gtk.Expander.setChild()` to add it
to the expander. When the expander is toggled, it will take care of
showing and hiding the child automatically.

## Special Usage

There are situations in which you may prefer to show and hide the
expanded widget yourself, such as when you want to actually create
the widget at expansion time. In this case, create a `GtkExpander`
but do not add a child to it. The expander widget has an
`Gtk.Expander.expanded` property which can be used to
monitor its expansion state. You should watch this property with
a signal connection as follows:

```c
static void
expander_callback (GObject    *object,
                   GParamSpec *param_spec,
                   gpointer    user_data)
{
  GtkExpander *expander;

  expander = GTK_EXPANDER (object);

  if (gtk_expander_get_expanded (expander))
    {
      // Show or create widgets
    }
  else
    {
      // Hide or destroy widgets
    }
}

static void
create_expander (void)
{
  GtkWidget *expander = gtk_expander_new_with_mnemonic ("_More Options");
  g_signal_connect (expander, "notify::expanded",
                    G_CALLBACK (expander_callback), NULL);

  // ...
}
```

## GtkExpander as GtkBuildable

An example of a UI definition fragment with GtkExpander:

```xml
<object class="GtkExpander">
  <property name="label-widget">
    <object class="GtkLabel" id="expander-label"/>
  </property>
  <property name="child">
    <object class="GtkEntry" id="expander-content"/>
  </property>
</object>
```

## CSS nodes

```
expander-widget
╰── box
    ├── title
    │   ├── expander
    │   ╰── <label widget>
    ╰── <child>
```

`GtkExpander` has a main node `expander-widget`, and subnode `box` containing
the title and child widget. The box subnode `title` contains node `expander`,
i.e. the expand/collapse arrow; then the label widget if any. The arrow of an
expander that is showing its child gets the `:checked` pseudoclass set on it.

## Accessibility

`GtkExpander` uses the `Gtk.AccessibleRole.button` role.

```tsx
import { GtkExpander } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkExpander**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Expander` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `expanded`

`boolean` · default `false`

Whether the expander has been opened to reveal the child.

### `label`

`string` · default `null`

The text of the expanders label.

### `labelWidget`

`Gtk.Widget | ReactElement`

A widget to display instead of the usual expander label.

### `resizeToplevel`

`boolean` · default `false`

When this property is `true`, the expander will resize the toplevel
widget containing the expander upon expanding and collapsing.

### `useMarkup`

`boolean` · default `false`

Whether the text in the label is Pango markup.

### `useUnderline`

`boolean` · default `false`

Whether an underline in the text indicates a mnemonic.

## Signals

### `onActivate`

```ts
(self: Gtk.Expander) => void
```

Activates the `GtkExpander`.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Expander` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `expander`.

**Returns** the child widget of `expander`

### `getExpanded`

```ts
getExpanded(): boolean
```

Queries a `GtkExpander` and returns its current state.

Returns `true` if the child widget is revealed.

**Returns** the current state of the expander

### `getLabel`

```ts
getLabel(): string | null
```

Fetches the text from a label widget.

This is including any embedded underlines indicating mnemonics and
Pango markup, as set by `Gtk.Expander.setLabel()`. If the label
text has not been set the return value will be `null`. This will be the
case if you create an empty button with `gtk_button_new()` to use as a
container.

**Returns** The text of the label widget. This string is owned
  by the widget and must not be modified or freed.

### `getLabelWidget`

```ts
getLabelWidget(): Gtk.Widget | null
```

Retrieves the label widget for the frame.

**Returns** the label widget

### `getResizeToplevel`

```ts
getResizeToplevel(): boolean
```

Returns whether the expander will resize the toplevel widget
containing the expander upon resizing and collapsing.

**Returns** the “resize toplevel” setting.

### `getUseMarkup`

```ts
getUseMarkup(): boolean
```

Returns whether the label’s text is interpreted as Pango markup.

**Returns** `true` if the label’s text will be parsed for markup

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Returns whether an underline in the text indicates a mnemonic.

**Returns** `true` if an embedded underline in the expander
  label indicates the mnemonic accelerator keys

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `expander`.

**Parameters**

- `child`: the child widget

### `setExpanded`

```ts
setExpanded(expanded: boolean): void
```

Sets the state of the expander.

Set to `true`, if you want the child widget to be revealed,
and `false` if you want the child widget to be hidden.

**Parameters**

- `expanded`: whether the child widget is revealed

### `setLabel`

```ts
setLabel(label: string | null): void
```

Sets the text of the label of the expander to `label`.

This will also clear any previously set labels.

**Parameters**

- `label`: a string

### `setLabelWidget`

```ts
setLabelWidget(labelWidget: Gtk.Widget | null): void
```

Set the label widget for the expander.

This is the widget that will appear embedded alongside
the expander arrow.

**Parameters**

- `labelWidget`: the new label widget

### `setResizeToplevel`

```ts
setResizeToplevel(resizeToplevel: boolean): void
```

Sets whether the expander will resize the toplevel widget
containing the expander upon resizing and collapsing.

**Parameters**

- `resizeToplevel`: whether to resize the toplevel

### `setUseMarkup`

```ts
setUseMarkup(useMarkup: boolean): void
```

Sets whether the text of the label contains Pango markup.

**Parameters**

- `useMarkup`: `true` if the label’s text should be parsed for markup

### `setUseUnderline`

```ts
setUseUnderline(useUnderline: boolean): void
```

If true, an underline in the text indicates a mnemonic.

**Parameters**

- `useUnderline`: `true` if underlines in the text indicate mnemonics
