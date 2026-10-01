---
description: "The base class for all widgets."
---

# GtkWidget

The base class for all widgets.

It manages the widget lifecycle, layout, states and style.

#### Height-for-width Geometry Management

GTK uses a height-for-width (and width-for-height) geometry management
system. Height-for-width means that a widget can change how much
vertical space it needs, depending on the amount of horizontal space
that it is given (and similar for width-for-height). The most common
example is a label that reflows to fill up the available width, wraps
to fewer lines, and therefore needs less height.

Height-for-width geometry management is implemented in GTK by way
of two virtual methods:

- `Gtk.Widget.getRequestMode()`
- `Gtk.Widget.measure()`

There are some important things to keep in mind when implementing
height-for-width and when using it in widget implementations.

If you implement a direct `GtkWidget` subclass that supports
height-for-width or width-for-height geometry management for itself
or its child widgets, the `Gtk.Widget.getRequestMode()` virtual
function must be implemented as well and return the widget's preferred
request mode. The default implementation of this virtual function
returns `GTK_SIZE_REQUEST_CONSTANT_SIZE`, which means that the widget will
only ever get -1 passed as the for_size value to its
`Gtk.Widget.measure()` implementation.

The geometry management system will query a widget hierarchy in
only one orientation at a time. When widgets are initially queried
for their minimum sizes it is generally done in two initial passes
in the `Gtk.SizeRequestMode` chosen by the toplevel.

For example, when queried in the normal `GTK_SIZE_REQUEST_HEIGHT_FOR_WIDTH` mode:

First, the default minimum and natural width for each widget
in the interface will be computed using `Gtk.Widget.measure()` with an
orientation of `GTK_ORIENTATION_HORIZONTAL` and a for_size of -1.
Because the preferred widths for each widget depend on the preferred
widths of their children, this information propagates up the hierarchy,
and finally a minimum and natural width is determined for the entire
toplevel. Next, the toplevel will use the minimum width to query for the
minimum height contextual to that width using `Gtk.Widget.measure()` with an
orientation of `GTK_ORIENTATION_VERTICAL` and a for_size of the just computed
width. This will also be a highly recursive operation. The minimum height
for the minimum width is normally used to set the minimum size constraint
on the toplevel.

After the toplevel window has initially requested its size in both
dimensions it can go on to allocate itself a reasonable size (or a size
previously specified with `Gtk.Window.setDefaultSize()`). During the
recursive allocation process it’s important to note that request cycles
will be recursively executed while widgets allocate their children.
Each widget, once allocated a size, will go on to first share the
space in one orientation among its children and then request each child's
height for its target allocated width or its width for allocated height,
depending. In this way a widget will typically be requested its size
a number of times before actually being allocated a size. The size a
widget is finally allocated can of course differ from the size it has
requested. For this reason, `GtkWidget` caches a  small number of results
to avoid re-querying for the same sizes in one allocation cycle.

If a widget does move content around to intelligently use up the
allocated size then it must support the request in both
`GtkSizeRequestMode`s even if the widget in question only
trades sizes in a single orientation.

For instance, a `Gtk.Label` that does height-for-width word wrapping
will not expect to have `Gtk.Widget.measure()` with an orientation of
`GTK_ORIENTATION_VERTICAL` called because that call is specific to a
width-for-height request. In this case the label must return the height
required for its own minimum possible width. By following this rule any
widget that handles height-for-width or width-for-height requests will
always be allocated at least enough space to fit its own content.

Here are some examples of how a `GTK_SIZE_REQUEST_HEIGHT_FOR_WIDTH` widget
generally deals with width-for-height requests:

```c
static void
foo_widget_measure (GtkWidget      *widget,
                    GtkOrientation  orientation,
                    int             for_size,
                    int            *minimum_size,
                    int            *natural_size,
                    int            *minimum_baseline,
                    int            *natural_baseline)
{
  if (orientation == GTK_ORIENTATION_HORIZONTAL)
    {
      // Calculate minimum and natural width
    }
  else // VERTICAL
    {
      if (i_am_in_height_for_width_mode)
        {
          int min_width, dummy;

          // First, get the minimum width of our widget
          GTK_WIDGET_GET_CLASS (widget)->measure (widget, GTK_ORIENTATION_HORIZONTAL, -1,
                                                  &min_width, &dummy, &dummy, &dummy);

          // Now use the minimum width to retrieve the minimum and natural height to display
          // that width.
          GTK_WIDGET_GET_CLASS (widget)->measure (widget, GTK_ORIENTATION_VERTICAL, min_width,
                                                  minimum_size, natural_size, &dummy, &dummy);
        }
      else
        {
          // ... some widgets do both.
        }
    }
}
```

Often a widget needs to get its own request during size request or
allocation. For example, when computing height it may need to also
compute width. Or when deciding how to use an allocation, the widget
may need to know its natural size. In these cases, the widget should
be careful to call its virtual methods directly, like in the code
example above.

It will not work to use the wrapper function `Gtk.Widget.measure()`
inside your own `Gtk.Widget.sizeAllocate()` implementation.
These return a request adjusted by `Gtk.SizeGroup`, the widget's
align and expand flags, as well as its CSS style.

If a widget used the wrappers inside its virtual method implementations,
then the adjustments (such as widget margins) would be applied
twice. GTK therefore does not allow this and will warn if you try
to do it.

Of course if you are getting the size request for another widget, such
as a child widget, you must use `Gtk.Widget.measure()`; otherwise, you
would not properly consider widget margins, `Gtk.SizeGroup`, and
so forth.

GTK also supports baseline vertical alignment of widgets. This
means that widgets are positioned such that the typographical baseline of
widgets in the same row are aligned. This happens if a widget supports
baselines, has a vertical alignment using baselines, and is inside
a widget that supports baselines and has a natural “row” that it aligns to
the baseline, or a baseline assigned to it by the grandparent.

Baseline alignment support for a widget is also done by the
`Gtk.Widget.measure()` virtual function. It allows you to report
both a minimum and natural size.

If a widget ends up baseline aligned it will be allocated all the space in
the parent as if it was `GTK_ALIGN_FILL`, but the selected baseline can be
found via `Gtk.Widget.getBaseline()`. If the baseline has a
value other than -1 you need to align the widget such that the baseline
appears at the position.

#### GtkWidget as GtkBuildable

The `GtkWidget` implementation of the `GtkBuildable` interface
supports various custom elements to specify additional aspects of widgets
that are not directly expressed as properties.

If the widget uses a `Gtk.LayoutManager`, `GtkWidget` supports
a custom `<layout>` element, used to define layout properties:

```xml
<object class="GtkGrid" id="my_grid">
  <child>
    <object class="GtkLabel" id="label1">
      <property name="label">Description</property>
      <layout>
        <property name="column">0</property>
        <property name="row">0</property>
        <property name="row-span">1</property>
        <property name="column-span">1</property>
      </layout>
    </object>
  </child>
  <child>
    <object class="GtkEntry" id="description_entry">
      <layout>
        <property name="column">1</property>
        <property name="row">0</property>
        <property name="row-span">1</property>
        <property name="column-span">1</property>
      </layout>
    </object>
  </child>
</object>
```

`GtkWidget` allows style information such as style classes to
be associated with widgets, using the custom `<style>` element:

```xml
<object class="GtkButton" id="button1">
  <style>
    <class name="my-special-button-class"/>
    <class name="dark-button"/>
  </style>
</object>
```

`GtkWidget` allows defining accessibility information, such as properties,
relations, and states, using the custom `<accessibility>` element:

```xml
<object class="GtkButton" id="button1">
  <accessibility>
    <property name="label">Download</property>
    <relation name="labelled-by">label1</relation>
  </accessibility>
</object>
```

#### Building composite widgets from template XML

`GtkWidget `exposes some facilities to automate the procedure
of creating composite widgets using "templates".

To create composite widgets with `GtkBuilder` XML, one must associate
the interface description with the widget class at class initialization
time using `Gtk.WidgetClass.setTemplate()`.

The interface description semantics expected in composite template descriptions
is slightly different from regular `Gtk.Builder` XML.

Unlike regular interface descriptions, `Gtk.WidgetClass.setTemplate()`
will expect a `<template>` tag as a direct child of the toplevel
`<interface>` tag. The `<template>` tag must specify the “class” attribute
which must be the type name of the widget. Optionally, the “parent”
attribute may be specified to specify the direct parent type of the widget
type; this is ignored by `GtkBuilder` but can be used by UI design tools to
introspect what kind of properties and internal children exist for a given
type when the actual type does not exist.

The XML which is contained inside the `<template>` tag behaves as if it were
added to the `<object>` tag defining the widget itself. You may set properties
on a widget by inserting `<property>` tags into the `<template>` tag, and also
add `<child>` tags to add children and extend a widget in the normal way you
would with `<object>` tags.

Additionally, `<object>` tags can also be added before and after the initial
`<template>` tag in the normal way, allowing one to define auxiliary objects
which might be referenced by other widgets declared as children of the
`<template>` tag.

Since, unlike the `<object>` tag, the `<template>` tag does not contain an
“id” attribute, if you need to refer to the instance of the object itself that
the template will create, simply refer to the template class name in an
applicable element content.

Here is an example of a template definition, which includes an example of
this in the `<signal>` tag:

```xml
<interface>
  <template class="FooWidget" parent="GtkBox">
    <property name="orientation">horizontal</property>
    <property name="spacing">4</property>
    <child>
      <object class="GtkButton" id="hello_button">
        <property name="label">Hello World</property>
        <signal name="clicked" handler="hello_button_clicked" object="FooWidget" swapped="yes"/>
      </object>
    </child>
    <child>
      <object class="GtkButton" id="goodbye_button">
        <property name="label">Goodbye World</property>
      </object>
    </child>
  </template>
</interface>
```

Typically, you'll place the template fragment into a file that is
bundled with your project, using `GResource`. In order to load the
template, you need to call `Gtk.WidgetClass.setTemplateFromResource()`
from the class initialization of your `GtkWidget` type:

```c
static void
foo_widget_class_init (FooWidgetClass *klass)
{
  // ...

  gtk_widget_class_set_template_from_resource (GTK_WIDGET_CLASS (klass),
                                               "/com/example/ui/foowidget.ui");
}
```

You will also need to call `Gtk.Widget.initTemplate()` from the
instance initialization function:

```c
static void
foo_widget_init (FooWidget *self)
{
  gtk_widget_init_template (GTK_WIDGET (self));

  // Initialize the rest of the widget...
}
```

as well as calling `Gtk.Widget.disposeTemplate()` from the dispose
function:

```c
static void
foo_widget_dispose (GObject *gobject)
{
  FooWidget *self = FOO_WIDGET (gobject);

  // Dispose objects for which you have a reference...

  // Clear the template children for this widget type
  gtk_widget_dispose_template (GTK_WIDGET (self), FOO_TYPE_WIDGET);

  G_OBJECT_CLASS (foo_widget_parent_class)->dispose (gobject);
}
```

