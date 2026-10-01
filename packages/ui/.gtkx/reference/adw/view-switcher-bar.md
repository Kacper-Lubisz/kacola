---
description: "A view switcher action bar."
---

# AdwViewSwitcherBar

A view switcher action bar.



An action bar letting you switch between multiple views contained in a
`ViewStack`, via an `ViewSwitcher`. It is designed to be put at
the bottom of a window and to be revealed only on really narrow windows, e.g.
on mobile phones. It can't be revealed if there are less than two pages.

`AdwViewSwitcherBar` is intended to be used together with
`AdwViewSwitcher` in a header bar, and a `Breakpoint` showing the view
switcher bar on narrow sizes, while removing the view switcher from the
header bar, as follows:

```xml
<object class="AdwWindow">
  <child>
    <object class="AdwBreakpoint">
      <condition>max-width: 550sp</condition>
      <setter object="switcher_bar" property="reveal">True</setter>
      <setter object="header_bar" property="title-widget"/>
    </object>
  </child>
  <property name="content">
    <object class="AdwToolbarView">
      <child type="top">
        <object class="AdwHeaderBar" id="header_bar">
          <property name="title-widget">
            <object class="AdwViewSwitcher">
              <property name="stack">stack</property>
              <property name="policy">wide</property>
            </object>
          </property>
        </object>
      </child>
      <property name="content">
        <object class="AdwViewStack" id="stack"/>
      </property>
      <child type="bottom">
        <object class="AdwViewSwitcherBar" id="switcher_bar">
          <property name="stack">stack</property>
        </object>
      </child>
    </object>
  </property>
</object>
```

It's recommended to set `ViewSwitcher.policy` to
`Adw.ViewSwitcherPolicy.wide` in this case.

You may have to adjust the breakpoint condition for your specific pages.

### CSS nodes

`AdwViewSwitcherBar` has a single CSS node with name` viewswitcherbar`.

See also: `ViewSwitcher`, `InlineViewSwitcher`,
`ViewSwitcherSidebar`.

```tsx
import { AdwViewSwitcherBar } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwViewSwitcherBar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ViewSwitcherBar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `reveal`

`boolean` · default `false`

Whether the bar should be revealed or hidden.

### `stack`

`Adw.ViewStack | ReactElement`

The stack the view switcher controls.

## Methods

Methods are called on the `Adw.ViewSwitcherBar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getReveal`

```ts
getReveal(): boolean
```

Gets whether `self` should be revealed or hidden.

**Returns** whether `self` is revealed

### `getStack`

```ts
getStack(): Adw.ViewStack | null
```

Gets the stack controlled by `self`.

**Returns** the stack

### `setReveal`

```ts
setReveal(reveal: boolean): void
```

Sets whether `self` should be revealed or hidden.

**Parameters**

- `reveal`: whether to reveal `self`

### `setStack`

```ts
setStack(stack: Adw.ViewStack | null): void
```

Sets the stack controlled by `self`.

**Parameters**

- `stack`: a stack
