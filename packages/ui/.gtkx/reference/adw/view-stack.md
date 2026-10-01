---
description: "A view container for ViewSwitcher."
---

# AdwViewStack

A view container for `ViewSwitcher`.

`AdwViewStack` is a container which only shows one page at a time.
It is typically used to hold an application's main views.

It doesn't provide a way to transition between pages.
Instead, a separate widget such as `ViewSwitcher`,
`InlineViewSwitcher` or `ViewSwitcherSidebar` can be used with
`AdwViewStack` to provide this functionality.

`AdwViewStack` pages can have a title, an icon, an attention request, and a
numbered badge that `ViewSwitcher` will use to let users identify which
page is which. Set them using the `ViewStackPage.title`,
`ViewStackPage.iconName`,
`ViewStackPage.needsAttention`, and
`ViewStackPage.badgeNumber` properties.

`AdwViewStack` pages can also be grouped into sections, using the
`ViewStackPage.startsSection` and
`ViewStackPage.sectionTitle` properties. Currently, only
`ViewSwitcherSidebar` displays groups.

Unlike `Gtk.Stack`, transitions between views can only be animated via
a crossfade and size changes are always interpolated. Animations are disabled
by default. Use `ViewStack.enableTransitions` to enable them.

`AdwViewStack` maintains a `ViewStackPage` object for each added child,
which holds additional per-child properties. You obtain the
`ViewStackPage` for a child with `ViewStack.getPage()` and you
can obtain a `Gtk.SelectionModel` containing all the pages with
`ViewStack.getPages()`.

### AdwViewStack as GtkBuildable

To set child-specific properties in a .ui file, create
`ViewStackPage` objects explicitly, and set the child widget as a
property on it:

```xml
  <object class="AdwViewStack" id="stack">
    <child>
      <object class="AdwViewStackPage">
        <property name="name">overview</property>
        <property name="title">Overview</property>
        <property name="child">
          <object class="AdwStatusPage">
            <property name="title">Welcome!</property>
          </object>
        </property>
      </object>
    </child>
  </object>
```

### CSS nodes

`AdwViewStack` has a single CSS node named `stack`.

### Accessibility

`AdwViewStack` uses the `Gtk.AccessibleRole.tab-panel` for the stack
pages which are the accessible parent objects of the child widgets.

```tsx
import { AdwViewStack } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwViewStack**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ViewStack` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

### `enableTransitions`

`boolean` · default `false`

Whether the stack uses a crossfade transition between pages.

Use `ViewStack.transitionDuration` to control the duration, and
`ViewStack.transitionRunning` to know when the transition is
running.

_Available since 1.7._

### `hhomogeneous`

`boolean` · default `true`

Whether the stack is horizontally homogeneous.

If the stack is horizontally homogeneous, it allocates the same width for
all children.

If it's `FALSE`, the stack may change width when a different child becomes
visible.

### `pages`

`Gtk.SelectionModel` · read-only, observe with `onNotifyPages`

A selection model with the stack's pages.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel` and creates sections based on
`ViewStackPage.startsSection` values.

The model also implements `Gtk.SelectionModel` and can be used to
track and change the visible page.

### `transitionDuration`

`number` · default `200`

The transition animation duration, in milliseconds.

Only used when `ViewStack.enableTransitions` is set to `TRUE`.

_Available since 1.7._

### `transitionRunning`

`boolean` · default `false` · read-only, observe with `onNotifyTransitionRunning`

Whether a transition is currently running.

If a transition is impossible, the property value will be set to `TRUE` and
then immediately to `FALSE`, so it's possible to rely on its notifications
to know that a transition has happened.

_Available since 1.7._

### `vhomogeneous`

`boolean` · default `true`

Whether the stack is vertically homogeneous.

If the stack is vertically homogeneous, it allocates the same height for
all children.

If it's `FALSE`, the stack may change height when a different child becomes
visible.

### `visibleChild`

`Gtk.Widget | ReactElement`

The widget currently visible in the stack.

### `visibleChildName`

`string` · default `null`

The name of the widget currently visible in the stack.

See `ViewStack.visibleChild`.

## Methods