You can access widgets defined in the template using the
`Gtk.Widget.getTemplateChild()` function, but you will typically declare
a pointer in the instance private data structure of your type using the same
name as the widget in the template definition, and call
`Gtk.WidgetClass.bindTemplateChildFull()` (or one of its wrapper macros
`Gtk.widgetClassBindTemplateChild()` and `Gtk.widgetClassBindTemplateChildPrivate()`)
with that name, e.g.

```c
typedef struct {
  GtkWidget *hello_button;
  GtkWidget *goodbye_button;
} FooWidgetPrivate;

G_DEFINE_TYPE_WITH_PRIVATE (FooWidget, foo_widget, GTK_TYPE_BOX)

static void
foo_widget_dispose (GObject *gobject)
{
  gtk_widget_dispose_template (GTK_WIDGET (gobject), FOO_TYPE_WIDGET);

  G_OBJECT_CLASS (foo_widget_parent_class)->dispose (gobject);
}

static void
foo_widget_class_init (FooWidgetClass *klass)
{
  // ...
  G_OBJECT_CLASS (klass)->dispose = foo_widget_dispose;

  gtk_widget_class_set_template_from_resource (GTK_WIDGET_CLASS (klass),
                                               "/com/example/ui/foowidget.ui");
  gtk_widget_class_bind_template_child_private (GTK_WIDGET_CLASS (klass),
                                                FooWidget, hello_button);
  gtk_widget_class_bind_template_child_private (GTK_WIDGET_CLASS (klass),
                                                FooWidget, goodbye_button);
}

static void
foo_widget_init (FooWidget *widget)
{
  gtk_widget_init_template (GTK_WIDGET (widget));
}
```

You can also use `Gtk.WidgetClass.bindTemplateCallbackFull()` (or
is wrapper macro `Gtk.widgetClassBindTemplateCallback()`) to connect
a signal callback defined in the template with a function visible in the
scope of the class, e.g.

```c
// the signal handler has the instance and user data swapped
// because of the swapped="yes" attribute in the template XML
static void
hello_button_clicked (FooWidget *self,
                      GtkButton *button)
{
  g_print ("Hello, world!\n");
}

static void
foo_widget_class_init (FooWidgetClass *klass)
{
  // ...
  gtk_widget_class_set_template_from_resource (GTK_WIDGET_CLASS (klass),
                                               "/com/example/ui/foowidget.ui");
  gtk_widget_class_bind_template_callback (GTK_WIDGET_CLASS (klass), hello_button_clicked);
}
```

```tsx
import { GtkWidget } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → **GtkWidget**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Widget` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `accessibleRole`

`Gtk.AccessibleRole` · default `GTK_ACCESSIBLE_ROLE_NONE` · from `GtkAccessible`

The accessible role of the given `GtkAccessible` implementation.

The accessible role cannot be changed once set.

### `actionGroups`

`ReactNode | null`

`Gio.ActionGroup` elements inserted into the widget, each under its own `prefix`.

### `canFocus`

`boolean` · default `true`

Whether the widget or any of its descendents can accept
the input focus.

This property is meant to be set by widget implementations,
typically in their instance init function.

### `canTarget`

`boolean` · default `true`

Whether the widget can receive pointer events.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `controllers`

`ReactNode | null`

`Gtk.EventController` elements added to the widget.

### `cssClasses`

`string[]`

A list of css classes applied to this widget.

### `cssName`

`string` · default `null` · construct-only

The name of this widget in the CSS tree.

This property is meant to be set by widget implementations,
typically in their instance init function.

### `cursor`

`Gdk.Cursor | ReactElement`

The cursor used by `widget`.

### `focusable`

`boolean` · default `false`

Whether this widget itself will accept the input focus.

### `focusOnClick`

`boolean` · default `true`

Whether the widget should grab focus when it is clicked with the mouse.

This property is only relevant for widgets that can take focus.

### `halign`

`Gtk.Align` · default `GTK_ALIGN_FILL`

How to distribute horizontal space if widget gets extra space.

### `hasDefault`

`boolean` · default `false` · read-only, observe with `onNotifyHasDefault`

Whether the widget is the default widget.

### `hasFocus`

`boolean` · default `false` · read-only, observe with `onNotifyHasFocus`

Whether the widget has the input focus.

### `hasTooltip`

`boolean` · default `false`

Enables or disables the emission of the `Gtk.Widget.query-tooltip`
signal on `widget`.

A true value indicates that `widget` can have a tooltip, in this case
the widget will be queried using `Gtk.Widget.query-tooltip` to
determine whether it will provide a tooltip or not.

### `heightRequest`

`number` · default `-1`

Overrides for height request of the widget.

If this is -1, the natural request will be used.

### `hexpand`

`boolean` · default `false`

Whether to expand horizontally.

### `hexpandSet`

`boolean` · default `false`

Whether to use the `hexpand` property.

### `layoutManager`

`Gtk.LayoutManager | ReactElement`

The `Gtk.LayoutManager` instance to use to compute
the preferred size of the widget, and allocate its children.

This property is meant to be set by widget implementations,
typically in their instance init function.

### `limitEvents`

`boolean` · default `false`

Makes this widget act like a modal dialog, with respect to
event delivery.

Global event controllers will not handle events with targets
inside the widget, unless they are set up to ignore propagation
limits. See `Gtk.EventController.setPropagationLimit()`.

_Available since 4.18._

### `marginBottom`

`number` · default `0`

Margin on bottom side of widget.

This property adds margin outside of the widget's normal size
request, the margin will be added in addition to the size from
`Gtk.Widget.setSizeRequest()` for example.

### `marginEnd`

`number` · default `0`

Margin on end of widget, horizontally.

This property supports left-to-right and right-to-left text
directions.

This property adds margin outside of the widget's normal size
request, the margin will be added in addition to the size from
`Gtk.Widget.setSizeRequest()` for example.

### `marginStart`

`number` · default `0`

Margin on start of widget, horizontally.

This property supports left-to-right and right-to-left text
directions.

This property adds margin outside of the widget's normal size
request, the margin will be added in addition to the size from
`Gtk.Widget.setSizeRequest()` for example.

### `marginTop`

`number` · default `0`

Margin on top side of widget.

This property adds margin outside of the widget's normal size
request, the margin will be added in addition to the size from
`Gtk.Widget.setSizeRequest()` for example.

### `name`

`string` · default `null`

The name of the widget.

### `opacity`

`number` · default `1.000000`

The requested opacity of the widget.

### `overflow`

`Gtk.Overflow` · default `GTK_OVERFLOW_VISIBLE`

How content outside the widget's content area is treated.

This property is meant to be set by widget implementations,
typically in their instance init function.

### `parent`

`Gtk.Widget` · read-only, observe with `onNotifyParent`

The parent widget of this widget.

### `receivesDefault`

`boolean` · default `false`

Whether the widget will receive the default action when it is focused.

### `root`

`Gtk.Root` · read-only, observe with `onNotifyRoot`

The `GtkRoot` widget of the widget tree containing this widget.

This will be `NULL` if the widget is not contained in a root widget.

### `scaleFactor`

`number` · default `1` · read-only, observe with `onNotifyScaleFactor`

The scale factor of the widget.

### `sensitive`

`boolean` · default `true`

Whether the widget responds to input.

### `style`

`Style | null`

Style declarations applied to this widget alone, outranking any class in `cssClasses`.

### `tooltipMarkup`

`string` · default `null`

Sets the text of tooltip to be the given string, which is marked up
with Pango markup.

Also see `Gtk.Tooltip.setMarkup()`.

This is a convenience property which will take care of getting the
tooltip shown if the given string is not `NULL`:
`Gtk.Widget.hasTooltip` will automatically be set to true
and there will be taken care of `Gtk.Widget.query-tooltip` in
the default signal handler.

Note that if both `Gtk.Widget.tooltipText` and
`Gtk.Widget.tooltipMarkup` are set, the last one wins.

### `tooltipText`

`string` · default `null`

Sets the text of tooltip to be the given string.

Also see `Gtk.Tooltip.setText()`.

This is a convenience property which will take care of getting the
tooltip shown if the given string is not `NULL`:
`Gtk.Widget.hasTooltip` will automatically be set to true
and there will be taken care of `Gtk.Widget.query-tooltip` in
the default signal handler.

Note that if both `Gtk.Widget.tooltipText` and
`Gtk.Widget.tooltipMarkup` are set, the last one wins.

### `valign`

`Gtk.Align` · default `GTK_ALIGN_FILL`

How to distribute vertical space if widget gets extra space.

### `vexpand`

`boolean` · default `false`

Whether to expand vertically.

### `vexpandSet`

`boolean` · default `false`

Whether to use the `vexpand` property.

### `visible`

`boolean` · default `true`

Whether the widget is visible.

### `widthRequest`

`number` · default `-1`

Overrides for width request of the widget.

If this is -1, the natural request will be used.

## Signals

### `onDestroy`

```ts
(self: Gtk.Widget) => void
```

Signals that all holders of a reference to the widget should release
the reference that they hold.

May result in finalization of the widget if all references are released.

This signal is not suitable for saving widget state.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onDirectionChanged`

```ts
(previousDirection: Gtk.TextDirection, self: Gtk.Widget) => void
```

Emitted when the text direction of a widget changes.

**Parameters**

- `previousDirection`: the previous text direction
- `self`: The instance the signal was emitted on.

### `onHide`

```ts
(self: Gtk.Widget) => void
```

Emitted when `widget` is hidden.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onKeynavFailed`

```ts
(direction: Gtk.DirectionType, self: Gtk.Widget) => boolean | undefined
```

Emitted if keyboard navigation fails.

See `Gtk.Widget.keynavFailed()` for details.

**Parameters**

- `direction`: the direction of movement
- `self`: The instance the signal was emitted on.

**Returns** true if stopping keyboard navigation is fine, false
  if the emitting widget should try to handle the keyboard
  navigation attempt in its parent widget

### `onMap`

```ts
(self: Gtk.Widget) => void
```

Emitted when `widget` is going to be mapped.

A widget is mapped when the widget is visible (which is controlled with
`Gtk.Widget.visible`) and all its parents up to the toplevel widget
are also visible.

