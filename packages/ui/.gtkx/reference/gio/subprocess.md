---
description: "GSubprocess allows the creation of and interaction with child processes."
---

# GSubprocess

`GSubprocess` allows the creation of and interaction with child
processes.

Processes can be communicated with using standard GIO-style APIs (ie:
`Gio.InputStream`, `Gio.OutputStream`). There are GIO-style APIs
to wait for process termination (ie: cancellable and with an asynchronous
variant).

There is an API to force a process to terminate, as well as a
race-free API for sending UNIX signals to a subprocess.

One major advantage that GIO brings over the core GLib library is
comprehensive API for asynchronous I/O, such
`Gio.OutputStream.spliceAsync()`.  This makes `GSubprocess`
significantly more powerful and flexible than equivalent APIs in
some other languages such as the `subprocess.py`
included with Python.  For example, using `GSubprocess` one could
create two child processes, reading standard output from the first,
processing it, and writing to the input stream of the second, all
without blocking the main loop.

A powerful `Gio.Subprocess.communicate()` API is provided similar to the
`communicate()` method of `subprocess.py`. This enables very easy
interaction with a subprocess that has been opened with pipes.

`GSubprocess` defaults to tight control over the file descriptors open
in the child process, avoiding dangling-FD issues that are caused by
a simple `fork()`/`exec()`.  The only open file descriptors in the
spawned process are ones that were explicitly specified by the
`GSubprocess` API (unless `G_SUBPROCESS_FLAGS_INHERIT_FDS` was
specified).

`GSubprocess` will quickly reap all child processes as they exit,
avoiding ‘zombie processes’ remaining around for long periods of
time.  `Gio.Subprocess.wait()` can be used to wait for this to happen,
but it will happen even without the call being explicitly made.

As a matter of principle, `GSubprocess` has no API that accepts
shell-style space-separated strings.  It will, however, match the
typical shell behaviour of searching the `PATH` for executables that do
not contain a directory separator in their name. By default, the `PATH`
of the current process is used.  You can specify
`G_SUBPROCESS_FLAGS_SEARCH_PATH_FROM_ENVP` to use the `PATH` of the
launcher environment instead.

`GSubprocess` attempts to have a very simple API for most uses (ie:
spawning a subprocess with arguments and support for most typical
kinds of input and output redirection).  See `Gio.Subprocess.new()`. The
`Gio.SubprocessLauncher` API is provided for more complicated cases
(advanced types of redirection, environment variable manipulation,
change of working directory, child setup functions, etc).

A typical use of `GSubprocess` will involve calling
`Gio.Subprocess.new()`, followed by `Gio.Subprocess.waitAsync()` or
`Gio.Subprocess.wait()`.  After the process exits, the status can be
checked using functions such as `Gio.Subprocess.getIfExited()` (which
are similar to the familiar `WIFEXITED`-style POSIX macros).

Note that as of GLib 2.82, creating a `GSubprocess` causes the signal
`SIGPIPE` to be ignored for the remainder of the program. If you are writing
a command-line utility that uses `GSubprocess`, you may need to take into
account the fact that your program will not automatically be killed
if it tries to write to `stdout` after it has been closed.

_Available since 2.40._

