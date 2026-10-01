---
description: "Monitors a file or directory for changes."
---

# GFileMonitor

Monitors a file or directory for changes.

To obtain a `GFileMonitor` for a file or directory, use
`Gio.File.monitor()`, `Gio.File.monitorFile()`, or
`Gio.File.monitorDirectory()`.

To get informed about changes to the file or directory you are
monitoring, connect to the `Gio.FileMonitor.changed` signal. The
signal will be emitted in the thread-default main context (see
`GLib.MainContext.pushThreadDefault()`) of the thread that the monitor
was created in (though if the global default main context is blocked, this
may cause notifications to be blocked even if the thread-default
context is still running).

```tsx
import { GFileMonitor } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GFileMonitor**

## Props

`ref` receives the `Gio.FileMonitor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `cancelled`

`boolean` · default `false` · read-only, observe with `onNotifyCancelled`

Whether the monitor has been cancelled.

### `rateLimit`

`number` · default `800`

The limit of the monitor to watch for changes, in milliseconds.

## Signals

### `onChanged`

```ts
(file: Gio.File, otherFile: Gio.File | null, eventType: Gio.FileMonitorEvent, self: Gio.FileMonitor) => void
```

Emitted when `file` has been changed.

If using `G_FILE_MONITOR_WATCH_MOVES` on a directory monitor, and
the information is available (and if supported by the backend),
`event_type` may be `G_FILE_MONITOR_EVENT_RENAMED`,
`G_FILE_MONITOR_EVENT_MOVED_IN` or `G_FILE_MONITOR_EVENT_MOVED_OUT`.

In all cases `file` will be a child of the monitored directory.  For
renames, `file` will be the old name and `other_file` is the new
name.  For "moved in" events, `file` is the name of the file that
appeared and `other_file` is the old name that it was moved from (in
another directory).  For "moved out" events, `file` is the name of
the file that used to be in this directory and `other_file` is the
name of the file at its new location.

It makes sense to treat `G_FILE_MONITOR_EVENT_MOVED_IN` as
equivalent to `G_FILE_MONITOR_EVENT_CREATED` and
`G_FILE_MONITOR_EVENT_MOVED_OUT` as equivalent to
`G_FILE_MONITOR_EVENT_DELETED`, with extra information.
`G_FILE_MONITOR_EVENT_RENAMED` is equivalent to a delete/create
pair.  This is exactly how the events will be reported in the case
that the `G_FILE_MONITOR_WATCH_MOVES` flag is not in use.

If using the deprecated flag `G_FILE_MONITOR_SEND_MOVED` flag and `event_type` is
`G_FILE_MONITOR_EVENT_MOVED`, `file` will be set to a `GFile` containing the
old path, and `other_file` will be set to a `GFile` containing the new path.

In all the other cases, `other_file` will be set to `NULL`.

**Parameters**

- `file`: a `GFile`.
- `otherFile`: a `GFile` or `NULL`.
- `eventType`: a `GFileMonitorEvent`.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gio.FileMonitor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `cancel`

```ts
cancel(): boolean
```

Cancels a file monitor.

**Returns** always `true`

### `emitEvent`

```ts
emitEvent(child: Gio.File, otherFile: Gio.File | null, eventType: Gio.FileMonitorEvent): void
```

Emits the `GFileMonitor.changed` signal if a change
has taken place. Should be called from file monitor
implementations only.

Implementations are responsible to call this method from the
thread-default main context (see `GLib.MainContext.pushThreadDefault()`)
of the thread that the monitor was created in.

**Parameters**

- `child`: a `GFile`.
- `otherFile`: a `GFile`, or `null`.
- `eventType`: a set of `GFileMonitorEvent` flags.

### `isCancelled`

```ts
isCancelled(): boolean
```

Returns whether the monitor is canceled.

**Returns** `true` if monitor is canceled. `false` otherwise.

### `setRateLimit`

```ts
setRateLimit(limitMsecs: number): void
```

Sets the rate limit to which the `monitor` will report
consecutive change events to the same file.

**Parameters**

- `limitMsecs`: a non-negative integer with the limit in milliseconds to poll for changes
