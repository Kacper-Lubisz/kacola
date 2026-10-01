---
description: "GMountOperation provides a mechanism for interacting with the user."
---

# GMountOperation

`GMountOperation` provides a mechanism for interacting with the user.
It can be used for authenticating mountable operations, such as loop
mounting files, hard drive partitions or server locations. It can
also be used to ask the user questions or show a list of applications
preventing unmount or eject operations from completing.

Note that `GMountOperation` is used for more than just `Gio.Mount`
objects – for example it is also used in `Gio.Drive.start()` and
`Gio.Drive.stop()`.

Users should instantiate a subclass of this that implements all the
various callbacks to show the required dialogs, such as
[`GtkMountOperation`](https://docs.gtk.org/gtk4/class.MountOperation.html).
If no user interaction is desired (for example when automounting
filesystems at login time), usually `NULL` can be passed, see each method
taking a `GMountOperation` for details.

Throughout the API, the term ‘TCRYPT’ is used to mean ‘compatible with TrueCrypt and VeraCrypt’.
[TrueCrypt](https://en.wikipedia.org/wiki/TrueCrypt) is a discontinued system for
encrypting file containers, partitions or whole disks, typically used with Windows.
[VeraCrypt](https://www.veracrypt.fr/) is a maintained fork of TrueCrypt with various
improvements and auditing fixes.

```tsx
import { GMountOperation } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GMountOperation**

## Props

`ref` receives the `Gio.MountOperation` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `anonymous`

`boolean` · default `false`

Whether to use an anonymous user when authenticating.

### `choice`

`number` · default `0`

The index of the user's choice when a question is asked during the
mount operation. See the `GMountOperation.ask-question` signal.

### `domain`

`string` · default `null`

The domain to use for the mount operation.

### `isTcryptHiddenVolume`

`boolean` · default `false`

Whether the device to be unlocked is a TCRYPT hidden volume.
See [the VeraCrypt documentation](https://www.veracrypt.fr/en/Hidden%20Volume.html).

_Available since 2.58._

### `isTcryptSystemVolume`

`boolean` · default `false`

Whether the device to be unlocked is a TCRYPT system volume.
In this context, a system volume is a volume with a bootloader
and operating system installed. This is only supported for Windows
operating systems. For further documentation, see
[the VeraCrypt documentation](https://www.veracrypt.fr/en/System%20Encryption.html).

_Available since 2.58._

### `password`

`string` · default `null`

The password that is used for authentication when carrying out
the mount operation.

### `passwordSave`

`Gio.PasswordSave` · default `G_PASSWORD_SAVE_NEVER`

Determines if and how the password information should be saved.

### `pim`

`number` · default `0`

The VeraCrypt PIM value, when unlocking a VeraCrypt volume. See
[the VeraCrypt documentation](https://www.veracrypt.fr/en/Personal%20Iterations%20Multiplier%20(PIM).html).

_Available since 2.58._

### `username`

`string` · default `null`

The user name that is used for authentication when carrying out
the mount operation.

## Signals

### `onAborted`

```ts
(self: Gio.MountOperation) => void
```

Emitted by the backend when e.g. a device becomes unavailable
while a mount operation is in progress.

Implementations of GMountOperation should handle this signal
by dismissing open password dialogs.

**Parameters**

- `self`: The instance the signal was emitted on.

_Available since 2.20._

### `onAskPassword`

```ts
(message: string, defaultUser: string, defaultDomain: string, flags: Gio.AskPasswordFlags, self: Gio.MountOperation) => void
```

Emitted when a mount operation asks the user for a password.

If the message contains a line break, the first line should be
presented as a heading. For example, it may be used as the
primary text in a `GtkMessageDialog`.

**Parameters**

- `message`: string containing a message to display to the user.
- `defaultUser`: string containing the default user name.
- `defaultDomain`: string containing the default domain.
- `flags`: a set of `GAskPasswordFlags`.
- `self`: The instance the signal was emitted on.

### `onAskQuestion`

```ts
(message: string, choices: string[], self: Gio.MountOperation) => void
```

Emitted when asking the user a question and gives a list of
choices for the user to choose from.

If the message contains a line break, the first line should be
presented as a heading. For example, it may be used as the
primary text in a `GtkMessageDialog`.

**Parameters**

- `message`: string containing a message to display to the user.
- `choices`: an array of strings for each possible choice.
- `self`: The instance the signal was emitted on.

### `onReply`

```ts
(result: Gio.MountOperationResult, self: Gio.MountOperation) => void
```

Emitted when the user has replied to the mount operation.

**Parameters**

- `result`: a `GMountOperationResult` indicating how the request was handled
- `self`: The instance the signal was emitted on.

### `onShowProcesses`

```ts
(message: string, processes: number[], choices: string[], self: Gio.MountOperation) => void
```

Emitted when one or more processes are blocking an operation
e.g. unmounting/ejecting a `GMount` or stopping a `GDrive`.

Note that this signal may be emitted several times to update the
list of blocking processes as processes close files. The
application should only respond with `g_mount_operation_reply()` to
the latest signal (setting `GMountOperation.choice` to the choice
the user made).

If the message contains a line break, the first line should be
presented as a heading. For example, it may be used as the
primary text in a `GtkMessageDialog`.

**Parameters**

- `message`: string containing a message to display to the user.
- `processes`: an array of `GPid` for processes blocking the operation.
- `choices`: an array of strings for each possible choice.
- `self`: The instance the signal was emitted on.

_Available since 2.22._

### `onShowUnmountProgress`

```ts
(message: string, timeLeft: bigint, bytesLeft: bigint, self: Gio.MountOperation) => void
```

Emitted when an unmount operation has been busy for more than some time
(typically 1.5 seconds).

When unmounting or ejecting a volume, the kernel might need to flush
pending data in its buffers to the volume stable storage, and this operation
can take a considerable amount of time. This signal may be emitted several
times as long as the unmount operation is outstanding, and then one
last time when the operation is completed, with `bytes_left` set to zero.

Implementations of GMountOperation should handle this signal by
showing an UI notification, and then dismiss it, or show another notification
of completion, when `bytes_left` reaches zero.

If the message contains a line break, the first line should be
presented as a heading. For example, it may be used as the
primary text in a `GtkMessageDialog`.

**Parameters**

- `message`: string containing a message to display to the user
- `timeLeft`: the estimated time left before the operation completes, in microseconds, or -1
- `bytesLeft`: the amount of bytes to be written before the operation completes (or -1 if such amount is not known), or zero if the operation is completed
- `self`: The instance the signal was emitted on.

_Available since 2.34._

## Methods

Methods are called on the `Gio.MountOperation` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getAnonymous`

```ts
getAnonymous(): boolean
```

Check to see whether the mount operation is being used
for an anonymous user.

**Returns** `true` if mount operation is anonymous.

### `getChoice`

```ts
getChoice(): number
```

Gets a choice from the mount operation.

**Returns** an integer containing an index of the user's choice from
the choice's list, or `0`.

### `getDomain`

```ts
getDomain(): string | null
```

Gets the domain of the mount operation.

**Returns** a string set to the domain.

### `getIsTcryptHiddenVolume`

```ts
getIsTcryptHiddenVolume(): boolean
```

Check to see whether the mount operation is being used
for a TCRYPT hidden volume.

**Returns** `true` if mount operation is for hidden volume.

_Available since 2.58._

### `getIsTcryptSystemVolume`

```ts
getIsTcryptSystemVolume(): boolean
```

Check to see whether the mount operation is being used
for a TCRYPT system volume.

**Returns** `true` if mount operation is for system volume.

_Available since 2.58._

### `getPassword`

```ts
getPassword(): string | null
```

Gets a password from the mount operation.

**Returns** a string containing the password within `op`.

### `getPasswordSave`

```ts
getPasswordSave(): Gio.PasswordSave
```

Gets the state of saving passwords for the mount operation.

**Returns** a `GPasswordSave` flag.

### `getPim`

```ts
getPim(): number
```

Gets a PIM from the mount operation.

**Returns** The VeraCrypt PIM within `op`.

_Available since 2.58._

### `getUsername`

```ts
getUsername(): string | null
```

Get the user name from the mount operation.

**Returns** a string containing the user name.

### `reply`

```ts
reply(result: Gio.MountOperationResult): void
```

Emits the `GMountOperation.reply` signal.

**Parameters**

- `result`: a `GMountOperationResult`

### `setAnonymous`

```ts
setAnonymous(anonymous: boolean): void
```

Sets the mount operation to use an anonymous user if `anonymous` is `true`.

**Parameters**

- `anonymous`: boolean value.

### `setChoice`

```ts
setChoice(choice: number): void
```

Sets a default choice for the mount operation.

**Parameters**

- `choice`: an integer.

### `setDomain`

```ts
setDomain(domain: string | null): void
```

Sets the mount operation's domain.

**Parameters**

- `domain`: the domain to set.

### `setIsTcryptHiddenVolume`

```ts
setIsTcryptHiddenVolume(hiddenVolume: boolean): void
```

Sets the mount operation to use a hidden volume if `hidden_volume` is `true`.

**Parameters**

- `hiddenVolume`: boolean value.

_Available since 2.58._

### `setIsTcryptSystemVolume`

```ts
setIsTcryptSystemVolume(systemVolume: boolean): void
```

Sets the mount operation to use a system volume if `system_volume` is `true`.

**Parameters**

- `systemVolume`: boolean value.

_Available since 2.58._

### `setPassword`

```ts
setPassword(password: string | null): void
```

Sets the mount operation's password to `password`.

**Parameters**

- `password`: password to set.

### `setPasswordSave`

```ts
setPasswordSave(save: Gio.PasswordSave): void
```

Sets the state of saving passwords for the mount operation.

**Parameters**

- `save`: a set of `GPasswordSave` flags.

### `setPim`

```ts
setPim(pim: number): void
```

Sets the mount operation's PIM to `pim`.

**Parameters**

- `pim`: an unsigned integer.

_Available since 2.58._

### `setUsername`

```ts
setUsername(username: string | null): void
```

Sets the user name within `op` to `username`.

**Parameters**

- `username`: input username.