```tsx
import { GSubprocess } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSubprocess**

Implements `GInitable`.

## Props

`ref` receives the `Gio.Subprocess` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `argv`

`string[]` · construct-only

Argument vector.

_Available since 2.40._

### `flags`

`Gio.SubprocessFlags` · default `G_SUBPROCESS_FLAGS_NONE` · construct-only

Subprocess flags.

_Available since 2.40._

## Methods

Methods are called on the `Gio.Subprocess` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `communicate`

```ts
communicate(stdinBuf: GLib.Bytes | null, cancellable: Gio.Cancellable | null): [boolean, GLib.Bytes | null, GLib.Bytes | null]
```

Communicate with the subprocess until it terminates, and all input
and output has been completed.

If `stdin_buf` is given, the subprocess must have been created with
`G_SUBPROCESS_FLAGS_STDIN_PIPE`.  The given data is fed to the
stdin of the subprocess and the pipe is closed (ie: EOF).

At the same time (as not to cause blocking when dealing with large
amounts of data), if `G_SUBPROCESS_FLAGS_STDOUT_PIPE` or
`G_SUBPROCESS_FLAGS_STDERR_PIPE` were used, reads from those
streams.  The data that was read is returned in `stdout` and/or
the `stderr`.

If the subprocess was created with `G_SUBPROCESS_FLAGS_STDOUT_PIPE`,
`stdout_buf` will contain the data read from stdout.  Otherwise, for
subprocesses not created with `G_SUBPROCESS_FLAGS_STDOUT_PIPE`,
`stdout_buf` will be set to `null`.  Similar provisions apply to
`stderr_buf` and `G_SUBPROCESS_FLAGS_STDERR_PIPE`.

As usual, any output variable may be given as `null` to ignore it.

If you desire the stdout and stderr data to be interleaved, create
the subprocess with `G_SUBPROCESS_FLAGS_STDOUT_PIPE` and
`G_SUBPROCESS_FLAGS_STDERR_MERGE`.  The merged result will be returned
in `stdout_buf` and `stderr_buf` will be set to `null`.

In case of any error (including cancellation), `false` will be
returned with `error` set.  Some or all of the stdin data may have
been written.  Any stdout or stderr data that has been read will be
discarded. None of the out variables (aside from `error`) will have
been set to anything in particular and should not be inspected.

In the case that `true` is returned, the subprocess has exited and the
exit status inspection APIs (eg: `g_subprocess_get_if_exited()`,
`g_subprocess_get_exit_status()`) may be used.

You should not attempt to use any of the subprocess pipes after
starting this function, since they may be left in strange states,
even if the operation was cancelled.  You should especially not
attempt to interact with the pipes while the operation is in progress
(either from another thread or if using the asynchronous version).

**Parameters**

- `stdinBuf`: data to send to the stdin of the subprocess, or `null`
- `cancellable`: a `GCancellable`

**Returns** Tuple of:

- `result`: `true` if successful
- `stdoutBuf`: data read from the subprocess stdout
- `stderrBuf`: data read from the subprocess stderr

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `communicateAsync`

```ts
communicateAsync(stdinBuf: GLib.Bytes | null, cancellable?: Gio.Cancellable | null): Promise<[GLib.Bytes | null, GLib.Bytes | null]>
```

Asynchronous version of `g_subprocess_communicate()`.  Complete
invocation with `g_subprocess_communicate_finish()`.

**Parameters**

- `stdinBuf`: Input data, or `null`
- `cancellable`: Cancellable

**Returns** Tuple of:

- `stdoutBuf`: Return location for stdout data
- `stderrBuf`: Return location for stderr data

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `communicateFinish`

```ts
communicateFinish(result: Gio.AsyncResult): [boolean, GLib.Bytes | null, GLib.Bytes | null]
```

Complete an invocation of `g_subprocess_communicate_async()`.

**Parameters**

- `result`: Result

**Returns** Tuple of:

- `stdoutBuf`: Return location for stdout data
- `stderrBuf`: Return location for stderr data

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `communicateUtf8`

```ts
communicateUtf8(stdinBuf: string | null, cancellable: Gio.Cancellable | null): [boolean, string | null, string | null]
```

Like `g_subprocess_communicate()`, but validates the output of the
process as UTF-8, and returns it as a regular NUL terminated string.

On error, `stdout_buf` and `stderr_buf` will be set to undefined values and
should not be used.

**Parameters**

- `stdinBuf`: data to send to the stdin of the subprocess, or `null`
- `cancellable`: a `GCancellable`

**Returns** Tuple of:

- `stdoutBuf`: data read from the subprocess stdout
- `stderrBuf`: data read from the subprocess stderr

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `communicateUtf8Async`

```ts
communicateUtf8Async(stdinBuf: string | null, cancellable?: Gio.Cancellable | null): Promise<[string | null, string | null]>
```

Asynchronous version of `g_subprocess_communicate_utf8()`.  Complete
invocation with `g_subprocess_communicate_utf8_finish()`.

**Parameters**

- `stdinBuf`: Input data, or `null`
- `cancellable`: Cancellable

**Returns** Tuple of:

- `stdoutBuf`: Return location for stdout data
- `stderrBuf`: Return location for stderr data

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `communicateUtf8Finish`

```ts
communicateUtf8Finish(result: Gio.AsyncResult): [boolean, string | null, string | null]
```

Complete an invocation of `g_subprocess_communicate_utf8_async()`.

**Parameters**

- `result`: Result

**Returns** Tuple of:

- `stdoutBuf`: Return location for stdout data
- `stderrBuf`: Return location for stderr data

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

### `forceExit`

```ts
forceExit(): void
```

Use an operating-system specific method to attempt an immediate,
forceful termination of the process.  There is no mechanism to
determine whether or not the request itself was successful;
however, you can use `g_subprocess_wait()` to monitor the status of
the process after calling this function.

On Unix, this function sends `SIGKILL`.

_Available since 2.40._

### `getExitStatus`

```ts
getExitStatus(): number
```

Check the exit status of the subprocess, given that it exited
normally.  This is the value passed to the `exit()` system call or the
return value from main.

This is equivalent to the system WEXITSTATUS macro.

It is an error to call this function before `g_subprocess_wait()` and
unless `g_subprocess_get_if_exited()` returned `true`.

**Returns** the exit status

_Available since 2.40._

### `getIdentifier`

```ts
getIdentifier(): string | null
```

On UNIX, returns the process ID as a decimal string.
On Windows, returns the result of GetProcessId() also as a string.
If the subprocess has terminated, this will return `null`.

**Returns** the subprocess identifier, or `null` if the subprocess
   has terminated

_Available since 2.40._

### `getIfExited`

```ts
getIfExited(): boolean
```

Check if the given subprocess exited normally (ie: by way of `exit()`
or return from `main()`).

This is equivalent to the system WIFEXITED macro.

It is an error to call this function before `g_subprocess_wait()` has
returned.

**Returns** `true` if the case of a normal exit

_Available since 2.40._

### `getIfSignaled`

```ts
getIfSignaled(): boolean
```

Check if the given subprocess terminated in response to a signal.

This is equivalent to the system WIFSIGNALED macro.

It is an error to call this function before `g_subprocess_wait()` has
returned.

**Returns** `true` if the case of termination due to a signal

_Available since 2.40._

### `getStatus`

```ts
getStatus(): number
```

Gets the raw status code of the process, as from `waitpid()`.

This value has no particular meaning, but it can be used with the
macros defined by the system headers such as WIFEXITED.  It can also
be used with `g_spawn_check_wait_status()`.

It is more likely that you want to use `g_subprocess_get_if_exited()`
followed by `g_subprocess_get_exit_status()`.

It is an error to call this function before `g_subprocess_wait()` has
returned.

**Returns** the (meaningless) `waitpid()` exit status from the kernel

_Available since 2.40._

### `getStderrPipe`

```ts
getStderrPipe(): Gio.InputStream | null
```

Gets the `GInputStream` from which to read the stderr output of
`subprocess`.

The process must have been created with `G_SUBPROCESS_FLAGS_STDERR_PIPE`,
otherwise `null` will be returned.

**Returns** the stderr pipe

_Available since 2.40._

### `getStdinPipe`

```ts
getStdinPipe(): Gio.OutputStream | null
```

Gets the `GOutputStream` that you can write to in order to give data
to the stdin of `subprocess`.

The process must have been created with `G_SUBPROCESS_FLAGS_STDIN_PIPE` and
not `G_SUBPROCESS_FLAGS_STDIN_INHERIT`, otherwise `null` will be returned.

**Returns** the stdout pipe

_Available since 2.40._

### `getStdoutPipe`

```ts
getStdoutPipe(): Gio.InputStream | null
```

Gets the `GInputStream` from which to read the stdout output of
`subprocess`.

The process must have been created with `G_SUBPROCESS_FLAGS_STDOUT_PIPE`,
otherwise `null` will be returned.

**Returns** the stdout pipe

_Available since 2.40._

### `getSuccessful`

```ts
getSuccessful(): boolean
```

Checks if the process was "successful".  A process is considered
successful if it exited cleanly with an exit status of 0, either by
way of the `exit()` system call or return from `main()`.

It is an error to call this function before `g_subprocess_wait()` has
returned.

**Returns** `true` if the process exited cleanly with a exit status of 0

_Available since 2.40._

### `getTermSig`

```ts
getTermSig(): number
```

Get the signal number that caused the subprocess to terminate, given
that it terminated due to a signal.

This is equivalent to the system WTERMSIG macro.

It is an error to call this function before `g_subprocess_wait()` and
unless `g_subprocess_get_if_signaled()` returned `true`.

**Returns** the signal causing termination

_Available since 2.40._

### `sendSignal`

```ts
sendSignal(signalNum: number): void
```

Sends the UNIX signal `signal_num` to the subprocess, if it is still
running.

This API is race-free.  If the subprocess has terminated, it will not
be signalled.

This API is not available on Windows.

**Parameters**

- `signalNum`: the signal number to send

_Available since 2.40._

### `wait`

```ts
wait(cancellable: Gio.Cancellable | null): boolean
```

Synchronously wait for the subprocess to terminate.

After the process terminates you can query its exit status with
functions such as `g_subprocess_get_if_exited()` and
`g_subprocess_get_exit_status()`.

This function does not fail in the case of the subprocess having
abnormal termination.  See `g_subprocess_wait_check()` for that.

Cancelling `cancellable` doesn't kill the subprocess.  Call
`g_subprocess_force_exit()` if it is desirable.

**Parameters**

- `cancellable`: a `GCancellable`

**Returns** `true` on success, `false` if `cancellable` was cancelled

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `waitAsync`

```ts
waitAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Wait for the subprocess to terminate.

