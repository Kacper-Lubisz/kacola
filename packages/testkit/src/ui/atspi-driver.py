#!/usr/bin/env python3
"""AT-SPI + GNOME Shell driver for the headless UI harness.

Speaks JSON lines over stdio: one request object per line in, one response per line out.

  request:  {"id": 1, "cmd": "find", "args": {...}}
  response: {"id": 1, "ok": true, "result": ...} | {"id": 1, "ok": false, "error": "..."}

It runs inside the harness's private session (AT_SPI_BUS_ADDRESS and DBUS_SESSION_BUS_ADDRESS
point at the throwaway buses), so it can only ever see and touch the headless display.

Accessible objects are handed to the caller as integer `ref`s; the objects stay in a table here
for the life of the process. A ref whose widget has been destroyed raises on use, which surfaces
as an error response rather than a crash.
"""

import json
import sys

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi, Gio, GLib  # noqa: E402

Atspi.init()

_refs = {}
_next_ref = [1]

# The Screenshot interface of GNOME Shell only answers callers that own one of a few well-known
# names. On our private bus nobody else can own them, so the driver claims one at startup.
SCREENSHOT_ALLOWED_NAME = "org.gnome.SettingsDaemon.MediaKeys"
_session_bus = None
_rd_session = None


def session_bus():
    global _session_bus
    if _session_bus is None:
        _session_bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    return _session_bus


_ref_by_acc = {}


def ref_of(acc):
    # PyGObject hands back the same wrapper for the same underlying AtspiAccessible, and
    # libatspi keeps one AtspiAccessible per (bus name, object path), so identity is stable.
    k = _ref_by_acc.get(acc)
    if k is None:
        k = _next_ref[0]
        _next_ref[0] += 1
        _refs[k] = acc
        _ref_by_acc[acc] = k
    return k


def deref(ref):
    acc = _refs.get(ref)
    if acc is None:
        raise ValueError(f"unknown ref {ref}")
    return acc


def uncached(acc):
    # libatspi caches names, roles and children per object and only refreshes them from events;
    # a test polling for "the list grew" must never read a stale cache.
    try:
        acc.clear_cache_single()
    except Exception:
        try:
            acc.clear_cache()
        except Exception:
            pass
    return acc


def state_names(acc):
    try:
        ss = acc.get_state_set()
        return sorted(Atspi.StateType(s).value_nick for s in ss.get_states())
    except Exception:
        return []


def action_names(acc):
    try:
        a = acc.get_action_iface()
        if a is None:
            return []
        return [a.get_action_name(i) for i in range(a.get_n_actions())]
    except Exception:
        return []


def describe(acc, with_children=False, depth=0, max_depth=64):
    uncached(acc)
    node = {
        "ref": ref_of(acc),
        "role": acc.get_role_name(),
        "name": acc.get_name() or "",
        "description": acc.get_description() or "",
        "states": state_names(acc),
        "actions": action_names(acc),
    }
    try:
        node["interfaces"] = list(acc.get_interfaces())
    except Exception:
        node["interfaces"] = []
    if "Text" in node["interfaces"]:
        try:
            node["text"] = Atspi.Text.get_text(acc, 0, Atspi.Text.get_character_count(acc))
        except Exception as e:
            node["textError"] = str(e)
    if "Value" in node["interfaces"]:
        try:
            node["value"] = Atspi.Value.get_current_value(acc)
        except Exception as e:
            node["valueError"] = str(e)
    if with_children and depth < max_depth:
        node["children"] = [describe(c, True, depth + 1, max_depth) for c in children(acc)]
    return node


def children(acc):
    out = []
    try:
        n = acc.get_child_count()
    except Exception:
        return out
    for i in range(n):
        try:
            c = acc.get_child_at_index(i)
        except Exception:
            c = None
        if c is not None:
            out.append(c)
    return out


def applications(app_name=None):
    desktop = uncached(Atspi.get_desktop(0))
    apps = []
    for app in children(desktop):
        name = app.get_name() or ""
        if app_name is not None and name != app_name:
            continue
        apps.append(app)
    return apps


def walk(acc, fn, depth=0, max_depth=64):
    uncached(acc)
    if fn(acc):
        return True
    if depth >= max_depth:
        return False
    for c in children(acc):
        if walk(c, fn, depth + 1, max_depth):
            return True
    return False


def matches(acc, q):
    if q.get("role") is not None and acc.get_role_name() != q["role"]:
        return False
    name = acc.get_name() or ""
    if q.get("name") is not None and name != q["name"]:
        return False
    if q.get("nameContains") is not None and q["nameContains"] not in name:
        return False
    if q.get("states"):
        have = set(state_names(acc))
        if not set(q["states"]).issubset(have):
            return False
    return True


def cmd_ping(_args):
    return {"atspi": list(Atspi.get_version())}


def cmd_apps(_args):
    return [a.get_name() or "" for a in applications()]


