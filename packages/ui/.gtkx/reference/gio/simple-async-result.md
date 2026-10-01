---
description: "As of GLib 2.46, GSimpleAsyncResult is deprecated in favor of Gio.Task, which provides a simpler API."
---

# GSimpleAsyncResult

As of GLib 2.46, `GSimpleAsyncResult` is deprecated in favor of
`Gio.Task`, which provides a simpler API.

`GSimpleAsyncResult` implements `Gio.AsyncResult`.

`GSimpleAsyncResult` handles `Gio.AsyncReadyCallback`s, error
reporting, operation cancellation and the final state of an operation,
completely transparent to the application. Results can be returned
as a pointer e.g. for functions that return data that is collected
asynchronously, a boolean value for checking the success or failure
of an operation, or a `gssize` for operations which return the number
of bytes modified by the operation; all of the simple return cases
are covered.

Most of the time, an application will not need to know of the details
of this API; it is handled transparently, and any necessary operations
are handled by `Gio.AsyncResult`’s interface. However, if implementing
a new GIO module, for writing language bindings, or for complex
applications that need better control of how asynchronous operations
are completed, it is important to understand this functionality.

`GSimpleAsyncResult`s are tagged with the calling function to ensure
that asynchronous functions and their finishing functions are used
together correctly.

To create a new `GSimpleAsyncResult`, call `Gio.SimpleAsyncResult.new()`.
If the result needs to be created for a `GError`, use
`Gio.SimpleAsyncResult.newFromError()` or
`Gio.SimpleAsyncResult.newTakeError()`. If a `GError` is not available
(e.g. the asynchronous operation doesn’t take a `GError` argument),
but the result still needs to be created for an error condition, use
`Gio.SimpleAsyncResult.newError()` (or
`Gio.SimpleAsyncResult.setErrorVa()` if your application or binding
requires passing a variable argument list directly), and the error can then
be propagated through the use of
`Gio.SimpleAsyncResult.propagateError()`.

An asynchronous operation can be made to ignore a cancellation event by
calling `Gio.SimpleAsyncResult.setHandleCancellation()` with a
`GSimpleAsyncResult` for the operation and `FALSE`. This is useful for
operations that are dangerous to cancel, such as close (which would
cause a leak if cancelled before being run).

`GSimpleAsyncResult` can integrate into GLib’s event loop,
`GLib.MainLoop`, or it can use `GLib.Thread`s.
`Gio.SimpleAsyncResult.complete()` will finish an I/O task directly
from the point where it is called.
`Gio.SimpleAsyncResult.completeInIdle()` will finish it from an idle
handler in the  thread-default main context (see
`GLib.MainContext.pushThreadDefault()`) where the `GSimpleAsyncResult`
was created. `Gio.SimpleAsyncResult.runInThread()` will run the job in
a separate thread and then use
`Gio.SimpleAsyncResult.completeInIdle()` to deliver the result.

To set the results of an asynchronous function,
`Gio.SimpleAsyncResult.setOpResGpointer()`,
`Gio.SimpleAsyncResult.setOpResGboolean()`, and
`Gio.SimpleAsyncResult.setOpResGssize()`
are provided, setting the operation's result to a `gpointer`, `gboolean`, or
`gssize`, respectively.

Likewise, to get the result of an asynchronous function,
`Gio.SimpleAsyncResult.getOpResGpointer()`,
`Gio.SimpleAsyncResult.getOpResGboolean()`, and
`Gio.SimpleAsyncResult.getOpResGssize()` are
provided, getting the operation’s result as a `gpointer`, `gboolean`, and
`gssize`, respectively.

For the details of the requirements implementations must respect, see
`Gio.AsyncResult`.  A typical implementation of an asynchronous
operation using `GSimpleAsyncResult` looks something like this:

```c
static void
baked_cb (Cake    *cake,
          gpointer user_data)
{
  // In this example, this callback is not given a reference to the cake,
  // so the GSimpleAsyncResult has to take a reference to it.
  GSimpleAsyncResult *result = user_data;

  if (cake == NULL)
    g_simple_async_result_set_error (result,
                                     BAKER_ERRORS,
                                     BAKER_ERROR_NO_FLOUR,
                                     "Go to the supermarket");
  else
    g_simple_async_result_set_op_res_gpointer (result,
                                               g_object_ref (cake),
                                               g_object_unref);


  // In this example, we assume that baked_cb is called as a callback from
  // the mainloop, so it's safe to complete the operation synchronously here.
  // If, however, _baker_prepare_cake () might call its callback without
  // first returning to the mainloop — inadvisable, but some APIs do so —
  // we would need to use g_simple_async_result_complete_in_idle().
  g_simple_async_result_complete (result);
  g_object_unref (result);
}

void
baker_bake_cake_async (Baker              *self,
                       guint               radius,
                       GAsyncReadyCallback callback,
                       gpointer            user_data)
{
  GSimpleAsyncResult *simple;
  Cake               *cake;

  if (radius < 3)
    {
      g_simple_async_report_error_in_idle (G_OBJECT (self),
                                           callback,
                                           user_data,
                                           BAKER_ERRORS,
                                           BAKER_ERROR_TOO_SMALL,
                                           "%ucm radius cakes are silly",
                                           radius);
      return;
    }

  simple = g_simple_async_result_new (G_OBJECT (self),
                                      callback,
                                      user_data,
                                      baker_bake_cake_async);
  cake = _baker_get_cached_cake (self, radius);

  if (cake != NULL)
    {
      g_simple_async_result_set_op_res_gpointer (simple,
                                                 g_object_ref (cake),
                                                 g_object_unref);
      g_simple_async_result_complete_in_idle (simple);
      g_object_unref (simple);
      // Drop the reference returned by _baker_get_cached_cake();
      // the GSimpleAsyncResult has taken its own reference.
      g_object_unref (cake);
      return;
    }

  _baker_prepare_cake (self, radius, baked_cb, simple);
}

Cake *
baker_bake_cake_finish (Baker        *self,
                        GAsyncResult *result,
                        GError      **error)
{
  GSimpleAsyncResult *simple;
  Cake               *cake;

  g_return_val_if_fail (g_simple_async_result_is_valid (result,
                                                        G_OBJECT (self),
                                                        baker_bake_cake_async),
                        NULL);

  simple = (GSimpleAsyncResult *) result;

  if (g_simple_async_result_propagate_error (simple, error))
    return NULL;

  cake = CAKE (g_simple_async_result_get_op_res_gpointer (simple));
  return g_object_ref (cake);
}
```

