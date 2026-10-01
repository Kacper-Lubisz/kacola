---
description: "A widget presenting sidebar and content side by side or as a navigation view."
---

# AdwNavigationSplitView

A widget presenting sidebar and content side by side or as a navigation view.




`AdwNavigationSplitView` has two `NavigationPage` children: sidebar and
content, and displays them side by side.

When `NavigationSplitView.collapsed` is set to `TRUE`, it instead
puts both children inside an `NavigationView`. The
`NavigationSplitView.showContent` controls which child is visible
while collapsed.

See also `OverlaySplitView`.

`AdwNavigationSplitView` is typically used together with an `Breakpoint`
setting the `collapsed` property to `TRUE` on small widths, as follows:

```xml
<object class="AdwWindow">
  <property name="default-width">800</property>
  <property name="default-height">800</property>
  <child>
    <object class="AdwBreakpoint">
      <condition>max-width: 400sp</condition>
      <setter object="split_view" property="collapsed">True</setter>
    </object>
  </child>
  <property name="content">
    <object class="AdwNavigationSplitView" id="split_view">
      <property name="sidebar">
        <object class="AdwNavigationPage">
          <property name="title" translatable="yes">Sidebar</property>
          <property name="child">
            <!-- ... -->
          </property>
        </object>
      </property>
      <property name="content">
        <object class="AdwNavigationPage">
          <property name="title" translatable="yes">Content</property>
          <property name="child">
            <!-- ... -->
          </property>
        </object>
      </property>
    </object>
  </property>
</object>
```

### Sizing

When not collapsed, `AdwNavigationSplitView` changes the sidebar width
depending on its own width.

If possible, it tries to allocate a fraction of the total width, controlled
with the `NavigationSplitView.sidebarWidthFraction` property.

The sidebar also has minimum and maximum sizes, controlled with the
`NavigationSplitView.minSidebarWidth` and
`NavigationSplitView.maxSidebarWidth` properties.

The minimum and maximum sizes are using the length unit specified with the
`NavigationSplitView.sidebarWidthUnit`.

By default, sidebar is using 25% of the total width, with 180sp as the
minimum size and 280sp as the maximum size.

### Header Bar Integration

When used inside `AdwNavigationSplitView`, `HeaderBar` will
automatically hide the window buttons in the middle.

When collapsed, it also displays a back button for the content widget, as
well as the page titles. See `NavigationView` documentation for details.

### Actions

`AdwNavigationSplitView` defines the same actions as `AdwNavigationView`, but
they can be used even when the split view is not collapsed:

- `navigation.push` takes a string parameter specifying the tag of the page
to push. If it matches the tag of the content widget, it sets
`NavigationSplitView.showContent` to `TRUE`.

- `navigation.pop` doesn't take any parameters and sets
`NavigationSplitView.showContent` to `FALSE`.

### `AdwNavigationSplitView` as `GtkBuildable`

The `AdwNavigationSplitView` implementation of the `Gtk.Buildable`
interface supports setting the sidebar widget by specifying “sidebar” as the
“type” attribute of a `<child>` element, Specifying “content” child type or
omitting it results in setting the content widget.

### CSS nodes

`AdwNavigationSplitView` has a single CSS node with the name
`navigation-split-view`.

When collapsed, it contains a child node with the name `navigation-view`
containing both children.

```
navigation-split-view
╰── navigation-view
    ├── [sidebar child]
    ╰── [content child]
```

When not collapsed, it contains two nodes with the name `widget`, one with
the `.sidebar-pane` style class, the other one with `.content-view` style
class, containing the sidebar and content children respectively.

```
navigation-split-view
├── widget.sidebar-pane
│   ╰── [sidebar child]
╰── widget.content-pane
    ╰── [content child]
```

### Accessibility

`AdwNavigationSplitView` uses the `Gtk.AccessibleRole.group` role.

_Available since 1.4._

```tsx
import { AdwNavigationSplitView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwNavigationSplitView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.NavigationSplitView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `collapsed`

`boolean` · default `false`

Whether the split view is collapsed.

When collapsed, the children are put inside an `NavigationView`,
otherwise they are displayed side by side.

The `NavigationSplitView.showContent` controls which child is
visible while collapsed.

_Available since 1.4._

### `maxSidebarWidth`

`number` · default `280.000000`

The maximum sidebar width.

Maximum width is affected by
`NavigationSplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

_Available since 1.4._

### `minSidebarWidth`

`number` · default `180.000000`

The minimum sidebar width.

