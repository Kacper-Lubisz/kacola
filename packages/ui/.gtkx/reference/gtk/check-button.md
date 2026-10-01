---
description: "Places a label next to an indicator."
---

# GtkCheckButton

Places a label next to an indicator.



A `GtkCheckButton` is created by calling either `Gtk.CheckButton.new()`
or `Gtk.CheckButton.newWithLabel()`.

The state of a `GtkCheckButton` can be set specifically using
`Gtk.CheckButton.setActive()`, and retrieved using
`Gtk.CheckButton.getActive()`.

## Inconsistent state

In addition to "on" and "off", check buttons can be an
"in between" state that is neither on nor off. This can be used
e.g. when the user has selected a range of elements (such as some
text or spreadsheet cells) that are affected by a check button,
and the current values in that range are inconsistent.

To set a `GtkCheckButton` to inconsistent state, use
`Gtk.CheckButton.setInconsistent()`.

## Grouping

Check buttons can be grouped together, to form mutually exclusive
groups - only one of the buttons can be toggled at a time, and toggling
another one will switch the currently toggled one off.

Grouped check buttons use a different indicator, and are commonly referred
to as *radio buttons*.



To add a `GtkCheckButton` to a group, use `Gtk.CheckButton.setGroup()`.

When the code must keep track of the state of a group of radio buttons, it
is recommended to keep track of such state through a stateful
`GAction` with a target for each button. Using the `toggled` signals to keep
track of the group changes and state is discouraged.

## Shortcuts and Gestures

`GtkCheckButton` supports the following keyboard shortcuts:

- <kbd>␣</kbd> or <kbd>Enter</kbd> activates the button.

## CSS nodes

```
checkbutton[.text-button][.grouped]
├── check
╰── [label]
```

A `GtkCheckButton` has a main node with name checkbutton. If the
`Gtk.CheckButton.label` or `Gtk.CheckButton.child`
properties are set, it contains a child widget. The indicator node
is named check when no group is set, and radio if the checkbutton
is grouped together with other checkbuttons.

## Accessibility

`GtkCheckButton` uses the `Gtk.AccessibleRole.checkbox` role.

```tsx
import { GtkCheckButton } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkCheckButton**

Implements `GtkAccessible`, `GtkActionable`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.CheckButton` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `actionName`

`string` · default `null` · from `GtkActionable`

The name of the action with which this widget should be associated.

### `actionTarget`

`GLib.Variant` · from `GtkActionable`

The target value of the actionable widget's action.

### `active`

`boolean` · default `false`

If the check button is active.

Setting `active` to `true` will add the `:checked:` state to both
the check button and the indicator CSS node.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `group`

`Gtk.CheckButton | ReactElement`

The check button whose group this widget belongs to.

### `inconsistent`

`boolean` · default `false`

If the check button is in an “in between” state.

The inconsistent state only affects visual appearance,
not the semantics of the button.

### `label`

`string` · default `null`

Text of the label inside the check button, if it contains a label widget.

### `useUnderline`

`boolean` · default `false`

If set, an underline in the text indicates that the following
character is to be used as mnemonic.

## Signals

### `onActivate`

```ts
(self: Gtk.CheckButton) => void
```

Emitted to when the check button is activated.

The `::activate` signal on `GtkCheckButton` is an action signal and
emitting it causes the button to animate press then release.

Applications should never connect to this signal, but use the
`Gtk.CheckButton.toggled` signal.

The default bindings for this signal are all forms of the
<kbd>␣</kbd> and <kbd>Enter</kbd> keys.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 4.2._

### `onToggled`

```ts
(self: Gtk.CheckButton) => void
```

Emitted when the buttons's `Gtk.CheckButton.active`
property changes.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.CheckButton` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `getActive`

```ts
getActive(): boolean
```

Returns whether the check button is active.

**Returns** whether the check button is active

### `getChild`

```ts
getChild(): Gtk.Widget | null
```

Gets the child widget of `button` or `NULL` if `CheckButton.label` is set.

**Returns** the child widget of `button`

_Available since 4.8._

### `getInconsistent`

```ts
getInconsistent(): boolean
```

Returns whether the check button is in an inconsistent state.

**Returns** `true` if `check_button` is currently in an inconsistent state

### `getLabel`

```ts
getLabel(): string | null
```

Returns the label of the check button or `NULL` if `CheckButton.child` is set.

**Returns** The label `self` shows next
  to the indicator. If no label is shown, `null` will be returned.

### `getUseUnderline`

```ts
getUseUnderline(): boolean
```

Returns whether underlines in the label indicate mnemonics.

**Returns** The value of the `Gtk.CheckButton.useUnderline` property.
  See `Gtk.CheckButton.setUseUnderline()` for details on how to set
  a new value.

### `setActive`

```ts
setActive(setting: boolean): void
```

Changes the check buttons active state.

**Parameters**

- `setting`: the new value to set

### `setChild`

```ts
setChild(child: Gtk.Widget | null): void
```

Sets the child widget of `button`.

Note that by using this API, you take full responsibility for setting
up the proper accessibility label and description information for `button`.
Most likely, you'll either set the accessibility label or description
for `button` explicitly, or you'll set a labelled-by or described-by
relations from `child` to `button`.

**Parameters**

- `child`: the child widget

_Available since 4.8._

### `setGroup`

```ts
setGroup(group: Gtk.CheckButton | null): void
```

Adds `self` to the group of `group`.

In a group of multiple check buttons, only one button can be active
at a time. The behavior of a checkbutton in a group is also commonly
known as a *radio button*.

Setting the group of a check button also changes the css name of the
indicator widget's CSS node to 'radio'.

Setting up groups in a cycle leads to undefined behavior.

Note that the same effect can be achieved via the `Gtk.Actionable`
API, by using the same action with parameter type and state type 's'
for all buttons in the group, and giving each button its own target
value.

**Parameters**

- `group`: another `GtkCheckButton` to form a group with

### `setInconsistent`

```ts
setInconsistent(inconsistent: boolean): void
```

Sets the `GtkCheckButton` to inconsistent state.

You should turn off the inconsistent state again if the user checks
the check button. This has to be done manually.

**Parameters**

- `inconsistent`: `true` if state is inconsistent

### `setLabel`

```ts
setLabel(label: string | null): void
```

Sets the text of `self`.

If `Gtk.CheckButton.useUnderline` is `true`, an underscore
in `label` is interpreted as mnemonic indicator, see
`Gtk.CheckButton.setUseUnderline()` for details on this behavior.

**Parameters**

- `label`: The text shown next to the indicator, or `null` to show no text

### `setUseUnderline`

```ts
setUseUnderline(setting: boolean): void
```

Sets whether underlines in the label indicate mnemonics.

If `setting` is `true`, an underscore character in `self`'s label
indicates a mnemonic accelerator key. This behavior is similar
to `Gtk.Label.useUnderline`.

**Parameters**

- `setting`: the new value to set