```tsx
import { GSimpleAsyncResult } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSimpleAsyncResult**

Implements `GAsyncResult`.

## Props

`ref` receives the `Gio.SimpleAsyncResult` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

## Methods

Methods are called on the `Gio.SimpleAsyncResult` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `complete`

```ts
complete(): void
```

Completes an asynchronous I/O job immediately. Must be called in
the thread where the asynchronous result was to be delivered, as it
invokes the callback directly. If you are in a different thread use
`g_simple_async_result_complete_in_idle()`.

Calling this function takes a reference to `simple` for as long as
is needed to complete the call.

> **Deprecated since 2.46.** Use `GTask` instead.

### `completeInIdle`

```ts
completeInIdle(): void
```

Completes an asynchronous function in an idle handler in the
thread-default main context (see `GLib.MainContext.pushThreadDefault()`)
of the thread that `simple` was initially created in
(and re-pushes that context around the invocation of the callback).

Calling this function takes a reference to `simple` for as long as
is needed to complete the call.

> **Deprecated since 2.46.** Use `GTask` instead.

### `getOpResGboolean`

```ts
getOpResGboolean(): boolean
```

Gets the operation result boolean from within the asynchronous result.

**Returns** `true` if the operation's result was `true`, `false`
    if the operation's result was `false`.

> **Deprecated since 2.46.** Use `GTask` and `g_task_propagate_boolean()` instead.

### `getOpResGssize`

```ts
getOpResGssize(): number
```

Gets a gssize from the asynchronous result.

**Returns** a gssize returned from the asynchronous function.

> **Deprecated since 2.46.** Use `GTask` and `g_task_propagate_int()` instead.

### `propagateError`

```ts
propagateError(): boolean
```

Propagates an error from within the simple asynchronous result to
a given destination.

If the `GCancellable` given to a prior call to
`g_simple_async_result_set_check_cancellable()` is cancelled then this
function will return `true` with `dest` set appropriately.

**Returns** `true` if the error was propagated to `dest`. `false` otherwise.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 2.46.** Use `GTask` instead.

### `setCheckCancellable`

```ts
setCheckCancellable(checkCancellable: Gio.Cancellable | null): void
```

Sets a `GCancellable` to check before dispatching results.

This function has one very specific purpose: the provided cancellable
is checked at the time of `g_simple_async_result_propagate_error()` If
it is cancelled, these functions will return an "Operation was
cancelled" error (`G_IO_ERROR_CANCELLED`).

Implementors of cancellable asynchronous functions should use this in
order to provide a guarantee to their callers that cancelling an
async operation will reliably result in an error being returned for
that operation (even if a positive result for the operation has
already been sent as an idle to the main context to be dispatched).

The checking described above is done regardless of any call to the
unrelated `g_simple_async_result_set_handle_cancellation()` function.

**Parameters**

- `checkCancellable`: a `GCancellable` to check, or `null` to unset

> **Deprecated since 2.46.** Use `GTask` instead.

_Available since 2.32._

### `setFromError`

```ts
setFromError(error: GLib.Error): void
```

Sets the result from a `GError`.

**Parameters**

- `error`: `GError`.

> **Deprecated since 2.46.** Use `GTask` and `g_task_return_error()` instead.

### `setHandleCancellation`

```ts
setHandleCancellation(handleCancellation: boolean): void
```

Sets whether to handle cancellation within the asynchronous operation.

This function has nothing to do with
`g_simple_async_result_set_check_cancellable()`.  It only refers to the
`GCancellable` passed to `g_simple_async_result_run_in_thread()`.

**Parameters**

- `handleCancellation`: a `gboolean`.

> **Deprecated since 2.46.**

### `setOpResGboolean`

```ts
setOpResGboolean(opRes: boolean): void
```

Sets the operation result to a boolean within the asynchronous result.

**Parameters**

- `opRes`: a `gboolean`.

> **Deprecated since 2.46.** Use `GTask` and `g_task_return_boolean()` instead.

### `setOpResGssize`

```ts
setOpResGssize(opRes: number): void
```

Sets the operation result within the asynchronous result to
the given `op_res`.

**Parameters**

- `opRes`: a `gssize`.

> **Deprecated since 2.46.** Use `GTask` and `g_task_return_int()` instead.