This is the asynchronous version of `g_subprocess_wait()`.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if successful, or `false` with `error` set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `waitCheck`

```ts
waitCheck(cancellable: Gio.Cancellable | null): boolean
```

Combines `g_subprocess_wait()` with `g_spawn_check_wait_status()`.

**Parameters**

- `cancellable`: a `GCancellable`

**Returns** `true` on success, `false` if process exited abnormally, or
`cancellable` was cancelled

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `waitCheckAsync`

```ts
waitCheckAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>
```

Combines `g_subprocess_wait_async()` with `g_spawn_check_wait_status()`.

This is the asynchronous version of `g_subprocess_wait_check()`.

**Parameters**

- `cancellable`: a `GCancellable`, or `null`

**Returns** `true` if successful, or `false` with `error` set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `waitCheckFinish`

```ts
waitCheckFinish(result: Gio.AsyncResult): boolean
```

Collects the result of a previous call to
`g_subprocess_wait_check_async()`.

**Parameters**

- `result`: the `GAsyncResult` passed to your `GAsyncReadyCallback`

**Returns** `true` if successful, or `false` with `error` set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._

### `waitFinish`

```ts
waitFinish(result: Gio.AsyncResult): boolean
```

Collects the result of a previous call to
`g_subprocess_wait_async()`.

**Parameters**

- `result`: the `GAsyncResult` passed to your `GAsyncReadyCallback`

**Returns** `true` if successful, or `false` with `error` set

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.40._