Minimum width is affected by
`NavigationSplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

_Available since 1.4._

### `showContent`

`boolean` · default `false`

Determines the visible page when collapsed.

If set to `TRUE`, the content widget will be the visible page when
`NavigationSplitView.collapsed` is `TRUE`; otherwise the sidebar
widget will be visible.

If the split view is already collapsed, the visible page changes
immediately.

_Available since 1.4._

### `sidebar`

`Adw.NavigationPage | ReactElement`

The sidebar widget.

_Available since 1.4._

### `sidebarPosition`

`Gtk.PackType` · default `GTK_PACK_START`

The sidebar position.

If set to `Gtk.PackType.start`, the sidebar is displayed before the
content, and the sidebar will be the root page when collapsed.

If set to `Gtk.PackType.end`, the sidebar is displayed after the
content, and the content will be the root page.

_Available since 1.7._

### `sidebarWidthFraction`

`number` · default `0.250000`

The preferred sidebar width as a fraction of the total width.

The preferred width is additionally limited by
`NavigationSplitView.minSidebarWidth` and
`NavigationSplitView.maxSidebarWidth`.

The sidebar widget can be allocated with larger width if its own minimum
width exceeds the preferred width.

_Available since 1.4._

### `sidebarWidthUnit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_SP`

The length unit for minimum and maximum sidebar widths.

See `NavigationSplitView.minSidebarWidth` and
`NavigationSplitView.maxSidebarWidth`.

_Available since 1.4._

## Methods

Methods are called on the `Adw.NavigationSplitView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCollapsed`

```ts
getCollapsed(): boolean
```

Gets whether `self` is collapsed.

**Returns** whether `self` is collapsed

_Available since 1.4._

### `getContent`

```ts
getContent(): Adw.NavigationPage | null
```

Sets the content widget for `self`.

**Returns** the content widget

_Available since 1.4._

### `getMaxSidebarWidth`

```ts
getMaxSidebarWidth(): number
```

Gets the maximum sidebar width for `self`.

**Returns** the maximum width

_Available since 1.4._

### `getMinSidebarWidth`

```ts
getMinSidebarWidth(): number
```

Gets the minimum sidebar width for `self`.

**Returns** the minimum width

_Available since 1.4._

### `getShowContent`

```ts
getShowContent(): boolean
```

Gets which page is visible when `self` is collapsed.

**Returns** whether to show content when collapsed

_Available since 1.4._

### `getSidebar`

```ts
getSidebar(): Adw.NavigationPage | null
```

Gets the sidebar widget for `self`.

**Returns** the sidebar widget

_Available since 1.4._

### `getSidebarPosition`

```ts
getSidebarPosition(): Gtk.PackType
```

Gets the sidebar position for `self`.

**Returns** the sidebar position for `self`

_Available since 1.7._

### `getSidebarWidthFraction`

```ts
getSidebarWidthFraction(): number
```

Gets the preferred sidebar width fraction for `self`.

**Returns** the preferred width fraction

_Available since 1.4._

### `getSidebarWidthUnit`

```ts
getSidebarWidthUnit(): Adw.LengthUnit
```

Gets the length unit for minimum and maximum sidebar widths.

**Returns** the length unit

_Available since 1.4._

### `setCollapsed`

```ts
setCollapsed(collapsed: boolean): void
```

Sets whether `self` is collapsed.

When collapsed, the children are put inside an `NavigationView`,
otherwise they are displayed side by side.

The `NavigationSplitView.showContent` controls which child is
visible while collapsed.

**Parameters**

- `collapsed`: whether `self` is collapsed

_Available since 1.4._

### `setContent`

```ts
setContent(content: Adw.NavigationPage | null): void
```

Sets the content widget for `self`.

**Parameters**

- `content`: the content widget

_Available since 1.4._

### `setMaxSidebarWidth`

```ts
setMaxSidebarWidth(width: number): void
```

Sets the maximum sidebar width for `self`.

Maximum width is affected by
`NavigationSplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

**Parameters**

- `width`: the maximum width

_Available since 1.4._

### `setMinSidebarWidth`

```ts
setMinSidebarWidth(width: number): void
```

Sets the minimum sidebar width for `self`.

Minimum width is affected by
`NavigationSplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

**Parameters**

- `width`: the minimum width

_Available since 1.4._

### `setShowContent`

```ts
setShowContent(showContent: boolean): void
```

Sets which page is visible when `self` is collapsed.

If set to `TRUE`, the content widget will be the visible page when
`NavigationSplitView.collapsed` is `TRUE`; otherwise the sidebar
widget will be visible.

If the split view is already collapsed, the visible page changes immediately.

**Parameters**

- `showContent`: whether to show content when collapsed

_Available since 1.4._

### `setSidebar`

```ts
setSidebar(sidebar: Adw.NavigationPage | null): void
```

Sets the sidebar widget for `self`.

**Parameters**

- `sidebar`: the sidebar widget

_Available since 1.4._

### `setSidebarPosition`

```ts
setSidebarPosition(position: Gtk.PackType): void
```

Sets the sidebar position for `self`.

If set to `Gtk.PackType.start`, the sidebar is displayed before the
content, and the sidebar will be the root page when collapsed.

If set to `Gtk.PackType.end`, the sidebar is displayed after the
content, and the content will be the root page.

**Parameters**

- `position`: the new position

_Available since 1.7._

### `setSidebarWidthFraction`

```ts
setSidebarWidthFraction(fraction: number): void
```

Sets the preferred sidebar width as a fraction of the total width of `self`.

The preferred width is additionally limited by
`NavigationSplitView.minSidebarWidth` and
`NavigationSplitView.maxSidebarWidth`.

The sidebar widget can be allocated with larger width if its own minimum
width exceeds the preferred width.

**Parameters**

- `fraction`: the preferred width fraction

_Available since 1.4._

### `setSidebarWidthUnit`

```ts
setSidebarWidthUnit(unit: Adw.LengthUnit): void
```

Sets the length unit for minimum and maximum sidebar widths.

See `NavigationSplitView.minSidebarWidth` and
`NavigationSplitView.maxSidebarWidth`.

**Parameters**

- `unit`: the length unit

_Available since 1.4._