The `::map` signal can be used to determine whether a widget will be drawn,
for instance it can resume an animation that was stopped during the
emission of `Gtk.Widget.unmap`.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onMnemonicActivate`

```ts
(groupCycling: boolean, self: Gtk.Widget) => boolean | undefined
```

Emitted when a widget is activated via a mnemonic.

The default handler for this signal activates `widget` if `group_cycling`
is false, or just makes `widget` grab focus if `group_cycling` is true.

**Parameters**

- `groupCycling`: true if there are other widgets with the same mnemonic
- `self`: The instance the signal was emitted on.

**Returns** true to stop other handlers from being invoked for the event,
  false to propagate the event further

### `onMoveFocus`

```ts
(direction: Gtk.DirectionType, self: Gtk.Widget) => void
```

Emitted when the focus is moved.

The `::move-focus` signal is a [keybinding signal](class.SignalAction.html).

The default bindings for this signal are <kbd>Tab</kbd> to move forward,
and <kbd>Shift</kbd>+<kbd>Tab</kbd> to move backward.

**Parameters**

- `direction`: the direction of the focus move
- `self`: The instance the signal was emitted on.

### `onQueryTooltip`

```ts
(x: number, y: number, keyboardMode: boolean, tooltip: Gtk.Tooltip, self: Gtk.Widget) => boolean | undefined
```

Emitted when the widget’s tooltip is about to be shown.

This happens when the `Gtk.Widget.hasTooltip` property
is true and the hover timeout has expired with the cursor hovering
above `widget`; or emitted when `widget` got focus in keyboard mode.

Using the given coordinates, the signal handler should determine
whether a tooltip should be shown for `widget`. If this is the case
true should be returned, false otherwise. Note that if `keyboard_mode`
is true, the values of `x` and `y` are undefined and should not be used.

The signal handler is free to manipulate `tooltip` with the therefore
destined function calls.

**Parameters**

- `x`: the x coordinate of the cursor position in widget coordinates
- `y`: the y coordinate of the cursor position in widget coordinates
- `keyboardMode`: true if the tooltip was triggered using the keyboard
- `tooltip`: a `GtkTooltip`
- `self`: The instance the signal was emitted on.

**Returns** true if `tooltip` should be shown right now, false otherwise

### `onRealize`

```ts
(self: Gtk.Widget) => void
```

Emitted when `widget` is associated with a `GdkSurface`.

This means that `Gtk.Widget.realize()` has been called
or the widget has been mapped (that is, it is going to be drawn).

**Parameters**

- `self`: The instance the signal was emitted on.

### `onShow`

```ts
(self: Gtk.Widget) => void
```

Emitted when `widget` is shown.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onStateFlagsChanged`

```ts
(flags: Gtk.StateFlags, self: Gtk.Widget) => void
```

Emitted when the widget state changes.

See `Gtk.Widget.getStateFlags()`.

**Parameters**

- `flags`: the previous state flags
- `self`: The instance the signal was emitted on.

### `onUnmap`

```ts
(self: Gtk.Widget) => void
```

Emitted when `widget` is going to be unmapped.

A widget is unmapped when either it or any of its parents up to the
toplevel widget have been set as hidden.

As `::unmap` indicates that a widget will not be shown any longer,
it can be used to, for example, stop an animation on the widget.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onUnrealize`

```ts
(self: Gtk.Widget) => void
```

Emitted when the `GdkSurface` associated with `widget` is destroyed.

This means that `Gtk.Widget.unrealize()` has been called
or the widget has been unmapped (that is, it is going to be hidden).

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Widget` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `actionSetEnabled`

```ts
actionSetEnabled(actionName: string, enabled: boolean): void
```

Enables or disables an action installed with
`Gtk.WidgetClass.installAction()`.

**Parameters**

- `actionName`: action name, such as "clipboard.paste"
- `enabled`: whether the action is now enabled

### `activate`

```ts
activate(): boolean
```

Activates the widget.

The activation will emit the signal set using
`Gtk.WidgetClass.setActivateSignal()`
during class initialization.

Activation is what happens when you press <kbd>Enter</kbd>
on a widget.

If you wish to handle the activation keybinding yourself,
it is recommended to use `Gtk.WidgetClass.addShortcut()`
with an action created with `Gtk.SignalAction.new()`.

If `widget` is not activatable, the function returns false.

**Returns** true if the widget was activated

### `activateAction`

```ts
activateAction(name: string, args: GLib.Variant | null): boolean
```

Activates an action for the widget.

The action is looked up in the action groups associated with
`widget` and its ancestors.

If the action is in an action group added with
`Gtk.Widget.insertActionGroup()`, the `name` is expected
to be prefixed with the prefix that was used when the group was
inserted.

The arguments must match the actions expected parameter type,
as returned by `Gio.Action.getParameterType()`.

**Parameters**

- `name`: the name of the action to activate
- `args`: parameters to use

**Returns** true if the action was activated

### `activateDefault`

```ts
activateDefault(): void
```

Activates the `default.activate` action for the widget.

The action is looked up in the same was as for
`Gtk.Widget.activateAction()`.

### `addController`

```ts
addController(controller: Gtk.EventController): void
```

Adds an event controller to the widget.

The event controllers of a widget handle the events that are
propagated to the widget.

You will usually want to call this function right after
creating any kind of `Gtk.EventController`.

**Parameters**

- `controller`: an event controller that hasn't been added to a widget yet

### `addCssClass`

```ts
addCssClass(cssClass: string): void
```

Adds a style class to the widget.

After calling this function, the widget’s style will match
for `css_class`, according to CSS matching rules.

Use `Gtk.Widget.removeCssClass()` to remove the
style again.

**Parameters**

- `cssClass`: style class to add to `widget`, without the leading period

### `addMnemonicLabel`

```ts
addMnemonicLabel(label: Gtk.Widget): void
```

Adds a widget to the list of mnemonic labels for this widget.

See `Gtk.Widget.listMnemonicLabels()`.

Note that the list of mnemonic labels for the widget is cleared
when the widget is destroyed, so the caller must make sure
to update its internal state at this point as well.

**Parameters**

- `label`: a widget that acts as a mnemonic label for `widget`

### `addTickCallback`

```ts
addTickCallback(callback: Gtk.TickCallback): number
```

Queues an animation frame update and adds a callback to be called
before each frame.

Until the tick callback is removed, it will be called frequently
(usually at the frame rate of the output device or as quickly as
the application can be repainted, whichever is slower). For this
reason, is most suitable for handling graphics that change every
frame or every few frames.

The tick callback does not automatically imply a relayout or repaint.
If you want a repaint or relayout, and aren’t changing widget properties
that would trigger that (for example, changing the text of a label),
then you will have to call `Gtk.Widget.queueResize()` or
`Gtk.Widget.queueDraw()` yourself.

`Gdk.FrameClock.getFrameTime()` should generally be used
for timing continuous animations and
`Gdk.FrameTimings.getPredictedPresentationTime()` should be
used if you are trying to display isolated frames at particular times.

This is a more convenient alternative to connecting directly to the
`Gdk.FrameClock.update` signal of the frame clock, since you
don't have to worry about when a frame clock is assigned to a widget.

To remove a tick callback, pass the ID that is returned by this function
to `Gtk.Widget.removeTickCallback()`.

**Parameters**

- `callback`: function to call for updating animations

**Returns** an ID for this callback

### `allocate`

```ts
allocate(width: number, height: number, baseline: number, transform: Gsk.Transform | null): void
```

Assigns size, position, (optionally) a baseline and transform
to a child widget.

In this function, the allocation and baseline may be adjusted.
The given allocation will be forced to be bigger than the
widget's minimum size, as well as at least 0×0 in size.

This function is only used by widget implementations.

For a version that does not take a transform, see
`Gtk.Widget.sizeAllocate()`.

**Parameters**

- `width`: new width
- `height`: new height
- `baseline`: new baseline, or -1
- `transform`: transformation to be applied

### `childFocus`

```ts
childFocus(direction: Gtk.DirectionType): boolean
```

Called by widgets as the user moves around the window using
keyboard shortcuts.

The `direction` argument indicates what kind of motion is taking
place (up, down, left, right, tab forward, tab backward).

This function calls the `Gtk.Widget.focus()` virtual function;
widgets can override the virtual function in order to implement
appropriate focus behavior.

The default `focus()` virtual function for a widget should return
true if moving in `direction` left the focus on a focusable location
inside that widget, and false if moving in `direction` moved the focus
outside the widget. When returning true, widgets normally call
`Gtk.Widget.grabFocus()` to place the focus accordingly;
when returning false, they don’t modify the current focus location.

This function is used by custom widget implementations; if you're
writing an app, you’d use `Gtk.Widget.grabFocus()` to move
the focus to a particular widget.

**Parameters**

- `direction`: direction of focus movement

**Returns** true if focus ended up inside `widget`

### `computeBounds`

```ts
computeBounds(target: Gtk.Widget): [boolean, Graphene.Rect]
```

Computes the bounds for `widget` in the coordinate space of `target`.

The bounds of widget are (the bounding box of) the region that it is
expected to draw in. See the [coordinate system](coordinates.html)
overview to learn more.

If the operation is successful, true is returned. If `widget` has no
bounds or the bounds cannot be expressed in `target`'s coordinate space
(for example if both widgets are in different windows), false is
returned and `bounds` is set to the zero rectangle.

It is valid for `widget` and `target` to be the same widget.

**Parameters**

- `target`: the target widget

**Returns** Tuple of:

- `result`: true if the bounds could be computed
- `outBounds`: the rectangle taking the bounds

### `computeExpand`

```ts
computeExpand(orientation: Gtk.Orientation): boolean
```

Computes whether a parent widget should give this widget
extra space when possible.

Widgets with children should check this, rather than looking at
`Gtk.Widget.getHexpand()` or `Gtk.Widget.getVexpand()`.

This function already checks whether the widget is visible, so
visibility does not need to be checked separately. Non-visible
widgets are not expanded.

The computed expand value uses either the expand setting explicitly
set on the widget itself, or, if none has been explicitly set,
the widget may expand if some of its children do.

**Parameters**

- `orientation`: expand direction

**Returns** whether widget tree rooted here should be expanded

### `computePoint`

```ts
computePoint(target: Gtk.Widget, point: Graphene.Point): [boolean, Graphene.Point]
```

Translates the given `point` in `widget`'s coordinates to coordinates
in `target`’s coordinate system.

In order to perform this operation, both widgets must share a
a common ancestor. If that is not the case, `out_point` is set
to (0, 0) and false is returned.

**Parameters**

- `target`: the widget to transform into
- `point`: a point in `widget`'s coordinate system

**Returns** Tuple of:

- `result`: true if `src_widget` and `dest_widget` have a common ancestor, false otherwise
- `outPoint`: set to the corresponding coordinates in `target`'s coordinate system

### `computeTransform`

```ts
computeTransform(target: Gtk.Widget): [boolean, Graphene.Matrix]
```

Computes a matrix suitable to describe a transformation from
`widget`'s coordinate system into `target`'s coordinate system.

The transform can not be computed in certain cases, for example
when `widget` and `target` do not share a common ancestor. In that
case `out_transform` gets set to the identity matrix.

To learn more about widget coordinate systems, see the coordinate
system [overview](coordinates.html).

**Parameters**

- `target`: the target widget that the matrix will transform to

**Returns** Tuple of:

- `result`: true if the transform could be computed
- `outTransform`: location to store the final transformation

### `contains`

```ts
contains(x: number, y: number): boolean
```

Tests if a given point is contained in the widget.

The coordinates for (x, y) must be in widget coordinates, so
(0, 0) is assumed to be the top left of `widget`'s content area.

**Parameters**

- `x`: X coordinate to test, relative to `widget`'s origin
- `y`: Y coordinate to test, relative to `widget`'s origin

**Returns** true if `widget` contains the point (x, y)

### `createPangoContext`

```ts
createPangoContext(): Pango.Context
```

Creates a new `PangoContext` that is configured for the widget.

The `PangoContext` will have the appropriate font map,
font options, font description, and base direction set.

See also `Gtk.Widget.getPangoContext()`.

**Returns** the new `PangoContext`

### `createPangoLayout`

```ts
createPangoLayout(text: string | null): Pango.Layout
```

Creates a new `PangoLayout` that is configured for the widget.

The `PangoLayout` will have the appropriate font map,
font description, and base direction set.

