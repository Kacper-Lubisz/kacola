// @kacola/capture-agent — the local-only half of kacola (H-2): capture + chunked upload for full
// offload (H-3), and the hybrid-sync pusher (H-7). Talks to any backend through the protocol only.
export { type AgentRecording, CaptureAgent, type CaptureAgentOptions } from './agent.ts'
export { SyncAgent, type SyncAgentOptions, type SyncStats } from './sync.ts'
export {
  ChunkUploader,
  chunksOfWav,
  resumeUpload,
  TrackChunker,
  type UploaderOptions,
  type UploadStats,
} from './upload.ts'
