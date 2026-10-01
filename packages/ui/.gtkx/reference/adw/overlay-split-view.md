---
description: "A widget presenting sidebar and content side by side or as an overlay."
---

# AdwOverlaySplitView

A widget presenting sidebar and content side by side or as an overlay.




`AdwOverlaySplitView` has two children: sidebar and content, and displays
them side by side.

When `OverlaySplitView.collapsed` is set to `TRUE`, the sidebar is
instead shown as an overlay above the content widget.

The sidebar can be hidden or shown using the
`OverlaySplitView.showSidebar` property.

Sidebar can be displayed before or after the content, this can be controlled
with the `OverlaySplitView.sidebarPosition` property.

Collapsing the split view automatically hides the sidebar widget, and
uncollapsing it shows the sidebar. If this behavior is not desired, the
`OverlaySplitView.pinSidebar` property can be used to override it.

`AdwOverlaySplitView` supports an edge swipe gesture for showing the sidebar,
and a swipe from the sidebar for hiding it. Gestures are only supported on
touchscreen, but not touchpad. Gestures can be controlled with the
`OverlaySplitView.enableShowGesture` and
`OverlaySplitView.enableHideGesture` properties.

See also `NavigationSplitView`.

`AdwOverlaySplitView` is typically used together with an `Breakpoint`
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
    <object class="AdwOverlaySplitView" id="split_view">
      <property name="sidebar">
        <!-- ... -->
      </property>
      <property name="content">
        <!-- ... -->
      </property>
    </object>
  </property>
</object>
```

`AdwOverlaySplitView` is often used for implementing the
[utility pane](https://developer.gnome.org/hig/patterns/containers/utility-panes.html)
pattern.

### Sizing

When not collapsed, `AdwOverlaySplitView` changes the sidebar width
depending on its own width.

If possible, it tries to allocate a fraction of the total width, controlled
with the `OverlaySplitView.sidebarWidthFraction` property.

The sidebar also has minimum and maximum sizes, controlled with the
`OverlaySplitView.minSidebarWidth` and
`OverlaySplitView.maxSidebarWidth` properties.

The minimum and maximum sizes are using the length unit specified with the
`OverlaySplitView.sidebarWidthUnit`.

By default, sidebar is using 25% of the total width, with 180sp as the
minimum size and 280sp as the maximum size.

When collapsed, the preferred width fraction is ignored and the sidebar uses
`OverlaySplitView.maxSidebarWidth` when possible.

### Header Bar Integration

When used inside `AdwOverlaySplitView`, `HeaderBar` will automatically
hide the window buttons in the middle.

### `AdwOverlaySplitView` as `GtkBuildable`

The `AdwOverlaySplitView` implementation of the `Gtk.Buildable`
interface supports setting the sidebar widget by specifying “sidebar” as the
“type” attribute of a `<child>` element, Specifying “content” child type or
omitting it results in setting the content widget.

### CSS nodes

`AdwOverlaySplitView` has a single CSS node with the name
`overlay-split-view`.

It contains two nodes with the name `widget`, containing the sidebar and
content children.

When not collapsed, they have the `.sidebar-view` and `.content-view` style
classes respectively.

```
overlay-split-view
├── widget.sidebar-pane
│   ╰── [sidebar child]
╰── widget.content-pane
    ╰── [content child]
```

When collapsed, the one containing the sidebar child has the `.background`
style class and the other one has no style classes.

```
overlay-split-view
├── widget.background
│   ╰── [sidebar child]
╰── widget
    ╰── [content child]
