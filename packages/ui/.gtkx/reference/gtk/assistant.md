---
description: "GtkAssistant is used to represent a complex as a series of steps."
---

# GtkAssistant

`GtkAssistant` is used to represent a complex as a series of steps.



Each step consists of one or more pages. `GtkAssistant` guides the user
through the pages, and controls the page flow to collect the data needed
for the operation.

`GtkAssistant` handles which buttons to show and to make sensitive based
on page sequence knowledge and the `Gtk.AssistantPageType` of each
page in addition to state information like the *completed* and *committed*
page statuses.

If you have a case that doesn’t quite fit in `GtkAssistant`s way of
handling buttons, you can use the `GTK_ASSISTANT_PAGE_CUSTOM` page
type and handle buttons yourself.

`GtkAssistant` maintains a `GtkAssistantPage` object for each added
child, which holds additional per-child properties. You
obtain the `GtkAssistantPage` for a child with `Gtk.Assistant.getPage()`.

## GtkAssistant as GtkBuildable

The `GtkAssistant` implementation of the `GtkBuildable` interface
exposes the `action_area` as internal children with the name
“action_area”.

To add pages to an assistant in `GtkBuilder`, simply add it as a
child to the `GtkAssistant` object. If you need to set per-object
properties, create a `GtkAssistantPage` object explicitly, and
set the child widget as a property on it.

## CSS nodes

`GtkAssistant` has a single CSS node with the name window and style
class .assistant.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

```tsx
import { GtkAssistant } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkWindow](.gtkx/reference/gtk/window.md) → **GtkAssistant**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkRoot`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.Assistant` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `pages`

`Gio.ListModel` · read-only, observe with `onNotifyPages`

`GListModel` containing the pages.

### `useHeaderBar`

`number` · default `-1` · construct-only · deprecated since 4.10

`true` if the assistant uses a `GtkHeaderBar` for action buttons
instead of the action-area.

For technical reasons, this property is declared as an integer
property, but you should only set it to `true` or `false`.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

## Signals

### `onApply`

```ts
(self: Gtk.Assistant) => void
```

Emitted when the apply button is clicked.

The default behavior of the `GtkAssistant` is to switch to the page
after the current page, unless the current page is the last one.

A handler for the ::apply signal should carry out the actions for
which the wizard has collected data. If the action takes a long time
to complete, you might consider putting a page of type
`GTK_ASSISTANT_PAGE_PROGRESS` after the confirmation page and handle
this operation within the `Gtk.Assistant.prepare` signal of
the progress page.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `onCancel`

```ts
(self: Gtk.Assistant) => void
```

Emitted when then the cancel button is clicked.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `onClose`

```ts
(self: Gtk.Assistant) => void
```

Emitted either when the close button of a summary page is clicked,
or when the apply button in the last page in the flow (of type
`GTK_ASSISTANT_PAGE_CONFIRM`) is clicked.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `onEscape`

```ts
(self: Gtk.Assistant) => void
```

The action signal for the Escape binding.

**Parameters**

- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `onPrepare`

```ts
(page: Gtk.Widget, self: Gtk.Assistant) => void
```

Emitted when a new page is set as the assistant's current page,
before making the new page visible.

A handler for this signal can do any preparations which are
necessary before showing `page`.

**Parameters**

- `page`: the current page
- `self`: The instance the signal was emitted on.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

## Methods

Methods are called on the `Gtk.Assistant` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `addActionWidget`

```ts
addActionWidget(child: Gtk.Widget): void
```

Adds a widget to the action area of a `GtkAssistant`.

**Parameters**

- `child`: a `GtkWidget`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `appendPage`

```ts
appendPage(page: Gtk.Widget): number
```

Appends a page to the `assistant`.

**Parameters**

- `page`: a `GtkWidget`

**Returns** the index (starting at 0) of the inserted page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `commit`

```ts
commit(): void
```

Erases the visited page history.

GTK will then hide the back button on the current page,
and removes the cancel button from subsequent pages.

Use this when the information provided up to the current
page is hereafter deemed permanent and cannot be modified
or undone. For example, showing a progress page to track
a long-running, unreversible operation after the user has
clicked apply on a confirmation page.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getCurrentPage`

```ts
getCurrentPage(): number
```

Returns the page number of the current page.

**Returns** The index (starting from 0) of the current
  page in the `assistant`, or -1 if the `assistant` has no pages,
  or no current page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getNPages`

```ts
getNPages(): number
```

Returns the number of pages in the `assistant`

**Returns** the number of pages in the `assistant`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getNthPage`

```ts
getNthPage(pageNum: number): Gtk.Widget | null
```

Returns the child widget contained in page number `page_num`.

**Parameters**

- `pageNum`: the index of a page in the `assistant`, or -1 to get the last page

