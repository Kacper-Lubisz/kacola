---
description: "A GTask represents and manages a cancellable ‘task’."
---

# GTask

A `GTask` represents and manages a cancellable ‘task’.

### Asynchronous operations

The most common usage of `GTask` is as a `Gio.AsyncResult`, to
manage data during an asynchronous operation. You call
`Gio.Task.new()` in the ‘start’ method, followed by
`Gio.Task.setTaskData()` and the like if you need to keep some
additional data associated with the task, and then pass the
task object around through your asynchronous operation.
Eventually, you will call a method such as
`Gio.Task.returnPointer()` or `Gio.Task.returnError()`, which
will save the value you give it and then invoke the task’s callback
function in the thread-default main context (see
`GLib.MainContext.pushThreadDefault()`)
where it was created (waiting until the next iteration of the main
loop first, if necessary). The caller will pass the `GTask` back to
the operation’s finish function (as a `Gio.AsyncResult`), and you can
use `Gio.Task.propagatePointer()` or the like to extract the
return value.

Using `GTask` requires the thread-default `GLib.MainContext` from when
the `GTask` was constructed to be running at least until the task has
completed and its data has been freed.

If a `GTask` has been constructed and its callback set, it is an error to
not call `g_task_return_*()` on it. GLib will warn at runtime if this happens
(since 2.76).

Here is an example for using `GTask` as a `Gio.AsyncResult`:
```c
typedef struct {
  CakeFrostingType frosting;
  char *message;
} DecorationData;

static void
decoration_data_free (DecorationData *decoration)
{
  g_free (decoration->message);
  g_slice_free (DecorationData, decoration);
}

static void
baked_cb (Cake     *cake,
          gpointer  user_data)
{
  GTask *task = user_data;
  DecorationData *decoration = g_task_get_task_data (task);
  GError *error = NULL;

  if (cake == NULL)
    {
      g_task_return_new_error (task, BAKER_ERROR, BAKER_ERROR_NO_FLOUR,
                               "Go to the supermarket");
      g_object_unref (task);
      return;
    }

  if (!cake_decorate (cake, decoration->frosting, decoration->message, &error))
    {
      g_object_unref (cake);
      // g_task_return_error() takes ownership of error
      g_task_return_error (task, error);
      g_object_unref (task);
      return;
    }

  g_task_return_pointer (task, cake, g_object_unref);
  g_object_unref (task);
}

void
baker_bake_cake_async (Baker               *self,
                       guint                radius,
                       CakeFlavor           flavor,
                       CakeFrostingType     frosting,
                       const char          *message,
                       GCancellable        *cancellable,
                       GAsyncReadyCallback  callback,
                       gpointer             user_data)
{
  GTask *task;
  DecorationData *decoration;
  Cake  *cake;

  task = g_task_new (self, cancellable, callback, user_data);
  if (radius < 3)
    {
      g_task_return_new_error (task, BAKER_ERROR, BAKER_ERROR_TOO_SMALL,
                               "%ucm radius cakes are silly",
                               radius);
      g_object_unref (task);
      return;
    }

  cake = _baker_get_cached_cake (self, radius, flavor, frosting, message);
  if (cake != NULL)
    {
      // _baker_get_cached_cake() returns a reffed cake
      g_task_return_pointer (task, cake, g_object_unref);
      g_object_unref (task);
      return;
    }

  decoration = g_slice_new (DecorationData);
  decoration->frosting = frosting;
  decoration->message = g_strdup (message);
  g_task_set_task_data (task, decoration, (GDestroyNotify) decoration_data_free);

  _baker_begin_cake (self, radius, flavor, cancellable, baked_cb, task);
}

Cake *
baker_bake_cake_finish (Baker         *self,
                        GAsyncResult  *result,
                        GError       **error)
{
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}
```

### Chained asynchronous operations