If you keep a `PangoLayout` created in this way around,
you need to re-create it when the widgets `PangoContext`
is replaced. This can be tracked by listening to changes
of the `Gtk.Widget.root` property on the widget.

**Parameters**

- `text`: text to set on the layout

**Returns** the new `PangoLayout`

### `disposeTemplate`

```ts
disposeTemplate(widgetType: bigint | AnyClass<TypedClass>): void
```

Clears the template children for the widget.

This function is the opposite of `Gtk.Widget.initTemplate()`,
and it is used to clear all the template children from a widget
instance. If you bound a template child to a field in the instance
structure, or in the instance private data structure, the field will
be set to `NULL` after this function returns.

You should call this function inside the `GObjectClass.dispose()`
implementation of any widget that called `Gtk.Widget.initTemplate()`.
Typically, you will want to call this function last, right before
chaining up to the parent type's dispose implementation, e.g.

```c
static void
some_widget_dispose (GObject *gobject)
{
  SomeWidget *self = SOME_WIDGET (gobject);

  // Clear the template data for SomeWidget
  gtk_widget_dispose_template (GTK_WIDGET (self), SOME_TYPE_WIDGET);

  G_OBJECT_CLASS (some_widget_parent_class)->dispose (gobject);
}
```

**Parameters**

- `widgetType`: the type of the widget to finalize the template for

_Available since 4.8._

### `dragCheckThreshold`

```ts
dragCheckThreshold(startX: number, startY: number, currentX: number, currentY: number): boolean
```

Checks to see if a drag movement has passed the GTK drag threshold.

**Parameters**

- `startX`: X coordinate of start of drag
- `startY`: Y coordinate of start of drag
- `currentX`: current X coordinate
- `currentY`: current Y coordinate

**Returns** true if the drag threshold has been passed

### `errorBell`

```ts
errorBell(): void
```

Notifies the user about an input-related error on the widget.

If the `Gtk.Settings.gtkErrorBell` setting is true,
it calls `Gdk.Surface.beep()`, otherwise it does nothing.

Note that the effect of `Gdk.Surface.beep()` can be configured
in many ways, depending on the windowing backend and the desktop
environment or window manager that is used.

### `getAllocatedBaseline`

```ts
getAllocatedBaseline(): number
```

Returns the baseline that has currently been allocated to the widget.

This function is intended to be used when implementing handlers
for the `GtkWidget`Class.`snapshot()` function, and when allocating
child widgets in `GtkWidget`Class.`size_allocate()`.

**Returns** the baseline of the `widget`, or -1 if none

> **Deprecated since 4.12.** Use `Gtk.Widget.getBaseline()` instead

### `getAllocatedHeight`

```ts
getAllocatedHeight(): number
```

Returns the height that has currently been allocated to the widget.

To learn more about widget sizes, see the coordinate
system [overview](coordinates.html).

**Returns** the height of the `widget`

> **Deprecated since 4.12.** Use `Gtk.Widget.getHeight()` instead

### `getAllocatedWidth`

```ts
getAllocatedWidth(): number
```

Returns the width that has currently been allocated to the widget.

To learn more about widget sizes, see the coordinate
system [overview](coordinates.html).

**Returns** the width of the `widget`

> **Deprecated since 4.12.** Use `Gtk.Widget.getWidth()` instead

### `getAllocation`

```ts
getAllocation(): Gtk.Allocation
```

Retrieves the widget’s allocation.

Note, when implementing a layout widget: a widget’s allocation
will be its “adjusted” allocation, that is, the widget’s parent
typically calls `Gtk.Widget.sizeAllocate()` with an allocation,
and that allocation is then adjusted (to handle margin
and alignment for example) before assignment to the widget.
`Gtk.Widget.getAllocation()` returns the adjusted allocation that
was actually assigned to the widget. The adjusted allocation is
guaranteed to be completely contained within the
`Gtk.Widget.sizeAllocate()` allocation, however.

So a layout widget is guaranteed that its children stay inside
the assigned bounds, but not that they have exactly the bounds the
widget assigned.

**Returns** a pointer to a `GtkAllocation` to copy to

> **Deprecated since 4.12.** Use `Gtk.Widget.computeBounds()`, `Gtk.Widget.getWidth()` or `Gtk.Widget.getHeight()` instead.

### `getAncestor`

```ts
getAncestor(widgetType: bigint | AnyClass<TypedClass>): Gtk.Widget | null
```

Gets the first ancestor of the widget with type `widget_type`.

For example, `gtk_widget_get_ancestor (widget, GTK_TYPE_BOX)`
gets the first `GtkBox` that’s an ancestor of `widget`. No
reference will be added to the returned widget; it should
not be unreferenced.

Note that unlike `Gtk.Widget.isAncestor()`, this function
considers `widget` to be an ancestor of itself.

**Parameters**

- `widgetType`: ancestor type

**Returns** the ancestor widget

### `getBaseline`

```ts
getBaseline(): number
```

Returns the baseline that has currently been allocated to the widget.

This function is intended to be used when implementing handlers
for the `GtkWidgetClass.snapshot()` function, and when allocating
child widgets in `GtkWidgetClass.size_allocate()`.

**Returns** the baseline of the `widget`, or -1 if none

_Available since 4.12._

### `getCanFocus`

```ts
getCanFocus(): boolean
```

Determines whether the input focus can enter the widget or any
of its children.

See `Gtk.Widget.setCanFocus()`.

**Returns** true if the input focus can enter `widget`

### `getCanTarget`

```ts
getCanTarget(): boolean
```

Queries whether the widget can be the target of pointer events.

**Returns** true if `widget` can receive pointer events

### `getChildVisible`

```ts
getChildVisible(): boolean
```

Gets the value set with `Gtk.Widget.setChildVisible()`.

If you feel a need to use this function, your code probably
needs reorganization.

This function is only useful for widget implementations
and should never be called by an application.

**Returns** true if the widget is mapped with the parent

### `getClipboard`

```ts
getClipboard(): Gdk.Clipboard
```

Gets the clipboard object for the widget.

This is a utility function to get the clipboard object for the
display that `widget` is using.

Note that this function always works, even when `widget` is not
realized yet.

**Returns** the appropriate clipboard object

### `getColor`

```ts
getColor(): Gdk.RGBA
```

Gets the current foreground color for the widget’s style.

This function should only be used in snapshot
implementations that need to do custom drawing
with the foreground color.

**Returns** return location for the color

_Available since 4.10._

### `getCssClasses`

```ts
getCssClasses(): string[]
```

Returns the list of style classes applied to the widget.

**Returns** a `NULL`-terminated list of
  css classes currently applied to `widget`

### `getCssName`

```ts
getCssName(): string
```

Returns the CSS name of the widget.

**Returns** the CSS name

### `getCursor`

```ts
getCursor(): Gdk.Cursor | null
```

Gets the cursor set on the widget.

See `Gtk.Widget.setCursor()` for details.

**Returns** the cursor
  that is set on `widget`

### `getDirection`

```ts
getDirection(): Gtk.TextDirection
```

Gets the reading direction for the widget.

See `Gtk.Widget.setDirection()`.

**Returns** the reading direction for the widget

### `getDisplay`

```ts
getDisplay(): Gdk.Display
```

Get the display for the window that the widget belongs to.

This function can only be called after the widget has been
added to a widget hierarchy with a `GtkRoot` at the top.

In general, you should only create display-specific
resources when a widget has been realized, and you should
free those resources when the widget is unrealized.

**Returns** the display for this widget

### `getFirstChild`

```ts
getFirstChild(): Gtk.Widget | null
```

Returns the widget’s first child.

This function is primarily meant for widget implementations.

**Returns** the widget's first child

### `getFocusable`

```ts
getFocusable(): boolean
```

Determines whether the widget can own the input focus.

See `Gtk.Widget.setFocusable()`.

**Returns** true if `widget` can own the input focus

### `getFocusChild`

```ts
getFocusChild(): Gtk.Widget | null
```

Returns the focus child of the widget.

**Returns** the current focus
  child of `widget`

### `getFocusOnClick`

```ts
getFocusOnClick(): boolean
```

Returns whether the widget should grab focus when it is clicked
with the mouse.

See `Gtk.Widget.setFocusOnClick()`.

**Returns** true if the widget should grab focus when it is
  clicked with the mouse

### `getFontMap`

```ts
getFontMap(): Pango.FontMap | null
```

Gets the font map of the widget.

See `Gtk.Widget.setFontMap()`.

**Returns** the font map of `widget`

### `getFontOptions`

```ts
getFontOptions(): cairo.FontOptions | null
```

Returns the `cairo_font_options_t` of the widget.

Seee `Gtk.Widget.setFontOptions()`.

**Returns** the `cairo_font_options_t` of widget

> **Deprecated since 4.16.**

### `getFrameClock`

```ts
getFrameClock(): Gdk.FrameClock | null
```

Obtains the frame clock for a widget.

The frame clock is a global “ticker” that can be used to drive
animations and repaints. The most common reason to get the frame
clock is to call `Gdk.FrameClock.getFrameTime()`, in order
to get a time to use for animating. For example you might record
the start of the animation with an initial value from
`Gdk.FrameClock.getFrameTime()`, and then update the animation
by calling `Gdk.FrameClock.getFrameTime()` again during each repaint.

`Gdk.FrameClock.requestPhase()` will result in a new frame on the
clock, but won’t necessarily repaint any widgets. To repaint a widget,
you have to use `Gtk.Widget.queueDraw()` which invalidates the
widget (thus scheduling it to receive a draw on the next frame).
`Gtk.Widget.queueDraw()` will also end up requesting a frame
on the appropriate frame clock.

A widget’s frame clock will not change while the widget is mapped.
Reparenting a widget (which implies a temporary unmap) can change
the widget’s frame clock.

Unrealized widgets do not have a frame clock.

**Returns** the frame clock

### `getHalign`

```ts
getHalign(): Gtk.Align
```

Gets the horizontal alignment of the widget.

For backwards compatibility reasons this method will never return
one of the baseline alignments, but instead it will convert it to
`Gtk.Align.fill` or `Gtk.Align.center`.

Baselines are not supported for horizontal alignment.

**Returns** the horizontal alignment of `widget`

### `getHasTooltip`

```ts
getHasTooltip(): boolean
```

Returns the current value of the `has-tooltip` property.

**Returns** current value of `has-tooltip` on `widget`

### `getHeight`

```ts
getHeight(): number
```

Returns the content height of the widget.

This function returns the height passed to its
size-allocate implementation, which is the height you
should be using in `Gtk.Widget.snapshot()`.

For pointer events, see `Gtk.Widget.contains()`.

To learn more about widget sizes, see the coordinate
system [overview](coordinates.html).

**Returns** The height of `widget`

### `getHexpand`

```ts
getHexpand(): boolean
```

Gets whether the widget would like any available extra horizontal
space.

When a user resizes a window, widgets with expand set to true generally
receive the extra space. For example, a list or scrollable area
or document in your window would often be set to expand.

Widgets with children should use `Gtk.Widget.computeExpand()`
rather than this function, to see whether any of its children,
has the expand flag set. If any child of a widget wants to
expand, the parent may ask to expand also.