**Returns** the child widget, or `null`
  if `page_num` is out of bounds

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getPage`

```ts
getPage(child: Gtk.Widget): Gtk.AssistantPage
```

Returns the `GtkAssistantPage` object for `child`.

**Parameters**

- `child`: a child of `assistant`

**Returns** the `GtkAssistantPage` for `child`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getPageComplete`

```ts
getPageComplete(page: Gtk.Widget): boolean
```

Gets whether `page` is complete.

**Parameters**

- `page`: a page of `assistant`

**Returns** `true` if `page` is complete.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getPages`

```ts
getPages(): Gio.ListModel
```

Gets a list model of the assistant pages.

**Returns** A list model of the pages.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getPageTitle`

```ts
getPageTitle(page: Gtk.Widget): string
```

Gets the title for `page`.

**Parameters**

- `page`: a page of `assistant`

**Returns** the title for `page`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `getPageType`

```ts
getPageType(page: Gtk.Widget): Gtk.AssistantPageType
```

Gets the page type of `page`.

**Parameters**

- `page`: a page of `assistant`

**Returns** the page type of `page`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `insertPage`

```ts
insertPage(page: Gtk.Widget, position: number): number
```

Inserts a page in the `assistant` at a given position.

**Parameters**

- `page`: a `GtkWidget`
- `position`: the index (starting at 0) at which to insert the page, or -1 to append the page to the `assistant`

**Returns** the index (starting from 0) of the inserted page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `nextPage`

```ts
nextPage(): void
```

Navigate to the next page.

It is a programming error to call this function when
there is no next page.

This function is for use when creating pages of the
`GTK_ASSISTANT_PAGE_CUSTOM` type.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `prependPage`

```ts
prependPage(page: Gtk.Widget): number
```

Prepends a page to the `assistant`.

**Parameters**

- `page`: a `GtkWidget`

**Returns** the index (starting at 0) of the inserted page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `previousPage`

```ts
previousPage(): void
```

Navigate to the previous visited page.

It is a programming error to call this function when
no previous page is available.

This function is for use when creating pages of the
`GTK_ASSISTANT_PAGE_CUSTOM` type.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `removeActionWidget`

```ts
removeActionWidget(child: Gtk.Widget): void
```

Removes a widget from the action area of a `GtkAssistant`.

**Parameters**

- `child`: a `GtkWidget`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `removePage`

```ts
removePage(pageNum: number): void
```

Removes the `page_num`’s page from `assistant`.

**Parameters**

- `pageNum`: the index of a page in the `assistant`, or -1 to remove the last page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setCurrentPage`

```ts
setCurrentPage(pageNum: number): void
```

Switches the page to `page_num`.

Note that this will only be necessary in custom buttons,
as the `assistant` flow can be set with
`gtk_assistant_set_forward_page_func()`.

**Parameters**

- `pageNum`: index of the page to switch to, starting from 0. If negative, the last page will be used. If greater than the number of pages in the `assistant`, nothing will be done.

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setForwardPageFunc`

```ts
setForwardPageFunc(pageFunc: Gtk.AssistantPageFunc | null): void
```

Sets the page forwarding function to be `page_func`.

This function will be used to determine what will be
the next page when the user presses the forward button.
Setting `page_func` to `null` will make the assistant to
use the default forward function, which just goes to the
next visible page.

**Parameters**

- `pageFunc`: the `GtkAssistantPageFunc`, or `null` to use the default one

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setPageComplete`

```ts
setPageComplete(page: Gtk.Widget, complete: boolean): void
```

Sets whether `page` contents are complete.

This will make `assistant` update the buttons state
to be able to continue the task.

**Parameters**

- `page`: a page of `assistant`
- `complete`: the completeness status of the page

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setPageTitle`

```ts
setPageTitle(page: Gtk.Widget, title: string): void
```

Sets a title for `page`.

The title is displayed in the header area of the assistant
when `page` is the current page.

**Parameters**

- `page`: a page of `assistant`
- `title`: the new title for `page`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `setPageType`

```ts
setPageType(page: Gtk.Widget, type: Gtk.AssistantPageType): void
```

Sets the page type for `page`.

The page type determines the page behavior in the `assistant`.

**Parameters**

- `page`: a page of `assistant`
- `type`: the new type for `page`

> **Deprecated since 4.10.** This widget will be removed in GTK 5

### `updateButtonsState`

```ts
updateButtonsState(): void
```

Forces `assistant` to recompute the buttons state.

GTK automatically takes care of this in most situations,
e.g. when the user goes to a different page, or when the
visibility or completeness of a page changes.

One situation where it can be necessary to call this
function is when changing a value on the current page
affects the future page flow of the assistant.

> **Deprecated since 4.10.** This widget will be removed in GTK 5
