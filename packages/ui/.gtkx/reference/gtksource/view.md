---
description: "Subclass of Gtk.TextView."
---

# GtkSourceView

Subclass of `Gtk.TextView`.

`GtkSourceView` is the main class of the GtkSourceView library.
Use a `Buffer` to display text with a `GtkSourceView`.

This class provides:

 - Show the line numbers;
 - Show a right margin;
 - Highlight the current line;
 - Indentation settings;
 - Configuration for the Home and End keyboard keys;
 - Configure and show line marks;
 - And a few other things.

An easy way to test all these features is to use the test-widget mini-program
provided in the GtkSourceView repository, in the tests/ directory.

## GtkSourceView as GtkBuildable

The GtkSourceView implementation of the `Gtk.Buildable` interface exposes the
`View.completion` object with the internal-child "completion".

An example of a UI definition fragment with GtkSourceView:
```xml
<object class="GtkSourceView" id="source_view">
  <property name="tab-width">4</property>
  <property name="auto-indent">True</property>
  <child internal-child="completion">
    <object class="GtkSourceCompletion">
      <property name="select-on-show">False</property>
    </object>
  </child>
</object>
```

## Changing the Font

Gtk CSS provides the best way to change the font for a `GtkSourceView` in a
manner that allows for components like `Map` to scale the desired
font.

```c
GtkCssProvider *provider = gtk_css_provider_new ();
gtk_css_provider_load_from_string (provider,
                                  "textview { font-family: Monospace; font-size: 8pt; }");
gtk_style_context_add_provider (gtk_widget_get_style_context (view),
                                GTK_STYLE_PROVIDER (provider),
                                GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
g_object_unref (provider);
```
```python
provider = Gtk.CssProvider()
provider.load_from_string("textview { font-family: Monospace; font-size: 8pt; }")
style_context = view.get_style_context()
style_context.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
```

If you need to adjust the font or size of font within a portion of the
document only, you should use a `Gtk.TextTag` with the `Gtk.TextTag.family` or
`Gtk.TextTag.scale` set so that the font size may be scaled relative to
the default font set in CSS.

```tsx
import { GtkSourceView } from "@gtkx/jsx/gtksource";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → [GtkTextView](.gtkx/reference/gtk/text-view.md) → **GtkSourceView**

Implements `GtkAccessible`, `GtkAccessibleText`, `GtkBuildable`, `GtkConstraintTarget`, `GtkScrollable`.

## Props

`ref` receives the `GtkSource.View` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `annotations`

`GtkSource.Annotations` · read-only, observe with `onNotifyAnnotations`

The `Annotations` object associated with the view.

_Available since 5.18._

### `autoIndent`

`boolean` · default `false`

### `backgroundPattern`

`GtkSource.BackgroundPatternType` · default `GTK_SOURCE_BACKGROUND_PATTERN_TYPE_NONE`

Draw a specific background pattern on the view.

### `completion`

`GtkSource.Completion` · read-only, observe with `onNotifyCompletion`

The completion object associated with the view

### `enableSnippets`

`boolean` · default `false`

The property denotes if snippets should be
expanded when the user presses Tab after having typed a word
matching the snippets found in `SnippetManager`.

The user may tab through focus-positions of the snippet if any
are available by pressing Tab repeatedly until the desired focus
position is selected.

### `highlightCurrentLine`

`boolean` · default `false`

### `indenter`

`GtkSource.Indenter | ReactElement`

The property is a `Indenter` to use to indent
as the user types into the `View`.

### `indentOnTab`

`boolean` · default `true`

### `indentWidth`

`number` · default `-1`

Width of an indentation step expressed in number of spaces.

### `insertSpacesInsteadOfTabs`

`boolean` · default `false`

### `rightMarginPosition`

`number` · default `80`

Position of the right margin.

### `showLineMarks`

`boolean` · default `false`

Whether to display line mark pixbufs

### `showLineNumbers`

`boolean` · default `false`

Whether to display line numbers

### `showRightMargin`

`boolean` · default `false`

Whether to display the right margin.

### `smartBackspace`

`boolean` · default `false`

Whether smart Backspace should be used.

### `smartHomeEnd`

`GtkSource.SmartHomeEndType` · default `GTK_SOURCE_SMART_HOME_END_DISABLED`

Set the behavior of the HOME and END keys.

### `spaceDrawer`

`GtkSource.SpaceDrawer` · read-only, observe with `onNotifySpaceDrawer`

The `SpaceDrawer` object associated with the view.

### `tabWidth`

`number` · default `8`

Width of a tab character expressed in number of spaces.

## Signals

### `onChangeCase`

```ts
(caseType: GtkSource.ChangeCaseType, self: GtkSource.View) => void
```

Keybinding signal to change case of the text at the current cursor position.

**Parameters**

- `caseType`: the case to use
- `self`: The instance the signal was emitted on.

### `onChangeNumber`

```ts
(count: number, self: GtkSource.View) => void
```

Keybinding signal to edit a number at the current cursor position.

**Parameters**

- `count`: the number to add to the number at the current position
- `self`: The instance the signal was emitted on.

### `onJoinLines`

```ts
(self: GtkSource.View) => void
```

Keybinding signal to join the lines currently selected.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onLineMarkActivated`