Methods are called on the `Adw.ViewStack` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(child: Gtk.Widget): Adw.ViewStackPage
```

Adds a child to `self`.

**Parameters**

- `child`: the widget to add

**Returns** the `ViewStackPage` for `child`

### `addNamed`

```ts
addNamed(child: Gtk.Widget, name: string | null): Adw.ViewStackPage
```

Adds a child to `self`.

The child is identified by the `name`.

**Parameters**

- `child`: the widget to add
- `name`: the name for `child`

**Returns** the `AdwViewStackPage` for `child`

### `addTitled`

```ts
addTitled(child: Gtk.Widget, name: string | null, title: string): Adw.ViewStackPage
```

Adds a child to `self`.

The child is identified by the `name`. The `title` will be used by
`ViewSwitcher` to represent `child`, so it should be short.

**Parameters**

- `child`: the widget to add
- `name`: the name for `child`
- `title`: a human-readable title for `child`

**Returns** the `AdwViewStackPage` for `child`

### `addTitledWithIcon`

```ts
addTitledWithIcon(child: Gtk.Widget, name: string | null, title: string, iconName: string): Adw.ViewStackPage
```

Adds a child to `self`.

The child is identified by the `name`. The `title` and `icon_name` will be used
by `ViewSwitcher` to represent `child`.

**Parameters**

- `child`: the widget to add
- `name`: the name for `child`
- `title`: a human-readable title for `child`
- `iconName`: an icon name for `child`

**Returns** the `AdwViewStackPage` for `child`

_Available since 1.2._

### `getChildByName`

```ts
getChildByName(name: string): Gtk.Widget | null
```

Finds the child with `name` in `self`.

**Parameters**

- `name`: the name of the child to find

**Returns** the requested child

### `getEnableTransitions`

```ts
getEnableTransitions(): boolean
```

Gets whether `self` uses a crossfade transition between pages.

Use `ViewStack.transitionDuration` to control the duration, and
`ViewStack.transitionRunning` to know when the transition is
running.

**Returns** whether to enable page transitions

_Available since 1.7._

### `getHhomogeneous`

```ts
getHhomogeneous(): boolean
```

Gets whether `self` is horizontally homogeneous.

**Returns** whether `self` is horizontally homogeneous

### `getPage`

```ts
getPage(child: Gtk.Widget): Adw.ViewStackPage
```

Gets the `ViewStackPage` object for `child`.

**Parameters**

- `child`: a child of `self`

**Returns** the page object for `child`

### `getPages`

```ts
getPages(): Gtk.SelectionModel
```

Returns a `Gio.ListModel` that contains the pages of the stack.

This can be used to keep an up-to-date view.

The model implements `Gtk.SectionModel` and creates sections based on
`ViewStackPage.startsSection` values.

The model also implements `Gtk.SelectionModel` and can be used to track
and change the visible page.

**Returns** a `GtkSelectionModel` for the stack's children

### `getTransitionDuration`

```ts
getTransitionDuration(): number
```

Gets the transition animation duration for `self`.

**Returns** the transition duration, in milliseconds

_Available since 1.7._

### `getTransitionRunning`

```ts
getTransitionRunning(): boolean
```

Gets whether a transition is currently running for `self`.

If a transition is impossible, the property value will be set to `TRUE` and
then immediately to `FALSE`, so it's possible to rely on its notifications
to know that a transition has happened.

**Returns** whether a transition is currently running

_Available since 1.7._

### `getVhomogeneous`

```ts
getVhomogeneous(): boolean
```

Gets whether `self` is vertically homogeneous.

**Returns** whether `self` is vertically homogeneous

### `getVisibleChild`

```ts
getVisibleChild(): Gtk.Widget | null
```

Gets the currently visible child of `self`.

**Returns** the visible child

### `getVisibleChildName`

```ts
getVisibleChildName(): string | null
```

Returns the name of the currently visible child of `self`.

**Returns** the name of the visible child

### `remove`

```ts
remove(child: Gtk.Widget): void
```

Removes a child widget from `self`.

**Parameters**

- `child`: the child to remove

### `setEnableTransitions`

```ts
setEnableTransitions(enableTransitions: boolean): void
```

Sets whether `self` uses a crossfade transition between pages.

**Parameters**

- `enableTransitions`: whether to enable page transitions

_Available since 1.7._

### `setHhomogeneous`

```ts
setHhomogeneous(hhomogeneous: boolean): void
```

Sets `self` to be horizontally homogeneous or not.

If the stack is horizontally homogeneous, it allocates the same width for
all children.

If it's `FALSE`, the stack may change width when a different child becomes
visible.

**Parameters**

- `hhomogeneous`: whether to make `self` horizontally homogeneous

### `setTransitionDuration`

```ts
setTransitionDuration(duration: number): void
```

Sets the transition animation duration for `self`.

Only used when `ViewStack.enableTransitions` is set to `TRUE`.

**Parameters**

- `duration`: the new duration, in milliseconds

_Available since 1.7._

### `setVhomogeneous`

```ts
setVhomogeneous(vhomogeneous: boolean): void
```

Sets `self` to be vertically homogeneous or not.

If the stack is vertically homogeneous, it allocates the same height for
all children.

If it's `FALSE`, the stack may change height when a different child becomes
visible.

**Parameters**

- `vhomogeneous`: whether to make `self` vertically homogeneous

### `setVisibleChild`

```ts
setVisibleChild(child: Gtk.Widget): void
```

Makes `child` the visible child of `self`.

**Parameters**

- `child`: a child of `self`

### `setVisibleChildName`

```ts
setVisibleChildName(name: string): void
```

Makes the child with `name` visible.

See `ViewStack.visibleChild`.

**Parameters**

- `name`: the name of the child
