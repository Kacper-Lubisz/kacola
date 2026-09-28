# @gnomeola/testkit

Shared verification machinery. Every tier's tests import from here, so the same assertions run through
every path (fake capture and real PipeWire, cassette LLM and live LLM).

| subpath | owns |
| --- | --- |
| `./invariants` | deterministic property checks over segments and event logs (V-2a) |
| `./rig` | the synthetic PipeWire rig: virtual devices, fixture playback, teardown (V-1a) |
| `./fixtures` | fixture meetings + hand-labelled / synthesized ground truth |
| `./metrics` | WER (and later DER), latency percentiles, baseline + tolerance-band comparison |
| `./cassettes` | record/replay for LLM HTTP traffic (V-5a) |
| `./daemon` | start a real daemon on a temp dir + random port for integration and e2e tests |
| `./ui` | headless compositor + AT-SPI driver for the GTK app (V-9a) |