```ts
(iter: Gtk.TextIter, button: number, state: Gdk.ModifierType, nPresses: number, self: GtkSource.View) => void
```

Emitted when a line mark has been activated (for instance when there
was a button press in the line marks gutter).

You can use `iter` to determine on which line the activation took place.

**Parameters**

- `iter`: a `GtkTextIter`
- `button`: the button that was pressed
- `state`: the modifier state, if any
- `nPresses`: the number of presses
- `self`: The instance the signal was emitted on.

### `onMoveLines`

```ts
(down: boolean, self: GtkSource.View) => void
```

The signal is a keybinding which gets emitted when the user initiates moving a line.

The default binding key is Alt+Up/Down arrow. And moves the currently selected lines,
or the current line up or down by one line.

**Parameters**

- `down`: `true` to move down, `false` to move up.
- `self`: The instance the signal was emitted on.

### `onMoveToMatchingBracket`

```ts
(extendSelection: boolean, self: GtkSource.View) => void
```

Keybinding signal to move the cursor to the matching bracket.

**Parameters**

- `extendSelection`: `true` if the move should extend the selection
- `self`: The instance the signal was emitted on.

### `onMoveWords`

```ts
(count: number, self: GtkSource.View) => void
```

The signal is a keybinding which gets emitted when the user initiates moving a word.

The default binding key is Alt+Left/Right Arrow and moves the current selection, or the current
word by one word.

**Parameters**

- `count`: the number of words to move over
- `self`: The instance the signal was emitted on.

### `onPushSnippet`

```ts
(snippet: GtkSource.Snippet, location: Gtk.TextIter, self: GtkSource.View) => void
```

The signal is emitted to insert a new snippet into the view.

If another snippet was active, it will be paused until all focus positions of `snippet` have been exhausted.

`location` will be updated to point at the end of the snippet.

**Parameters**

- `snippet`: a `GtkSourceSnippet`
- `location`: a `GtkTextIter`
- `self`: The instance the signal was emitted on.

### `onShowCompletion`

```ts
(self: GtkSource.View) => void
```

The signal is a key binding signal which gets
emitted when the user requests a completion, by pressing
<keycombo><keycap>Control</keycap><keycap>space</keycap></keycombo>.

This will create a `CompletionContext` with the activation
type as `GTK_SOURCE_COMPLETION_ACTIVATION_USER_REQUESTED`.

Applications should not connect to it, but may emit it with
`GObject.signalEmitByName()` if they need to activate the completion by
another means, for example with another key binding or a menu entry.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onSmartHomeEnd`

```ts
(iter: Gtk.TextIter, count: number, self: GtkSource.View) => void
```

Emitted when a the cursor was moved according to the smart home end setting.

The signal is emitted after the cursor is moved, but
during the `Gtk.TextView.move-cursor` action. This can be used to find
out whether the cursor was moved by a normal home/end or by a smart
home/end.

**Parameters**

- `iter`: a `GtkTextIter`
- `count`: the count
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `GtkSource.View` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtksource`. Methods inherited from ancestors are documented on their own pages.

