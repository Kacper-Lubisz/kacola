---
description: "Manages keyboard shortcuts and their activation."
---

# GtkShortcutController

Manages keyboard shortcuts and their activation.

Most common shortcuts are using this controller implicitly, e.g. by
adding a mnemonic underline to a `Gtk.Label`, or by installing a key
binding using `Gtk.WidgetClass.addBinding()`, or by adding accelerators
to global actions using `Gtk.Application.setAccelsForAction()`.

But it is possible to create your own shortcut controller, and add
shortcuts to it.

`GtkShortcutController` implements `Gio.ListModel` for querying the
shortcuts that have been added to it.

## GtkShortcutController as GtkBuildable

`GtkShortcutController`s can be created in `Gtk.Builder` ui files, to set up
shortcuts in the same place as the widgets.

An example of a UI definition fragment with `GtkShortcutController`:
```xml
  <object class='GtkButton'>
    <child>
      <object class='GtkShortcutController'>
        <property name='scope'>managed</property>
        <child>
          <object class='GtkShortcut'>
            <property name='trigger'>&lt;Control&gt;k</property>
            <property name='action'>activate</property>
          </object>
        </child>
      </object>
    </child>
  </object>
```

This example creates a `Gtk.ActivateAction` for triggering the
`activate` signal of the `Gtk.Button`. See `Gtk.ShortcutAction.parseString()`
for the syntax for other kinds of `Gtk.ShortcutAction`. See
`Gtk.ShortcutTrigger.parseString()` to learn more about the syntax
for triggers.

```tsx
import { GtkShortcutController } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GtkEventController](.gtkx/reference/gtk/event-controller.md) → **GtkShortcutController**

Implements `GListModel`, `GtkBuildable`.

## Props

`ref` receives the `Gtk.ShortcutController` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `itemType`

`GObject.Type` · read-only, observe with `onNotifyItemType`

The type of items. See `Gio.ListModel.getItemType()`.

_Available since 4.8._

### `mnemonicModifiers`

`Gdk.ModifierType` · default `GDK_ALT_MASK`

The modifiers that need to be pressed to allow mnemonics activation.

### `model`

`Gio.ListModel` · construct-only

A list model to take shortcuts from.

### `nItems`

`number` · default `0` · read-only, observe with `onNotifyNItems`

The number of items. See `Gio.ListModel.getNItems()`.

_Available since 4.8._

### `scope`

`Gtk.ShortcutScope` · default `GTK_SHORTCUT_SCOPE_LOCAL`

What scope the shortcuts will be handled in.

### `shortcuts`

`ReactNode | null`

`Gtk.Shortcut` elements the controller watches for.

## Signals

### `onItemsChanged`

```ts
(position: number, removed: number, added: number, self: Gtk.ShortcutController) => void
```

From `GListModel`.

This signal is emitted whenever items were added to or removed
from `list`. At `position`, `removed` items were removed and `added`
items were added in their place.

Note: If `removed != added`, the positions of all later items
in the model change.

**Parameters**

- `position`: the position at which `list` changed
- `removed`: the number of items removed
- `added`: the number of items added
- `self`: The instance the signal was emitted on.

_Available since 2.44._

## Methods

Methods are called on the `Gtk.ShortcutController` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addShortcut`

```ts
addShortcut(shortcut: Gtk.Shortcut): void
```

Adds `shortcut` to the list of shortcuts handled by `self`.

If this controller uses an external shortcut list, this
function does nothing.

**Parameters**

- `shortcut`: a `GtkShortcut`

### `getMnemonicsModifiers`

```ts
getMnemonicsModifiers(): Gdk.ModifierType
```

Gets the mnemonics modifiers for when this controller activates its shortcuts.

**Returns** the controller's mnemonics modifiers

### `getScope`

```ts
getScope(): Gtk.ShortcutScope
```

Gets the scope for when this controller activates its shortcuts.

See `Gtk.ShortcutController.setScope()` for details.

**Returns** the controller's scope

### `removeShortcut`

```ts
removeShortcut(shortcut: Gtk.Shortcut): void
```

Removes `shortcut` from the list of shortcuts handled by `self`.

If `shortcut` had not been added to `controller` or this controller
uses an external shortcut list, this function does nothing.

**Parameters**

- `shortcut`: a `GtkShortcut`

### `setMnemonicsModifiers`

```ts
setMnemonicsModifiers(modifiers: Gdk.ModifierType): void
```

Sets the controller to use the given modifier for mnemonics.

The mnemonics modifiers determines which modifiers need to be pressed to allow
activation of shortcuts with mnemonics triggers.

GTK normally uses the Alt modifier for mnemonics, except in `GtkPopoverMenu`s,
where mnemonics can be triggered without any modifiers. It should be very
rarely necessary to change this, and doing so is likely to interfere with
other shortcuts.

This value is only relevant for local shortcut controllers. Global and managed
shortcut controllers will have their shortcuts activated from other places which
have their own modifiers for activating mnemonics.

**Parameters**

- `modifiers`: the new mnemonics_modifiers to use

### `setScope`

```ts
setScope(scope: Gtk.ShortcutScope): void
```

Sets the controller to have the given `scope`.

The scope allows shortcuts to be activated outside of the normal
event propagation. In particular, it allows installing global
keyboard shortcuts that can be activated even when a widget does
not have focus.

With `GTK_SHORTCUT_SCOPE_LOCAL`, shortcuts will only be activated
when the widget has focus.

**Parameters**

- `scope`: the new scope to use
