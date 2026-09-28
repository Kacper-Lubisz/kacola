#!/usr/bin/env python3
"""A minimal GTK4 app the harness tests itself against, independent of GTKX.

An entry, a button that copies the entry into a label, and a list whose rows select.
"""

import sys

import gi

gi.require_version("Gtk", "4.0")
from gi.repository import GLib, Gtk  # noqa: E402

GLib.set_prgname("harness-fixture")
GLib.set_application_name("harness-fixture")


def on_activate(app):
    win = Gtk.ApplicationWindow(application=app, title="Harness fixture")
    win.set_default_size(480, 360)
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
    for m in ("top", "bottom", "start", "end"):
        getattr(box, f"set_margin_{m}")(16)

    entry = Gtk.Entry()
    entry.update_property([Gtk.AccessibleProperty.LABEL], ["Name"])
    label = Gtk.Label(label="Nobody greeted")
    button = Gtk.Button(label="Greet")
    button.connect("clicked", lambda _b: label.set_label(f"Hello, {entry.get_text()}"))

    lst = Gtk.ListBox()
    lst.update_property([Gtk.AccessibleProperty.LABEL], ["Fruits"])
    for name in ("Apple", "Banana", "Cherry"):
        row = Gtk.ListBoxRow()
        row.set_child(Gtk.Label(label=name))
        row.update_property([Gtk.AccessibleProperty.LABEL], [name])
        lst.append(row)
    picked = Gtk.Label(label="Picked: none")
    lst.connect(
        "row-selected",
        lambda _l, row: picked.set_label(
            f"Picked: {row.get_child().get_label()}" if row else "Picked: none"
        ),
    )

    for w in (entry, button, label, lst, picked):
        box.append(w)
    win.set_child(box)
    win.present()
    entry.grab_focus()


app = Gtk.Application(application_id="org.gnome.Gnomeola.HarnessFixture")
app.connect("activate", on_activate)
sys.exit(app.run([]))
