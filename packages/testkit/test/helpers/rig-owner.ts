// Child process for the rig crash-safety test: creates a rig, reports its node names, then idles until
// the parent SIGKILLs it. Run with plain `node` (type stripping).
import { PipeWireRig } from '../../src/rig/index.ts'

const rig = await PipeWireRig.create()
process.stdout.write(
  `READY ${JSON.stringify({ id: rig.id, nodes: (await rig.nodes()).map((n) => n.name) })}\n`,
)
setInterval(() => {}, 1000)
