---
description: "GVolumeMonitor is for listing the user interesting devices and volumes on the computer."
---

# GVolumeMonitor

`GVolumeMonitor` is for listing the user interesting devices and volumes
on the computer. In other words, what a file selector or file manager
would show in a sidebar.

`GVolumeMonitor` is not
thread-default-context aware (see
`GLib.MainContext.pushThreadDefault()`), and so should not be used
other than from the main thread, with no thread-default-context active.

In order to receive updates about volumes and mounts monitored through GVFS,
a main loop must be running.

```tsx
import { GVolumeMonitor } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GVolumeMonitor**

## Props

`ref` receives the `Gio.VolumeMonitor` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Signals

### `onDriveChanged`

```ts
(drive: Gio.Drive, self: Gio.VolumeMonitor) => void
```

Emitted when a drive changes.

**Parameters**

- `drive`: the drive that changed
- `self`: The instance the signal was emitted on.

### `onDriveConnected`

```ts
(drive: Gio.Drive, self: Gio.VolumeMonitor) => void
```

Emitted when a drive is connected to the system.

**Parameters**

- `drive`: a `GDrive` that was connected.
- `self`: The instance the signal was emitted on.

### `onDriveDisconnected`

```ts
(drive: Gio.Drive, self: Gio.VolumeMonitor) => void
```

Emitted when a drive is disconnected from the system.

**Parameters**

- `drive`: a `GDrive` that was disconnected.
- `self`: The instance the signal was emitted on.

### `onDriveEjectButton`

```ts
(drive: Gio.Drive, self: Gio.VolumeMonitor) => void
```

Emitted when the eject button is pressed on `drive`.

**Parameters**

- `drive`: the drive where the eject button was pressed
- `self`: The instance the signal was emitted on.

_Available since 2.18._

### `onDriveStopButton`

```ts
(drive: Gio.Drive, self: Gio.VolumeMonitor) => void
```

Emitted when the stop button is pressed on `drive`.

**Parameters**

- `drive`: the drive where the stop button was pressed
- `self`: The instance the signal was emitted on.

_Available since 2.22._

### `onMountAdded`

```ts
(mount: Gio.Mount, self: Gio.VolumeMonitor) => void
```

Emitted when a mount is added.

**Parameters**

- `mount`: a `GMount` that was added.
- `self`: The instance the signal was emitted on.

### `onMountChanged`

```ts
(mount: Gio.Mount, self: Gio.VolumeMonitor) => void
```

Emitted when a mount changes.

**Parameters**

- `mount`: a `GMount` that changed.
- `self`: The instance the signal was emitted on.

### `onMountPreUnmount`

```ts
(mount: Gio.Mount, self: Gio.VolumeMonitor) => void
```

May be emitted when a mount is about to be removed.

This signal depends on the backend and is only emitted if
GIO was used to unmount.

**Parameters**

- `mount`: a `GMount` that is being unmounted.
- `self`: The instance the signal was emitted on.

### `onMountRemoved`

```ts
(mount: Gio.Mount, self: Gio.VolumeMonitor) => void
```

Emitted when a mount is removed.

**Parameters**

- `mount`: a `GMount` that was removed.
- `self`: The instance the signal was emitted on.

### `onVolumeAdded`

```ts
(volume: Gio.Volume, self: Gio.VolumeMonitor) => void
```

Emitted when a mountable volume is added to the system.

**Parameters**

- `volume`: a `GVolume` that was added.
- `self`: The instance the signal was emitted on.

### `onVolumeChanged`

```ts
(volume: Gio.Volume, self: Gio.VolumeMonitor) => void
```

Emitted when mountable volume is changed.

**Parameters**

- `volume`: a `GVolume` that changed.
- `self`: The instance the signal was emitted on.

### `onVolumeRemoved`

```ts
(volume: Gio.Volume, self: Gio.VolumeMonitor) => void
```

Emitted when a mountable volume is removed from the system.

**Parameters**

- `volume`: a `GVolume` that was removed.
- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gio.VolumeMonitor` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getConnectedDrives`

```ts
getConnectedDrives(): Gio.Drive[]
```

Gets a list of drives connected to the system.

The returned list should be freed with `g_list_free()`, after
its elements have been unreffed with `g_object_unref()`.

**Returns** a `GList` of connected `GDrive` objects.

### `getMountForUuid`

```ts
getMountForUuid(uuid: string): Gio.Mount | null
```

Finds a `GMount` object by its UUID (see `g_mount_get_uuid()`)

**Parameters**

- `uuid`: the UUID to look for

**Returns** a `GMount` or `null` if no such mount is available.
    Free the returned object with `g_object_unref()`.

### `getMounts`

```ts
getMounts(): Gio.Mount[]
```

Gets a list of the mounts on the system.

The returned list should be freed with `g_list_free()`, after
its elements have been unreffed with `g_object_unref()`.

**Returns** a `GList` of `GMount` objects.

### `getVolumeForUuid`

```ts
getVolumeForUuid(uuid: string): Gio.Volume | null
```

Finds a `GVolume` object by its UUID (see `g_volume_get_uuid()`)

**Parameters**

- `uuid`: the UUID to look for

**Returns** a `GVolume` or `null` if no such volume is available.
    Free the returned object with `g_object_unref()`.

### `getVolumes`

```ts
getVolumes(): Gio.Volume[]
```

Gets a list of the volumes on the system.

The returned list should be freed with `g_list_free()`, after
its elements have been unreffed with `g_object_unref()`.

**Returns** a `GList` of `GVolume` objects.
