# The Electron window (packages/desktop)

## E-1 footprint gate (2026-09-30)

Measured inside the headless GNOME Shell 50.4 (Wayland, `--virtual-monitor 1280x800`,
`startHeadlessDisplay()`), Fedora 44, 3 runs each, figures stable to ±1%. Idle = 15 s after the first
paint. Memory is summed over the app's whole process tree from `/proc/<pid>/smaps_rollup`.

| | cold start: ready | cold start: first pixels | idle RSS (sum) | idle PSS (sum) | idle USS (sum) | processes |
| --- | --- | --- | --- | --- | --- | --- |
| GTK app (`node packages/ui/dist/bundle.mjs`, real test daemon, empty) | 975–1006 ms | 995–1027 ms | 361 MB | 197 MB | 172 MB | 1 |
| Electron 44.5.1 minimal window (sandboxed, data: page with sidebar) | 562–585 ms | 742–751 ms | 844–852 MB | 345–348 MB | 195 MB | 11 |
| same, `--disable-gpu --disable-software-rasterizer` | 263 ms | 402 ms | 700 MB | 259 MB | 138 MB | 11 |

- *ready*: GTK = "No Session Selected" label on the AT-SPI bus; Electron = `ready-to-show`.
- *first pixels*: first Shell screenshot that differs from the empty desktop (both apps, same probe).
- Electron per-process RSS (default): main 196, GPU 138 (no GPU in the headless Shell → SwiftShader),
  renderer 102, zygotes 63+63+16, network/utility 89+88, broker 45, glycin-svg 16 MB.
- **Summed RSS double-counts** the pages every Chromium process shares (libelectron / V8 snapshot /
  ICU are mapped into all of them). PSS divides shared pages among their sharers, so it is the fair
  "sum of all processes" figure; USS is what quitting the app would free.

**Gate: the brief's threshold is "idle RSS > 350 MB → stop". Summed RSS is 852 MB (the GTK app alone
is 361 MB RSS); summed PSS is 348 MB. Stopped at E-1 for the lead's decision on which figure the gate
means.**
