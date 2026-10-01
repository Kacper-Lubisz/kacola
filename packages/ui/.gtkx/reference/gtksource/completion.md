---
description: "Main Completion Object."
---

# GtkSourceCompletion

Main Completion Object.

The completion system helps the user when they writes some text,
such as words, command names, functions, and suchlike. Proposals can
be shown, to complete the text the user is writing. Each proposal can
contain an additional piece of information (for example
documentation), that is displayed when the "Details" button is
clicked.

Proposals are created via a `CompletionProvider`. There can
be for example a provider to complete words (see `CompletionWords`),
another provider for the completion of
function names, etc. To add a provider, call
`Completion.addProvider()`.

The `CompletionProposal` interface represents a proposal.

If a proposal contains extra information (see
`GTK_SOURCE_COMPLETION_COLUMN_DETAILS`), it will be
displayed in a supplemental details window, which appears when
the "Details" button is clicked.

Each `View` object is associated with a `Completion`
instance. This instance can be obtained with
`View.getCompletion()`. The `View` class contains also the
`View.show-completion` signal.

A same `CompletionProvider` object can be used for several
`GtkSourceCompletion`'s.

```tsx
import { GtkSourceCompletion } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GtkSourceCompletion**

## Props

`ref` receives the `GtkSource.Completion` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `buffer`

`Gtk.TextView` · read-only, observe with `onNotifyBuffer`

The `GtkTextBuffer` for the `GtkSourceCompletion.view`.
This is a convenience property for providers.

### `pageSize`

`number` · default `5`

The number of rows to display to the user before scrolling.

### `rememberInfoVisibility`

`boolean` · default `false`

Determines whether the visibility of the info window should be saved when the
completion is hidden, and restored when the completion is shown again.

### `selectOnShow`

`boolean` · default `false`

Determines whether the first proposal should be selected when the completion
is first shown.

### `showIcons`

`boolean` · default `true`

The "show-icons" property denotes if icons should be displayed within
the list of completions presented to the user.

### `view`

`GtkSource.View` · construct-only

The "view" property is the `GtkTextView` for which this `GtkSourceCompletion`
is providing completion features.

## Signals

### `onHide`

```ts
(self: GtkSource.Completion) => void
```

The "hide" signal is emitted when the completion window should
be hidden.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onProviderAdded`

```ts
(provider: GtkSource.CompletionProvider, self: GtkSource.Completion) => void
```

The "provided-added" signal is emitted when a new provider is
added to the completion.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`
- `self`: The instance the signal was emitted on.

### `onProviderRemoved`

```ts
(provider: GtkSource.CompletionProvider, self: GtkSource.Completion) => void
```

The "provided-removed" signal is emitted when a provider has
been removed from the completion.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`
- `self`: The instance the signal was emitted on.

### `onShow`

```ts
(self: GtkSource.Completion) => void
```

The "show" signal is emitted when the completion window should
be shown.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.Completion` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `addProvider`

```ts
addProvider(provider: GtkSource.CompletionProvider): void
```

Adds a `CompletionProvider` to the list of providers to be queried
for completion results.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`

### `blockInteractive`

```ts
blockInteractive(): void
```

### `getBuffer`

```ts
getBuffer(): GtkSource.Buffer
```

Gets the connected `View`'s `Buffer`

**Returns** A `GtkSourceBuffer`

### `getPageSize`

```ts
getPageSize(): number
```

### `getView`

```ts
getView(): GtkSource.View
```

Gets the `View` that owns the `Completion`.

**Returns** A `GtkSourceView`

### `hide`

```ts
hide(): void
```

Emits the "hide" signal.

When the "hide" signal is emitted, the completion window will be
dismissed.

### `removeProvider`

```ts
removeProvider(provider: GtkSource.CompletionProvider): void
```

Removes a `CompletionProvider` previously added with
`Completion.addProvider()`.

**Parameters**

- `provider`: a `GtkSourceCompletionProvider`

### `setPageSize`

```ts
setPageSize(pageSize: number): void
```

### `show`

```ts
show(): void
```

Emits the "show" signal.

When the "show" signal is emitted, the completion window will be
displayed if there are any results available.

### `unblockInteractive`

```ts
unblockInteractive(): void
```