This function only looks at the widget’s own hexpand flag, rather
than computing whether the entire widget tree rooted at this widget
wants to expand.

**Returns** whether hexpand flag is set

### `getHexpandSet`

```ts
getHexpandSet(): boolean
```

Gets whether the `hexpand` flag has been explicitly set.

If `Gtk.Widget.hexpand` property is set, then it
overrides any computed expand value based on child widgets.
If `hexpand` is not set, then the expand value depends on
whether any children of the widget would like to expand.

There are few reasons to use this function, but it’s here
for completeness and consistency.

**Returns** whether hexpand has been explicitly set

### `getLastChild`

```ts
getLastChild(): Gtk.Widget | null
```

Returns the widget’s last child.

This function is primarily meant for widget implementations.

**Returns** the widget's last child

### `getLayoutManager`

```ts
getLayoutManager(): Gtk.LayoutManager | null
```

Retrieves the layout manager of the widget.

See `Gtk.Widget.setLayoutManager()`.

**Returns** the layout manager of `widget`

### `getLimitEvents`

```ts
getLimitEvents(): boolean
```

Gets the value of the `Gtk.Widget.limitEvents` property.

_Available since 4.18._

### `getMapped`

```ts
getMapped(): boolean
```

Returns whether the widget is mapped.

**Returns** true if the widget is mapped

### `getMarginBottom`

```ts
getMarginBottom(): number
```

Gets the bottom margin of the widget.

**Returns** The bottom margin of `widget`

### `getMarginEnd`

```ts
getMarginEnd(): number
```

Gets the end margin of the widget.

**Returns** The end margin of `widget`

### `getMarginStart`

```ts
getMarginStart(): number
```

Gets the start margin of the widget.

**Returns** The start margin of `widget`

### `getMarginTop`

```ts
getMarginTop(): number
```

Gets the top margin of the widget.

**Returns** The top margin of `widget`

### `getName`

```ts
getName(): string
```

Retrieves the name of a widget.

See `Gtk.Widget.setName()` for the significance of widget names.

**Returns** name of the widget

### `getNative`

```ts
getNative(): Gtk.Native | null
```

Returns the nearest `GtkNative` ancestor of the widget.

This function will return `NULL` if the widget is not
contained inside a widget tree with a native ancestor.

`GtkNative` widgets will return themselves here.

**Returns** the `GtkNative` ancestor of `widget`

### `getNextSibling`

```ts
getNextSibling(): Gtk.Widget | null
```

Returns the widget’s next sibling.

This function is primarily meant for widget implementations.

**Returns** the widget's next sibling

### `getOpacity`

```ts
getOpacity(): number
```

Fetches the requested opacity for the widget.

See `Gtk.Widget.setOpacity()`.

**Returns** the requested opacity for this widget

### `getOverflow`

```ts
getOverflow(): Gtk.Overflow
```

Returns the widget’s overflow value.

**Returns** The widget's overflow value

### `getPangoContext`

```ts
getPangoContext(): Pango.Context
```

Gets a `PangoContext` that is configured for the widget.

The `PangoContext` will have the appropriate font map, font description,
and base direction set.

Unlike the context returned by `Gtk.Widget.createPangoContext()`,
this context is owned by the widget (it can be used until the screen
for the widget changes or the widget is removed from its toplevel),
and will be updated to match any changes to the widget’s attributes.
This can be tracked by listening to changes of the
`Gtk.Widget.root` property on the widget.

**Returns** the `PangoContext` for the widget

### `getParent`

```ts
getParent(): Gtk.Widget | null
```

Returns the parent widget of the widget.

**Returns** the parent widget of `widget`

### `getPreferredSize`

```ts
getPreferredSize(): [Gtk.Requisition, Gtk.Requisition]
```

Retrieves the minimum and natural size of a widget, taking
into account the widget’s preference for height-for-width management.

This is used to retrieve a suitable size by container widgets which do
not impose any restrictions on the child placement. It can be used
to deduce toplevel window and menu sizes as well as child widgets in
free-form containers such as `GtkFixed`.

Handle with care. Note that the natural height of a height-for-width
widget will generally be a smaller size than the minimum height, since
the required height for the natural width is generally smaller than the
required height for the minimum width.

Use `Gtk.Widget.measure()` if you want to support baseline alignment.

**Returns** Tuple of:

- `minimumSize`: location for storing the minimum size
- `naturalSize`: location for storing the natural size

### `getPrevSibling`

```ts
getPrevSibling(): Gtk.Widget | null
```

Returns the widget’s previous sibling.

This function is primarily meant for widget implementations.

**Returns** the widget's previous sibling

### `getPrimaryClipboard`

```ts
getPrimaryClipboard(): Gdk.Clipboard
```

Gets the primary clipboard of the widget.

This is a utility function to get the primary clipboard object
for the display that `widget` is using.

Note that this function always works, even when `widget` is not
realized yet.

**Returns** the appropriate clipboard object

### `getRealized`

```ts
getRealized(): boolean
```

Determines whether the widget is realized.

**Returns** true if `widget` is realized

### `getReceivesDefault`

```ts
getReceivesDefault(): boolean
```

Determines whether the widget is always treated as the default widget
within its toplevel when it has the focus, even if another widget
is the default.

See `Gtk.Widget.setReceivesDefault()`.

**Returns** true if `widget` acts as the default widget when focused

### `getRequestMode`

```ts
getRequestMode(): Gtk.SizeRequestMode
```

Gets whether the widget prefers a height-for-width layout
or a width-for-height layout.

Single-child widgets generally propagate the preference of
their child, more complex widgets need to request something
either in context of their children or in context of their
allocation capabilities.

**Returns** The `GtkSizeRequestMode` preferred by `widget`.

### `getRoot`

```ts
getRoot(): Gtk.Root | null
```

Returns the `GtkRoot` widget of the widget.

This function will return `NULL` if the widget is not contained
inside a widget tree with a root widget.

`GtkRoot` widgets will return themselves here.

**Returns** the root widget of `widget`

### `getScaleFactor`

```ts
getScaleFactor(): number
```

Retrieves the internal scale factor that maps from window
coordinates to the actual device pixels.

On traditional systems this is 1, on high density outputs,
it can be a higher value (typically 2).

See `Gdk.Surface.getScaleFactor()`.

Note that modern systems may support *fractional* scaling,
where the scale factor is not an integer. On such systems,
this function will return the next higher integer value,
but you probably want to use `Gdk.Surface.getScale()`
to get the fractional scale value.

**Returns** the scale factor for `widget`

### `getSensitive`

```ts
getSensitive(): boolean
```

Returns the widget’s sensitivity.

This function returns the value that has been set using
`Gtk.Widget.setSensitive()`).

The effective sensitivity of a widget is however determined
by both its own and its parent widget’s sensitivity.
See `Gtk.Widget.isSensitive()`.

**Returns** true if the widget is sensitive

### `getSettings`

```ts
getSettings(): Gtk.Settings
```

Gets the settings object holding the settings used for the widget.

Note that this function can only be called when the `GtkWidget`
is attached to a toplevel, since the settings object is specific
to a particular display. If you want to monitor the widget for
changes in its settings, connect to the `notify::display` signal.

**Returns** the relevant settings object

### `getSize`

```ts
getSize(orientation: Gtk.Orientation): number
```

Returns the content width or height of the widget.

Which dimension is returned depends on `orientation`.

This is equivalent to calling `Gtk.Widget.getWidth()`
for `Gtk.Orientation.horizontal` or `Gtk.Widget.getHeight()`
for `Gtk.Orientation.vertical`, but can be used when
writing orientation-independent code, such as when
implementing `Gtk.Orientable` widgets.

To learn more about widget sizes, see the coordinate
system [overview](coordinates.html).

**Parameters**

- `orientation`: the orientation to query

**Returns** the size of `widget` in `orientation`

### `getSizeRequest`

```ts
getSizeRequest(): [number, number]
```

Gets the size request that was explicitly set for the widget.

A value of -1 stored in `width` or `height` indicates that that
dimension has not been set explicitly and the natural requisition
of the widget will be used instead.

See `Gtk.Widget.setSizeRequest()`.

To get the size a widget will actually request, call
`Gtk.Widget.measure()` instead of this function.

**Returns** Tuple of:

- `width`: return location for width
- `height`: return location for height

### `getStateFlags`

```ts
getStateFlags(): Gtk.StateFlags
```

Returns the widget state as a flag set.

It is worth mentioning that the effective `Gtk.StateFlags.insensitive`
state will be returned, that is, also based on parent insensitivity,
even if `widget` itself is sensitive.

Also note that if you are looking for a way to obtain the
`Gtk.StateFlags` to pass to a `Gtk.StyleContext`
method, you should look at `Gtk.StyleContext.getState()`.

**Returns** the state flags of widget

### `getStyleContext`

```ts
getStyleContext(): Gtk.StyleContext
```

Returns the style context associated to the widget.

The returned object is guaranteed to be the same
for the lifetime of `widget`.

**Returns** the widgets style context

> **Deprecated since 4.10.** Style contexts will be removed in GTK 5

### `getTemplateChild`

```ts
getTemplateChild(widgetType: bigint | AnyClass<TypedClass>, name: string): GObject.Object
```

Fetches an object build from the template XML for `widget_type` in
the widget.

This will only report children which were previously declared
with `Gtk.WidgetClass.bindTemplateChildFull()` or one of its
variants.

This function is only meant to be called for code which is private
to the `widget_type` which declared the child and is meant for language
bindings which cannot easily make use of the GObject structure offsets.

**Parameters**

- `widgetType`: The type of the widget class that defines the child in the template
- `name`: ID of the child defined in the template XML

**Returns** the object built in the template XML with
  the id `name`

### `getTooltipMarkup`

```ts
getTooltipMarkup(): string | null
```

Gets the contents of the tooltip for the widget.

If the tooltip has not been set using
`Gtk.Widget.setTooltipMarkup()`, this
function returns `NULL`.

**Returns** the tooltip text

### `getTooltipText`

```ts
getTooltipText(): string | null
```

Gets the contents of the tooltip for the widget.

If the `widget`'s tooltip was set using
`Gtk.Widget.setTooltipMarkup()`,
this function will return the escaped text.

**Returns** the tooltip text

### `getValign`

```ts
getValign(): Gtk.Align
```

Gets the vertical alignment of the widget.

**Returns** the vertical alignment of `widget`

### `getVexpand`

```ts
getVexpand(): boolean
```

Gets whether the widget would like any available extra vertical
space.

See `Gtk.Widget.getHexpand()` for more detail.

**Returns** whether vexpand flag is set

### `getVexpandSet`

```ts
getVexpandSet(): boolean
```

Gets whether the `vexpand` flag has been explicitly set.

See `Gtk.Widget.getHexpandSet()` for more detail.

**Returns** whether vexpand has been explicitly set

### `getVisible`

```ts
getVisible(): boolean
```

Determines whether the widget is visible.

If you want to take into account whether the widget’s
parent is also marked as visible, use
`Gtk.Widget.isVisible()` instead.

This function does not check if the widget is
obscured in any way.

See `Gtk.Widget.setVisible()`.

