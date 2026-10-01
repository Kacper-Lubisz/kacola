---
description: "Displays a Gregorian calendar, one month at a time."
---

# GtkCalendar

Displays a Gregorian calendar, one month at a time.



A `GtkCalendar` can be created with `Gtk.Calendar.new()`.

The selected date can be retrieved from a `GtkCalendar` using
`Gtk.Calendar.getDate()`.
It can be altered with `Gtk.Calendar.setDate()`.

To place a visual marker on a particular day, use
`Gtk.Calendar.markDay()` and to remove the marker,
`Gtk.Calendar.unmarkDay()`. Alternative, all
marks can be cleared with `Gtk.Calendar.clearMarks()`.

Users should be aware that, although the Gregorian calendar is the
legal calendar in most countries, it was adopted progressively
between 1582 and 1929. Display before these dates is likely to be
historically incorrect.

## Shortcuts and Gestures

`GtkCalendar` supports the following gestures:

- Scrolling up or down will switch to the previous or next month.
- Date strings can be dropped for setting the current day.

## CSS nodes

```
calendar.view
├── header
│   ├── button
│   ├── stack.month
│   ├── button
│   ├── button
│   ├── label.year
│   ╰── button
╰── grid
    ╰── label[.day-name][.week-number][.day-number][.other-month][.today]
```

`GtkCalendar` has a main node with name calendar. It contains a subnode
called header containing the widgets for switching between years and months.

The grid subnode contains all day labels, including week numbers on the left
(marked with the .week-number css class) and day names on top (marked with the
.day-name css class).

Day labels that belong to the previous or next month get the .other-month
style class. The label of the current day get the .today style class.

Marked day labels get the :selected state assigned.

```tsx
import { GtkCalendar } from "@gtkx/jsx/gtk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → [GInitiallyUnowned](.gtkx/reference/gobject/initially-unowned.md) → [GtkWidget](.gtkx/reference/gtk/widget.md) → **GtkCalendar**

Implements `GtkAccessible`, `GtkBuildable`, `GtkConstraintTarget`.

## Props

`ref` receives the `Gtk.Calendar` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `date`

`GLib.DateTime`

The selected date.

This property gets initially set to the current date.

### `day`

`number` · default `1` · deprecated since 4.20

The selected day (as a number between 1 and 31).

> **Deprecated since 4.20.** This property will be removed in GTK 5. Use `Calendar.date` instead.

### `markedDays`

`number[] | null`

Days of the shown month drawn as marked, cleared and re-marked whenever the list changes.

### `month`

`number` · default `0` · deprecated since 4.20

The selected month (as a number between 0 and 11).

This property gets initially set to the current month.

> **Deprecated since 4.20.** This property will be removed in GTK 5. Use `Calendar.date` instead.

### `showDayNames`

`boolean` · default `true`

Determines whether day names are displayed.

### `showHeading`

`boolean` · default `true`

Determines whether a heading is displayed.

### `showWeekNumbers`

`boolean` · default `false`

Determines whether week numbers are displayed.

### `year`

`number` · default `1` · deprecated since 4.20

The selected year.

This property gets initially set to the current year.

> **Deprecated since 4.20.** This property will be removed in GTK 5. Use `Calendar.date` instead.

## Signals

### `onDaySelected`

```ts
(self: Gtk.Calendar) => void
```

Emitted when the user selects a day.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onNextMonth`

```ts
(self: Gtk.Calendar) => void
```

Emitted when the user switches to the next month.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onNextYear`

```ts
(self: Gtk.Calendar) => void
```

Emitted when user switches to the next year.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPrevMonth`

```ts
(self: Gtk.Calendar) => void
```

Emitted when the user switches to the previous month.

**Parameters**

- `self`: The instance the signal was emitted on.

### `onPrevYear`

```ts
(self: Gtk.Calendar) => void
```

Emitted when user switches to the previous year.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gtk.Calendar` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gtk`. Methods inherited from ancestors are documented on their own pages.

### `clearMarks`

```ts
clearMarks(): void
```

Remove all visual markers.