`GTask` also tries to simplify asynchronous operations that
internally chain together several smaller asynchronous
operations. `Gio.Task.getCancellable()`, `Gio.Task.getContext()`,
and `Gio.Task.getPriority()` allow you to get back the task’s
`Gio.Cancellable`, `GLib.MainContext`, and
[I/O priority](iface.AsyncResult.html#io-priority)
when starting a new subtask, so you don’t have to keep track
of them yourself. `Gio.Task.attachSource()` simplifies the case
of waiting for a source to fire (automatically using the correct
`GLib.MainContext` and priority).

Here is an example for chained asynchronous operations:
```c
typedef struct {
  Cake *cake;
  CakeFrostingType frosting;
  char *message;
} BakingData;

static void
decoration_data_free (BakingData *bd)
{
  if (bd->cake)
    g_object_unref (bd->cake);
  g_free (bd->message);
  g_slice_free (BakingData, bd);
}

static void
decorated_cb (Cake         *cake,
              GAsyncResult *result,
              gpointer      user_data)
{
  GTask *task = user_data;
  GError *error = NULL;

  if (!cake_decorate_finish (cake, result, &error))
    {
      g_object_unref (cake);
      g_task_return_error (task, error);
      g_object_unref (task);
      return;
    }

  // baking_data_free() will drop its ref on the cake, so we have to
  // take another here to give to the caller.
  g_task_return_pointer (task, g_object_ref (cake), g_object_unref);
  g_object_unref (task);
}

static gboolean
decorator_ready (gpointer user_data)
{
  GTask *task = user_data;
  BakingData *bd = g_task_get_task_data (task);

  cake_decorate_async (bd->cake, bd->frosting, bd->message,
                       g_task_get_cancellable (task),
                       decorated_cb, task);

  return G_SOURCE_REMOVE;
}

static void
baked_cb (Cake     *cake,
          gpointer  user_data)
{
  GTask *task = user_data;
  BakingData *bd = g_task_get_task_data (task);
  GError *error = NULL;

  if (cake == NULL)
    {
      g_task_return_new_error (task, BAKER_ERROR, BAKER_ERROR_NO_FLOUR,
                               "Go to the supermarket");
      g_object_unref (task);
      return;
    }

  bd->cake = cake;

  // Bail out now if the user has already cancelled
  if (g_task_return_error_if_cancelled (task))
    {
      g_object_unref (task);
      return;
    }

  if (cake_decorator_available (cake))
    decorator_ready (task);
  else
    {
      GSource *source;

      source = cake_decorator_wait_source_new (cake);
      // Attach @source to @task’s GMainContext and have it call
      // decorator_ready() when it is ready.
      g_task_attach_source (task, source, decorator_ready);
      g_source_unref (source);
    }
}

void
baker_bake_cake_async (Baker               *self,
                       guint                radius,
                       CakeFlavor           flavor,
                       CakeFrostingType     frosting,
                       const char          *message,
                       gint                 priority,
                       GCancellable        *cancellable,
                       GAsyncReadyCallback  callback,
                       gpointer             user_data)
{
  GTask *task;
  BakingData *bd;

  task = g_task_new (self, cancellable, callback, user_data);
  g_task_set_priority (task, priority);

  bd = g_slice_new0 (BakingData);
  bd->frosting = frosting;
  bd->message = g_strdup (message);
  g_task_set_task_data (task, bd, (GDestroyNotify) baking_data_free);

  _baker_begin_cake (self, radius, flavor, cancellable, baked_cb, task);
}

Cake *
baker_bake_cake_finish (Baker         *self,
                        GAsyncResult  *result,
                        GError       **error)
{
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}
```

### Asynchronous operations from synchronous ones

You can use `Gio.Task.runInThread()` to turn a synchronous
operation into an asynchronous one, by running it in a thread.
When it completes, the result will be dispatched to the thread-default
main context (see `GLib.MainContext.pushThreadDefault()`)
where the `GTask` was created.

Running a task in a thread:
```c
typedef struct {
  guint radius;
  CakeFlavor flavor;
  CakeFrostingType frosting;
  char *message;
} CakeData;

static void
cake_data_free (CakeData *cake_data)
{
  g_free (cake_data->message);
  g_slice_free (CakeData, cake_data);
}

static void
bake_cake_thread (GTask         *task,
                  gpointer       source_object,
                  gpointer       task_data,
                  GCancellable  *cancellable)
{
  Baker *self = source_object;
  CakeData *cake_data = task_data;
  Cake *cake;
  GError *error = NULL;

  cake = bake_cake (baker, cake_data->radius, cake_data->flavor,
                    cake_data->frosting, cake_data->message,
                    cancellable, &error);
  if (cake)
    g_task_return_pointer (task, cake, g_object_unref);
  else
    g_task_return_error (task, error);
}

void
baker_bake_cake_async (Baker               *self,
                       guint                radius,
                       CakeFlavor           flavor,
                       CakeFrostingType     frosting,
                       const char          *message,
                       GCancellable        *cancellable,
                       GAsyncReadyCallback  callback,
                       gpointer             user_data)
{
  CakeData *cake_data;
  GTask *task;

  cake_data = g_slice_new (CakeData);
  cake_data->radius = radius;
  cake_data->flavor = flavor;
  cake_data->frosting = frosting;
  cake_data->message = g_strdup (message);
  task = g_task_new (self, cancellable, callback, user_data);
  g_task_set_task_data (task, cake_data, (GDestroyNotify) cake_data_free);
  g_task_run_in_thread (task, bake_cake_thread);
  g_object_unref (task);
}

Cake *
baker_bake_cake_finish (Baker         *self,
                        GAsyncResult  *result,
                        GError       **error)
{
  g_return_val_if_fail (g_task_is_valid (result, self), NULL);

  return g_task_propagate_pointer (G_TASK (result), error);
}
```

### Adding cancellability to uncancellable tasks

Finally, `Gio.Task.runInThread()` and
`Gio.Task.runInThreadSync()` can be used to turn an uncancellable
operation into a cancellable one. If you call
`Gio.Task.setReturnOnCancel()`, passing `TRUE`, then if the task’s
`Gio.Cancellable` is cancelled, it will return control back to the
caller immediately, while allowing the task thread to continue running in the
background (and simply discarding its result when it finally does finish).
Provided that the task thread is careful about how it uses
locks and other externally-visible resources, this allows you
to make ‘GLib-friendly’ asynchronous and cancellable
synchronous variants of blocking APIs.

Cancelling a task:
```c
static void
bake_cake_thread (GTask         *task,
                  gpointer       source_object,
                  gpointer       task_data,
                  GCancellable  *cancellable)
{
  Baker *self = source_object;
  CakeData *cake_data = task_data;
  Cake *cake;
  GError *error = NULL;

  cake = bake_cake (baker, cake_data->radius, cake_data->flavor,
                    cake_data->frosting, cake_data->message,
                    &error);
  if (error)
    {
      g_task_return_error (task, error);
      return;
    }

  // If the task has already been cancelled, then we don’t want to add
  // the cake to the cake cache. Likewise, we don’t  want to have the
  // task get cancelled in the middle of updating the cache.
  // g_task_set_return_on_cancel() will return %TRUE here if it managed
  // to disable return-on-cancel, or %FALSE if the task was cancelled
  // before it could.
  if (g_task_set_return_on_cancel (task, FALSE))
    {
      // If the caller cancels at this point, their
      // GAsyncReadyCallback won’t be invoked until we return,
      // so we don’t have to worry that this code will run at
      // the same time as that code does. But if there were
      // other functions that might look at the cake cache,
      // then we’d probably need a GMutex here as well.
      baker_add_cake_to_cache (baker, cake);
      g_task_return_pointer (task, cake, g_object_unref);
    }
}

void
baker_bake_cake_async (Baker               *self,
                       guint                radius,
                       CakeFlavor           flavor,
                       CakeFrostingType     frosting,
                       const char          *message,
                       GCancellable        *cancellable,
                       GAsyncReadyCallback  callback,
                       gpointer             user_data)
{
  CakeData *cake_data;
  GTask *task;

  cake_data = g_slice_new (CakeData);

  ...

  task = g_task_new (self, cancellable, callback, user_data);
  g_task_set_task_data (task, cake_data, (GDestroyNotify) cake_data_free);
  g_task_set_return_on_cancel (task, TRUE);
  g_task_run_in_thread (task, bake_cake_thread);
}

Cake *
baker_bake_cake_sync (Baker               *self,
                      guint                radius,
                      CakeFlavor           flavor,
                      CakeFrostingType     frosting,
                      const char          *message,
                      GCancellable        *cancellable,
                      GError             **error)
{
  CakeData *cake_data;
  GTask *task;
  Cake *cake;

  cake_data = g_slice_new (CakeData);

  ...

  task = g_task_new (self, cancellable, NULL, NULL);
  g_task_set_task_data (task, cake_data, (GDestroyNotify) cake_data_free);
  g_task_set_return_on_cancel (task, TRUE);
  g_task_run_in_thread_sync (task, bake_cake_thread);

  cake = g_task_propagate_pointer (task, error);
  g_object_unref (task);
  return cake;
}
```

### Porting from `Gio.SimpleAsyncResult`

`GTask`’s API attempts to be simpler than `Gio.SimpleAsyncResult`’s
in several ways:

- You can save task-specific data with `Gio.Task.setTaskData()`, and
  retrieve it later with `Gio.Task.getTaskData()`. This replaces the
  abuse of `Gio.SimpleAsyncResult.setOpResGpointer()` for the same
  purpose with `Gio.SimpleAsyncResult`.
- In addition to the task data, `GTask` also keeps track of the
  [priority](iface.AsyncResult.html#io-priority), `Gio.Cancellable`,
  and `GLib.MainContext` associated with the task, so tasks that
  consist of a chain of simpler asynchronous operations will have easy access
  to those values when starting each sub-task.
- `Gio.Task.returnErrorIfCancelled()` provides simplified
  handling for cancellation. In addition, cancellation
  overrides any other `GTask` return value by default, like
  `Gio.SimpleAsyncResult` does when
  `Gio.SimpleAsyncResult.setCheckCancellable()` is called.
  (You can use `Gio.Task.setCheckCancellable()` to turn off that
  behavior.) On the other hand, `Gio.Task.runInThread()`
  guarantees that it will always run your
  `task_func`, even if the task’s `Gio.Cancellable`
  is already cancelled before the task gets a chance to run;
  you can start your `task_func` with a
  `Gio.Task.returnErrorIfCancelled()` check if you need the
  old behavior.
- The ‘return’ methods (eg, `Gio.Task.returnPointer()`)
  automatically cause the task to be ‘completed’ as well, and
  there is no need to worry about the ‘complete’ vs ‘complete in idle’
  distinction. (`GTask` automatically figures out
  whether the task’s callback can be invoked directly, or
  if it needs to be sent to another `GLib.MainContext`, or delayed
  until the next iteration of the current `GLib.MainContext`.)
- The ‘finish’ functions for `GTask` based operations are generally
  much simpler than `Gio.SimpleAsyncResult` ones, normally consisting
  of only a single call to `Gio.Task.propagatePointer()` or the like.
  Since `Gio.Task.propagatePointer()` ‘steals’ the return value from
  the `GTask`, it is not necessary to juggle pointers around to
  prevent it from being freed twice.
- With `Gio.SimpleAsyncResult`, it was common to call
  `Gio.SimpleAsyncResult.propagateError()` from the
  `_finish()` wrapper function, and have
  virtual method implementations only deal with successful
  returns. This behavior is deprecated, because it makes it
  difficult for a subclass to chain to a parent class’s async
  methods. Instead, the wrapper function should just be a
  simple wrapper, and the virtual method should call an
  appropriate `g_task_propagate_` function.
  Note that wrapper methods can now use
  `Gio.AsyncResult.legacyPropagateError()` to do old-style
  `Gio.SimpleAsyncResult` error-returning behavior, and
  `Gio.AsyncResult.isTagged()` to check if a result is tagged as
  having come from the `_async()` wrapper
  function (for ‘short-circuit’ results, such as when passing
  `0` to `Gio.InputStream.readAsync()`).

### Thread-safety considerations

Due to some infelicities in the API design, there is a
thread-safety concern that users of `GTask` have to be aware of:

If the `main` thread drops its last reference to the source object
or the task data before the task is finalized, then the finalizers
of these objects may be called on the worker thread.

This is a problem if the finalizers use non-threadsafe API, and
can lead to hard-to-debug crashes. Possible workarounds include:

- Clear task data in a signal handler for `notify::completed`
- Keep iterating a main context in the main thread and defer
  dropping the reference to the source object to that main
  context when the task is finalized

```tsx
import { GTask } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GTask**

Implements `GAsyncResult`.

## Props

`ref` receives the `Gio.Task` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `completed`

`boolean` · default `false` · read-only, observe with `onNotifyCompleted`

Whether the task has completed, meaning its callback (if set) has been
invoked.

This can only happen after `g_task_return_pointer()`,
`g_task_return_error()` or one of the other return functions have been called
on the task. However, it is not guaranteed to happen immediately after
those functions are called, as the task’s callback may need to be scheduled
to run in a different thread.

That means it is **not safe** to use this property to track whether a
return function has been called on the `GTask`. Callers must do that
tracking themselves, typically by linking the lifetime of the `GTask` to the
control flow of their code.

This property is guaranteed to change from `false` to `true` exactly once.

The `GObject.notify` signal for this change is emitted in the same main
context as the task’s callback, immediately after that callback is invoked.

_Available since 2.44._

## Methods

Methods are called on the `Gio.Task` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getCancellable`

```ts
getCancellable(): Gio.Cancellable | null
```

Gets `task`'s `GCancellable`

**Returns** `task`'s `GCancellable`

_Available since 2.36._

### `getCheckCancellable`

```ts
getCheckCancellable(): boolean
```

Gets `task`'s check-cancellable flag. See
`g_task_set_check_cancellable()` for more details.

_Available since 2.36._

### `getCompleted`

```ts
getCompleted(): boolean
```

Gets the value of `GTask.completed`. This changes from `false` to `true` after
the task’s callback is invoked, and will return `false` if called from inside
the callback.

**Returns** `true` if the task has completed, `false` otherwise.

_Available since 2.44._

### `getContext`

```ts
getContext(): GLib.MainContext
```

Gets the `GMainContext` that `task` will return its result in (that
is, the context that was the thread-default main context
(see `GLib.MainContext.pushThreadDefault()`)
at the point when `task` was created).

This will always return a non-`null` value, even if the task's
context is the default `GMainContext`.

**Returns** `task`'s `GMainContext`

_Available since 2.36._

### `getName`

```ts
getName(): string | null
```

Gets `task`’s name. See `g_task_set_name()`.

**Returns** `task`’s name, or `null`

_Available since 2.60._

### `getPriority`

```ts
getPriority(): number
```

Gets `task`'s priority

**Returns** `task`'s priority

_Available since 2.36._

### `getReturnOnCancel`

```ts
getReturnOnCancel(): boolean
```

Gets `task`'s return-on-cancel flag. See
`g_task_set_return_on_cancel()` for more details.

_Available since 2.36._

### `getSourceObject`

```ts
getSourceObject(): GObject.Object | null
```

Gets the source object from `task`. Like
`g_async_result_get_source_object()`, but does not ref the object.

**Returns** `task`'s source object, or `null`

_Available since 2.36._

### `getSourceTag`

```ts
getSourceTag(): bigint | null
```

Gets `task`'s source tag. See `g_task_set_source_tag()`.

**Returns** `task`'s source tag

_Available since 2.36._

### `getTaskData`

```ts
getTaskData(): bigint | null
```

Gets `task`'s `task_data`.

**Returns** `task`'s `task_data`.

_Available since 2.36._

### `hadError`

```ts
hadError(): boolean
```

Tests if `task` resulted in an error.

**Returns** `true` if the task resulted in an error, `false` otherwise.

_Available since 2.36._

### `propagateBoolean`

```ts
propagateBoolean(): boolean
```

Gets the result of `task` as a `gboolean`.

If the task resulted in an error, or was cancelled, then this will
instead return `false` and set `error`.

Since this method transfers ownership of the return value (or
error) to the caller, you may only call it once.

**Returns** the task result, or `false` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `propagateInt`

```ts
propagateInt(): number
```

Gets the result of `task` as an integer (`gssize`).

If the task resulted in an error, or was cancelled, then this will
instead return -1 and set `error`.

Since this method transfers ownership of the return value (or
error) to the caller, you may only call it once.

**Returns** the task result, or -1 on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `propagatePointer`

```ts
propagatePointer(): bigint | null
```

Gets the result of `task` as a pointer, and transfers ownership
of that value to the caller.

If the task resulted in an error, or was cancelled, then this will
instead return `null` and set `error`.

Since this method transfers ownership of the return value (or
error) to the caller, you may only call it once.

**Returns** the task result, or `null` on error

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.36._

### `propagateValue`

```ts
propagateValue(): [boolean, unknown]
```

Gets the result of `task` as a `GValue`, and transfers ownership of
that value to the caller. As with `g_task_return_value()`, this is
a generic low-level method; `g_task_propagate_pointer()` and the like
will usually be more useful for C code.

If the task resulted in an error, or was cancelled, then this will
instead set `error` and return `false`.

Since this method transfers ownership of the return value (or
error) to the caller, you may only call it once.

**Returns** Tuple of:

- `result`: `true` if `task` succeeded, `false` on error.
- `value`: return location for the `GValue`

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.64._

### `returnBoolean`

```ts
returnBoolean(result: boolean): void
```

Sets `task`'s result to `result` and completes the task (see
`g_task_return_pointer()` for more discussion of exactly what this
means).

**Parameters**

- `result`: the `gboolean` result of a task function.

_Available since 2.36._

### `returnError`

```ts
returnError(error: GLib.Error): void
```

Sets `task`'s result to `error` (which `task` assumes ownership of)
and completes the task (see `g_task_return_pointer()` for more
discussion of exactly what this means).

Note that since the task takes ownership of `error`, and since the
task may be completed before returning from `g_task_return_error()`,
you cannot assume that `error` is still valid after calling this.
Call `g_error_copy()` on the error if you need to keep a local copy
as well.

See also `Gio.Task.returnNewError()`,
`Gio.Task.returnNewErrorLiteral()`.

**Parameters**

- `error`: the `GError` result of a task function.

_Available since 2.36._

### `returnErrorIfCancelled`

```ts
returnErrorIfCancelled(): boolean
```

Checks if `task`'s `GCancellable` has been cancelled, and if so, sets
`task`'s error accordingly and completes the task (see
`g_task_return_pointer()` for more discussion of exactly what this
means).

