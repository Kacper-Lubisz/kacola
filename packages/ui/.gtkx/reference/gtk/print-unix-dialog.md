---
description: "A print dialog for platforms which don’t provide a native print dialog, like Unix."
---

# GtkPrintUnixDialog

A print dialog for platforms which don’t provide a native
print dialog, like Unix.



It can be used very much like any other GTK dialog, at the cost of
the portability offered by the high-level printing API with
`Gtk.PrintOperation`.

In order to print something with `GtkPrintUnixDialog`, you need to
use `Gtk.PrintUnixDialog.getSelectedPrinter()` to obtain a
`Gtk.Printer` object and use it to construct a `Gtk.PrintJob`
using `Gtk.PrintJob.new()`.

`GtkPrintUnixDialog` uses the following response values:

- `GTK_RESPONSE_OK`: for the “Print” button
- `GTK_RESPONSE_APPLY`: for the “Preview” button
- `GTK_RESPONSE_CANCEL`: for the “Cancel” button

## GtkPrintUnixDialog as GtkBuildable

The `GtkPrintUnixDialog` implementation of the `GtkBuildable` interface
exposes its `notebook` internal children with the name “notebook”.

An example of a `GtkPrintUnixDialog` UI definition fragment:

```xml
<object class="GtkPrintUnixDialog" id="dialog1">
  <child internal-child="notebook">
    <object class="GtkNotebook" id="notebook">
      <child>
        <object type="GtkNotebookPage">
          <property name="tab_expand">False</property>
          <property name="tab_fill">False</property>
          <property name="tab">
            <object class="GtkLabel" id="tablabel">
              <property name="label">Tab label</property>
            </object>
          </property>
          <property name="child">
            <object class="GtkLabel" id="tabcontent">
              <property name="label">Content on notebook tab</property>
            </object>
          </property>
        </object>
      </child>
    </object>
  </child>
</object>
```

## CSS nodes

`GtkPrintUnixDialog` has a single CSS node with name window. The style classes
dialog and print are added.

```tsx
import { GtkPrintUnixDialog } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → [GtkDialog](.gtkx/reference/gtk/dialog.md) → **GtkPrintUnixDialog**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.PrintUnixDialog` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `currentPage`

`number` · default `-1`

The current page in the document.

### `embedPageSetup`

`boolean` · default `false`

`true` if the page setup controls are embedded.

### `hasSelection`

`boolean` · default `false`

Whether the application has a selection.

### `manualCapabilities`

`Gtk.PrintCapabilities` · default `0`

Capabilities the application can handle.

### `pageSetup`

`Gtk.PageSetup | ReactElement`

The `GtkPageSetup` object to use.

### `printSettings`

`Gtk.PrintSettings | ReactElement`

The `GtkPrintSettings` object used for this dialog.

### `selectedPrinter`

`Gtk.Printer` · read-only, observe with `onNotifySelectedPrinter`

The `GtkPrinter` which is selected.

### `supportSelection`

`boolean` · default `false`

Whether the dialog supports selection.

## Methods

Methods are called on the `Gtk.PrintUnixDialog` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addCustomTab`

```ts
addCustomTab(child: Gtk.Widget, tabLabel: Gtk.Widget): void
```

Adds a custom tab to the print dialog.

**Parameters**

- `child`: the widget to put in the custom tab
- `tabLabel`: the widget to use as tab label

### `getCurrentPage`

```ts
getCurrentPage(): number
```

Gets the current page of the `GtkPrintUnixDialog`.

**Returns** the current page of `dialog`

### `getEmbedPageSetup`

```ts
getEmbedPageSetup(): boolean
```

Gets whether to embed the page setup.

**Returns** whether to embed the page setup

### `getHasSelection`

```ts
getHasSelection(): boolean
```

Gets whether there is a selection.

**Returns** whether there is a selection

### `getManualCapabilities`

```ts
getManualCapabilities(): Gtk.PrintCapabilities
```

Gets the capabilities that have been set on this `GtkPrintUnixDialog`.

**Returns** the printing capabilities

### `getPageSetup`

```ts
getPageSetup(): Gtk.PageSetup
```

Gets the page setup that is used by the `GtkPrintUnixDialog`.

**Returns** the page setup of `dialog`.

### `getPageSetupSet`

```ts
getPageSetupSet(): boolean
```

Gets whether a page setup was set by the user.

**Returns** whether a page setup was set by user.

### `getSelectedPrinter`

```ts
getSelectedPrinter(): Gtk.Printer | null
```

Gets the currently selected printer.

**Returns** the currently selected printer

### `getSupportSelection`

```ts
getSupportSelection(): boolean
```

Gets whether the print dialog allows user to print a selection.

**Returns** whether the application supports print of selection

### `printUnixDialogGetSettings`

```ts
printUnixDialogGetSettings(): Gtk.PrintSettings
```

Gets a new `GtkPrintSettings` object that represents the
current values in the print dialog.

Note that this creates a new object, and you need to unref
it if don’t want to keep it.

**Returns** a new `GtkPrintSettings` object with the values from `dialog`

### `setCurrentPage`

```ts
setCurrentPage(currentPage: number): void
```

Sets the current page number.

If `current_page` is not -1, this enables the current page choice
for the range of pages to print.

**Parameters**

- `currentPage`: the current page number.

### `setEmbedPageSetup`

```ts
setEmbedPageSetup(embed: boolean): void
```

Embed page size combo box and orientation combo box into page setup page.

**Parameters**

- `embed`: embed page setup selection

### `setHasSelection`

```ts
setHasSelection(hasSelection: boolean): void
```

Sets whether a selection exists.

**Parameters**

- `hasSelection`: `true` indicates that a selection exists

### `setManualCapabilities`

```ts
setManualCapabilities(capabilities: Gtk.PrintCapabilities): void
```

This lets you specify the printing capabilities your application
supports.

For instance, if you can handle scaling the output then you pass
`GTK_PRINT_CAPABILITY_SCALE`. If you don’t pass that, then the dialog
will only let you select the scale if the printing system automatically
handles scaling.

**Parameters**

- `capabilities`: the printing capabilities of your application

### `setPageSetup`

```ts
setPageSetup(pageSetup: Gtk.PageSetup): void
```

Sets the page setup of the `GtkPrintUnixDialog`.

**Parameters**

- `pageSetup`: a `GtkPageSetup`

### `setSettings`

```ts
setSettings(settings: Gtk.PrintSettings | null): void
```

Sets the `GtkPrintSettings` for the `GtkPrintUnixDialog`.

Typically, this is used to restore saved print settings
from a previous print operation before the print dialog
is shown.

**Parameters**

- `settings`: a `GtkPrintSettings`

### `setSupportSelection`

```ts
setSupportSelection(supportSelection: boolean): void
```

Sets whether the print dialog allows user to print a selection.

**Parameters**

- `supportSelection`: `true` to allow print selection
