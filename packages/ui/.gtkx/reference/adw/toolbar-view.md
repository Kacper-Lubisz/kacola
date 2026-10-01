---
description: "A widget containing a page, as well as top and/or bottom bars."
---

# AdwToolbarView

A widget containing a page, as well as top and/or bottom bars.



`AdwToolbarView` has a single content widget and one or multiple top and
bottom bars, shown at the top and bottom sides respectively.

Example of an `AdwToolbarView` UI definition:
```xml
<object class="AdwToolbarView">
  <child type="top">
    <object class="AdwHeaderBar"/>
  </child>
  <property name="content">
    <object class="AdwPreferencesPage">
      <!-- ... -->
    </object>
  </property>
</object>
```

The following kinds of top and bottom bars are supported:

- `HeaderBar`
- `TabBar`
- `ViewSwitcherBar`
- `Gtk.ActionBar`
- `Gtk.HeaderBar`
- `Gtk.PopoverMenuBar`
- `Gtk.SearchBar`
- Any `Gtk.Box` or a similar widget with the
  [`.toolbar`](style-classes.html#toolbars) style class

By default, top and bottom bars are flat and scrolling content has a subtle
undershoot shadow, same as when using the
[`.undershoot-top`](style-classes.html#undershoot-indicators) and
[`.undershoot-bottom`](style-classes.html#undershoot-indicators) style
classes. This works well in most cases, e.g. with `StatusPage` or
`PreferencesPage`, where the background at the top and bottom parts of
the page is uniform. Additionally, windows with sidebars should always use
this style.

`ToolbarView.topBarStyle` and
`ToolbarView.bottomBarStyle` properties can be used add an opaque
background and a persistent shadow to top and bottom bars, this can be useful
for content such as [utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html),
where some elements are adjacent to the top/bottom bars, or `TabView`,
where each page can have a different background.





`AdwToolbarView` ensures the top and bottom bars have consistent backdrop
styles and vertical spacing. For comparison:




Any top and bottom bars can also be dragged to move the window, equivalent
to putting them into a `Gtk.WindowHandle`.

Content is typically place between top and bottom bars, but can also extend
behind them. This is controlled with the
`ToolbarView.extendContentToTopEdge` and
`ToolbarView.extendContentToBottomEdge` properties.

Top and bottom bars can be hidden and revealed with an animation using the
`ToolbarView.revealTopBars` and
`ToolbarView.revealBottomBars` properties.

### `AdwToolbarView` as `GtkBuildable`

The `AdwToolbarView` implementation of the `Gtk.Buildable` interface
supports adding a top bar by specifying “top” as the “type” attribute of a
`<child>` element, or adding a bottom bar by specifying “bottom”.

### Accessibility

`AdwToolbarView` uses the `Gtk.AccessibleRole.group` role.

_Available since 1.4._

```tsx
import { AdwToolbarView } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwToolbarView**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ToolbarView` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `bottomBar`

`ReactNode | null`

Widgets stacked below the content.

### `bottomBarHeight`

`number` · default `0` · read-only, observe with `onNotifyBottomBarHeight`

The current bottom bar height.

Bottom bar height does change depending on
`ToolbarView.revealBottomBars`, including during the transition.

See `ToolbarView.topBarHeight`.

_Available since 1.4._

### `bottomBarStyle`

`Adw.ToolbarStyle` · default `ADW_TOOLBAR_FLAT`

Appearance of the bottom bars.

If set to `Adw.ToolbarStyle.flat`, bottom bars are flat and scrolling
content has a subtle undershoot shadow when touching them, same as the
[`.undershoot-bottom`](style-classes.html#undershoot-indicators)
style class. This works well for simple content, e.g. `StatusPage` or
`PreferencesPage`, where the background at the bottom of the page is
uniform. Additionally, windows with sidebars should always use this style.

Undershoot shadow is only present if a bottom bar is actually present and
visible. It is also never present if
`ToolbarView.extendContentToBottomEdge` is set to `TRUE`.

If set to `Adw.ToolbarStyle.raised`, bottom bars have an opaque
background and a persistent shadow, this is suitable for content such as
[utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html),
where some elements are directly adjacent to the bottom bars, or
`TabView`, where each page can have a different background.

`Adw.ToolbarStyle.raised-border` is similar to
`Adw.ToolbarStyle.raised`, but the shadow is replaced with a more
subtle border. This can be useful for applications like image viewers.

See also `ToolbarView.topBarStyle`.

_Available since 1.4._

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `extendContentToBottomEdge`

`boolean` · default `false`

Whether the content widget can extend behind bottom bars.

This can be used in combination with
`ToolbarView.revealBottomBars` to show and hide toolbars in
fullscreen.

See `ToolbarView.extendContentToTopEdge`.

_Available since 1.4._

### `extendContentToTopEdge`

`boolean` · default `false`

Whether the content widget can extend behind top bars.

This can be used in combination with `ToolbarView.revealTopBars`
to show and hide toolbars in fullscreen.

See `ToolbarView.extendContentToBottomEdge`.

_Available since 1.4._

### `revealBottomBars`

`boolean` · default `true`

Whether bottom bars are visible.

The transition will be animated.

This can be used in combination with
`ToolbarView.extendContentToBottomEdge` to show and hide
toolbars in fullscreen.

See `ToolbarView.revealTopBars`.

_Available since 1.4._

### `revealTopBars`

`boolean` · default `true`

Whether top bars are revealed.

The transition will be animated.

This can be used in combination with
`ToolbarView.extendContentToTopEdge` to show and hide toolbars
in fullscreen.

See `ToolbarView.revealBottomBars`.

_Available since 1.4._

### `topBar`

`ReactNode | null`

Widgets stacked above the content.

### `topBarHeight`

`number` · default `0` · read-only, observe with `onNotifyTopBarHeight`

The current top bar height.

Top bar height does change depending `ToolbarView.revealTopBars`,
including during the transition.

See `ToolbarView.bottomBarHeight`.

_Available since 1.4._

### `topBarStyle`

`Adw.ToolbarStyle` · default `ADW_TOOLBAR_FLAT`

Appearance of the top bars.

If set to `Adw.ToolbarStyle.flat`, top bars are flat and scrolling
content has a subtle undershoot shadow when touching them, same as the
[`.undershoot-top`](style-classes.html#undershoot-indicators)
style class. This works well for simple content, e.g. `StatusPage` or
`PreferencesPage`, where the background at the top of the page is
uniform. Additionally, windows with sidebars should always use this style.

Undershoot shadow is only present if a top bar is actually present and
visible. It is also never present if
`ToolbarView.extendContentToTopEdge` is set to `TRUE`.

If set to `Adw.ToolbarStyle.raised`, top bars have an opaque
background and a persistent shadow, this is suitable for content such as
[utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html),
where some elements are directly adjacent to the top bars, or
`TabView`, where each page can have a different background.

`Adw.ToolbarStyle.raised-border` is similar to
`Adw.ToolbarStyle.raised`, but the shadow is replaced with a more
subtle border. This can be useful for applications like image viewers.

See also `ToolbarView.bottomBarStyle`.

_Available since 1.4._

## Methods

Methods are called on the `Adw.ToolbarView` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `addBottomBar`

```ts
addBottomBar(widget: Gtk.Widget): void
```

Adds a bottom bar to `self`.

**Parameters**

- `widget`: a widget

_Available since 1.4._

### `addTopBar`

```ts
addTopBar(widget: Gtk.Widget): void
```

Adds a top bar to `self`.

**Parameters**

- `widget`: a widget

_Available since 1.4._

### `getBottomBarHeight`

```ts
getBottomBarHeight(): number
```

Gets the current bottom bar height for `self`.

Bottom bar height does change depending on
`ToolbarView.revealBottomBars`, including during the transition.

See `ToolbarView.getTopBarHeight()`.

**Returns** the current bottom bar height

_Available since 1.4._

### `getBottomBarStyle`

```ts
getBottomBarStyle(): Adw.ToolbarStyle
```

Gets appearance of the bottom bars for `self`.

**Returns** bottom bar style

_Available since 1.4._

### `getContent`

```ts
getContent(): Gtk.Widget | null
```

Gets the content widget for `self`.

**Returns** the content widget

_Available since 1.4._

### `getExtendContentToBottomEdge`

```ts
getExtendContentToBottomEdge(): boolean
```

Gets whether the content widget can extend behind bottom bars.

**Returns** whether content extends behind bottom bars

_Available since 1.4._

### `getExtendContentToTopEdge`

```ts
getExtendContentToTopEdge(): boolean
```

Gets whether the content widget can extend behind top bars.

**Returns** whether content extends behind top bars

_Available since 1.4._

### `getRevealBottomBars`

```ts
getRevealBottomBars(): boolean
```

Gets whether bottom bars are revealed for `self`.

**Returns** whether bottom bars are revealed

_Available since 1.4._

### `getRevealTopBars`

```ts
getRevealTopBars(): boolean
```

Gets whether top bars are revealed for `self`.

**Returns** whether top bars are revealed

_Available since 1.4._

### `getTopBarHeight`

```ts
getTopBarHeight(): number
```

Gets the current top bar height for `self`.

Top bar height does change depending on
`ToolbarView.revealTopBars`, including during the transition.

See `ToolbarView.getBottomBarHeight()`.

**Returns** the current top bar height

_Available since 1.4._

### `getTopBarStyle`

```ts
getTopBarStyle(): Adw.ToolbarStyle
```

Gets appearance of the top bars for `self`.

**Returns** top bar style

_Available since 1.4._

### `remove`

```ts
remove(widget: Gtk.Widget): void
```

Removes a child from `self`.

**Parameters**

- `widget`: the child to be removed

_Available since 1.4._

### `setBottomBarStyle`

```ts
setBottomBarStyle(style: Adw.ToolbarStyle): void
```

Sets appearance of the bottom bars for `self`.

If set to `Adw.ToolbarStyle.flat`, bottom bars are flat and scrolling
content has a subtle undershoot shadow when touching them, same as the
[`.undershoot-bottom`](style-classes.html#undershoot-indicators)
style class. This works well for simple content, e.g. `StatusPage` or
`PreferencesPage`, where the background at the bottom of the page is
uniform. Additionally, windows with sidebars should always use this style.

Undershoot shadow is only present if a bottom bar is actually present and
visible. It is also never present if
`ToolbarView.extendContentToBottomEdge` is set to `TRUE`.

If set to `Adw.ToolbarStyle.raised`, bottom bars have an opaque
background and a persistent shadow, this is suitable for content such as
[utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html),
where some elements are directly adjacent to the bottom bars, or
`TabView`, where each page can have a different background.

`Adw.ToolbarStyle.raised-border` is similar to
`Adw.ToolbarStyle.raised`, but the shadow is replaced with a more subtle
border. This can be useful for applications like image viewers.

See also `ToolbarView.setTopBarStyle()`.

**Parameters**

- `style`: bottom bar style

_Available since 1.4._

### `setContent`

```ts
setContent(content: Gtk.Widget | null): void
```

Sets the content widget for `self`.

**Parameters**

- `content`: the content widget

_Available since 1.4._

### `setExtendContentToBottomEdge`

```ts
setExtendContentToBottomEdge(extend: boolean): void
```

Sets whether the content widget can extend behind bottom bars.

This can be used in combination with `ToolbarView.revealBottomBars`
to show and hide toolbars in fullscreen.

See `ToolbarView.setExtendContentToTopEdge()`.

**Parameters**

- `extend`: whether content extends behind bottom bars

_Available since 1.4._

### `setExtendContentToTopEdge`

```ts
setExtendContentToTopEdge(extend: boolean): void
```

Sets whether the content widget can extend behind top bars.

This can be used in combination with `ToolbarView.revealTopBars`
to show and hide toolbars in fullscreen.

See `ToolbarView.setExtendContentToBottomEdge()`.

**Parameters**

- `extend`: whether content extends behind top bars

_Available since 1.4._

### `setRevealBottomBars`

```ts
setRevealBottomBars(reveal: boolean): void
```

Sets whether bottom bars are revealed for `self`.

The transition will be animated.

This can be used in combination with
`ToolbarView.extendContentToBottomEdge` to show and hide
toolbars in fullscreen.

See `ToolbarView.setRevealTopBars()`.

**Parameters**

- `reveal`: whether to reveal bottom bars

_Available since 1.4._

### `setRevealTopBars`

```ts
setRevealTopBars(reveal: boolean): void
```

Sets whether top bars are revealed for `self`.

The transition will be animated.

This can be used in combination with
`ToolbarView.extendContentToTopEdge` to show and hide toolbars
in fullscreen.

See `ToolbarView.setRevealBottomBars()`.

**Parameters**

- `reveal`: whether to reveal top bars

_Available since 1.4._

### `setTopBarStyle`

```ts
setTopBarStyle(style: Adw.ToolbarStyle): void
```

Sets appearance of the top bars for `self`.

If set to `Adw.ToolbarStyle.flat`, top bars are flat and scrolling
content has a subtle undershoot shadow when touching them, same as the
[`.undershoot-top`](style-classes.html#undershoot-indicators)
style class. This works well for simple content, e.g. `StatusPage` or
`PreferencesPage`, where the background at the top of the page is
uniform. Additionally, windows with sidebars should always use this style.

Undershoot shadow is only present if a top bar is actually present and
visible. It is also never present if
`ToolbarView.extendContentToTopEdge` is set to `TRUE`.

If set to `Adw.ToolbarStyle.raised`, top bars have an opaque background
and a persistent shadow, this is suitable for content such as
[utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html),
where some elements are directly adjacent to the top bars, or
`TabView`, where each page can have a different background.

`Adw.ToolbarStyle.raised-border` is similar to
`Adw.ToolbarStyle.raised`, but the shadow is replaced with a more subtle
border. This can be useful for applications like image viewers.

See also `ToolbarView.setBottomBarStyle()`.

**Parameters**

- `style`: top bar style

_Available since 1.4._