**Returns** `true` if `task` has been cancelled, `false` if not

_Available since 2.36._

### `returnInt`

```ts
returnInt(result: number): void
```

Sets `task`'s result to `result` and completes the task (see
`g_task_return_pointer()` for more discussion of exactly what this
means).

**Parameters**

- `result`: the integer (`gssize`) result of a task function.

_Available since 2.36._

### `returnNewErrorLiteral`

```ts
returnNewErrorLiteral(domain: GLib.Quark, code: number, message: string): void
```

Sets `task`’s result to a new `GLib.Error` created from `domain`, `code`,
`message` and completes the task.

See `Gio.Task.returnPointer()` for more discussion of exactly what
‘completing the task’ means.

See also `Gio.Task.returnNewError()`.

**Parameters**

- `domain`: a `GQuark`.
- `code`: an error code.
- `message`: an error message

_Available since 2.80._

### `returnPointer`

```ts
returnPointer(result: bigint | null, resultDestroy: GLib.DestroyNotify | null): void
```

Sets `task`'s result to `result` and completes the task. If `result`
is not `null`, then `result_destroy` will be used to free `result` if
the caller does not take ownership of it with
`g_task_propagate_pointer()`.

"Completes the task" means that for an ordinary asynchronous task
it will either invoke the task's callback, or else queue that
callback to be invoked in the proper `GMainContext`, or in the next
iteration of the current `GMainContext`. For a task run via
`g_task_run_in_thread()` or `g_task_run_in_thread_sync()`, calling this
method will save `result` to be returned to the caller later, but
the task will not actually be completed until the `GTaskThreadFunc`
exits.