### `getAnnotations`

```ts
getAnnotations(): GtkSource.Annotations
```

Gets the `Annotations` associated with `view`.

The returned object is guaranteed to be the same for the lifetime of `view`.
Each `View` object has a different `Annotations`.

**Returns** the `GtkSourceAnnotations` associated with `view`.

_Available since 5.18._

### `getAutoIndent`

```ts
getAutoIndent(): boolean
```

Returns whether auto-indentation of text is enabled.

**Returns** `true` if auto indentation is enabled.

### `getBackgroundPattern`

```ts
getBackgroundPattern(): GtkSource.BackgroundPatternType
```

Returns the `GtkSourceBackgroundPatternType` specifying if and how
the background pattern should be displayed for this `view`.

**Returns** the `GtkSourceBackgroundPatternType`.

### `getCompletion`

```ts
getCompletion(): GtkSource.Completion
```

Gets the `Completion` associated with `view`.

The returned object is guaranteed to be the same for the lifetime of `view`.
Each `GtkSourceView` object has a different `Completion`.

**Returns** the `GtkSourceCompletion` associated with `view`.

### `getEnableSnippets`

```ts
getEnableSnippets(): boolean
```

Gets the `View.enableSnippets` property.

If `true`, matching snippets found in the `SnippetManager`
may be expanded when the user presses Tab after a word in the `View`.

**Returns** `true` if enabled

### `getHighlightCurrentLine`

```ts
getHighlightCurrentLine(): boolean
```

Returns whether the current line is highlighted.

**Returns** `true` if the current line is highlighted.

### `getHover`

```ts
getHover(): GtkSource.Hover
```

Gets the `Hover` associated with `view`.

The returned object is guaranteed to be the same for the lifetime of `view`.
Each `View` object has a different `Hover`.

**Returns** a `GtkSourceHover` associated with `view`.

### `getIndenter`

```ts
getIndenter(): GtkSource.Indenter | null
```

Gets the `View.indenter` property.

**Returns** a `GtkSourceIndenter` or `null`

### `getIndentOnTab`

```ts
getIndentOnTab(): boolean
```

Returns whether when the tab key is pressed the current selection
should get indented instead of replaced with the `\t` character.

**Returns** `true` if the selection is indented when tab is pressed.

### `getIndentWidth`

```ts
getIndentWidth(): number
```

Returns the number of spaces to use for each step of indent.

See `View.setIndentWidth()` for details.

**Returns** indent width.

### `getInsertSpacesInsteadOfTabs`

```ts
getInsertSpacesInsteadOfTabs(): boolean
```

Returns whether when inserting a tabulator character it should
be replaced by a group of space characters.

**Returns** `true` if spaces are inserted instead of tabs.

### `getMarkAttributes`

```ts
getMarkAttributes(category: string, priority: number): GtkSource.MarkAttributes
```

Gets attributes and priority for the `category`.

**Parameters**

- `category`: the category.
- `priority`: place where priority of the category will be stored.

**Returns** `GtkSourceMarkAttributes` for the `category`.
The object belongs to `view`, so it must not be unreffed.

### `getRightMarginPosition`

```ts
getRightMarginPosition(): number
```

Gets the position of the right margin in the given `view`.

**Returns** the position of the right margin.

### `getShowLineMarks`

```ts
getShowLineMarks(): boolean
```

Returns whether line marks are displayed beside the text.

**Returns** `true` if the line marks are displayed.

### `getShowLineNumbers`

```ts
getShowLineNumbers(): boolean
```

Returns whether line numbers are displayed beside the text.

**Returns** `true` if the line numbers are displayed.

### `getShowRightMargin`

```ts
getShowRightMargin(): boolean
```

Returns whether a right margin is displayed.

**Returns** `true` if the right margin is shown.

### `getSmartBackspace`

```ts
getSmartBackspace(): boolean
```

