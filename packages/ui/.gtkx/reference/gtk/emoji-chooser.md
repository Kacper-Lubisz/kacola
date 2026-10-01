---
description: "Used by text widgets to let users insert Emoji characters."
---

# GtkEmojiChooser

Used by text widgets to let users insert Emoji characters.



`GtkEmojiChooser` emits the `Gtk.EmojiChooser.emoji-picked`
signal when an Emoji is selected.

## Shortcuts and Gestures

`GtkEmojiChooser` supports the following keyboard shortcuts:

- <kbd>Ctrl</kbd>+<kbd>N</kbd> scrolls th the next section.
- <kbd>Ctrl</kbd>+<kbd>P</kbd> scrolls th the previous section.

## Actions

`GtkEmojiChooser` defines a set of built-in actions:

- `scroll.section` scrolls to the next or previous section.

## CSS nodes

```
popover
├── box.emoji-searchbar
│   ╰── entry.search
╰── box.emoji-toolbar
    ├── button.image-button.emoji-section
    ├── ...
    ╰── button.image-button.emoji-section
```

Every `GtkEmojiChooser` consists of a main node called popover.
The contents of the popover are largely implementation defined
and supposed to inherit general styles.
The top searchbar used to search emoji and gets the .emoji-searchbar
style class itself.
The bottom toolbar used to switch between different emoji categories
consists of buttons with the .emoji-section style class and gets the
.emoji-toolbar style class itself.

```tsx
import { GtkEmojiChooser } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkPopover](.gtkx/reference/gtk/popover.md) → **GtkEmojiChooser**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`, `GtkNative`, `GtkShortcutManager`.

## Props

`ref` receives the `Gtk.EmojiChooser` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onEmojiPicked`

```ts
(text: string, self: Gtk.EmojiChooser) => void
```

Emitted when the user selects an Emoji.

**Parameters**

- `text`: the Unicode sequence for the picked Emoji, in UTF-8
- `self`: The instance the signal was emitted on.
