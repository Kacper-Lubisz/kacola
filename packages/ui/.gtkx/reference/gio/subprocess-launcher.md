---
description: "This class contains a set of options for launching child processes, such as where its standard input and output will be directed, the argument list, the environment, and more."
---

# GSubprocessLauncher

This class contains a set of options for launching child processes,
such as where its standard input and output will be directed, the
argument list, the environment, and more.

While the `Gio.Subprocess` class has high level functions covering
popular cases, use of this class allows access to more advanced
options.  It can also be used to launch multiple subprocesses with
a similar configuration.

_Available since 2.40._

```tsx
import { GSubprocessLauncher } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSubprocessLauncher**

## Props

`ref` receives the `Gio.SubprocessLauncher` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `flags`

`Gio.SubprocessFlags` · default `G_SUBPROCESS_FLAGS_NONE` · construct-only

`Gio.SubprocessFlags` for launched processes.

_Available since 2.40._

## Methods

Methods are called on the `Gio.SubprocessLauncher` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `close`

```ts
close(): void
```

Closes all the file descriptors previously passed to the object with
`g_subprocess_launcher_take_fd()`, `g_subprocess_launcher_take_stderr_fd()`, etc.

After calling this method, any subsequent calls to `g_subprocess_launcher_spawn()` or `g_subprocess_launcher_spawnv()` will
return `G_IO_ERROR_CLOSED`. This method is idempotent if
called more than once.

This function is called automatically when the `GSubprocessLauncher`
is disposed, but is provided separately so that garbage collected
language bindings can call it earlier to guarantee when FDs are closed.

_Available since 2.68._

### `getenv`

```ts
getenv(variable: string): string | null
```

Returns the value of the environment variable `variable` in the
environment of processes launched from this launcher.

On UNIX, the returned string can be an arbitrary byte string.
On Windows, it will be UTF-8.

**Parameters**

- `variable`: the environment variable to get

**Returns** the value of the environment variable,
    `null` if unset

_Available since 2.40._

### `setCwd`

```ts
setCwd(cwd: string): void
```

Sets the current working directory that processes will be launched
with.

By default processes are launched with the current working directory
of the launching process at the time of launch.

**Parameters**

- `cwd`: the cwd for launched processes

_Available since 2.40._

### `setenv`

```ts
setenv(variable: string, value: string, overwrite: boolean): void
```

Sets the environment variable `variable` in the environment of
processes launched from this launcher.

On UNIX, both the variable's name and value can be arbitrary byte
strings, except that the variable's name cannot contain '='.
On Windows, they should be in UTF-8.

**Parameters**

- `variable`: the environment variable to set, must not contain '='
- `value`: the new value for the variable
- `overwrite`: whether to change the variable if it already exists

_Available since 2.40._

### `setEnviron`

```ts
setEnviron(env: string[]): void
```

Replace the entire environment of processes launched from this
launcher with the given 'environ' variable.

Typically you will build this variable by using `g_listenv()` to copy
the process 'environ' and using the functions `g_environ_setenv()`,
`g_environ_unsetenv()`, etc.

As an alternative, you can use `g_subprocess_launcher_setenv()`,
`g_subprocess_launcher_unsetenv()`, etc.

Pass an empty array to set an empty environment. Pass `null` to inherit the
parent process’ environment. As of GLib 2.54, the parent process’ environment
will be copied when `g_subprocess_launcher_set_environ()` is called.
Previously, it was copied when the subprocess was executed. This means the
copied environment may now be modified (using `g_subprocess_launcher_setenv()`,
etc.) before launching the subprocess.

On UNIX, all strings in this array can be arbitrary byte strings.
On Windows, they should be in UTF-8.

**Parameters**

- `env`: the replacement environment

_Available since 2.40._

### `setFlags`

```ts
setFlags(flags: Gio.SubprocessFlags): void
```

Sets the flags on the launcher.

The default flags are `G_SUBPROCESS_FLAGS_NONE`.

You may not set flags that specify conflicting options for how to
handle a particular stdio stream (eg: specifying both
`G_SUBPROCESS_FLAGS_STDIN_PIPE` and
`G_SUBPROCESS_FLAGS_STDIN_INHERIT`).

You may also not set a flag that conflicts with a previous call to a
function like `g_subprocess_launcher_set_stdin_file_path()` or
`g_subprocess_launcher_take_stdout_fd()`.

**Parameters**

- `flags`: `GSubprocessFlags`

_Available since 2.40._

### `setStderrFilePath`

```ts
setStderrFilePath(path: string | null): void
```

Sets the file path to use as the stderr for spawned processes.

If `path` is `null` then any previously given path is unset.

The file will be created or truncated when the process is spawned, as
would be the case if using '2>' at the shell.

If you want to send both stdout and stderr to the same file then use
`G_SUBPROCESS_FLAGS_STDERR_MERGE`.

You may not set a stderr file path if a stderr fd is already set or
if the launcher flags contain any flags directing stderr elsewhere.

This feature is only available on UNIX.

**Parameters**

- `path`: a filename or `null`

_Available since 2.40._

### `setStdinFilePath`

```ts
setStdinFilePath(path: string | null): void
```

Sets the file path to use as the stdin for spawned processes.

If `path` is `null` then any previously given path is unset.

The file must exist or spawning the process will fail.

You may not set a stdin file path if a stdin fd is already set or if
the launcher flags contain any flags directing stdin elsewhere.

This feature is only available on UNIX.

**Parameters**

- `path`: a filename or `null`

_Available since 2.40._

### `setStdoutFilePath`

```ts
setStdoutFilePath(path: string | null): void
```

Sets the file path to use as the stdout for spawned processes.

If `path` is `null` then any previously given path is unset.

The file will be created or truncated when the process is spawned, as
would be the case if using '>' at the shell.

You may not set a stdout file path if a stdout fd is already set or
if the launcher flags contain any flags directing stdout elsewhere.

This feature is only available on UNIX.

**Parameters**

- `path`: a filename or `null`

_Available since 2.40._

### `spawnv`

```ts
spawnv(argv: string[]): Gio.Subprocess
```

Creates a `GSubprocess` given a provided array of arguments.

**Parameters**

- `argv`: Command line arguments

**Returns** A new `GSubprocess`, or `null` on error (and `error` will be set)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `takeFd`

```ts
takeFd(sourceFd: number, targetFd: number): void
```

Transfer an arbitrary file descriptor from parent process to the
child.  This function takes ownership of the `source_fd`; it will be closed
in the parent when `self` is freed.

By default, all file descriptors from the parent will be closed.
This function allows you to create (for example) a custom `pipe()` or
`socketpair()` before launching the process, and choose the target
descriptor in the child.

An example use case is GNUPG, which has a command line argument
`--passphrase-fd` providing a file descriptor number where it expects
the passphrase to be written.

**Parameters**

- `sourceFd`: File descriptor in parent process
- `targetFd`: Target descriptor for child process

### `takeStderrFd`

```ts
takeStderrFd(fd: number): void
```

Sets the file descriptor to use as the stderr for spawned processes.

If `fd` is -1 then any previously given fd is unset.

Note that the default behaviour is to pass stderr through to the
stderr of the parent process.

The passed `fd` belongs to the `GSubprocessLauncher`.  It will be
automatically closed when the launcher is finalized.  The file
descriptor will also be closed on the child side when executing the
spawned process.

You may not set a stderr fd if a stderr file path is already set or
if the launcher flags contain any flags directing stderr elsewhere.

This feature is only available on UNIX.

**Parameters**

- `fd`: a file descriptor, or -1

_Available since 2.40._

### `takeStdinFd`

```ts
takeStdinFd(fd: number): void
```

Sets the file descriptor to use as the stdin for spawned processes.

If `fd` is -1 then any previously given fd is unset.

Note that if your intention is to have the stdin of the calling
process inherited by the child then `G_SUBPROCESS_FLAGS_STDIN_INHERIT`
is a better way to go about doing that.

The passed `fd` is noted but will not be touched in the current
process.  It is therefore necessary that it be kept open by the
caller until the subprocess is spawned.  The file descriptor will
also not be explicitly closed on the child side, so it must be marked
O_CLOEXEC if that's what you want.

You may not set a stdin fd if a stdin file path is already set or if
the launcher flags contain any flags directing stdin elsewhere.

This feature is only available on UNIX.

**Parameters**

- `fd`: a file descriptor, or -1

_Available since 2.40._

### `takeStdoutFd`

```ts
takeStdoutFd(fd: number): void
```

Sets the file descriptor to use as the stdout for spawned processes.

If `fd` is -1 then any previously given fd is unset.

Note that the default behaviour is to pass stdout through to the
stdout of the parent process.

The passed `fd` is noted but will not be touched in the current
process.  It is therefore necessary that it be kept open by the
caller until the subprocess is spawned.  The file descriptor will
also not be explicitly closed on the child side, so it must be marked
O_CLOEXEC if that's what you want.

You may not set a stdout fd if a stdout file path is already set or
if the launcher flags contain any flags directing stdout elsewhere.

This feature is only available on UNIX.

**Parameters**

- `fd`: a file descriptor, or -1

_Available since 2.40._

### `unsetenv`

```ts
unsetenv(variable: string): void
```

Removes the environment variable `variable` from the environment of
processes launched from this launcher.

On UNIX, the variable's name can be an arbitrary byte string not
containing '='. On Windows, it should be in UTF-8.

**Parameters**

- `variable`: the environment variable to unset, must not contain '='

_Available since 2.40._
