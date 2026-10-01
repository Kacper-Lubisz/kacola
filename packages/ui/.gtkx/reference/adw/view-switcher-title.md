---
description: "A view switcher title."
---

# AdwViewSwitcherTitle

A view switcher title.



A widget letting you switch between multiple views contained by a
`ViewStack` via an `ViewSwitcher`.

It is designed to be used as the title widget of a `HeaderBar`, and
will display the window's title when the window is too narrow to fit the view
switcher e.g. on mobile phones, or if there are less than two views.

In order to center the title in narrow windows, the header bar should have
`HeaderBar.centeringPolicy` set to
`Adw.CenteringPolicy.strict`.

`AdwViewSwitcherTitle` is intended to be used together with
`ViewSwitcherBar`.

A common use case is to bind the `ViewSwitcherBar.reveal` property
to `ViewSwitcherTitle.titleVisible` to automatically reveal the
view switcher bar when the title label is displayed in place of the view
switcher, as follows:

```xml
<object class="AdwWindow">
  <property name="content">
    <object class="AdwToolbarView">
      <child type="top">
        <object class="AdwHeaderBar">
          <property name="centering-policy">strict</property>
          <property name="title-widget">
            <object class="AdwViewSwitcherTitle" id="title">
              <property name="stack">stack</property>
            </object>
          </property>
        </object>
      </child>
      <property name="content">
        <object class="AdwViewStack" id="stack"/>
      </property>
      <child type="bottom">
        <object class="AdwViewSwitcherBar">
          <property name="stack">stack</property>
          <binding name="reveal">
            <lookup name="title-visible">title</lookup>
          </binding>
        </object>
      </child>
    </object>
  </property>
</object>
```

### CSS nodes

`AdwViewSwitcherTitle` has a single CSS node with name `viewswitchertitle`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

```tsx
import { AdwViewSwitcherTitle } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwViewSwitcherTitle**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ViewSwitcherTitle` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `stack`

`Adw.ViewStack | ReactElement` · deprecated since 1.4

The stack the view switcher controls.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `subtitle`

`string` · deprecated since 1.4

The subtitle to display.

The subtitle should give the user additional details.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `title`

`string` · deprecated since 1.4

The title to display.

The title typically identifies the current view or content item, and
generally does not use the application name.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `titleVisible`

`boolean` · default `true` · read-only, observe with `onNotifyTitleVisible` · deprecated since 1.4

Whether the title is currently visible.

If the title is visible, it means the view switcher is hidden an it may be
wanted to show an alternative switcher, e.g. a `ViewSwitcherBar`.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `viewSwitcherEnabled`

`boolean` · default `true` · deprecated since 1.4

Whether the view switcher is enabled.

If it is disabled, the title will be displayed instead. This allows to
programmatically hide the view switcher even if it fits in the available
space.

This can be used e.g. to ensure the view switcher is hidden below a certain
window width, or any other constraint you find suitable.

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

## Methods

Methods are called on the `Adw.ViewSwitcherTitle` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getStack`

```ts
getStack(): Adw.ViewStack | null
```

Gets the stack controlled by `self`.

**Returns** the stack

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `getSubtitle`

```ts
getSubtitle(): string
```

Gets the subtitle of `self`.

**Returns** the subtitle

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `getTitle`

```ts
getTitle(): string
```

Gets the title of `self`.

**Returns** the title

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `getTitleVisible`

```ts
getTitleVisible(): boolean
```

Gets whether the title of `self` is currently visible.

If the title is visible, it means the view switcher is hidden an it may be
wanted to show an alternative switcher, e.g. a `ViewSwitcherBar`.

**Returns** whether the title of `self` is currently visible

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `getViewSwitcherEnabled`

```ts
getViewSwitcherEnabled(): boolean
```

Gets whether `self`'s view switcher is enabled.

**Returns** whether the view switcher is enabled

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `setStack`

```ts
setStack(stack: Adw.ViewStack | null): void
```

Sets the stack controlled by `self`.

**Parameters**

- `stack`: a stack

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `setSubtitle`

```ts
setSubtitle(subtitle: string): void
```

Sets the subtitle of `self`.

The subtitle should give the user additional details.

**Parameters**

- `subtitle`: a subtitle

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `setTitle`

```ts
setTitle(title: string): void
```

Sets the title of `self`.

The title typically identifies the current view or content item, and
generally does not use the application name.

**Parameters**

- `title`: a title

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)

### `setViewSwitcherEnabled`

```ts
setViewSwitcherEnabled(enabled: boolean): void
```

Sets whether `self`'s view switcher is enabled.

If it is disabled, the title will be displayed instead. This allows to
programmatically hide the view switcher even if it fits in the available
space.

This can be used e.g. to ensure the view switcher is hidden below a certain
window width, or any other constraint you find suitable.

**Parameters**

- `enabled`: whether the view switcher is enabled

> **Deprecated since 1.4.** See [the migration guide](migrating-to-breakpoints.html#replace-adwviewswitchertitle)