### `getDate`

```ts
getDate(): GLib.DateTime
```

Returns a `GDateTime` representing the shown
year, month and the selected day.

The returned date is in the local time zone.

**Returns** the `GDateTime` representing the selected date

### `getDay`

```ts
getDay(): number
```

Gets the day of the selected date.

**Returns** the day of the selected date.

_Available since 4.14._

### `getDayIsMarked`

```ts
getDayIsMarked(day: number): boolean
```

Returns if the `day` of the `calendar` is already marked.

**Parameters**

- `day`: the day number between 1 and 31.

**Returns** whether the day is marked.

### `getMonth`

```ts
getMonth(): number
```

Gets the month of the selected date.

**Returns** The month of the selected date (as a number between 0 and 11).

_Available since 4.14._

### `getShowDayNames`

```ts
getShowDayNames(): boolean
```

Returns whether `self` is currently showing the names
of the week days.

This is the value of the `Gtk.Calendar.showDayNames`
property.

**Returns** Whether the calendar shows day names.

### `getShowHeading`

```ts
getShowHeading(): boolean
```

Returns whether `self` is currently showing the heading.

This is the value of the `Gtk.Calendar.showHeading`
property.

**Returns** Whether the calendar is showing a heading.

### `getShowWeekNumbers`

```ts
getShowWeekNumbers(): boolean
```

Returns whether `self` is showing week numbers right
now.

This is the value of the `Gtk.Calendar.showWeekNumbers`
property.

**Returns** Whether the calendar is showing week numbers.

### `getYear`

```ts
getYear(): number
```

Gets the year of the selected date.

**Returns** the year of the selected date.

_Available since 4.14._

### `markDay`

```ts
markDay(day: number): void
```

Places a visual marker on a particular day of the current month.

**Parameters**

- `day`: the day number to mark between 1 and 31.

### `selectDay`

```ts
selectDay(date: GLib.DateTime): void
```

Switches to `date`'s year and month and select its day.

**Parameters**

- `date`: a `GDateTime` representing the day to select

> **Deprecated since 4.20.** Use `Calendar.setDate()` instead.

### `setDate`

```ts
setDate(date: GLib.DateTime): void
```

Switches to `date`'s year and month and selects its day.

**Parameters**

- `date`: a `GDateTime` representing the day to select

_Available since 4.20._

### `setDay`

```ts
setDay(day: number): void
```

Sets the day for the selected date.

The new date must be valid. For example, setting the day to 31 when the
month is February will fail.

**Parameters**

- `day`: The desired day for the selected date (as a number between 1 and 31).

_Available since 4.14._

### `setMonth`

```ts
setMonth(month: number): void
```

Sets the month for the selected date.

The new date must be valid. For example, setting the month to 1 (February)
when the day is 31 will fail.

**Parameters**

- `month`: The desired month for the selected date (as a number between 0 and 11).

_Available since 4.14._

### `setShowDayNames`

```ts
setShowDayNames(value: boolean): void
```

Sets whether the calendar shows day names.

**Parameters**

- `value`: Whether to show day names above the day numbers

### `setShowHeading`

```ts
setShowHeading(value: boolean): void
```

Sets whether the calendar should show a heading.

The heading contains the current year and month as well as
buttons for changing both.

**Parameters**

- `value`: Whether to show the heading in the calendar

### `setShowWeekNumbers`

```ts
setShowWeekNumbers(value: boolean): void
```

Sets whether week numbers are shown in the calendar.

**Parameters**

- `value`: whether to show week numbers alongside the days

### `setYear`

```ts
setYear(year: number): void
```

Sets the year for the selected date.

The new date must be valid. For example, setting the year to 2023 when the
date is February 29 will fail.

**Parameters**

- `year`: The desired year for the selected date (within `GLib.DateTime` limits, i.e. from 0001 to 9999).

_Available since 4.14._

### `unmarkDay`

```ts
unmarkDay(day: number): void
```

Removes the visual marker from a particular day.

**Parameters**

- `day`: the day number to unmark between 1 and 31.