def cmd_tree(args):
    roots = [deref(args["ref"])] if args.get("ref") else applications(args.get("app"))
    return [describe(r, True, 0, args.get("maxDepth", 64)) for r in roots]


def cmd_find(args):
    limit = args.get("limit", 1000)
    roots = [deref(args["within"])] if args.get("within") else applications(args.get("app"))
    found = []

    def visit(acc):
        if matches(acc, args):
            found.append(acc)
        return len(found) >= limit

    for r in roots:
        if walk(r, visit):
            break
    return [describe(a) for a in found]


def cmd_describe(args):
    return describe(deref(args["ref"]), args.get("children", False))


def cmd_parent(args):
    p = deref(args["ref"]).get_parent()
    return describe(p) if p is not None else None


def do_named_action(acc, names):
    a = acc.get_action_iface()
    if a is None:
        return None
    available = [a.get_action_name(i) for i in range(a.get_n_actions())]
    for want in names:
        if want in available:
            if not a.do_action(available.index(want)):
                raise RuntimeError(f"action {want} refused")
            return want
    return None


def cmd_click(args):
    """Activate a widget the way a user would, preferring the widget's own semantics.

    1. an Action named click/activate/press/toggle on the node itself;
    2. if the node is a selectable item in a container implementing Selection (a GtkListBox
       row), select it through the container — which is what a pointer click on a row does;
    3. an action on a descendant, preferring one with the same name — composite widgets such
       as AdwSwitchRow expose the row (no action) with the real GtkSwitch (action "toggle")
       inside it;
    4. otherwise fail loudly rather than guess.
    """
    wanted = ["click", "activate", "press", "toggle"]
    acc = uncached(deref(args["ref"]))
    used = do_named_action(acc, wanted)
    if used:
        return {"via": f"action:{used}"}
    parent = acc.get_parent()
    if parent is not None and "selectable" in state_names(acc):
        sel = parent.get_selection_iface() if "Selection" in parent.get_interfaces() else None
        if sel is not None:
            idx = acc.get_index_in_parent()
            if sel.select_child(idx):
                return {"via": "selection", "index": idx}
    name = acc.get_name() or ""
    candidates = []

    def collect(node):
        if node is not acc and set(action_names(node)) & set(wanted):
            candidates.append(node)
        return False

    walk(acc, collect, 0, 6)
    candidates.sort(key=lambda n: 0 if (n.get_name() or "") == name else 1)
    for c in candidates:
        used = do_named_action(c, wanted)
        if used:
            return {"via": f"descendant-action:{used}"}
    raise RuntimeError(
        f"no way to click {acc.get_role_name()} {acc.get_name()!r}: actions={action_names(acc)}"
    )


def cmd_action(args):
    acc = deref(args["ref"])
    used = do_named_action(acc, [args["name"]])
    if not used:
        raise RuntimeError(f"no action {args['name']!r}; have {action_names(acc)}")
    return {"via": f"action:{used}"}


def cmd_focus(args):
    comp = deref(args["ref"]).get_component_iface()
    if comp is None or not comp.grab_focus():
        raise RuntimeError("grab_focus failed")
    return True


def cmd_set_text(args):
    acc = deref(args["ref"])
    et = acc.get_editable_text_iface()
    if et is None:
        raise RuntimeError(f"{acc.get_role_name()} has no EditableText interface")
    if not et.set_text_contents(args["text"]):
        raise RuntimeError("set_text_contents refused")
    return True


def cmd_extents(args):
    comp = deref(args["ref"]).get_component_iface()
    r = comp.get_extents(Atspi.CoordType.WINDOW)
    return {"x": r.x, "y": r.y, "width": r.width, "height": r.height}


def cmd_screenshot(args):
    bus = session_bus()
    bus.call_sync(
        "org.freedesktop.DBus",
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus",
        "RequestName",
        GLib.Variant("(su)", (SCREENSHOT_ALLOWED_NAME, 4)),
        None,
        Gio.DBusCallFlags.NONE,
        5000,
        None,
    )
    # the Shell learns about the name owner through a NameOwnerChanged watch; give it a moment
    wait_for_owner_seen()
    kind = args.get("kind", "screen")
    if kind == "window":
        method, params = "ScreenshotWindow", GLib.Variant("(bbbs)", (True, False, False, args["path"]))
    else:
        method, params = "Screenshot", GLib.Variant("(bbs)", (False, False, args["path"]))
    res = bus.call_sync(
        "org.gnome.Shell.Screenshot",
        "/org/gnome/Shell/Screenshot",
        "org.gnome.Shell.Screenshot",
        method,
        params,
        None,
        Gio.DBusCallFlags.NONE,
        15000,
        None,
    ).unpack()
    if not res[0]:
        raise RuntimeError(f"{method} returned failure")
    return {"path": res[1]}


_owner_seen = [False]


def wait_for_owner_seen():
    if not _owner_seen[0]:
        spin(0.4)
        _owner_seen[0] = True


