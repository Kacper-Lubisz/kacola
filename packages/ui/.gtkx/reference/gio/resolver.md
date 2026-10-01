---
description: "The object that handles DNS resolution."
---

# GResolver

The object that handles DNS resolution. Use `Gio.Resolver.getDefault()`
to get the default resolver.

`GResolver` provides cancellable synchronous and asynchronous DNS
resolution, for hostnames (`Gio.Resolver.lookupByAddress()`,
`Gio.Resolver.lookupByName()` and their async variants) and SRV
(service) records (`Gio.Resolver.lookupService()`).

`Gio.NetworkAddress` and `Gio.NetworkService` provide wrappers
around `GResolver` functionality that also implement
`Gio.SocketConnectable`, making it easy to connect to a remote
host/service.

The default resolver (see `Gio.Resolver.getDefault()`) has a timeout of
30s set on it since GLib 2.78. Earlier versions of GLib did not support
resolver timeouts.

This is an abstract type; subclasses of it implement different resolvers for
different platforms and situations.

```tsx
import { GResolver } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GResolver**

## Props

`ref` receives the `Gio.Resolver` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `timeout`

`number` · default `0`

The timeout applied to all resolver lookups, in milliseconds.

This may be changed through the lifetime of the `GResolver`. The new value
will apply to any lookups started after the change, but not to any
already-ongoing lookups.

If this is `0`, no timeout is applied to lookups.

No timeout was applied to lookups before this property was added in
GLib 2.78.

_Available since 2.78._

## Signals

### `onReload`

```ts
(self: Gio.Resolver) => void
```

Emitted when the resolver notices that the system resolver
configuration has changed.

**Parameters**

- `self`: The instance the signal was emitted on.

## Methods

Methods are called on the `Gio.Resolver` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `getTimeout`

```ts
getTimeout(): number
```

Get the timeout applied to all resolver lookups. See `GResolver.timeout`.

**Returns** the resolver timeout, in milliseconds, or `0` for no timeout

_Available since 2.78._

### `lookupByAddress`

```ts
lookupByAddress(address: Gio.InetAddress, cancellable: Gio.Cancellable | null): string
```

Synchronously reverse-resolves `address` to determine its
associated hostname.

If the DNS resolution fails, `error` (if non-`null`) will be set to
a value from `GResolverError`.

If `cancellable` is non-`null`, it can be used to cancel the
operation, in which case `error` (if non-`null`) will be set to
`G_IO_ERROR_CANCELLED`.

**Parameters**

- `address`: the address to reverse-resolve
- `cancellable`: a `GCancellable`, or `null`

**Returns** a hostname (either ASCII-only, or in ASCII-encoded
    form), or `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByAddressAsync`

```ts
lookupByAddressAsync(address: Gio.InetAddress, cancellable?: Gio.Cancellable | null): Promise<string>
```

Begins asynchronously reverse-resolving `address` to determine its
associated hostname, and eventually calls `callback`, which must
call `g_resolver_lookup_by_address_finish()` to get the final result.

**Parameters**

- `address`: the address to reverse-resolve
- `cancellable`: a `GCancellable`, or `null`

**Returns** a hostname (either ASCII-only, or in ASCII-encoded
form), or `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByAddressFinish`

```ts
lookupByAddressFinish(result: Gio.AsyncResult): string
```

Retrieves the result of a previous call to
`g_resolver_lookup_by_address_async()`.

If the DNS resolution failed, `error` (if non-`null`) will be set to
a value from `GResolverError`. If the operation was cancelled,
`error` will be set to `G_IO_ERROR_CANCELLED`.

**Parameters**

- `result`: the result passed to your `GAsyncReadyCallback`

**Returns** a hostname (either ASCII-only, or in ASCII-encoded
form), or `null` on error.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByName`

```ts
lookupByName(hostname: string, cancellable: Gio.Cancellable | null): Gio.InetAddress[]
```

Synchronously resolves `hostname` to determine its associated IP
address(es). `hostname` may be an ASCII-only or UTF-8 hostname, or
the textual form of an IP address (in which case this just becomes
a wrapper around `g_inet_address_new_from_string()`).

On success, `g_resolver_lookup_by_name()` will return a non-empty `GList` of
`GInetAddress`, sorted in order of preference and guaranteed to not
contain duplicates. That is, if using the result to connect to
`hostname`, you should attempt to connect to the first address
first, then the second if the first fails, etc. If you are using
the result to listen on a socket, it is appropriate to add each
result using e.g. `g_socket_listener_add_address()`.

If the DNS resolution fails, `error` (if non-`null`) will be set to a
value from `GResolverError` and `null` will be returned.

If `cancellable` is non-`null`, it can be used to cancel the
operation, in which case `error` (if non-`null`) will be set to
`G_IO_ERROR_CANCELLED`.

If you are planning to connect to a socket on the resolved IP
address, it may be easier to create a `GNetworkAddress` and use its
`GSocketConnectable` interface.

