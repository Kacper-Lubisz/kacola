---
description: "A widget for switching between different layouts."
---

# AdwMultiLayoutView

A widget for switching between different layouts.

`AdwMultiLayoutView` contains layouts and children. Each child has
an ID, each layout has slots inside it, each slot also has an ID. When
switching layouts, children are inserted into slots with matching IDs. The
`Gtk.Widget.visible` property of each slot is updated to match
that of the inserted child.

This can be useful for rearranging children when it's difficult to do so
otherwise, for example to move a child from a sidebar to a bottom bar.

The currently used layout can be switched using the
`MultiLayoutView.layout` or `MultiLayoutView.layoutName`
properties. For example, it can be done via a `Adw.Breakpoint` setter
to change layouts depending on the window size.

### AdwMultiLayoutView as GtkBuildable

The `AdwMultiLayoutView` implementation of the `Gtk.Buildable`
interface supports adding layouts via `<child>` element with the `type`
attribute omitted.

It also supports setting children via `<child type="ID">`.

Example of an `AdwMultiLayoutView` UI definition that can display a secondary
child as either a sidebar or a bottom sheet.

```xml
<object class="AdwMultiLayoutView">
  <child>
    <object class="AdwLayout">
      <property name="name">sidebar</property>
      <property name="content">
        <object class="AdwOverlaySplitView">
          <property name="sidebar">
            <object class="AdwLayoutSlot">
              <property name="id">secondary</property>
            </object>
          </property>
          <property name="content">
            <object class="AdwLayoutSlot">
              <property name="id">primary</property>
            </object>
          </property>
        </object>
      </property>
    </object>
  </child>
  <child>
    <object class="AdwLayout">
      <property name="name">bottom-sheet</property>
      <property name="content">
        <object class="AdwBottomSheet">
          <property name="open">True</property>
          <property name="content">
            <object class="AdwLayoutSlot">
              <property name="id">primary</property>
            </object>
          </property>
          <property name="sheet">
            <object class="AdwLayoutSlot">
              <property name="id">secondary</property>
            </object>
          </property>
        </object>
      </property>
    </object>
  </child>
  <child type="primary">
    <!-- ... -->
  </child>
  <child type="secondary">
    <!-- ... -->
  </child>
</object>
```

### CSS nodes

`AdwMultiLayoutView` has a single CSS node with name `multi-layout-view`.

_Available since 1.6._

```tsx
import { AdwMultiLayoutView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwMultiLayoutView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.MultiLayoutView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `${string}Slot`

`ReactNode | null`

Widget the view places in the `Adw.LayoutSlot` whose `id` is the prop name without its `Slot` suffix, so `sidebarSlot` fills the slot with id `sidebar` in whichever layout is current.

### `layout`

`Adw.Layout | ReactElement`

The currently used layout.

_Available since 1.6._

### `layoutName`

`string` · default `null`

The name of the currently used layout.

See `Layout.name`.

_Available since 1.6._

### `layouts`

`ReactNode | null`

`Adw.Layout` elements added to the view, each holding the content it lays out.

## Methods

Methods are called on the `Adw.MultiLayoutView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addLayout`

```ts
addLayout(layout: Adw.Layout): void
```

Adds `layout` to `self`.

**Parameters**

- `layout`: the layout to add

_Available since 1.6._

### `getChild`

```ts
getChild(id: string): Gtk.Widget | null
```

Gets the child for `id` to `self`.

**Parameters**

- `id`: the id of the child

**Returns** the child for `id`

_Available since 1.6._

### `getLayout`

```ts
getLayout(): Adw.Layout | null
```

Gets the currently used layout of `self`.

**Returns** the current layout

_Available since 1.6._

### `getLayoutByName`

```ts
getLayoutByName(name: string): Adw.Layout | null
```

Gets layout with the name `name` from `self`, or `NULL` if it doesn't exist.

See `Layout.name`.

**Parameters**

- `name`: the name of the layout

**Returns** the layout with `name`

_Available since 1.6._

### `getLayoutName`

```ts
getLayoutName(): string | null
```

Returns the name of the currently used layout of `self`.

**Returns** the name of the current layout

_Available since 1.6._

### `removeLayout`

```ts
removeLayout(layout: Adw.Layout): void
```

Removes `layout` from `self`.

**Parameters**

- `layout`: the layout to add

_Available since 1.6._

### `setChild`

```ts
setChild(id: string, child: Gtk.Widget): void
```

Sets `child` as the child for `id` in `self`.

When changing layouts, it will be inserted into the slot with `id`.

**Parameters**

- `id`: the id of the child
- `child`: the child to set

_Available since 1.6._

### `setLayout`

```ts
setLayout(layout: Adw.Layout): void
```

Makes `layout` the current layout of `self`.

**Parameters**

- `layout`: a layout in `self`

_Available since 1.6._

### `setLayoutName`

```ts
setLayoutName(name: string): void
```

Makes the layout with `name` the current layout of `self`.

See `Layout.name`.

**Parameters**

- `name`: the name of the layout

_Available since 1.6._
