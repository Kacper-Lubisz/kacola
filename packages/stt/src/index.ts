// @kacola/stt — speech-to-text for kacola: model manager (T-1), provider interfaces (T-2), the
// sherpa-onnx live and final tiers (T-3, T-4), Silero VAD, the segment reconciler + pipeline (T-5), and
// far-end diarization + the mic echo gate (M3).
//
// Importing this module never loads the native addon; the sherpa implementations load it on first use.

export * from './diarize/clustering.ts'
export * from './diarize/session.ts'
export * from './diarize/types.ts'
export * from './echo-gate.ts'
export * from './model-manager/catalog.ts'
export * from './model-manager/manager.ts'
export * from './model-manager/paths.ts'
export * from './pipeline.ts'
export * from './reconciler.ts'
export * from './sherpa/index.ts'
export * from './types.ts'