Note that since the task may be completed before returning from
`g_task_return_pointer()`, you cannot assume that `result` is still
valid after calling this, unless you are still holding another
reference on it.

**Parameters**

- `result`: the pointer result of a task function
- `resultDestroy`: a `GDestroyNotify` function.

_Available since 2.36._

### `returnValue`

```ts
returnValue(result: GObject.Value | null): void
```

Sets `task`'s result to `result` (by copying it) and completes the task.

If `result` is `null` then a `GValue` of type `G_TYPE_POINTER`
with a value of `null` will be used for the result.

This is a very generic low-level method intended primarily for use
by language bindings; for C code, `g_task_return_pointer()` and the
like will normally be much easier to use.

**Parameters**

- `result`: the `GValue` result of a task function

_Available since 2.64._

### `runInThread`

```ts
runInThread(taskFunc: Gio.TaskThreadFunc): void
```

Runs `task_func` in another thread. When `task_func` returns, `task`'s
`GAsyncReadyCallback` will be invoked in `task`'s `GMainContext`.

This takes a ref on `task` until the task completes.

See `GTaskThreadFunc` for more details about how `task_func` is handled.

Although GLib currently rate-limits the tasks queued via
`g_task_run_in_thread()`, you should not assume that it will always
do this. If you have a very large number of tasks to run (several tens of
tasks), but don't want them to all run at once, you should only queue a
limited number of them (around ten) at a time.

