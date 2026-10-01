---
description: "GSimpleProxyResolver is a simple Gio.ProxyResolver implementation that handles a single default proxy, multiple URI-scheme-specific proxies, and a list of hosts that proxies should not be used for."
---

# GSimpleProxyResolver

`GSimpleProxyResolver` is a simple `Gio.ProxyResolver` implementation
that handles a single default proxy, multiple URI-scheme-specific
proxies, and a list of hosts that proxies should not be used for.

`GSimpleProxyResolver` is never the default proxy resolver, but it
can be used as the base class for another proxy resolver
implementation, or it can be created and used manually, such as
with `Gio.SocketClient.setProxyResolver()`.

_Available since 2.36._

```tsx
import { GSimpleProxyResolver } from "@gtkx/jsx/gio";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GSimpleProxyResolver**

Implements `GProxyResolver`.

## Props

`ref` receives the `Gio.SimpleProxyResolver` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `defaultProxy`

`string` · default `null`

The default proxy URI that will be used for any URI that doesn't
match `GSimpleProxyResolver.ignoreHosts`, and doesn't match any
of the schemes set with `g_simple_proxy_resolver_set_uri_proxy()`.

Note that as a special case, if this URI starts with
"socks://", `GSimpleProxyResolver` will treat it as referring
to all three of the socks5, socks4a, and socks4 proxy types.

### `ignoreHosts`

`string[]`

A list of hostnames and IP addresses that the resolver should
allow direct connections to.

Entries can be in one of 4 formats:

- A hostname, such as "example.com", ".example.com", or
  "*.example.com", any of which match "example.com" or
  any subdomain of it.

- An IPv4 or IPv6 address, such as "192.168.1.1",
  which matches only that address.

- A hostname or IP address followed by a port, such as
  "example.com:80", which matches whatever the hostname or IP
  address would match, but only for URLs with the (explicitly)
  indicated port. In the case of an IPv6 address, the address
  part must appear in brackets: "[::1]:443"

- An IP address range, given by a base address and prefix length,
  such as "fe80::/10", which matches any address in that range.

Note that when dealing with Unicode hostnames, the matching is
done against the ASCII form of the name.

Also note that hostname exclusions apply only to connections made
to hosts identified by name, and IP address exclusions apply only
to connections made to hosts identified by address. That is, if
example.com has an address of 192.168.1.1, and the :ignore-hosts list
contains only "192.168.1.1", then a connection to "example.com"
(eg, via a `GNetworkAddress`) will use the proxy, and a connection to
"192.168.1.1" (eg, via a `GInetSocketAddress`) will not.

These rules match the "ignore-hosts"/"noproxy" rules most
commonly used by other applications.

## Methods

Methods are called on the `Gio.SimpleProxyResolver` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gio`. Methods inherited from ancestors are documented on their own pages.

### `setDefaultProxy`

```ts
setDefaultProxy(defaultProxy: string | null): void
```

Sets the default proxy on `resolver`, to be used for any URIs that
don't match `GSimpleProxyResolver.ignoreHosts` or a proxy set
via `g_simple_proxy_resolver_set_uri_proxy()`.

If `default_proxy` starts with "socks://",
`GSimpleProxyResolver` will treat it as referring to all three of
the socks5, socks4a, and socks4 proxy types.

**Parameters**

- `defaultProxy`: the default proxy to use

_Available since 2.36._

### `setIgnoreHosts`

```ts
setIgnoreHosts(ignoreHosts: string[]): void
```

Sets the list of ignored hosts.

See `GSimpleProxyResolver.ignoreHosts` for more details on how the
`ignore_hosts` argument is interpreted.

**Parameters**

- `ignoreHosts`: `null`-terminated list of hosts/IP addresses to not use a proxy for

_Available since 2.36._

### `setUriProxy`

```ts
setUriProxy(uriScheme: string, proxy: string): void
```

Adds a URI-scheme-specific proxy to `resolver`; URIs whose scheme
matches `uri_scheme` (and which don't match
`GSimpleProxyResolver.ignoreHosts`) will be proxied via `proxy`.

As with `GSimpleProxyResolver.defaultProxy`, if `proxy` starts with
"socks://", `GSimpleProxyResolver` will treat it
as referring to all three of the socks5, socks4a, and socks4 proxy
types.

**Parameters**

- `uriScheme`: the URI scheme to add a proxy for
- `proxy`: the proxy to use for `uri_scheme`

_Available since 2.36._
