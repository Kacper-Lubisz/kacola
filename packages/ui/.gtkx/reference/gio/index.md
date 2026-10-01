---
description: "Reference pages for the JSX elements in the Gio namespace."
---

# Gio elements

Elements in this namespace are imported from `@gtkx/jsx/gio`; the matching classes, enums, and functions are imported from `@gtkx/gi/gio`.

| Element | Description |
| --- | --- |
| [GAppInfoMonitor](.gtkx/reference/gio/app-info-monitor.md) | GAppInfoMonitor monitors application information for changes. |
| [GAppLaunchContext](.gtkx/reference/gio/app-launch-context.md) | Integrating the launch with the launching application. |
| [GApplication](.gtkx/reference/gio/application.md) | GApplication is the core class for application support. |
| [GApplicationCommandLine](.gtkx/reference/gio/application-command-line.md) | GApplicationCommandLine represents a command-line invocation of an application. |
| [GBufferedInputStream](.gtkx/reference/gio/buffered-input-stream.md) | Buffered input stream implements Gio.FilterInputStream and provides for buffered reads. |
| [GBufferedOutputStream](.gtkx/reference/gio/buffered-output-stream.md) | Buffered output stream implements Gio.FilterOutputStream and provides for buffered writes. |
| [GBytesIcon](.gtkx/reference/gio/bytes-icon.md) | GBytesIcon specifies an image held in memory in a common format (usually PNG) to be used as icon. |
| [GCancellable](.gtkx/reference/gio/cancellable.md) | GCancellable allows operations to be cancelled. |
| [GCharsetConverter](.gtkx/reference/gio/charset-converter.md) | GCharsetConverter is an implementation of Gio.Converter based on GLib.IConv. |
| [GConverterInputStream](.gtkx/reference/gio/converter-input-stream.md) | Converter input stream implements Gio.InputStream and allows conversion of data of various types during reading. |
| [GConverterOutputStream](.gtkx/reference/gio/converter-output-stream.md) | Converter output stream implements Gio.OutputStream and allows conversion of data of various types during reading. |
| [GCredentials](.gtkx/reference/gio/credentials.md) | The GCredentials type is a reference-counted wrapper for native credentials. |
| [GDataInputStream](.gtkx/reference/gio/data-input-stream.md) | Data input stream implements Gio.InputStream and includes functions for reading structured data directly from a binary input stream. |
| [GDataOutputStream](.gtkx/reference/gio/data-output-stream.md) | Data output stream implements Gio.OutputStream and includes functions for writing data directly to an output stream. |
| [GDBusActionGroup](.gtkx/reference/gio/d-bus-action-group.md) | GDBusActionGroup is an implementation of the Gio.ActionGroup interface. |
| [GDBusAuthObserver](.gtkx/reference/gio/d-bus-auth-observer.md) | GDBusAuthObserver provides a mechanism for participating in how a Gio.DBusServer (or a Gio.DBusConnection) authenticates remote peers. |
| [GDBusConnection](.gtkx/reference/gio/d-bus-connection.md) | The GDBusConnection type is used for D-Bus connections to remote peers such as a message buses. |
| [GDBusInterfaceSkeleton](.gtkx/reference/gio/d-bus-interface-skeleton.md) | Abstract base class for D-Bus interfaces on the service side. |
| [GDBusMenuModel](.gtkx/reference/gio/d-bus-menu-model.md) | GDBusMenuModel is an implementation of Gio.MenuModel that can be used as a proxy for a menu model that is exported over D-Bus with Gio.DBusConnection.exportMenuModel(). |
| [GDBusMessage](.gtkx/reference/gio/d-bus-message.md) | A type for representing D-Bus messages that can be sent or received on a Gio.DBusConnection. |
| [GDBusMethodInvocation](.gtkx/reference/gio/d-bus-method-invocation.md) | Instances of the GDBusMethodInvocation class are used when handling D-Bus method calls. |
| [GDBusObjectManagerClient](.gtkx/reference/gio/d-bus-object-manager-client.md) | GDBusObjectManagerClient is used to create, monitor and delete object proxies for remote objects exported by a Gio.DBusObjectManagerServer (or any code implementing the org.freedesktop.DBus.ObjectManager interface). |
| [GDBusObjectManagerServer](.gtkx/reference/gio/d-bus-object-manager-server.md) | GDBusObjectManagerServer is used to export Gio.DBusObject instances using the standardized org.freedesktop.DBus.ObjectManager interface. |
| [GDBusObjectProxy](.gtkx/reference/gio/d-bus-object-proxy.md) | A GDBusObjectProxy is an object used to represent a remote object with one or more D-Bus interfaces. |
| [GDBusObjectSkeleton](.gtkx/reference/gio/d-bus-object-skeleton.md) | A GDBusObjectSkeleton instance is essentially a group of D-Bus interfaces. |
| [GDBusProxy](.gtkx/reference/gio/d-bus-proxy.md) | GDBusProxy is a base class used for proxies to access a D-Bus interface on a remote object. |
| [GDBusServer](.gtkx/reference/gio/d-bus-server.md) | GDBusServer is a helper for listening to and accepting D-Bus connections. |
| [GDebugControllerDBus](.gtkx/reference/gio/debug-controller-d-bus.md) | GDebugControllerDBus is an implementation of Gio.DebugController which exposes debug settings as a D-Bus object. |
| [GEmblem](.gtkx/reference/gio/emblem.md) | GEmblem is an implementation of Gio.Icon that supports having an emblem, which is an icon with additional properties. |
| [GEmblemedIcon](.gtkx/reference/gio/emblemed-icon.md) | GEmblemedIcon is an implementation of Gio.Icon that supports adding an emblem to an icon. |
| [GFileEnumerator](.gtkx/reference/gio/file-enumerator.md) | GFileEnumerator allows you to operate on a set of Gio.File objects, returning a Gio.FileInfo structure for each file enumerated (e.g. |
| [GFileIcon](.gtkx/reference/gio/file-icon.md) | GFileIcon specifies an icon by pointing to an image file to be used as icon. |
| [GFileInfo](.gtkx/reference/gio/file-info.md) | Stores information about a file system object referenced by a Gio.File. |
| [GFileInputStream](.gtkx/reference/gio/file-input-stream.md) | GFileInputStream provides input streams that take their content from a file. |
| [GFileIOStream](.gtkx/reference/gio/file-io-stream.md) | GFileIOStream provides I/O streams that both read and write to the same file handle. |
| [GFileMonitor](.gtkx/reference/gio/file-monitor.md) | Monitors a file or directory for changes. |
| [GFilenameCompleter](.gtkx/reference/gio/filename-completer.md) | Completes partial file and directory names given a partial string by looking in the file system for clues. |
| [GFileOutputStream](.gtkx/reference/gio/file-output-stream.md) | GFileOutputStream provides output streams that write their content to a file. |
| [GFilterInputStream](.gtkx/reference/gio/filter-input-stream.md) | Base class for input stream implementations that perform some kind of filtering operation on a base stream. |
| [GFilterOutputStream](.gtkx/reference/gio/filter-output-stream.md) | Base class for output stream implementations that perform some kind of filtering operation on a base stream. |
| [GInetAddress](.gtkx/reference/gio/inet-address.md) | GInetAddress represents an IPv4 or IPv6 internet address. |
| [GInetAddressMask](.gtkx/reference/gio/inet-address-mask.md) | GInetAddressMask represents a range of IPv4 or IPv6 addresses described by a base address and a length indicating how many bits of the base address are relevant for matching purposes. |
| [GInetSocketAddress](.gtkx/reference/gio/inet-socket-address.md) | An IPv4 or IPv6 socket address. |
| [GInputStream](.gtkx/reference/gio/input-stream.md) | GInputStream is a base class for implementing streaming input. |
| [GIOModule](.gtkx/reference/gio/io-module.md) | Provides an interface and default functions for loading and unloading modules. |
| [GIOStream](.gtkx/reference/gio/io-stream.md) | GIOStream represents an object that has both read and write streams. |
| [GIPTosMessage](.gtkx/reference/gio/ip-tos-message.md) | Contains the type of service (ToS) byte of an IPv4 header. |
| [GIPv6TclassMessage](.gtkx/reference/gio/i-pv6-tclass-message.md) | Contains the Traffic Class byte of an IPv6 header. |
| [GListStore](.gtkx/reference/gio/list-store.md) | GListStore is a simple implementation of Gio.ListModel that stores all items in memory. |
| [GMemoryInputStream](.gtkx/reference/gio/memory-input-stream.md) | GMemoryInputStream is a class for using arbitrary memory chunks as input for GIO streaming input operations. |
| [GMemoryOutputStream](.gtkx/reference/gio/memory-output-stream.md) | GMemoryOutputStream is a class for using arbitrary memory chunks as output for GIO streaming output operations. |
| [GMenu](.gtkx/reference/gio/menu.md) | GMenu is a simple implementation of Gio.MenuModel. |
| [GMenuAttributeIter](.gtkx/reference/gio/menu-attribute-iter.md) | GMenuAttributeIter is an opaque structure type. |
| [GMenuItem](.gtkx/reference/gio/menu-item.md) | GMenuItem is an opaque structure type. |
| [GMenuLinkIter](.gtkx/reference/gio/menu-link-iter.md) | GMenuLinkIter is an opaque structure type. |
| [GMenuModel](.gtkx/reference/gio/menu-model.md) | GMenuModel represents the contents of a menu — an ordered list of menu items. |
| [GMountOperation](.gtkx/reference/gio/mount-operation.md) | GMountOperation provides a mechanism for interacting with the user. |
| [GNativeSocketAddress](.gtkx/reference/gio/native-socket-address.md) | A socket address of some unknown native type. |
| [GNativeVolumeMonitor](.gtkx/reference/gio/native-volume-monitor.md) |  |
| [GNetworkAddress](.gtkx/reference/gio/network-address.md) | GNetworkAddress provides an easy way to resolve a hostname and then attempt to connect to that host, handling the possibility of multiple IP addresses and multiple address families. |
| [GNetworkService](.gtkx/reference/gio/network-service.md) | Like Gio.NetworkAddress does with hostnames, GNetworkService provides an easy way to resolve a SRV record, and then attempt to connect to one of the hosts that implements that service, handling service priority/weight... |
| [GNotification](.gtkx/reference/gio/notification.md) | GNotification is a mechanism for creating a notification to be shown to the user — typically as a pop-up notification presented by the desktop environment shell. |
| [GOutputStream](.gtkx/reference/gio/output-stream.md) | GOutputStream is a base class for implementing streaming output. |
| [GPermission](.gtkx/reference/gio/permission.md) | A GPermission represents the status of the caller’s permission to perform a certain action. |
| [GPropertyAction](.gtkx/reference/gio/property-action.md) | A GPropertyAction is a way to get a Gio.Action with a state value reflecting and controlling the value of a GObject.Object property. |
| [GProxyAddress](.gtkx/reference/gio/proxy-address.md) | A Gio.InetSocketAddress representing a connection via a proxy server. |
| [GProxyAddressEnumerator](.gtkx/reference/gio/proxy-address-enumerator.md) | GProxyAddressEnumerator is a wrapper around Gio.SocketAddressEnumerator which takes the Gio.SocketAddress instances returned by the Gio.SocketAddressEnumerator and wraps them in Gio.ProxyAddress instances, using the g... |
| [GResolver](.gtkx/reference/gio/resolver.md) | The object that handles DNS resolution. |
| [GSettings](.gtkx/reference/gio/settings.md) | The GSettings class provides a convenient API for storing and retrieving application settings. |
| [GSettingsBackend](.gtkx/reference/gio/settings-backend.md) | The GSettingsBackend interface defines a generic interface for non-strictly-typed data that is stored in a hierarchy. |
| [GSimpleAction](.gtkx/reference/gio/simple-action.md) | A GSimpleAction is the obvious simple implementation of the Gio.Action interface. |
| [GSimpleActionGroup](.gtkx/reference/gio/simple-action-group.md) | GSimpleActionGroup is a hash table filled with Gio.Action objects, implementing the Gio.ActionGroup and Gio.ActionMap interfaces. |
| [GSimpleAsyncResult](.gtkx/reference/gio/simple-async-result.md) | As of GLib 2.46, GSimpleAsyncResult is deprecated in favor of Gio.Task, which provides a simpler API. |
| [GSimpleIOStream](.gtkx/reference/gio/simple-io-stream.md) | GSimpleIOStream creates a Gio.IOStream from an arbitrary Gio.InputStream and Gio.OutputStream. |
| [GSimplePermission](.gtkx/reference/gio/simple-permission.md) | GSimplePermission is a trivial implementation of Gio.Permission that represents a permission that is either always or never allowed. |
| [GSimpleProxyResolver](.gtkx/reference/gio/simple-proxy-resolver.md) | GSimpleProxyResolver is a simple Gio.ProxyResolver implementation that handles a single default proxy, multiple URI-scheme-specific proxies, and a list of hosts that proxies should not be used for. |
| [GSocket](.gtkx/reference/gio/socket.md) | A GSocket is a low-level networking primitive. |
| [GSocketAddress](.gtkx/reference/gio/socket-address.md) | GSocketAddress is the equivalent of struct sockaddr) and its subtypes in the BSD sockets API. |
| [GSocketAddressEnumerator](.gtkx/reference/gio/socket-address-enumerator.md) | GSocketAddressEnumerator is an enumerator type for Gio.SocketAddress instances. |
| [GSocketClient](.gtkx/reference/gio/socket-client.md) | GSocketClient is a lightweight high-level utility class for connecting to a network host using a connection oriented socket type. |
| [GSocketConnection](.gtkx/reference/gio/socket-connection.md) | GSocketConnection is a Gio.IOStream for a connected socket. |
| [GSocketControlMessage](.gtkx/reference/gio/socket-control-message.md) | A GSocketControlMessage is a special-purpose utility message that can be sent to or received from a Gio.Socket. |
| [GSocketListener](.gtkx/reference/gio/socket-listener.md) | A GSocketListener is an object that keeps track of a set of server sockets and helps you accept sockets from any of the socket, either sync or async. |
| [GSocketService](.gtkx/reference/gio/socket-service.md) | A GSocketService is an object that represents a service that is provided to the network or over local sockets. |
| [GSubprocess](.gtkx/reference/gio/subprocess.md) | GSubprocess allows the creation of and interaction with child processes. |
| [GSubprocessLauncher](.gtkx/reference/gio/subprocess-launcher.md) | This class contains a set of options for launching child processes, such as where its standard input and output will be directed, the argument list, the environment, and more. |
| [GTask](.gtkx/reference/gio/task.md) | A GTask represents and manages a cancellable ‘task’. |
| [GTcpConnection](.gtkx/reference/gio/tcp-connection.md) | This is the subclass of Gio.SocketConnection that is created for TCP/IP sockets. |
| [GTcpWrapperConnection](.gtkx/reference/gio/tcp-wrapper-connection.md) | A GTcpWrapperConnection can be used to wrap a Gio.IOStream that is based on a Gio.Socket, but which is not actually a Gio.SocketConnection. |
| [GTestDBus](.gtkx/reference/gio/test-d-bus.md) | A helper class for testing code which uses D-Bus without touching the user’s session bus. |
| [GThemedIcon](.gtkx/reference/gio/themed-icon.md) | GThemedIcon is an implementation of Gio.Icon that supports icon themes. |
| [GThreadedResolver](.gtkx/reference/gio/threaded-resolver.md) | GThreadedResolver is an implementation of GResolver which calls the libc lookup functions in threads to allow them to run asynchronously. |
| [GThreadedSocketService](.gtkx/reference/gio/threaded-socket-service.md) | A GThreadedSocketService is a simple subclass of Gio.SocketService that handles incoming connections by creating a worker thread and dispatching the connection to it by emitting the [signal@Gio.ThreadedSocketService::... |
| [GTlsCertificate](.gtkx/reference/gio/tls-certificate.md) | A certificate used for TLS authentication and encryption. |
| [GTlsConnection](.gtkx/reference/gio/tls-connection.md) | GTlsConnection is the base TLS connection class type, which wraps a Gio.IOStream and provides TLS encryption on top of it. |
| [GTlsDatabase](.gtkx/reference/gio/tls-database.md) | GTlsDatabase is used to look up certificates and other information from a certificate or key store. |
| [GTlsInteraction](.gtkx/reference/gio/tls-interaction.md) | GTlsInteraction provides a mechanism for the TLS connection and database code to interact with the user. |
| [GTlsPassword](.gtkx/reference/gio/tls-password.md) | An abstract interface representing a password used in TLS. |
| [GUnixConnection](.gtkx/reference/gio/unix-connection.md) | This is the subclass of Gio.SocketConnection that is created for UNIX domain sockets. |
| [GUnixCredentialsMessage](.gtkx/reference/gio/unix-credentials-message.md) | This Gio.SocketControlMessage contains a Gio.Credentials instance. |
| [GUnixFDList](.gtkx/reference/gio/unix-fd-list.md) | A GUnixFDList contains a list of file descriptors. |
| [GUnixSocketAddress](.gtkx/reference/gio/unix-socket-address.md) | Support for UNIX-domain (also known as local) sockets, corresponding to struct sockaddr_un. |
| [GVfs](.gtkx/reference/gio/vfs.md) | Entry point for using GIO functionality. |
| [GVolumeMonitor](.gtkx/reference/gio/volume-monitor.md) | GVolumeMonitor is for listing the user interesting devices and volumes on the computer. |
| [GZlibCompressor](.gtkx/reference/gio/zlib-compressor.md) | GZlibCompressor is an implementation of Gio.Converter that compresses data using zlib. |
| [GZlibDecompressor](.gtkx/reference/gio/zlib-decompressor.md) | GZlibDecompressor is an implementation of Gio.Converter that decompresses data compressed with zlib. |