Be aware that if your task depends on other tasks to complete, use of this
function could lead to a livelock if the other tasks also use this function
and enough of them (around 10) execute in a dependency chain, as that will
exhaust the thread pool. If this situation is possible, consider using a
separate worker thread or thread pool explicitly, rather than using
`g_task_run_in_thread()`.

**Parameters**

- `taskFunc`: a `GTaskThreadFunc`

_Available since 2.36._

### `runInThreadSync`

```ts
runInThreadSync(taskFunc: Gio.TaskThreadFunc): void
```

Runs `task_func` in another thread, and waits for it to return or be
cancelled. You can use `g_task_propagate_pointer()`, etc, afterward
to get the result of `task_func`.

See `GTaskThreadFunc` for more details about how `task_func` is handled.

Normally this is used with tasks created with a `null`
`callback`, but note that even if the task does
have a callback, it will not be invoked when `task_func` returns.
`GTask.completed` will be set to `true` just before this function returns.

Although GLib currently rate-limits the tasks queued via
`g_task_run_in_thread_sync()`, you should not assume that it will
always do this. If you have a very large number of tasks to run,
but don't want them to all run at once, you should only queue a
limited number of them at a time.

**Parameters**

- `taskFunc`: a `GTaskThreadFunc`

_Available since 2.36._

