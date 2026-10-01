---
description: "A subclass of GtkPopover that implements menu behavior."
---

# GtkPopoverMenu

A subclass of `GtkPopover` that implements menu behavior.



`GtkPopoverMenu` treats its children like menus and allows switching
between them. It can open submenus as traditional, nested submenus,
or in a more touch-friendly sliding fashion.
The property `Gtk.PopoverMenu.flags` controls this appearance.

`GtkPopoverMenu` is meant to be used primarily with menu models,
using `Gtk.PopoverMenu.newFromModel()`. If you need to put
other widgets such as a `GtkSpinButton` or a `GtkSwitch` into a popover,
you can use `Gtk.PopoverMenu.addChild()`.

For more dialog-like behavior, use a plain `GtkPopover`.

### Menu models

The XML format understood by `GtkBuilder` for `GMenuModel` consists
of a toplevel `<menu>` element, which contains one or more `<item>`
elements. Each `<item>` element contains `<attribute>` and `<link>`
elements with a mandatory name attribute. `<link>` elements have the
same content model as `<menu>`. Instead of `<link name="submenu">`
or `<link name="section">`, you can use `<submenu>` or `<section>`
elements.

```xml
<menu id='app-menu'>
  <section>
    <item>
      <attribute name='label' translatable='yes'>_New Window</attribute>
      <attribute name='action'>app.new</attribute>
    </item>
    <item>
      <attribute name='label' translatable='yes'>_About Sunny</attribute>
      <attribute name='action'>app.about</attribute>
    </item>
    <item>
      <attribute name='label' translatable='yes'>_Quit</attribute>
      <attribute name='action'>app.quit</attribute>
    </item>
  </section>
</menu>
```

Attribute values can be translated using gettext, like other `GtkBuilder`
content. `<attribute>` elements can be marked for translation with a
`translatable="yes"` attribute. It is also possible to specify message
context and translator comments, using the context and comments attributes.
To make use of this, the `GtkBuilder` must have been given the gettext
domain to use.

The following attributes are used when constructing menu items:

- "label": a user-visible string to display
- "use-markup": whether the text in the menu item includes [Pango markup](https://docs.gtk.org/Pango/pango_markup.html)
- "action": the prefixed name of the action to trigger
- "target": the parameter to use when activating the action
- "icon" and "verb-icon": names of icons that may be displayed
- "submenu-action": name of an action that may be used to track
     whether a submenu is open
- "hidden-when": a string used to determine when the item will be hidden.
     Possible values include "action-disabled", "action-missing", "macos-menubar".
     This is mainly useful for exported menus, see `Gtk.Application.setMenubar()`.
- "custom": a string used to match against the ID of a custom child added with
     `Gtk.PopoverMenu.addChild()`, `Gtk.PopoverMenuBar.addChild()`,
     or in the ui file with `<child type="ID">`.

The following attributes are used when constructing sections:

- "label": a user-visible string to use as section heading
- "display-hint": a string used to determine special formatting for the section.
    Possible values include "horizontal-buttons", "circular-buttons" and
    "inline-buttons". They all indicate that section should be
    displayed as a horizontal row of buttons.
- "text-direction": a string used to determine the `GtkTextDirection` to use
    when "display-hint" is set to "horizontal-buttons". Possible values
    include "rtl", "ltr", and "none".

The following attributes are used when constructing submenus:

- "label": a user-visible string to display
- "icon": icon name to display
- "gtk-macos-special": (macOS only, ignored by others) Add special meaning to a menu
    in the macOS menu bar. See [Using GTK on Apple macOS](osx.html).

Menu items will also show accelerators, which are usually associated
with actions via `Gtk.Application.setAccelsForAction()`,
`WidgetClass.addBindingAction()` or
`Gtk.ShortcutController.addShortcut()`.

## Shortcuts and Gestures

`GtkPopoverMenu` supports the following keyboard shortcuts:

- <kbd>Space</kbd> activates the default widget.

## CSS Nodes

`GtkPopoverMenu` is just a subclass of `GtkPopover` that adds custom content
to it, therefore it has the same CSS nodes. It is one of the cases that add
a `.menu` style class to the main `popover` node.

Menu items have nodes with name `button` and class `.model`. If a section
display-hint is set, the section gets a node `box` with class `horizontal`
plus a class with the same text as the display hint. Note that said box may
not be the direct ancestor of the item `button`s. Thus, for example, to style
items in an `inline-buttons` section, select `.inline-buttons button.model`.
Other things that may be of interest to style in menus include `label` nodes.

## Accessibility

`GtkPopoverMenu` uses the `Gtk.AccessibleRole.menu` role, and its
items use the `Gtk.AccessibleRole.menu_item`,
`Gtk.AccessibleRole.checkbox` or `Gtk.AccessibleRole.menu_item_radio`
roles, depending on the action they are connected to.

```tsx
import { GtkPopoverMenu } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkPopover](.gtkx/reference/gtk/popover.md) → **GtkPopoverMenu**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.PopoverMenu` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `flags`

`Gtk.PopoverMenuFlags` · default `GTK_POPOVER_MENU_SLIDING`

The flags that `popover` uses to create/display a menu from its model.

If a model is set and the flags change, contents are rebuilt, so if setting
properties individually, set flags before model to avoid a redundant rebuild.

_Available since 4.14._

### `menuModel`

`Gio.MenuModel | ReactElement`

The model from which the menu is made.

### `visibleSubmenu`

`string` · default `null`

The name of the visible submenu.

## Methods

Methods are called on the `Gtk.PopoverMenu` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addChild`

```ts
addChild(child: Gtk.Widget, id: string): boolean
```

Adds a custom widget to a generated menu.

For this to work, the menu model of `popover` must have
an item with a `custom` attribute that matches `id`.

**Parameters**

- `child`: the `GtkWidget` to add
- `id`: the ID to insert `child` at

**Returns** `true` if `id` was found and the widget added

### `getFlags`

```ts
getFlags(): Gtk.PopoverMenuFlags
```

Returns the flags that `popover` uses to create/display a menu from its model.

**Returns** the `GtkPopoverMenuFlags`

_Available since 4.14._

### `getMenuModel`

```ts
getMenuModel(): Gio.MenuModel | null
```

Returns the menu model used to populate the popover.

**Returns** the menu model of `popover`

### `removeChild`

```ts
removeChild(child: Gtk.Widget): boolean
```

Removes a widget that has previously been added with
`Gtk.PopoverMenu.addChild()`

**Parameters**

- `child`: the `GtkWidget` to remove

**Returns** `true` if the widget was removed

### `setFlags`

```ts
setFlags(flags: Gtk.PopoverMenuFlags): void
```

Sets the flags that `popover` uses to create/display a menu from its model.

If a model is set and the flags change, contents are rebuilt, so if setting
properties individually, set flags before model to avoid a redundant rebuild.

**Parameters**

- `flags`: a set of `GtkPopoverMenuFlags`

_Available since 4.14._

### `setMenuModel`

```ts
setMenuModel(model: Gio.MenuModel | null): void
```

Sets a new menu model on `popover`.

The existing contents of `popover` are removed, and
the `popover` is populated with new contents according
to `model`.

**Parameters**

- `model`: a `GMenuModel`
