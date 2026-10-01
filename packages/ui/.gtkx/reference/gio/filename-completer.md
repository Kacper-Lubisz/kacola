---
description: "Completes partial file and directory names given a partial string by looking in the file system for clues."
---

# GFilenameCompleter

Completes partial file and directory names given a partial string by
looking in the file system for clues. Can return a list of possible
completion strings for widget implementations.

```tsx
import { GFilenameCompleter } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GFilenameCompleter**

## Props

`ref` receives the `Gio.FilenameCompleter` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onGotCompletionData`

```ts
(self: Gio.FilenameCompleter) => void
```

Emitted when the file name completion information comes available.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gio.FilenameCompleter` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getCompletions`

```ts
getCompletions(initialText: string): string[]
```

Gets an array of completion strings for a given initial text.

**Parameters**

- `initialText`: text to be completed.

**Returns** array of strings with possible completions for `initial_text`.
This array must be freed by `g_strfreev()` when finished.

### `getCompletionSuffix`

```ts
getCompletionSuffix(initialText: string): string | null
```

Obtains a suffix completion for `initial_text` from `completer`.

Suffix will be an empty string if there's no shared suffix among matching
completions. If there's no matching completions anyway, `NULL` is returned.

**Parameters**

- `initialText`: text to be completed.

**Returns** a suffix completion string, or `NULL` if no
    completion exists.

### `setDirsOnly`

```ts
setDirsOnly(dirsOnly: boolean): void
```

If `dirs_only` is `true`, `completer` will only
complete directory names, and not file names.

This function needs to be called before waiting for results from the
completer to be populated.

**Parameters**

- `dirsOnly`: a `gboolean`.