### `setCheckCancellable`

```ts
setCheckCancellable(checkCancellable: boolean): void
```

Sets or clears `task`'s check-cancellable flag. If this is `true`
(the default), then `g_task_propagate_pointer()`, etc, and
`g_task_had_error()` will check the task's `GCancellable` first, and
if it has been cancelled, then they will consider the task to have
returned an "Operation was cancelled" error
(`G_IO_ERROR_CANCELLED`), regardless of any other error or return
value the task may have had.

If `check_cancellable` is `false`, then the `GTask` will not check the
cancellable itself, and it is up to `task`'s owner to do this (eg,
via `g_task_return_error_if_cancelled()`).

If you are using `g_task_set_return_on_cancel()` as well, then
you must leave check-cancellable set `true`.

**Parameters**

- `checkCancellable`: whether `GTask` will check the state of its `GCancellable` for you.

_Available since 2.36._

### `setName`

```ts
setName(name: string | null): void
```

Sets `task`’s name, used in debugging and profiling. The name defaults to
`null`.

The task name should describe in a human readable way what the task does.
For example, ‘Open file’ or ‘Connect to network host’. It is used to set the
name of the `GSource` used for idle completion of the task.

This function may only be called before the `task` is first used in a thread
other than the one it was constructed in.

**Parameters**