**Parameters**

- `hostname`: the hostname to look up
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList`
of `GInetAddress`, or `null` on error. You
must unref each of the addresses and free the list when you are
done with it. (You can use `g_resolver_free_addresses()` to do this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByNameAsync`

```ts
lookupByNameAsync(hostname: string, cancellable?: Gio.Cancellable | null): Promise<Gio.InetAddress[]>
```

Begins asynchronously resolving `hostname` to determine its
associated IP address(es), and eventually calls `callback`, which
must call `g_resolver_lookup_by_name_finish()` to get the result.
See `g_resolver_lookup_by_name()` for more details.

**Parameters**

- `hostname`: the hostname to look up the address of
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GList`
of `GInetAddress`, or `null` on error. See `g_resolver_lookup_by_name()`
for more details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByNameFinish`

```ts
lookupByNameFinish(result: Gio.AsyncResult): Gio.InetAddress[]
```

Retrieves the result of a call to
`g_resolver_lookup_by_name_async()`.

If the DNS resolution failed, `error` (if non-`null`) will be set to
a value from `GResolverError`. If the operation was cancelled,
`error` will be set to `G_IO_ERROR_CANCELLED`.

**Parameters**

- `result`: the result passed to your `GAsyncReadyCallback`

**Returns** a `GList`
of `GInetAddress`, or `null` on error. See `g_resolver_lookup_by_name()`
for more details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupByNameWithFlags`

```ts
lookupByNameWithFlags(hostname: string, flags: Gio.ResolverNameLookupFlags, cancellable: Gio.Cancellable | null): Gio.InetAddress[]
```

This differs from `g_resolver_lookup_by_name()` in that you can modify
the lookup behavior with `flags`. For example this can be used to limit
results with `G_RESOLVER_NAME_LOOKUP_FLAGS_IPV4_ONLY`.

**Parameters**

- `hostname`: the hostname to look up
- `flags`: extra `GResolverNameLookupFlags` for the lookup
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList`
of `GInetAddress`, or `null` on error. You
must unref each of the addresses and free the list when you are
done with it. (You can use `g_resolver_free_addresses()` to do this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `lookupByNameWithFlagsAsync`

```ts
lookupByNameWithFlagsAsync(hostname: string, flags: Gio.ResolverNameLookupFlags, cancellable?: Gio.Cancellable | null): Promise<Gio.InetAddress[]>
```

Begins asynchronously resolving `hostname` to determine its
associated IP address(es), and eventually calls `callback`, which
must call `g_resolver_lookup_by_name_with_flags_finish()` to get the result.
See `g_resolver_lookup_by_name()` for more details.

**Parameters**

- `hostname`: the hostname to look up the address of
- `flags`: extra `GResolverNameLookupFlags` for the lookup
- `cancellable`: a `GCancellable`, or `null`

**Returns** a `GList`
of `GInetAddress`, or `null` on error. See `g_resolver_lookup_by_name()`
for more details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `lookupByNameWithFlagsFinish`

```ts
lookupByNameWithFlagsFinish(result: Gio.AsyncResult): Gio.InetAddress[]
```

Retrieves the result of a call to
`g_resolver_lookup_by_name_with_flags_async()`.

If the DNS resolution failed, `error` (if non-`null`) will be set to
a value from `GResolverError`. If the operation was cancelled,
`error` will be set to `G_IO_ERROR_CANCELLED`.

**Parameters**

- `result`: the result passed to your `GAsyncReadyCallback`

**Returns** a `GList`
of `GInetAddress`, or `null` on error. See `g_resolver_lookup_by_name()`
for more details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.60._

### `lookupRecords`

```ts
lookupRecords(rrname: string, recordType: Gio.ResolverRecordType, cancellable: Gio.Cancellable | null): GLib.Variant[]
```

Synchronously performs a DNS record lookup for the given `rrname` and returns
a list of records as `GVariant` tuples. See `GResolverRecordType` for
information on what the records contain for each `record_type`.

If the DNS resolution fails, `error` (if non-`null`) will be set to
a value from `GResolverError` and `null` will be returned.

If `cancellable` is non-`null`, it can be used to cancel the
operation, in which case `error` (if non-`null`) will be set to
`G_IO_ERROR_CANCELLED`.

**Parameters**

- `rrname`: the DNS name to look up the record for
- `recordType`: the type of DNS record to look up
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList` of
`GVariant`, or `null` on error. You must free each of the records and the list
when you are done with it. (You can use `g_list_free_full()` with
`g_variant_unref()` to do this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `lookupRecordsAsync`

```ts
lookupRecordsAsync(rrname: string, recordType: Gio.ResolverRecordType, cancellable?: Gio.Cancellable | null): Promise<GLib.Variant[]>
```

Begins asynchronously performing a DNS lookup for the given
`rrname`, and eventually calls `callback`, which must call
`g_resolver_lookup_records_finish()` to get the final result. See
`g_resolver_lookup_records()` for more details.

**Parameters**

- `rrname`: the DNS name to look up the record for
- `recordType`: the type of DNS record to look up
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList` of
`GVariant`, or `null` on error. You must free each of the records and the list
when you are done with it. (You can use `g_list_free_full()` with
`g_variant_unref()` to do this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `lookupRecordsFinish`

```ts
lookupRecordsFinish(result: Gio.AsyncResult): GLib.Variant[]
```

Retrieves the result of a previous call to
`g_resolver_lookup_records_async()`. Returns a non-empty list of records as
`GVariant` tuples. See `GResolverRecordType` for information on what the
records contain.

If the DNS resolution failed, `error` (if non-`null`) will be set to
a value from `GResolverError`. If the operation was cancelled,
`error` will be set to `G_IO_ERROR_CANCELLED`.

**Parameters**

- `result`: the result passed to your `GAsyncReadyCallback`

**Returns** a non-empty `GList` of
`GVariant`, or `null` on error. You must free each of the records and the list
when you are done with it. (You can use `g_list_free_full()` with
`g_variant_unref()` to do this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.34._

### `lookupService`

```ts
lookupService(service: string, protocol: string, domain: string, cancellable: Gio.Cancellable | null): Gio.SrvTarget[]
```

Synchronously performs a DNS SRV lookup for the given `service` and
`protocol` in the given `domain` and returns an array of `GSrvTarget`.
`domain` may be an ASCII-only or UTF-8 hostname. Note also that the
`service` and `protocol` arguments do not include the leading underscore
that appears in the actual DNS entry.

On success, `g_resolver_lookup_service()` will return a non-empty `GList` of
`GSrvTarget`, sorted in order of preference. (That is, you should
attempt to connect to the first target first, then the second if
the first fails, etc.)

If the DNS resolution fails, `error` (if non-`null`) will be set to
a value from `GResolverError` and `null` will be returned.

If `cancellable` is non-`null`, it can be used to cancel the
operation, in which case `error` (if non-`null`) will be set to
`G_IO_ERROR_CANCELLED`.

If you are planning to connect to the service, it is usually easier
to create a `GNetworkService` and use its `GSocketConnectable`
interface.

**Parameters**

- `service`: the service type to look up (eg, "ldap")
- `protocol`: the networking protocol to use for `service` (eg, "tcp")
- `domain`: the DNS domain to look up the service in
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList` of
`GSrvTarget`, or `null` on error. You must free each of the targets and the
list when you are done with it. (You can use `g_resolver_free_targets()` to do
this.)

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupServiceAsync`

```ts
lookupServiceAsync(service: string, protocol: string, domain: string, cancellable?: Gio.Cancellable | null): Promise<Gio.SrvTarget[]>
```

Begins asynchronously performing a DNS SRV lookup for the given
`service` and `protocol` in the given `domain`, and eventually calls
`callback`, which must call `g_resolver_lookup_service_finish()` to
get the final result. See `g_resolver_lookup_service()` for more
details.

**Parameters**

- `service`: the service type to look up (eg, "ldap")
- `protocol`: the networking protocol to use for `service` (eg, "tcp")
- `domain`: the DNS domain to look up the service in
- `cancellable`: a `GCancellable`, or `null`

**Returns** a non-empty `GList` of
`GSrvTarget`, or `null` on error. See `g_resolver_lookup_service()` for more
details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `lookupServiceFinish`

```ts
lookupServiceFinish(result: Gio.AsyncResult): Gio.SrvTarget[]
```

Retrieves the result of a previous call to
`g_resolver_lookup_service_async()`.

If the DNS resolution failed, `error` (if non-`null`) will be set to
a value from `GResolverError`. If the operation was cancelled,
`error` will be set to `G_IO_ERROR_CANCELLED`.

**Parameters**

- `result`: the result passed to your `GAsyncReadyCallback`

**Returns** a non-empty `GList` of
`GSrvTarget`, or `null` on error. See `g_resolver_lookup_service()` for more
details.

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

_Available since 2.22._

### `setDefault`

```ts
setDefault(): void
```

Sets `resolver` to be the application's default resolver (reffing
`resolver`, and unreffing the previous default resolver, if any).
Future calls to `g_resolver_get_default()` will return this resolver.

This can be used if an application wants to perform any sort of DNS
caching or "pinning"; it can implement its own `GResolver` that
calls the original default resolver for DNS operations, and
implements its own cache policies on top of that, and then set
itself as the default resolver for all later code to use.

_Available since 2.22._

### `setTimeout`

```ts
setTimeout(timeoutMs: number): void
```

Set the timeout applied to all resolver lookups. See `GResolver.timeout`.

**Parameters**

- `timeoutMs`: timeout in milliseconds, or `0` for no timeouts

_Available since 2.78._
