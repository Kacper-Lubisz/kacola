---
description: "A title bar widget."
---

# AdwHeaderBar

A title bar widget.



`AdwHeaderBar` is similar to `Gtk.HeaderBar`, but provides additional
features compared to it. Refer to `GtkHeaderBar` for details. It is typically
used as a top bar within `ToolbarView`.

### Dialog Integration

When placed inside an `Dialog`, `AdwHeaderBar` will display the dialog
title instead of window title. It will also adjust the decoration layout to
ensure it always has a close button and nothing else. Set
`HeaderBar.showStartTitleButtons` and
`HeaderBar.showEndTitleButtons` to `FALSE` to remove it if it's
unwanted.

### Navigation View Integration

When placed inside an `NavigationPage`, `AdwHeaderBar` will display the
page title instead of window title.

When used together with `NavigationView` or `NavigationSplitView`,
it will also display a back button that can be used to go back to the previous
page. The button also has a context menu, allowing to pop multiple pages at
once, potentially across multiple navigation views.

Set `HeaderBar.showBackButton` to `FALSE` to disable this behavior
in rare scenarios where it's unwanted.

### Split View Integration

When placed inside `NavigationSplitView` or `OverlaySplitView`,
`AdwHeaderBar` will automatically hide the title buttons other than at the
edges of the window.

### Bottom Sheet Integration

When played inside `BottomSheet`, `AdwHeaderBar` will not show the title
unless `BottomSheet.showDragHandle` is set to `FALSE`, regardless
of `HeaderBar.showTitle`. This only applies to the default title,
titles set with `HeaderBar.titleWidget` will still be shown.

### Centering Policy

`HeaderBar.centeringPolicy` allows to enforce strict centering of
the title widget. This can be useful for entries inside `Clamp`.

### Title Buttons

Unlike `GtkHeaderBar`, `AdwHeaderBar` allows to toggle title button
visibility for each side individually, using the
`HeaderBar.showStartTitleButtons` and
`HeaderBar.showEndTitleButtons` properties.

### CSS nodes

```
headerbar
╰── windowhandle
    ╰── box
        ├── widget
        │   ╰── box.start
        │       ├── windowcontrols.start
        │       ├── widget
        │       │   ╰── [button.back]
        │       ╰── [other children]
        ├── widget
        │   ╰── [Title Widget]
        ╰── widget
            ╰── box.end
                ├── [other children]
                ╰── windowcontrols.end
```

`AdwHeaderBar`'s CSS node is called `headerbar`. It contains a `windowhandle`
subnode, which contains a `box` subnode, which contains three `widget`
subnodes at the start, center and end of the header bar. The start and end
subnodes contain a `box` subnode with the `.start` and `.end` style classes
respectively, and the center node contains a node that represents the title.

Each of the boxes contains a `windowcontrols` subnode, see
`Gtk.WindowControls` for details, as well as other children.

When `HeaderBar.showBackButton` is `TRUE`, the start box also
contains a node with the name `widget` that contains a node with the name
`button` and `.back` style class.

### Accessibility

`AdwHeaderBar` uses the `Gtk.AccessibleRole.group` role.

```tsx
import { AdwHeaderBar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwHeaderBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.HeaderBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `centeringPolicy`

`Adw.CenteringPolicy` · default `ADW_CENTERING_POLICY_LOOSE`

The policy for aligning the center widget.

### `decorationLayout`

`string` · default `null`

The decoration layout for buttons.

If this property is not set, the
`Gtk.Settings.gtkDecorationLayout` setting is used.

The format of the string is button names, separated by commas. A colon
separates the buttons that should appear at the start from those at the
end. Recognized button names are minimize, maximize, close and icon (the
window icon).

For example, “icon:minimize,maximize,close” specifies an icon at the start,
and minimize, maximize and close buttons at the end.

### `end`

`ReactNode | null`

Widgets packed at the end of the bar.

### `showBackButton`

`boolean` · default `true`

Whether the header bar can show the back button.

The back button will never be shown unless the header bar is placed inside an
`NavigationView`. Usually, there is no reason to set this to `FALSE`.

_Available since 1.4._

### `showEndTitleButtons`

`boolean` · default `true`

Whether to show title buttons at the end of the header bar.

See `HeaderBar.showStartTitleButtons` for the other side.

Which buttons are actually shown and where is determined by the
`HeaderBar.decorationLayout` property, and by the state of the
window (e.g. a close button will not be shown if the window can't be
closed).

### `showStartTitleButtons`

`boolean` · default `true`

Whether to show title buttons at the start of the header bar.

See `HeaderBar.showEndTitleButtons` for the other side.

Which buttons are actually shown and where is determined by the
`HeaderBar.decorationLayout` property, and by the state of the
window (e.g. a close button will not be shown if the window can't be
closed).

### `showTitle`

`boolean` · default `true`

Whether the title widget should be shown.

_Available since 1.4._

### `start`

`ReactNode | null`

Widgets packed at the start of the bar.

### `titleWidget`

`Gtk.Widget | ReactElement`

The title widget to display.

When set to `NULL`, the header bar will display the title of the window it
is contained in.

To use a different title, use `WindowTitle`:

```xml
<object class="AdwHeaderBar">
  <property name="title-widget">
    <object class="AdwWindowTitle">
      <property name="title" translatable="yes">Title</property>
    </object>
  </property>