- `name`: a human readable name for the task, or `null` to unset it

_Available since 2.60._

### `setPriority`

```ts
setPriority(priority: number): void
```

Sets `task`'s priority. If you do not call this, it will default to
`G_PRIORITY_DEFAULT`.

This will affect the priority of `GSources` created with
`g_task_attach_source()` and the scheduling of tasks run in threads,
and can also be explicitly retrieved later via
`g_task_get_priority()`.

**Parameters**

- `priority`: the [priority](iface.AsyncResult.html#io-priority) of the request

_Available since 2.36._

### `setReturnOnCancel`

```ts
setReturnOnCancel(returnOnCancel: boolean): boolean
```

Sets or clears `task`'s return-on-cancel flag. This is only
meaningful for tasks run via `g_task_run_in_thread()` or
`g_task_run_in_thread_sync()`.

If `return_on_cancel` is `true`, then cancelling `task`'s
`GCancellable` will immediately cause it to return, as though the
task's `GTaskThreadFunc` had called
`g_task_return_error_if_cancelled()` and then returned.

This allows you to create a cancellable wrapper around an
uninterruptible function. The `GTaskThreadFunc` just needs to be
careful that it does not modify any externally-visible state after
it has been cancelled. To do that, the thread should call
`g_task_set_return_on_cancel()` again to (atomically) set
return-on-cancel `false` before making externally-visible changes;
if the task gets cancelled before the return-on-cancel flag could
be changed, `g_task_set_return_on_cancel()` will indicate this by
returning `false`.

You can disable and re-enable this flag multiple times if you wish.
If the task's `GCancellable` is cancelled while return-on-cancel is
`false`, then calling `g_task_set_return_on_cancel()` to set it `true`
again will cause the task to be cancelled at that point.

If the task's `GCancellable` is already cancelled before you call
`g_task_run_in_thread()`/`g_task_run_in_thread_sync()`, then the
`GTaskThreadFunc` will still be run (for consistency), but the task
will also be completed right away.

**Parameters**

- `returnOnCancel`: whether the task returns automatically when it is cancelled.

**Returns** `true` if `task`'s return-on-cancel flag was changed to
  match `return_on_cancel`. `false` if `task` has already been
  cancelled.

_Available since 2.36._

### `setSourceTag`

```ts
setSourceTag(sourceTag: bigint | null): void
```

Sets `task`'s source tag.

You can use this to tag a task return
value with a particular pointer (usually a pointer to the function
doing the tagging) and then later check it using
`g_task_get_source_tag()` (or `g_async_result_is_tagged()`) in the
task's "finish" function, to figure out if the response came from a
particular place.

A macro wrapper around this function will automatically set the
task’s name to the string form of `source_tag` if it’s not already
set, for convenience.

**Parameters**

- `sourceTag`: an opaque pointer indicating the source of this task

_Available since 2.36._

### `setStaticName`

```ts
setStaticName(name: string | null): void
```

Sets `task`’s name, used in debugging and profiling.

This is a variant of `g_task_set_name()` that avoids copying `name`.

This function is called automatically by `Gio.Task.setSourceTag()`
unless a name is set.

**Parameters**

- `name`: a human readable name for the task. Must be a string literal

_Available since 2.76._

### `setTaskData`

```ts
setTaskData(taskData: bigint | null, taskDataDestroy: GLib.DestroyNotify | null): void
```

Sets `task`'s task data (freeing the existing task data, if any).

**Parameters**

- `taskData`: task-specific data
- `taskDataDestroy`: `GDestroyNotify` for `task_data`

_Available since 2.36._