Returns `true` if pressing the Backspace key will try to delete spaces
up to the previous tab stop.

**Returns** `true` if smart Backspace handling is enabled.

### `getSmartHomeEnd`

```ts
getSmartHomeEnd(): GtkSource.SmartHomeEndType
```

Returns a `SmartHomeEndType` end value specifying
how the cursor will move when HOME and END keys are pressed.

**Returns** a `GtkSourceSmartHomeEndType` value.

### `getSpaceDrawer`

```ts
getSpaceDrawer(): GtkSource.SpaceDrawer
```

Gets the `SpaceDrawer` associated with `view`.

The returned object is guaranteed to be the same for the lifetime of `view`.
Each `View` object has a different `SpaceDrawer`.

**Returns** the `GtkSourceSpaceDrawer` associated with `view`.

### `getTabWidth`

```ts
getTabWidth(): number
```

Returns the width of tabulation in characters.

**Returns** width of tab.

### `getVisualColumn`

```ts
getVisualColumn(iter: Gtk.TextIter): number
```

Determines the visual column at `iter` taking into consideration the
`View.tabWidth` of `view`.

**Parameters**

- `iter`: a position in `view`.

**Returns** the visual column at `iter`.

### `indentLines`

```ts
indentLines(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Inserts one indentation level at the beginning of the specified lines. The
empty lines are not indented.

**Parameters**

- `start`: `GtkTextIter` of the first line to indent
- `end`: `GtkTextIter` of the last line to indent

### `pushSnippet`

```ts
pushSnippet(snippet: GtkSource.Snippet, location: Gtk.TextIter | null): void
```

Inserts a new snippet at `location`

If another snippet was already active, it will be paused and the new
snippet will become active. Once the focus positions of `snippet` have
been exhausted, editing will return to the previous snippet.

**Parameters**

- `snippet`: a `GtkSourceSnippet`
- `location`: a `GtkTextIter` or `null` for the cursor position

### `setAutoIndent`

```ts
setAutoIndent(enable: boolean): void
```

If `true` auto-indentation of text is enabled.

When Enter is pressed to create a new line, the auto-indentation inserts the
same indentation as the previous line. This is **not** a
"smart indentation" where an indentation level is added or removed depending
on the context.

**Parameters**

- `enable`: whether to enable auto indentation.

### `setBackgroundPattern`

```ts
setBackgroundPattern(backgroundPattern: GtkSource.BackgroundPatternType): void
```

Set if and how the background pattern should be displayed.

**Parameters**

- `backgroundPattern`: the `GtkSourceBackgroundPatternType`.

### `setEnableSnippets`

```ts
setEnableSnippets(enableSnippets: boolean): void
```

Sets the `View.enableSnippets` property.

If `enable_snippets` is `true`, matching snippets found in the
`SnippetManager` may be expanded when the user presses
Tab after a word in the `View`.

**Parameters**

- `enableSnippets`: if snippets should be enabled

### `setHighlightCurrentLine`

```ts
setHighlightCurrentLine(highlight: boolean): void
```

If `highlight` is `true` the current line will be highlighted.

**Parameters**

- `highlight`: whether to highlight the current line.

### `setIndenter`

```ts
setIndenter(indenter: GtkSource.Indenter | null): void
```

Sets the indenter for `view` to `indenter`.

Note that the indenter will not be used unless `GtkSourceView.autoIndent`
has been set to `true`.

**Parameters**

- `indenter`: a `GtkSourceIndenter` or `null`

### `setIndentOnTab`

```ts
setIndentOnTab(enable: boolean): void
```

If `true`, when the tab key is pressed when several lines are selected, the
selected lines are indented of one level instead of being replaced with a `\t`
character. Shift+Tab unindents the selection.

If the first or last line is not selected completely, it is also indented or
unindented.

When the selection doesn't span several lines, the tab key always replaces
the selection with a normal `\t` character.

**Parameters**

- `enable`: whether to indent a block when tab is pressed.

### `setIndentWidth`

```ts
setIndentWidth(width: number): void
```

Sets the number of spaces to use for each step of indent when the tab key is
pressed.

If `width` is -1, the value of the `View.tabWidth` property
will be used.

The `View.indentWidth` interacts with the
`View.insertSpacesInsteadOfTabs` property and
`View.tabWidth`. An example will be clearer:

If the `View.indentWidth` is 4 and `View.tabWidth` is 8 and
`View.insertSpacesInsteadOfTabs` is `false`, then pressing the tab
key at the beginning of a line will insert 4 spaces. So far so good. Pressing
the tab key a second time will remove the 4 spaces and insert a `\t` character
instead (since `View.tabWidth` is 8). On the other hand, if
`View.insertSpacesInsteadOfTabs` is `true`, the second tab key
pressed will insert 4 more spaces for a total of 8 spaces in the
`Gtk.TextBuffer`.

The test-widget program (available in the GtkSourceView repository) may be
useful to better understand the indentation settings (enable the space
drawing!).

**Parameters**

- `width`: indent width in characters.

### `setInsertSpacesInsteadOfTabs`

```ts
setInsertSpacesInsteadOfTabs(enable: boolean): void
```

If `true` a tab key pressed is replaced by a group of space characters.

Of course it is still possible to insert a real `\t` programmatically with the
`Gtk.TextBuffer` API.

**Parameters**

- `enable`: whether to insert spaces instead of tabs.

### `setMarkAttributes`

```ts
setMarkAttributes(category: string, attributes: GtkSource.MarkAttributes, priority: number): void
```

Sets attributes and priority for the `category`.

**Parameters**

- `category`: the category.
- `attributes`: mark attributes.
- `priority`: priority of the category.

### `setRightMarginPosition`

```ts
setRightMarginPosition(pos: number): void
```

Sets the position of the right margin in the given `view`.

**Parameters**

- `pos`: the width in characters where to position the right margin.

### `setShowLineMarks`

```ts
setShowLineMarks(show: boolean): void
```

If `true` line marks will be displayed beside the text.

**Parameters**

- `show`: whether line marks should be displayed.

### `setShowLineNumbers`

```ts
setShowLineNumbers(show: boolean): void
```

If `true` line numbers will be displayed beside the text.

**Parameters**

- `show`: whether line numbers should be displayed.

### `setShowRightMargin`

```ts
setShowRightMargin(show: boolean): void
```

If `true` a right margin is displayed.

**Parameters**

- `show`: whether to show a right margin.

### `setSmartBackspace`

```ts
setSmartBackspace(smartBackspace: boolean): void
```

When set to `true`, pressing the Backspace key will try to delete spaces
up to the previous tab stop.

**Parameters**

- `smartBackspace`: whether to enable smart Backspace handling.

### `setSmartHomeEnd`

```ts
setSmartHomeEnd(smartHomeEnd: GtkSource.SmartHomeEndType): void
```

Set the desired movement of the cursor when HOME and END keys
are pressed.

**Parameters**

- `smartHomeEnd`: the desired behavior among `GtkSourceSmartHomeEndType`.

### `setTabWidth`

```ts
setTabWidth(width: number): void
```

Sets the width of tabulation in characters.

The `GtkTextBuffer` still contains `\t` characters,
but they can take a different visual width in a `View` widget.

**Parameters**

- `width`: width of tab in characters.

### `unindentLines`

```ts
unindentLines(start: Gtk.TextIter, end: Gtk.TextIter): void
```

Removes one indentation level at the beginning of the
specified lines.

**Parameters**

- `start`: `GtkTextIter` of the first line to indent
- `end`: `GtkTextIter` of the last line to indent

### `viewGetGutter`

```ts
viewGetGutter(windowType: Gtk.TextWindowType): GtkSource.Gutter
```

Returns the `Gutter` object associated with `window_type` for `view`.

Only `GTK_TEXT_WINDOW_LEFT` and `GTK_TEXT_WINDOW_RIGHT` are supported,
respectively corresponding to the left and right gutter. The line numbers
and mark category icons are rendered in the left gutter.

**Parameters**

- `windowType`: the gutter window type.

**Returns** the `GtkSourceGutter`.