</object>
```

## Methods

Methods are called on the `Adw.HeaderBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getCenteringPolicy`

```ts
getCenteringPolicy(): Adw.CenteringPolicy
```

Gets the policy for aligning the center widget.

**Returns** the centering policy

### `getDecorationLayout`

```ts
getDecorationLayout(): string | null
```

Gets the decoration layout for `self`.

**Returns** the decoration layout

### `getShowBackButton`

```ts
getShowBackButton(): boolean
```

Gets whether `self` can show the back button.

**Returns** whether to show the back button

_Available since 1.4._

### `getShowEndTitleButtons`

```ts
getShowEndTitleButtons(): boolean
```

Gets whether to show title buttons at the end of `self`.

**Returns** `TRUE` if title buttons at the end are shown

### `getShowStartTitleButtons`

```ts
getShowStartTitleButtons(): boolean
```

Gets whether to show title buttons at the start of `self`.

**Returns** `TRUE` if title buttons at the start are shown

### `getShowTitle`

```ts
getShowTitle(): boolean
```

Gets whether the title widget should be shown.

**Returns** whether the title widget should be shown.

_Available since 1.4._

### `getTitleWidget`

```ts
getTitleWidget(): Gtk.Widget | null
```

Gets the title widget widget of `self`.

**Returns** the title widget

### `packEnd`

```ts
packEnd(child: Gtk.Widget): void
```

Adds `child` to `self`, packed with reference to the end of `self`.

**Parameters**

- `child`: the widget to be added to `self`

### `packStart`

```ts
packStart(child: Gtk.Widget): void
```

Adds `child` to `self`, packed with reference to the start of the `self`.

**Parameters**

- `child`: the widget to be added to `self`

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child from `self`.

The child must have been added with `HeaderBar.packStart()`,
`HeaderBar.packEnd()` or `HeaderBar.titleWidget`.

**Parameters**

- `child`: the child to remove

### `setCenteringPolicy`

```ts
setCenteringPolicy(centeringPolicy: Adw.CenteringPolicy): void
```

Sets the policy for aligning the center widget.

**Parameters**

- `centeringPolicy`: the centering policy

### `setDecorationLayout`

```ts
setDecorationLayout(layout: string | null): void
```

Sets the decoration layout for `self`.

If this property is not set, the
`Gtk.Settings.gtkDecorationLayout` setting is used.

The format of the string is button names, separated by commas. A colon
separates the buttons that should appear at the start from those at the end.
Recognized button names are minimize, maximize, close and icon (the window
icon).

For example, “icon:minimize,maximize,close” specifies an icon at the start,
and minimize, maximize and close buttons at the end.

**Parameters**

- `layout`: a decoration layout

### `setShowBackButton`

```ts
setShowBackButton(showBackButton: boolean): void
```

Sets whether `self` can show the back button.

The back button will never be shown unless the header bar is placed inside an
`NavigationView`. Usually, there is no reason to set it to `FALSE`.

**Parameters**

- `showBackButton`: whether to show the back button

_Available since 1.4._

### `setShowEndTitleButtons`

```ts
setShowEndTitleButtons(setting: boolean): void
```

Sets whether to show title buttons at the end of `self`.

See `HeaderBar.showStartTitleButtons` for the other side.

Which buttons are actually shown and where is determined by the
`HeaderBar.decorationLayout` property, and by the state of the
window (e.g. a close button will not be shown if the window can't be closed).

**Parameters**

- `setting`: `TRUE` to show standard title buttons

### `setShowStartTitleButtons`

```ts
setShowStartTitleButtons(setting: boolean): void
```

Sets whether to show title buttons at the start of `self`.

See `HeaderBar.showEndTitleButtons` for the other side.

Which buttons are actually shown and where is determined by the
`HeaderBar.decorationLayout` property, and by the state of the
window (e.g. a close button will not be shown if the window can't be closed).

**Parameters**

- `setting`: `TRUE` to show standard title buttons

### `setShowTitle`

```ts
setShowTitle(showTitle: boolean): void
```

Sets whether the title widget should be shown.

**Parameters**

- `showTitle`: whether the title widget is visible

_Available since 1.4._

### `setTitleWidget`

```ts
setTitleWidget(titleWidget: Gtk.Widget | null): void
```

Sets the title widget for `self`.

When set to `NULL`, the header bar will display the title of the window it
is contained in.

To use a different title, use `WindowTitle`:

```xml
<object class="AdwHeaderBar">
  <property name="title-widget">
    <object class="AdwWindowTitle">
      <property name="title" translatable="yes">Title</property>
    </object>
  </property>
</object>
```

**Parameters**

- `titleWidget`: a widget to use for a title
