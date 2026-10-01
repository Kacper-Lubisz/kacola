---
description: "An adaptive view switcher."
---

# AdwViewSwitcher

An adaptive view switcher.



An adaptive view switcher designed to switch between multiple views
contained in a `ViewStack` in a similar fashion to
`Gtk.StackSwitcher`.

`AdwViewSwitcher` buttons always have an icon and a label. They can be
displayed side by side, or icon on top of the label. This can be controlled
via the `ViewSwitcher.policy` property.

`AdwViewSwitcher` is intended to be used in a header bar together with
`ViewSwitcherBar` at the bottom of the window, and a `Breakpoint`
showing the view switcher bar on narrow sizes, while removing the view
switcher from the header bar, as follows:

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

`AdwViewSwitcher` has a single CSS node with name `viewswitcher`. It can have
the style classes `.wide` and `.narrow`, matching its policy.

### Accessibility

`AdwViewSwitcher` uses the `Gtk.AccessibleRole.tab-list` role and the
`Gtk.AccessibleRole.tab` role for its buttons.

See also: `ViewSwitcherBar`, `InlineViewSwitcher`,
`ViewSwitcherSidebar`.

```tsx
import { AdwViewSwitcher } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **AdwViewSwitcher**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Adw.ViewSwitcher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `policy`

`Adw.ViewSwitcherPolicy` · default `ADW_VIEW_SWITCHER_POLICY_NARROW`

The policy to determine which mode to use.

### `stack`

`Adw.ViewStack | ReactElement`

The stack the view switcher controls.

## Methods

Methods are called on the `Adw.ViewSwitcher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `getPolicy`

```ts
getPolicy(): Adw.ViewSwitcherPolicy
```

Gets the policy of `self`.

**Returns** the policy of `self`

### `getStack`

```ts
getStack(): Adw.ViewStack | null
```

Gets the stack controlled by `self`.

**Returns** the stack

### `setPolicy`

```ts
setPolicy(policy: Adw.ViewSwitcherPolicy): void
```

Sets the policy of `self`.

**Parameters**

- `policy`: the new policy

### `setStack`

```ts
setStack(stack: Adw.ViewStack | null): void
```

Sets the stack controlled by `self`.

**Parameters**

- `stack`: a stack