**Returns** true if the widget is visible

### `getWidth`

```ts
getWidth(): number
```

Returns the content width of the widget.

This function returns the width passed to its
size-allocate implementation, which is the width you
should be using in `Gtk.Widget.snapshot()`.

For pointer events, see `Gtk.Widget.contains()`.

To learn more about widget sizes, see the coordinate
system [overview](coordinates.html).

**Returns** The width of `widget`

### `grabFocus`

```ts
grabFocus(): boolean
```

Causes `widget` to have the keyboard focus for the window
that it belongs to.

If `widget` is not focusable, or its `Gtk.Widget.grabFocus()`
implementation cannot transfer the focus to a descendant of `widget`
that is focusable, it will not take focus and false will be returned.

Calling `Gtk.Widget.grabFocus()` on an already focused widget
is allowed, should not have an effect, and return true.

**Returns** true if focus is now inside `widget`

### `hasCssClass`

```ts
hasCssClass(cssClass: string): boolean
```

Returns whether a style class is currently applied to the widget.

**Parameters**

- `cssClass`: style class, without the leading period

**Returns** true if `css_class` is currently applied to `widget`

### `hasDefault`

```ts
hasDefault(): boolean
```

Determines whether the widget is the current default widget
within its toplevel.

**Returns** true if `widget` is the current default widget
  within its toplevel

### `hasFocus`

```ts
hasFocus(): boolean
```

Determines if the widget has the global input focus.

See `Gtk.Widget.isFocus()` for the difference between
having the global input focus, and only having the focus
within a toplevel.

**Returns** true if the widget has the global input focus

### `hasVisibleFocus`

```ts
hasVisibleFocus(): boolean
```

Determines if the widget should show a visible indication that
it has the global input focus.

This is a convenience function that takes into account whether
focus indication should currently be shown in the toplevel window
of `widget`. See `Gtk.Window.getFocusVisible()` for more
information about focus indication.

To find out if the widget has the global input focus, use
`Gtk.Widget.hasFocus()`.

**Returns** true if the widget should display a “focus rectangle”

### `hide`

```ts
hide(): void
```

Reverses the effects of [method.Gtk.Widget.show].

This is causing the widget to be hidden (invisible to the user).

> **Deprecated since 4.10.** Use `Gtk.Widget.setVisible()` instead

### `inDestruction`

```ts
inDestruction(): boolean
```

Returns whether the widget is currently being destroyed.

This information can sometimes be used to avoid doing
unnecessary work.

**Returns** true if `widget` is being destroyed

### `initTemplate`

```ts
initTemplate(): void
```

Creates and initializes child widgets defined in templates.

This function must be called in the instance initializer
for any class which assigned itself a template using
`Gtk.WidgetClass.setTemplate()`.

It is important to call this function in the instance initializer
of a widget subclass and not in `GObject.constructed()` or
`GObject.constructor()` for two reasons:

 - derived widgets will assume that the composite widgets
   defined by its parent classes have been created in their
   relative instance initializers
 - when calling `g_object_new()` on a widget with composite templates,
   it’s important to build the composite widgets before the construct
   properties are set. Properties passed to `g_object_new()` should
   take precedence over properties set in the private template XML

A good rule of thumb is to call this function as the first thing in
an instance initialization function.

### `insertActionGroup`

```ts
insertActionGroup(name: string, group: Gio.ActionGroup | null): void
```

Inserts an action group into the widget's actions.

Children of `widget` that implement `Gtk.Actionable` can
then be associated with actions in `group` by setting their
“action-name” to `prefix`.`action-name`.

Note that inheritance is defined for individual actions. I.e.
even if you insert a group with prefix `prefix`, actions with
the same prefix will still be inherited from the parent, unless
the group contains an action with the same name.

If `group` is `NULL`, a previously inserted group for `name` is
removed from `widget`.

**Parameters**

- `name`: the prefix for actions in `group`
- `group`: an action group

### `insertAfter`

```ts
insertAfter(parent: Gtk.Widget, previousSibling: Gtk.Widget | null): void
```

Sets the parent widget of the widget.

In contrast to `Gtk.Widget.setParent()`, this function
inserts `widget` at a specific position into the list of children
of the `parent` widget.

It will be placed after `previous_sibling`, or at the beginning if
`previous_sibling` is `NULL`.

After calling this function, `gtk_widget_get_prev_sibling (widget)`
will return `previous_sibling`.

If `parent` is already set as the parent widget of `widget`, this
function can also be used to reorder `widget` in the child widget
list of `parent`.

This function is primarily meant for widget implementations; if you are
just using a widget, you *must* use its own API for adding children.

**Parameters**

- `parent`: the parent widget to insert `widget` into
- `previousSibling`: the new previous sibling of `widget`

### `insertBefore`

```ts
insertBefore(parent: Gtk.Widget, nextSibling: Gtk.Widget | null): void
```

Sets the parent widget of the widget.

In contrast to `Gtk.Widget.setParent()`, this function
inserts `widget` at a specific position into the list of children
of the `parent` widget.

It will be placed before `next_sibling`, or at the end if
`next_sibling` is `NULL`.

After calling this function, `gtk_widget_get_next_sibling (widget)`
will return `next_sibling`.

If `parent` is already set as the parent widget of `widget`, this function
can also be used to reorder `widget` in the child widget list of `parent`.

This function is primarily meant for widget implementations; if you are
just using a widget, you *must* use its own API for adding children.

**Parameters**

- `parent`: the parent widget to insert `widget` into
- `nextSibling`: the new next sibling of `widget`

### `isAncestor`

```ts
isAncestor(ancestor: Gtk.Widget): boolean
```

Determines whether the widget is a descendent of `ancestor`.

**Parameters**

- `ancestor`: another `GtkWidget`

**Returns** true if `ancestor` contains `widget` as a child,
  grandchild, great grandchild, etc

### `isDrawable`

```ts
isDrawable(): boolean
```

Determines whether the widget can be drawn to.

A widget can be drawn if it is mapped and visible.

**Returns** true if `widget` is drawable

### `isFocus`

```ts
isFocus(): boolean
```

Determines if the widget is the focus widget within its
toplevel.

This does not mean that the `Gtk.Widget.hasFocus`
property is necessarily set; `Gtk.Widget.hasFocus`
will only be set if the toplevel widget additionally has the
global input focus.

**Returns** true if the widget is the focus widget

### `isSensitive`

```ts
isSensitive(): boolean
```

Returns the widget’s effective sensitivity.

This means it is sensitive itself and also its
parent widget is sensitive.

**Returns** true if the widget is effectively sensitive

### `isVisible`

```ts
isVisible(): boolean
```

Determines whether the widget and all its parents are marked as
visible.

This function does not check if the widget is obscured in any way.

See also `Gtk.Widget.getVisible()` and
`Gtk.Widget.setVisible()`.

**Returns** true if the widget and all its parents are visible

### `keynavFailed`

```ts
keynavFailed(direction: Gtk.DirectionType): boolean
```

Emits the `Gtk.Widget.keynav-failed` signal on the widget.

This function should be called whenever keyboard navigation
within a single widget hits a boundary.

The return value of this function should be interpreted
in a way similar to the return value of
`Gtk.Widget.childFocus()`. When true is returned,
stay in the widget, the failed keyboard navigation is ok
and/or there is nowhere we can/should move the focus to.
When false is returned, the caller should continue with
keyboard navigation outside the widget, e.g. by calling
`Gtk.Widget.childFocus()` on the widget’s toplevel.

The default `Gtk.Widget.keynav-failed` handler returns
false for `Gtk.DirectionType.tab-forward` and
`Gtk.DirectionType.tab-backward`. For the other values
of `Gtk.DirectionType` it returns true.

Whenever the default handler returns true, it also calls
`Gtk.Widget.errorBell()` to notify the user of the
failed keyboard navigation.

A use case for providing an own implementation of `::keynav-failed`
(either by connecting to it or by overriding it) would be a row of
`Gtk.Entry` widgets where the user should be able to navigate
the entire row with the cursor keys, as e.g. known from user
interfaces that require entering license keys.

**Parameters**

- `direction`: direction of focus movement

**Returns** true if stopping keyboard navigation is fine, false
  if the emitting widget should try to handle the keyboard
  navigation attempt in its parent widget

### `listMnemonicLabels`

```ts
listMnemonicLabels(): Gtk.Widget[]
```

Returns the widgets for which this widget is the target of a
mnemonic.

Typically, these widgets will be labels. See, for example,
`Gtk.Label.setMnemonicWidget()`.

The widgets in the list are not individually referenced.
If you want to iterate through the list and perform actions
involving callbacks that might destroy the widgets, you
must call `g_list_foreach (result, (GFunc)g_object_ref, NULL)`
first, and then unref all the widgets afterwards.

**Returns** the list
  of mnemonic labels

### `map`

```ts
map(): void
```

Causes a widget to be mapped if it isn’t already.

This function is only for use in widget implementations.

### `measure`

```ts
measure(orientation: Gtk.Orientation, forSize: number): [number, number, number, number]
```

Measures `widget` in the orientation `orientation` and for the given `for_size`.

As an example, if `orientation` is `GTK_ORIENTATION_HORIZONTAL` and `for_size`
is 300, this functions will compute the minimum and natural width of `widget`
if it is allocated at a height of 300 pixels.