def spin(seconds):
    ctx = GLib.MainContext.default()
    end = GLib.get_monotonic_time() + int(seconds * 1_000_000)
    while GLib.get_monotonic_time() < end:
        while ctx.pending():
            ctx.iteration(False)
        GLib.usleep(10_000)


def remote_desktop():
    """A mutter RemoteDesktop session: the one way to inject real keyboard input under Wayland."""
    global _rd_session
    if _rd_session is None:
        bus = session_bus()
        path = bus.call_sync(
            "org.gnome.Mutter.RemoteDesktop",
            "/org/gnome/Mutter/RemoteDesktop",
            "org.gnome.Mutter.RemoteDesktop",
            "CreateSession",
            None,
            GLib.VariantType("(o)"),
            Gio.DBusCallFlags.NONE,
            5000,
            None,
        ).unpack()[0]
        bus.call_sync(
            "org.gnome.Mutter.RemoteDesktop",
            path,
            "org.gnome.Mutter.RemoteDesktop.Session",
            "Start",
            None,
            None,
            Gio.DBusCallFlags.NONE,
            5000,
            None,
        )
        _rd_session = path
        # The virtual keyboard only comes into being with its first event, and that first event is
        # not delivered to the client. Burn it on a lone Shift press so no real keystroke is lost.
        for pressed in (True, False):
            bus.call_sync(
                "org.gnome.Mutter.RemoteDesktop",
                path,
                "org.gnome.Mutter.RemoteDesktop.Session",
                "NotifyKeyboardKeysym",
                GLib.Variant("(ub)", (NAMED_KEYS["Shift_L"], pressed)),
                None,
                Gio.DBusCallFlags.NONE,
                5000,
                None,
            )
        spin(0.2)
    return _rd_session


def keysym_for(ch):
    cp = ord(ch)
    specials = {"\n": 0xFF0D, "\r": 0xFF0D, "\t": 0xFF09, "\b": 0xFF08}
    if ch in specials:
        return specials[ch]
    if 0x20 <= cp <= 0x7E or 0xA0 <= cp <= 0xFF:
        return cp
    return 0x01000000 + cp


NAMED_KEYS = {
    "Return": 0xFF0D,
    "Escape": 0xFF1B,
    "Tab": 0xFF09,
    "BackSpace": 0xFF08,
    "Down": 0xFF54,
    "Up": 0xFF52,
    "Left": 0xFF51,
    "Right": 0xFF53,
    "Home": 0xFF50,
    "End": 0xFF57,
    "space": 0x20,
    "Control_L": 0xFFE3,
    "Shift_L": 0xFFE1,
    "Alt_L": 0xFFE9,
}


def notify_keysym(keysym, pressed):
    session_bus().call_sync(
        "org.gnome.Mutter.RemoteDesktop",
        remote_desktop(),
        "org.gnome.Mutter.RemoteDesktop.Session",
        "NotifyKeyboardKeysym",
        GLib.Variant("(ub)", (keysym, pressed)),
        None,
        Gio.DBusCallFlags.NONE,
        5000,
        None,
    )


def cmd_type_text(args):
    delay = args.get("delayMs", 15) / 1000
    for ch in args["text"]:
        ks = keysym_for(ch)
        notify_keysym(ks, True)
        notify_keysym(ks, False)
        spin(delay)
    return True


def cmd_key(args):
    """Press a chord of named keys, e.g. ["Control_L", "a"]: all down in order, then all up."""
    syms = [NAMED_KEYS.get(k, keysym_for(k) if len(k) == 1 else None) for k in args["keys"]]
    if None in syms:
        raise ValueError(f"unknown key in {args['keys']}")
    for s in syms:
        notify_keysym(s, True)
    for s in reversed(syms):
        notify_keysym(s, False)
    spin(0.02)
    return True


COMMANDS = {
    "ping": cmd_ping,
    "apps": cmd_apps,
    "tree": cmd_tree,
    "find": cmd_find,
    "describe": cmd_describe,
    "parent": cmd_parent,
    "click": cmd_click,
    "action": cmd_action,
    "focus": cmd_focus,
    "setText": cmd_set_text,
    "extents": cmd_extents,
    "screenshot": cmd_screenshot,
    "typeText": cmd_type_text,
    "key": cmd_key,
}


def handle(line):
    req = json.loads(line)
    rid = req.get("id")
    try:
        fn = COMMANDS[req["cmd"]]
        result = fn(req.get("args") or {})
        return {"id": rid, "ok": True, "result": result}
    except Exception as e:  # report every failure to the caller; never die on one bad request
        return {"id": rid, "ok": False, "error": f"{type(e).__name__}: {e}"}


def main():
    # Signals from the registry (apps appearing, children changing) are delivered on the main
    # context; drain it between requests so the libatspi view of the desktop stays current.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        ctx = GLib.MainContext.default()
        while ctx.pending():
            ctx.iteration(False)
        sys.stdout.write(json.dumps(handle(line)) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
