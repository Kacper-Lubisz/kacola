---
description: "A dialog that displays application's keyboard shortcuts."
---

# AdwShortcutsDialog

A dialog that displays application's keyboard shortcuts.



Shortcuts are grouped into sections, represented by `ShortcutsSection`
objects. Each section has one or more items, represented by
`ShortcutsItem` objects.

To add a section to the dialog, use `ShortcutsDialog.add()`, or add it
as a child when using UI files.

Sections without titles can be used to further subdivide each section into
groups.

Example of an `AdwShortcutsDialog` UI definition:

```xml
<object class="AdwShortcutsDialog" id="shortcuts_dialog">
  <child>
    <object class="AdwShortcutsSection">
      <property name="title" translatable="yes">General</property>
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Open Menu</property>
          <property name="accelerator">F10</property>
        </object>
      </child>
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Quit</property>
          <property name="action-name">app.quit</property>
        </object>
      </child>
    </object>
  </child>
  <child>
    <object class="AdwShortcutsSection">
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Move Tab Left</property>
          <property name="accelerator">&lt;Shift&gt;&lt;Ctrl&gt;Page_Up</property>
          <property name="direction">ltr</property>
        </object>
      </child>
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Move Tab Right</property>
          <property name="accelerator">&lt;Shift&gt;&lt;Ctrl&gt;Page_Down</property>
          <property name="direction">ltr</property>
        </object>
      </child>
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Move Tab Right</property>
          <property name="accelerator">&lt;Shift&gt;&lt;Ctrl&gt;Page_Up</property>
          <property name="direction">rtl</property>
        </object>
      </child>
      <child>
        <object class="AdwShortcutsItem">
          <property name="title" translatable="yes">Move Tab Left</property>
          <property name="accelerator">&lt;Shift&gt;&lt;Ctrl&gt;Page_Down</property>
          <property name="direction">rtl</property>
        </object>
      </child>
    </object>
  </child>
</object>
```

If the `app.quit` action has the <kbd>Ctrl</kbd><kbd>Q</kbd> accelerator
associated with it, the result will look as follows:



The recommended way to use `AdwShortcutsDialog` is via `Application`'s
automatic resource loading.

See also: `ShortcutLabel`.

_Available since 1.8._

```tsx
import { AdwShortcutsDialog } from "@gtkx/jsx/adw";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [AdwDialog](.gtkx/reference/adw/dialog.md) → **AdwShortcutsDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkShortcutManager`.

## Props

`ref` receives the `Adw.ShortcutsDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `children`

`ReactNode`

Elements attached to the element's default child slot, or its text for elements that hold text.

## Methods

Methods are called on the `Adw.ShortcutsDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/adw`. Methods inherited from ancestors are documented on their own pages.

### `add`

```ts
add(section: Adw.ShortcutsSection): void
```

Adds `section` to `self`.

**Parameters**

- `section`: the section to add

_Available since 1.8._
