---
description: "GMenuItem is an opaque structure type."
---

# GMenuItem

`GMenuItem` is an opaque structure type.  You must access it using the
functions below.

_Available since 2.32._

```tsx
import { GMenuItem } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GMenuItem**

## Props

`ref` receives the `Gio.MenuItem` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.MenuItem` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getAttributeValue`

```ts
getAttributeValue(attribute: string, expectedType: GLib.VariantType | null): GLib.Variant | null
```

Queries the named `attribute` on `menu_item`.

If `expected_type` is specified and the attribute does not have this
type, `null` is returned.  `null` is also returned if the attribute
simply does not exist.

**Parameters**

- `attribute`: the attribute name to query
- `expectedType`: the expected type of the attribute

**Returns** the attribute value, or `null`

_Available since 2.34._

### `getLink`

```ts
getLink(link: string): Gio.MenuModel | null
```

Queries the named `link` on `menu_item`.

**Parameters**

- `link`: the link name to query

**Returns** the link, or `null`

_Available since 2.34._

### `setActionAndTargetValue`

```ts
setActionAndTargetValue(action: string | null, targetValue: GLib.Variant | null): void
```

Sets or unsets the "action" and "target" attributes of `menu_item`.

If `action` is `null` then both the "action" and "target" attributes
are unset (and `target_value` is ignored).

If `action` is non-`null` then the "action" attribute is set.  The
"target" attribute is then set to the value of `target_value` if it is
non-`null` or unset otherwise.

Normal menu items (ie: not submenu, section or other custom item
types) are expected to have the "action" attribute set to identify
the action that they are associated with.  The state type of the
action help to determine the disposition of the menu item.  See
`GAction` and `GActionGroup` for an overview of actions.

In general, clicking on the menu item will result in activation of
the named action with the "target" attribute given as the parameter
to the action invocation.  If the "target" attribute is not set then
the action is invoked with no parameter.

If the action has no state then the menu item is usually drawn as a
plain menu item (ie: with no additional decoration).

If the action has a boolean state then the menu item is usually drawn
as a toggle menu item (ie: with a checkmark or equivalent
indication).  The item should be marked as 'toggled' or 'checked'
when the boolean state is `true`.

If the action has a string state then the menu item is usually drawn
as a radio menu item (ie: with a radio bullet or equivalent
indication).  The item should be marked as 'selected' when the string
state is equal to the value of the `target` property.

See `g_menu_item_set_action_and_target()` or
`g_menu_item_set_detailed_action()` for two equivalent calls that are
probably more convenient for most uses.

**Parameters**

- `action`: the name of the action for this item
- `targetValue`: a `GVariant` to use as the action target

_Available since 2.32._

### `setAttributeValue`

```ts
setAttributeValue(attribute: string, value: GLib.Variant | null): void
```

Sets or unsets an attribute on `menu_item`.

The attribute to set or unset is specified by `attribute`. This
can be one of the standard attribute names `G_MENU_ATTRIBUTE_LABEL`,
`G_MENU_ATTRIBUTE_ACTION`, `G_MENU_ATTRIBUTE_TARGET`, or a custom
attribute name.
Attribute names are restricted to lowercase characters, numbers
and '-'. Furthermore, the names must begin with a lowercase character,
must not end with a '-', and must not contain consecutive dashes.

must consist only of lowercase
ASCII characters, digits and '-'.

If `value` is non-`null` then it is used as the new value for the
attribute.  If `value` is `null` then the attribute is unset. If
the `value` `GVariant` is floating, it is consumed.

See also `g_menu_item_set_attribute()` for a more convenient way to do
the same.

**Parameters**

- `attribute`: the attribute to set
- `value`: a `GVariant` to use as the value, or `null`

_Available since 2.32._

### `setDetailedAction`

```ts
setDetailedAction(detailedAction: string): void
```

Sets the "action" and possibly the "target" attribute of `menu_item`.

The format of `detailed_action` is the same format parsed by
`g_action_parse_detailed_name()`.

See `g_menu_item_set_action_and_target()` or
`g_menu_item_set_action_and_target_value()` for more flexible (but
slightly less convenient) alternatives.

See also `g_menu_item_set_action_and_target_value()` for a description of
the semantics of the action and target attributes.

**Parameters**

- `detailedAction`: the "detailed" action string

_Available since 2.32._

### `setIcon`

```ts
setIcon(icon: Gio.Icon): void
```

Sets (or unsets) the icon on `menu_item`.

This call is the same as calling `g_icon_serialize()` and using the
result as the value to `g_menu_item_set_attribute_value()` for
`G_MENU_ATTRIBUTE_ICON`.

This API is only intended for use with "noun" menu items; things like
bookmarks or applications in an "Open With" menu.  Don't use it on
menu items corresponding to verbs (eg: stock icons for 'Save' or
'Quit').

If `icon` is `null` then the icon is unset.

**Parameters**

- `icon`: a `GIcon`, or `null`

_Available since 2.38._

### `setLabel`

```ts
setLabel(label: string | null): void
```

Sets or unsets the "label" attribute of `menu_item`.

If `label` is non-`null` it is used as the label for the menu item.  If
it is `null` then the label attribute is unset.

**Parameters**

- `label`: the label to set, or `null` to unset

_Available since 2.32._

### `setLink`

```ts
setLink(link: string, model: Gio.MenuModel | null): void
```

Creates a link from `menu_item` to `model` if non-`null`, or unsets it.

Links are used to establish a relationship between a particular menu
item and another menu.  For example, `G_MENU_LINK_SUBMENU` is used to
associate a submenu with a particular menu item, and `G_MENU_LINK_SECTION`
is used to create a section. Other types of link can be used, but there
is no guarantee that clients will be able to make sense of them.
Link types are restricted to lowercase characters, numbers
and '-'. Furthermore, the names must begin with a lowercase character,
must not end with a '-', and must not contain consecutive dashes.

**Parameters**

- `link`: type of link to establish or unset
- `model`: the `GMenuModel` to link to (or `null` to unset)

_Available since 2.32._

### `setSection`

```ts
setSection(section: Gio.MenuModel | null): void
```

Sets or unsets the "section" link of `menu_item` to `section`.

The effect of having one menu appear as a section of another is
exactly as it sounds: the items from `section` become a direct part of
the menu that `menu_item` is added to.  See `g_menu_item_new_section()`
for more information about what it means for a menu item to be a
section.

**Parameters**

- `section`: a `GMenuModel`, or `null`

_Available since 2.32._

### `setSubmenu`

```ts
setSubmenu(submenu: Gio.MenuModel | null): void
```

Sets or unsets the "submenu" link of `menu_item` to `submenu`.

If `submenu` is non-`null`, it is linked to.  If it is `null` then the
link is unset.

The effect of having one menu appear as a submenu of another is
exactly as it sounds.

**Parameters**

- `submenu`: a `GMenuModel`, or `null`

_Available since 2.32._