See [GtkWidget’s geometry management section](class.Widget.html#height-for-width-geometry-management) for
a more details on implementing `GtkWidgetClass.measure()`.

**Parameters**

- `orientation`: the orientation to measure
- `forSize`: Size for the opposite of `orientation`, i.e. if `orientation` is `GTK_ORIENTATION_HORIZONTAL`, this is the height the widget should be measured with. The `GTK_ORIENTATION_VERTICAL` case is analogous. This way, both height-for-width and width-for-height requests can be implemented. If no size is known, -1 can be passed.

**Returns** Tuple of:

- `minimum`: location to store the minimum size
- `natural`: location to store the natural size
- `minimumBaseline`: location to store the baseline position for the minimum size, or -1 to report no baseline
- `naturalBaseline`: location to store the baseline position for the natural size, or -1 to report no baseline

### `mnemonicActivate`

```ts
mnemonicActivate(groupCycling: boolean): boolean
```

Emits the `Gtk.Widget.mnemonic-activate` signal.

**Parameters**

- `groupCycling`: true if there are other widgets with the same mnemonic

**Returns** true if the signal has been handled

### `observeChildren`

```ts
observeChildren(): Gio.ListModel
```

Returns a list model to track the children of the widget.

Calling this function will enable extra internal bookkeeping
to track children and emit signals on the returned listmodel.
It may slow down operations a lot.

Applications should try hard to avoid calling this function
because of the slowdowns.

**Returns** a list model tracking `widget`'s children

### `observeControllers`

```ts
observeControllers(): Gio.ListModel
```

Returns a list model to track the event controllers of the widget.

Calling this function will enable extra internal bookkeeping
to track controllers and emit signals on the returned listmodel.
It may slow down operations a lot.

Applications should try hard to avoid calling this function
because of the slowdowns.

**Returns** a list model tracking `widget`'s controllers

### `pick`

```ts
pick(x: number, y: number, flags: Gtk.PickFlags): Gtk.Widget | null
```

Finds the descendant of the widget closest to a point.

The point (x, y) must be given in widget coordinates, so (0, 0)
is assumed to be the top left of `widget`'s content area.

Usually widgets will return `NULL` if the given coordinate is not
contained in `widget` checked via `Gtk.Widget.contains()`.
Otherwise they will recursively try to find a child that does
not return `NULL`. Widgets are however free to customize their
picking algorithm.

This function is used on the toplevel to determine the widget
below the mouse cursor for purposes of hover highlighting and
delivering events.

**Parameters**

- `x`: x coordinate to test, relative to `widget`'s origin
- `y`: y coordinate to test, relative to `widget`'s origin
- `flags`: flags to influence what is picked

**Returns** the widget's descendant at (x, y)

### `queueAllocate`

```ts
queueAllocate(): void
```

Flags the widget for a rerun of the `Gtk.Widget.sizeAllocate()`
function.

Use this function instead of `Gtk.Widget.queueResize()`
when the `widget`'s size request didn't change but it wants to
reposition its contents.

An example user of this function is `Gtk.Widget.setHalign()`.

This function is only for use in widget implementations.

### `queueDraw`

```ts
queueDraw(): void
```

Schedules this widget to be redrawn.

The redraw will happen in the paint phase
of the current or the next frame.

This means `widget`'s `Gtk.Widget.snapshot()`
implementation will be called.

### `queueResize`

```ts
queueResize(): void
```

Flags a widget to have its size renegotiated.

This should be called when a widget for some reason has a new
size request. For example, when you change the text in a
`Gtk.Label`, the label queues a resize to ensure there’s
enough space for the new text.

Note that you cannot call `gtk_widget_queue_resize()` on a widget
from inside its implementation of the `Gtk.Widget.sizeAllocate()`
virtual method. Calls to `gtk_widget_queue_resize()` from inside
`Gtk.Widget.sizeAllocate()` will be silently ignored.

This function is only for use in widget implementations.

### `realize`

```ts
realize(): void
```

Creates the GDK resources associated with a widget.

Normally realization happens implicitly; if you show a widget
and all its parent containers, then the widget will be realized
and mapped automatically.

Realizing a widget requires all the widget’s parent widgets to be
realized; calling this function realizes the widget’s parents
in addition to `widget` itself. If a widget is not yet inside a
toplevel window when you realize it, bad things will happen.

This function is primarily used in widget implementations, and
isn’t very useful otherwise. Many times when you think you might
need it, a better approach is to connect to a signal that will be
called after the widget is realized automatically, such as
`Gtk.Widget.realize`.

### `removeController`

```ts
removeController(controller: Gtk.EventController): void
```

Removes an event controller from the widget.

The removed event controller will not receive any more events,
and should not be used again.

Widgets will remove all event controllers automatically when they
are destroyed, there is normally no need to call this function.

**Parameters**

- `controller`: an event controller

### `removeCssClass`

```ts
removeCssClass(cssClass: string): void
```

Removes a style from the widget.

After this, the style of `widget` will stop matching for `css_class`.

**Parameters**

- `cssClass`: style class to remove from `widget`, without the leading period

### `removeMnemonicLabel`

```ts
removeMnemonicLabel(label: Gtk.Widget): void
```

Removes a widget from the list of mnemonic labels for this widget.

See `Gtk.Widget.listMnemonicLabels()`.

The widget must have previously been added to the list with
`Gtk.Widget.addMnemonicLabel()`.

**Parameters**

- `label`: a widget that is a mnemonic label for `widget`

### `removeTickCallback`

```ts
removeTickCallback(id: number): void
```

Removes a tick callback previously registered with
`Gtk.Widget.addTickCallback()`.

**Parameters**

- `id`: an ID returned by `Gtk.Widget.addTickCallback()`

### `setCanFocus`

```ts
setCanFocus(canFocus: boolean): void
```

Sets whether the input focus can enter the widget or
any of its children.

Applications should set `can_focus` to false to mark a
widget as for pointer/touch use only.

Note that having `can_focus` be true is only one of the
necessary conditions for being focusable. A widget must
also be sensitive and focusable and not have an ancestor
that is marked as not can-focus in order to receive input
focus.

See `Gtk.Widget.grabFocus()` for actually setting
the input focus on a widget.

**Parameters**

- `canFocus`: whether the input focus can enter the widget or any of its children

### `setCanTarget`

```ts
setCanTarget(canTarget: boolean): void
```

Sets whether the widget can be the target of pointer events.

**Parameters**

- `canTarget`: whether this widget should be able to receive pointer events

### `setChildVisible`

```ts
setChildVisible(childVisible: boolean): void
```

Sets whether the widget should be mapped along with its parent.

The child visibility can be set for widget before it is added
to a container with `Gtk.Widget.setParent()`, to avoid
mapping children unnecessary before immediately unmapping them.
However it will be reset to its default state of true when the
widget is removed from a container.

Note that changing the child visibility of a widget does not
queue a resize on the widget. Most of the time, the size of
a widget is computed from all visible children, whether or
not they are mapped. If this is not the case, the container
can queue a resize itself.

This function is only useful for widget implementations
and should never be called by an application.

**Parameters**

- `childVisible`: whether `widget` should be mapped along with its parent

### `setCssClasses`

```ts
setCssClasses(classes: string[]): void
```

Replaces the current style classes of the widget with `classes`.

**Parameters**

- `classes`: `NULL`-terminated list of style classes

### `setCursor`

```ts
setCursor(cursor: Gdk.Cursor | null): void
```

Sets the cursor to be shown when the pointer hovers over
the widget.

If the `cursor` is `NULL`, `widget` will use the cursor
inherited from its parent.

**Parameters**

- `cursor`: the new cursor

### `setCursorFromName`

```ts
setCursorFromName(name: string | null): void
```

Sets the cursor to be shown when the pointer hovers over
the widget.

This is a utility function that creates a cursor via
`Gdk.Cursor.newFromName()` and then sets it on `widget`
with `Gtk.Widget.setCursor()`. See those functions for
details.

On top of that, this function allows `name` to be `NULL`, which
will do the same as calling `Gtk.Widget.setCursor()`
with a `NULL` cursor.

**Parameters**

- `name`: the name of the cursor

### `setDirection`

```ts
setDirection(dir: Gtk.TextDirection): void
```

Sets the reading direction on the widget.

This direction controls the primary direction for widgets
containing text, and also the direction in which the children
of a container are packed. The ability to set the direction is
present in order so that correct localization into languages with
right-to-left reading directions can be done.

Generally, applications will let the default reading direction
prevail, except for widgets where the children are arranged in
an order that is explicitly visual rather than logical (such as
buttons for text justification).

If the direction is set to `Gtk.TextDirection.none`, then
the value set by `Gtk.Widget.setDefaultDirection()` will be used.

**Parameters**

- `dir`: the new direction

### `setFocusable`

```ts
setFocusable(focusable: boolean): void
```

Sets whether the widget can own the input focus.

Widget implementations should set `focusable` to true in
their `init()` function if they want to receive keyboard input.

Note that having `focusable` be true is only one of the
necessary conditions for being focusable. A widget must
also be sensitive and can-focus and not have an ancestor
that is marked as not can-focus in order to receive input
focus.

See `Gtk.Widget.grabFocus()` for actually setting
the input focus on a widget.

**Parameters**

- `focusable`: whether or not `widget` can own the input focus

### `setFocusChild`

```ts
setFocusChild(child: Gtk.Widget | null): void
```

Set the focus child of the widget.

This function is only suitable for widget implementations.
If you want a certain widget to get the input focus, call
`Gtk.Widget.grabFocus()` on it.

**Parameters**

- `child`: a direct child widget of `widget` or `NULL` to unset the focus child

### `setFocusOnClick`

```ts
setFocusOnClick(focusOnClick: boolean): void
```

Sets whether the widget should grab focus when it is clicked
with the mouse.

Making mouse clicks not grab focus is useful in places like
toolbars where you don’t want the keyboard focus removed from
the main area of the application.

**Parameters**

- `focusOnClick`: whether the widget should grab focus when clicked with the mouse

### `setFontMap`

```ts
setFontMap(fontMap: Pango.FontMap | null): void
```

Sets the font map to use for text rendering in the widget.

The font map is the object that is used to look up fonts.
Setting a custom font map can be useful in special situations,
e.g. when you need to add application-specific fonts to the set
of available fonts.

When not set, the widget will inherit the font map from its parent.

**Parameters**

- `fontMap`: a `PangoFontMap`

### `setFontOptions`

```ts
setFontOptions(options: cairo.FontOptions | null): void
```

Sets the `cairo_font_options_t` used for text rendering
in the widget.

When not set, the default font options for the `GdkDisplay`
will be used.

**Parameters**

- `options`: a `cairo_font_options_t` struct to unset any previously set default font options

> **Deprecated since 4.16.**

### `setHalign`

```ts
setHalign(align: Gtk.Align): void
```

Sets the horizontal alignment of the widget.

**Parameters**

- `align`: the horizontal alignment

### `setHasTooltip`

```ts
setHasTooltip(hasTooltip: boolean): void
```

Sets the `has-tooltip` property on the widget.

**Parameters**

- `hasTooltip`: whether or not `widget` has a tooltip

### `setHexpand`

```ts
setHexpand(expand: boolean): void
```

Sets whether the widget would like any available extra horizontal
space.

When a user resizes a window, widgets with expand set to true generally
receive the extra space. For example, a list or scrollable area
or document in your window would often be set to expand.

Call this function to set the expand flag if you would like your
widget to become larger horizontally when the window has extra
room.

By default, widgets automatically expand if any of their children
want to expand. (To see if a widget will automatically expand given
its current children and state, call `Gtk.Widget.computeExpand()`.
A widget can decide how the expandability of children affects its
own expansion by overriding the `compute_expand` virtual method on
`GtkWidget`.).

Setting hexpand explicitly with this function will override the
automatic expand behavior.

This function forces the widget to expand or not to expand,
regardless of children. The override occurs because
`Gtk.Widget.setHexpand()` sets the hexpand-set property (see
`Gtk.Widget.setHexpandSet()`) which causes the widget’s hexpand
value to be used, rather than looking at children and widget state.

**Parameters**

- `expand`: whether to expand

### `setHexpandSet`

```ts
setHexpandSet(set: boolean): void
```

Sets whether the hexpand flag will be used.

The `Gtk.Widget.hexpandSet` property will be set
automatically when you call `Gtk.Widget.setHexpand()`
to set hexpand, so the most likely reason to use this function
would be to unset an explicit expand flag.

If hexpand is set, then it overrides any computed
expand value based on child widgets. If hexpand is not
set, then the expand value depends on whether any
children of the widget would like to expand.

There are few reasons to use this function, but it’s here
for completeness and consistency.

**Parameters**

- `set`: value for hexpand-set property

### `setLayoutManager`

```ts
setLayoutManager(layoutManager: Gtk.LayoutManager | null): void
```

Sets the layout manager to use for measuring and allocating children
of the widget.

**Parameters**

- `layoutManager`: a layout manager

### `setLimitEvents`

```ts
setLimitEvents(limitEvents: boolean): void
```

Sets whether the widget acts like a modal dialog,
with respect to event delivery.

**Parameters**

- `limitEvents`: whether to limit events

_Available since 4.18._

### `setMarginBottom`

```ts
setMarginBottom(margin: number): void
```

Sets the bottom margin of the widget.

**Parameters**

- `margin`: the bottom margin

### `setMarginEnd`

```ts
setMarginEnd(margin: number): void
```

Sets the end margin of the widget.

**Parameters**

- `margin`: the end margin

### `setMarginStart`

```ts
setMarginStart(margin: number): void
```

Sets the start margin of the widget.

**Parameters**

- `margin`: the start margin

### `setMarginTop`

```ts
setMarginTop(margin: number): void
```

Sets the top margin of the widget.

**Parameters**

- `margin`: the top margin

### `setName`

```ts
setName(name: string): void
```

Sets a widgets name.

Setting a name allows you to refer to the widget from a
CSS file. You can apply a style to widgets with a particular name
in the CSS file. See the documentation for the CSS syntax (on the
same page as the docs for `Gtk.StyleContext`.

Note that the CSS syntax has certain special characters to delimit
and represent elements in a selector (period, #, >, *...), so using
these will make your widget impossible to match by name. Any combination
of alphanumeric symbols, dashes and underscores will suffice.

**Parameters**

- `name`: name for the widget

### `setOpacity`

```ts
setOpacity(opacity: number): void
```

Requests the widget to be rendered partially transparent.

An opacity of 0 is fully transparent and an opacity of 1
is fully opaque.

Opacity works on both toplevel widgets and child widgets, although
there are some limitations: For toplevel widgets, applying opacity
depends on the capabilities of the windowing system. On X11, this
has any effect only on X displays with a compositing manager, see
`Gdk.Display.isComposited()`. On Windows and Wayland it will
always work, although setting a window’s opacity after the window
has been shown may cause some flicker.

Note that the opacity is inherited through inclusion — if you set
a toplevel to be partially translucent, all of its content will
appear translucent, since it is ultimatively rendered on that
toplevel. The opacity value itself is not inherited by child
widgets (since that would make widgets deeper in the hierarchy
progressively more translucent). As a consequence, `Gtk.Popover`
instances and other `Gtk.Native` widgets with their own surface
will use their own opacity value, and thus by default appear
non-translucent, even if they are attached to a toplevel that
is translucent.

**Parameters**

- `opacity`: desired opacity, between 0 and 1

### `setOverflow`

```ts
setOverflow(overflow: Gtk.Overflow): void
```

Sets how the widget treats content that is drawn outside the
it's content area.

See the definition of `Gtk.Overflow` for details.

This setting is provided for widget implementations and
should not be used by application code.

The default value is `Gtk.Overflow.visible`.

**Parameters**

- `overflow`: desired overflow value

### `setParent`

```ts
setParent(parent: Gtk.Widget): void
```

Sets the parent widget of the widget.

This takes care of details such as updating the state and style
of the child to reflect its new location and resizing the parent.
The opposite function is `Gtk.Widget.unparent()`.

This function is useful only when implementing subclasses of
`GtkWidget`.

**Parameters**

- `parent`: parent widget

### `setReceivesDefault`

```ts
setReceivesDefault(receivesDefault: boolean): void
```

Sets whether the widget will be treated as the default
widget within its toplevel when it has the focus, even if
another widget is the default.

**Parameters**

- `receivesDefault`: whether or not `widget` can be a default widget

### `setSensitive`

```ts
setSensitive(sensitive: boolean): void
```

Sets the sensitivity of the widget.

A widget is sensitive if the user can interact with it.
Insensitive widgets are “grayed out” and the user can’t
interact with them. Insensitive widgets are known as
“inactive”, “disabled”, or “ghosted” in some other toolkits.

**Parameters**

- `sensitive`: true to make the widget sensitive

### `setSizeRequest`

```ts
setSizeRequest(width: number, height: number): void
```

Sets the minimum size of the widget.

That is, the widget’s size request will be at least `width`
by `height`. You can use this function to force a widget to
be larger than it normally would be.

In most cases, `Gtk.Window.setDefaultSize()` is a better
choice for toplevel windows than this function; setting the default
size will still allow users to shrink the window. Setting the size
request will force them to leave the window at least as large as
the size request.

Note the inherent danger of setting any fixed size - themes,
translations into other languages, different fonts, and user action
can all change the appropriate size for a given widget. So, it is
basically impossible to hardcode a size that will always work.

The size request of a widget is the smallest size a widget can
accept while still functioning well and drawing itself correctly.
However in some strange cases a widget may be allocated less than
its requested size, and in many cases a widget may be allocated more
space than it requested.

If the size request in a given direction is -1 (unset), then
the “natural” size request of the widget will be used instead.

The size request set here does not include any margin from the
properties
`Gtk.Widget.marginStart`,
`Gtk.Widget.marginEnd`,
`Gtk.Widget.marginTop`, and
`Gtk.Widget.marginBottom`, but it does include pretty
much all other padding or border properties set by any subclass
of `GtkWidget`.

**Parameters**

- `width`: width `widget` should request, or -1 to unset
- `height`: height `widget` should request, or -1 to unset

### `setStateFlags`

```ts
setStateFlags(flags: Gtk.StateFlags, clear: boolean): void
```

Turns on flag values in the current widget state.

Typical widget states are insensitive, prelighted, etc.

This function accepts the values `Gtk.StateFlags.dir-ltr` and
`Gtk.StateFlags.dir-rtl` but ignores them. If you want to set
the widget's direction, use `Gtk.Widget.setDirection()`.

This function is for use in widget implementations.

**Parameters**

- `flags`: state flags to turn on
- `clear`: whether to clear state before turning on `flags`

### `setTooltipMarkup`

```ts
setTooltipMarkup(markup: string | null): void
```

Sets the contents of the tooltip for widget.

`markup` must contain Pango markup.

This function will take care of setting the
`Gtk.Widget.hasTooltip` as a side effect, and of the
default handler for the `Gtk.Widget.query-tooltip` signal.

See also `Gtk.Tooltip.setMarkup()`.

**Parameters**

- `markup`: the contents of the tooltip for `widget`

### `setTooltipText`

```ts
setTooltipText(text: string | null): void
```

Sets the contents of the tooltip for the widget.

If `text` contains any markup, it will be escaped.

This function will take care of setting
`Gtk.Widget.hasTooltip` as a side effect,
and of the default handler for the
`Gtk.Widget.query-tooltip` signal.

See also `Gtk.Tooltip.setText()`.

**Parameters**

- `text`: the contents of the tooltip for `widget`

### `setValign`

```ts
setValign(align: Gtk.Align): void
```

Sets the vertical alignment of the widget.

**Parameters**

- `align`: the vertical alignment

### `setVexpand`

```ts
setVexpand(expand: boolean): void
```

Sets whether the widget would like any available extra vertical
space.

See `Gtk.Widget.setHexpand()` for more detail.

**Parameters**

- `expand`: whether to expand

### `setVexpandSet`

```ts
setVexpandSet(set: boolean): void
```

Sets whether the vexpand flag will be used.

See `Gtk.Widget.setHexpandSet()` for more detail.

**Parameters**

- `set`: value for vexpand-set property

### `setVisible`

```ts
setVisible(visible: boolean): void
```

Sets the visibility state of `widget`.

Note that setting this to true doesn’t mean the widget is
actually viewable, see `Gtk.Widget.getVisible()`.

**Parameters**

- `visible`: whether the widget should be shown or not

### `shouldLayout`

```ts
shouldLayout(): boolean
```

Returns whether the widget should contribute to
the measuring and allocation of its parent.

This is false for invisible children, but also
for children that have their own surface, such
as `Gtk.Popover` instances.

**Returns** true if child should be included in
  measuring and allocating

### `show`

```ts
show(): void
```

Flags a widget to be displayed.

Any widget that isn’t shown will not appear on the screen.

Remember that you have to show the containers containing a widget,
in addition to the widget itself, before it will appear onscreen.

When a toplevel widget is shown, it is immediately realized and
mapped; other shown widgets are realized and mapped when their
toplevel widget is realized and mapped.

> **Deprecated since 4.10.** Use `Gtk.Widget.setVisible()` instead

### `sizeAllocate`

```ts
sizeAllocate(allocation: Gtk.Allocation, baseline: number): void
```

Allocates widget with a transformation that translates
the origin to the position in `allocation`.

This is a simple form of `Gtk.Widget.allocate()`.

**Parameters**

- `allocation`: position and size to be allocated to `widget`
- `baseline`: the baseline of the child, or -1

### `snapshotChild`

```ts
snapshotChild(child: Gtk.Widget, snapshot: Gtk.Snapshot): void
```

Snapshots a child of the widget.

When a widget receives a call to the snapshot function,
it must send synthetic `Gtk.Widget.snapshot()` calls
to all children. This function provides a convenient way
of doing this. A widget, when it receives a call to its
`Gtk.Widget.snapshot()` function, calls
`gtk_widget_snapshot_child()` once for each child, passing in
the `snapshot` the widget received.

This function takes care of translating the origin of `snapshot`,
and deciding whether the child needs to be snapshot.

It does nothing for children that implement `GtkNative`.

**Parameters**

- `child`: a child of `widget`
- `snapshot`: snapshot as passed to the widget. In particular, no calls to `Gtk.Snapshot.translate()` or other transform calls should have been made

### `translateCoordinates`

```ts
translateCoordinates(destWidget: Gtk.Widget, srcX: number, srcY: number): [boolean, number, number]
```

Translates coordinates relative to `src_widget`’s allocation
to coordinates relative to `dest_widget`’s allocations.

In order to perform this operation, both widget must share
a common ancestor. If that is not the case, `dest_x` and `dest_y`
are set to 0 and false is returned.

**Parameters**

- `destWidget`: another widget
- `srcX`: X position in widget coordinates of `src_widget`
- `srcY`: Y position in widget coordinates of `src_widget`

**Returns** Tuple of:

- `result`: true if `src_widget` and `dest_widget` have a common ancestor, false otherwise
- `destX`: location to store X position in widget coordinates of `dest_widget`
- `destY`: location to store Y position in widget coordinates of `dest_widget`

> **Deprecated since 4.12.** Use `Gtk.Widget.computePoint()` instead

### `triggerTooltipQuery`

```ts
triggerTooltipQuery(): void
```

Triggers a tooltip query on the display of the widget.

### `unmap`

```ts
unmap(): void
```

Causes a widget to be unmapped if it’s currently mapped.

This function is only for use in widget implementations.

### `unparent`

```ts
unparent(): void
```

Removes `widget` from its parent.

This function is only for use in widget implementations,
typically in dispose.

### `unrealize`

```ts
unrealize(): void
```

Causes a widget to be unrealized.

This frees all GDK resources associated with the widget.

This function is only useful in widget implementations.

### `unsetStateFlags`

```ts
unsetStateFlags(flags: Gtk.StateFlags): void
```

Turns off flag values for the current widget state.

See `Gtk.Widget.setStateFlags()`.

This function is for use in widget implementations.

**Parameters**

- `flags`: state flags to turn off