```

### Accessibility

`AdwOverlaySplitView` uses the `Gtk.AccessibleRole.group` role.

_Available since 1.4._

```tsx
import { AdwOverlaySplitView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwOverlaySplitView**

Implements `AdwSwipeable`, `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.OverlaySplitView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `collapsed`

`boolean` · default `false`

Whether the split view is collapsed.

When collapsed, the sidebar widget is presented as an overlay above the
content widget, otherwise they are displayed side by side.

_Available since 1.4._

### `enableHideGesture`

`boolean` · default `true`

Whether the sidebar can be closed with a swipe gesture.

Only touchscreen swipes are supported.

_Available since 1.4._

### `enableShowGesture`

`boolean` · default `true`

Whether the sidebar can be opened with an edge swipe gesture.

Only touchscreen swipes are supported.

_Available since 1.4._

### `maxSidebarWidth`

`number` · default `280.000000`

The maximum sidebar width.

Maximum width is affected by
`OverlaySplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

_Available since 1.4._

### `minSidebarWidth`

`number` · default `180.000000`

The minimum sidebar width.

Minimum width is affected by
`OverlaySplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

_Available since 1.4._

### `pinSidebar`

`boolean` · default `false`

Whether the sidebar widget is pinned.

By default, collapsing `self` automatically hides the sidebar widget, and
uncollapsing it shows the sidebar. If set to `TRUE`, sidebar visibility
never changes on its own.

_Available since 1.4._

### `showSidebar`

`boolean` · default `true`

Whether the sidebar widget is shown.

_Available since 1.4._

### `sidebar`

`Gtk.Widget | ReactElement`

The sidebar widget.

_Available since 1.4._

### `sidebarPosition`

`Gtk.PackType` · default `GTK_PACK_START`

The sidebar position.

If it's set to `Gtk.PackType.start`, the sidebar is displayed before
the content; if `Gtk.PackType.end`, it's displayed after the content.

_Available since 1.4._

### `sidebarWidthFraction`

`number` · default `0.250000`

The preferred sidebar width as a fraction of the total width.

The preferred width is additionally limited by
`OverlaySplitView.minSidebarWidth` and
`OverlaySplitView.maxSidebarWidth`.

The sidebar widget can be allocated with larger width if its own minimum
width exceeds the preferred width.

_Available since 1.4._

### `sidebarWidthUnit`

`Adw.LengthUnit` · default `ADW_LENGTH_UNIT_SP`

The length unit for minimum and maximum sidebar widths.

See `OverlaySplitView.minSidebarWidth` and
`OverlaySplitView.maxSidebarWidth`.

_Available since 1.4._

## Methods

Methods are called on the `Adw.OverlaySplitView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCollapsed`

```ts
getCollapsed(): boolean
```

Gets whether `self` is collapsed.

**Returns** whether `self` is collapsed

_Available since 1.4._

### `getContent`

```ts
getContent(): Gtk.Widget | null
```

Gets the content widget for `self`.

**Returns** the content widget for `self`

_Available since 1.4._

### `getEnableHideGesture`

```ts
getEnableHideGesture(): boolean
```

Gets whether `self` can be closed with a swipe gesture.

**Returns** `TRUE` if `self` can be closed with a swipe gesture

_Available since 1.4._

### `getEnableShowGesture`

```ts
getEnableShowGesture(): boolean
```

Gets whether `self` can be opened with an edge swipe gesture.

**Returns** `TRUE` if `self` can be opened with a swipe gesture

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

### `getPinSidebar`

```ts
getPinSidebar(): boolean
```

Gets whether the sidebar widget is pinned for `self`.

**Returns** whether if the sidebar widget is pinned

_Available since 1.4._

### `getShowSidebar`

```ts
getShowSidebar(): boolean
```

Gets whether the sidebar widget is shown for `self`.

**Returns** `TRUE` if the sidebar widget is shown

_Available since 1.4._

### `getSidebar`

```ts
getSidebar(): Gtk.Widget | null
```

Gets the sidebar widget for `self`.

**Returns** the sidebar widget for `self`

_Available since 1.4._

### `getSidebarPosition`

```ts
getSidebarPosition(): Gtk.PackType
```

Gets the sidebar position for `self`.

**Returns** the sidebar position for `self`

_Available since 1.4._

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

Sets whether `self` view is collapsed.

When collapsed, the sidebar widget is presented as an overlay above the
content widget, otherwise they are displayed side by side.

**Parameters**

- `collapsed`: whether `self` is collapsed

_Available since 1.4._

### `setContent`

```ts
setContent(content: Gtk.Widget | null): void
```

Sets the content widget for `self`.

**Parameters**

- `content`: the content widget

_Available since 1.4._

### `setEnableHideGesture`

```ts
setEnableHideGesture(enableHideGesture: boolean): void
```

Sets whether `self` can be closed with a swipe gesture.

Only touchscreen swipes are supported.

**Parameters**

- `enableHideGesture`: whether `self` can be closed with a swipe gesture

_Available since 1.4._

### `setEnableShowGesture`

```ts
setEnableShowGesture(enableShowGesture: boolean): void
```

Sets whether `self` can be opened with an edge swipe gesture.

Only touchscreen swipes are supported.

**Parameters**

- `enableShowGesture`: whether `self` can be opened with a swipe gesture

_Available since 1.4._

### `setMaxSidebarWidth`

```ts
setMaxSidebarWidth(width: number): void
```

Sets the maximum sidebar width for `self`.

Maximum width is affected by `OverlaySplitView.sidebarWidthUnit`.

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

Minimum width is affected by `OverlaySplitView.sidebarWidthUnit`.

The sidebar widget can still be allocated with larger width if its own
minimum width exceeds it.

**Parameters**

- `width`: the minimum width

_Available since 1.4._

### `setPinSidebar`

```ts
setPinSidebar(pinSidebar: boolean): void
```

Sets whether the sidebar widget is pinned for `self`.

By default, collapsing `self` automatically hides the sidebar widget, and
uncollapsing it shows the sidebar. If set to `TRUE`, sidebar visibility never
changes on its own.

**Parameters**

- `pinSidebar`: whether to pin the sidebar widget

_Available since 1.4._

### `setShowSidebar`

```ts
setShowSidebar(showSidebar: boolean): void
```

Sets whether the sidebar widget is shown for `self`.

**Parameters**

- `showSidebar`: whether to show the sidebar widget

_Available since 1.4._

### `setSidebar`

```ts
setSidebar(sidebar: Gtk.Widget | null): void
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

If it's set to `Gtk.PackType.start`, the sidebar is displayed before the
content; if `Gtk.PackType.end`, it's displayed after the content.

**Parameters**

- `position`: the new position

_Available since 1.4._

### `setSidebarWidthFraction`

```ts
setSidebarWidthFraction(fraction: number): void
```

Sets the preferred sidebar width as a fraction of the total width of `self`.

The preferred width is additionally limited by
`OverlaySplitView.minSidebarWidth` and
`OverlaySplitView.maxSidebarWidth`.

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

See `OverlaySplitView.minSidebarWidth` and
`OverlaySplitView.maxSidebarWidth`.

**Parameters**

- `unit`: the length unit

_Available since 1.4._
