// The model catalog: every model gnomeola can download, pinned by sha256.
//
// Checksums were recorded by downloading each artefact once and hashing it (see docs/stt.md). A model is
// only ever `ready` when the archive that produced it matched this hash and every `requiredFiles` entry
// is present with the size recorded at install time — a half-extracted or tampered directory is
// `corrupt`, never silently used.

export type ModelRole = 'live' | 'final' | 'vad' | 'tts' | 'segmentation' | 'embedding'

/** How a sherpa-onnx engine is configured from the files in the model directory (paths are relative). */
export type EngineSpec =
  | { kind: 'online-transducer'; encoder: string; decoder: string; joiner: string; tokens: string }
  | { kind: 'offline-whisper'; encoder: string; decoder: string; tokens: string }
  | { kind: 'offline-moonshine-v2'; encoder: string; mergedDecoder: string; tokens: string }
  | { kind: 'offline-nemo-transducer'; encoder: string; decoder: string; joiner: string; tokens: string }
  | { kind: 'silero-vad'; model: string }
  | { kind: 'vits'; model: string; tokens: string; dataDir: string }
  | { kind: 'pyannote-segmentation'; model: string }
  | { kind: 'speaker-embedding'; model: string }

export type CatalogEntry = {
  id: string
  role: ModelRole
  title: string
  url: string
  sha256: string
  /** Download size in bytes (the archive, or the single file). */
  sizeBytes: number
  /** `tar.bz2` archives have one top-level directory, which is stripped on extraction. */
  format: 'tar.bz2' | 'file'
  /** For `file`: the name it is stored under inside the model directory. */
  fileName?: string
  requiredFiles: string[]
  engine: EngineSpec
  license: string
  /** Where the licence is stated — kept for the licence audit. */
  licenseUrl: string
}

const ASR = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models'
const TTS = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models'
const SEGMENTATION = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models'
// (sic: the release tag is spelled this way upstream)
const SPEAKER = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models'

const transducerFiles = (prefix: string, suffix: string) => ({
  encoder: `${prefix}encoder${suffix}`,
  decoder: `${prefix}decoder${suffix}`,
  joiner: `${prefix}joiner${suffix}`,
  tokens: 'tokens.txt',
})

function online(
  e: Omit<CatalogEntry, 'role' | 'format' | 'requiredFiles' | 'engine'>,
  files: { encoder: string; decoder: string; joiner: string; tokens: string },
): CatalogEntry {
  return {
    ...e,
    role: 'live',
    format: 'tar.bz2',
    requiredFiles: Object.values(files),
    engine: { kind: 'online-transducer', ...files },
  }
}

function piper(voice: string, sha256: string, sizeBytes: number, license: string): CatalogEntry {
  const model = `${voice}.onnx`
  return {
    id: `tts-piper-${voice}`,
    role: 'tts',
    title: `Piper voice ${voice} (int8)`,
    url: `${TTS}/vits-piper-${voice}-int8.tar.bz2`,
    sha256,
    sizeBytes,
    format: 'tar.bz2',
    requiredFiles: [model, 'tokens.txt', 'espeak-ng-data/phontab', 'MODEL_CARD'],
    engine: { kind: 'vits', model, tokens: 'tokens.txt', dataDir: 'espeak-ng-data' },
    license,
    licenseUrl: 'https://huggingface.co/rhasspy/piper-voices',
  }
}

export const CATALOG: readonly CatalogEntry[] = [
  // ------------------------------------------------------------------ tier 1: streaming (live)
  online(
    {
      id: 'live-zipformer-en-2023-06-26-int8',
      title: 'Streaming Zipformer transducer, English (icefall 2023-06-26, int8)',
      url: `${ASR}/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2`,
      sha256: '639e25b578e9e997131402199419c13a941f8e4e198e2da1ce57dbf5cf401282',
      sizeBytes: 310414022,
      license: 'Apache-2.0',
      licenseUrl: 'https://github.com/k2-fsa/icefall/blob/master/LICENSE',
    },
    transducerFiles('', '-epoch-99-avg-1-chunk-16-left-128.int8.onnx'),
  ),
  online(
    {
      id: 'live-zipformer-en-20m-2023-02-17-int8',
      title: 'Streaming Zipformer transducer, English, 20M params (icefall 2023-02-17, int8)',
      url: `${ASR}/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2`,
      sha256: '9c559283e8498d3fe95913c79ca1cb454bb26281ac2b102b41306c7d752765d9',
      sizeBytes: 127887156,
      license: 'Apache-2.0',
      licenseUrl: 'https://github.com/k2-fsa/icefall/blob/master/LICENSE',
    },
    transducerFiles('', '-epoch-99-avg-1.int8.onnx'),
  ),
  online(
    {
      id: 'live-kroko-en-2025-08-06',
      title: 'Kroko streaming Zipformer, English community model (2025-08-06)',
      url: `${ASR}/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2`,
      sha256: 'c8676e5ff9ac2a85296e53ee0fd4d5fb1db6770e7a7647166eeafe349ade6834',
      sizeBytes: 57267600,
      license: 'CC-BY-SA-4.0',
      licenseUrl: 'https://huggingface.co/Banafo/Kroko-ASR',
    },
    transducerFiles('', '.onnx'),
  ),
  online(
    {
      id: 'live-nemo-fastconformer-en-80ms-int8',
      title: 'NeMo streaming FastConformer transducer, English, 80 ms (int8)',
      url: `${ASR}/sherpa-onnx-nemo-streaming-fast-conformer-transducer-en-80ms-int8.tar.bz2`,
      sha256: '7bd33a914e93370a1ba9c2066d9e841bdcad8613fa2a00537c1ae15d851a14d8',
      sizeBytes: 102813625,
      license: 'CC-BY-4.0',
      licenseUrl: 'https://huggingface.co/nvidia/stt_en_fastconformer_hybrid_large_streaming_multi',
    },
    transducerFiles('', '.int8.onnx'),
  ),

  // ------------------------------------------------------------------ tier 2: offline (final)
  ...(['tiny', 'base', 'small'] as const).map(
    (size): CatalogEntry => ({
      id: `final-whisper-${size}-en-int8`,
      role: 'final',
      title: `Whisper ${size}.en (int8)`,
      url: `${ASR}/sherpa-onnx-whisper-${size}.en.tar.bz2`,
      sha256: {
        tiny: '2bd6cf965c8bb3e068ef9fa2191387ee63a9dfa2a4e37582a8109641c20005dd',
        base: '475bc7052ce299c007f6d5d5407ba8601f819a2867f6eecee510ed17df581542',
        small: '0cdba2b8aaab69e04847f3427cc9709574112e67913a1a84b7fec3a8729faa9a',
      }[size],
      sizeBytes: { tiny: 118071777, base: 208576005, small: 635693775 }[size],
      format: 'tar.bz2',
      requiredFiles: [
        `${size}.en-encoder.int8.onnx`,
        `${size}.en-decoder.int8.onnx`,
        `${size}.en-tokens.txt`,
      ],
      engine: {
        kind: 'offline-whisper',
        encoder: `${size}.en-encoder.int8.onnx`,
        decoder: `${size}.en-decoder.int8.onnx`,
        tokens: `${size}.en-tokens.txt`,
      },
      license: 'MIT',
      licenseUrl: 'https://github.com/openai/whisper/blob/main/LICENSE',
    }),
  ),
  ...(['tiny', 'base'] as const).map(
    (size): CatalogEntry => ({
      id: `final-moonshine-${size}-en`,
      role: 'final',
      title: `Moonshine v2 ${size}, English (quantized, 2026-02-27)`,
      url: `${ASR}/sherpa-onnx-moonshine-${size}-en-quantized-2026-02-27.tar.bz2`,
      sha256: {
        tiny: '9ec31b342d8fa3240c3b81b8f82e1cf7e3ac467c93ca5a999b741d5887164f8d',
        base: '43232c1d13013d37317163baec3135bd771a186a4356f28c889bab453bb0e891',
      }[size],
      sizeBytes: { tiny: 29858559, base: 111266225 }[size],
      format: 'tar.bz2',
      requiredFiles: ['encoder_model.ort', 'decoder_model_merged.ort', 'tokens.txt', 'LICENSE'],
      engine: {
        kind: 'offline-moonshine-v2',
        encoder: 'encoder_model.ort',
        mergedDecoder: 'decoder_model_merged.ort',
        tokens: 'tokens.txt',
      },
      license: 'MIT',
      licenseUrl: 'https://github.com/moonshine-ai/moonshine/blob/main/LICENSE',
    }),
  ),
  {
    id: 'final-parakeet-tdt-110m-en-int8',
    role: 'final',
    title: 'NVIDIA Parakeet TDT 110M, English (int8)',
    url: `${ASR}/sherpa-onnx-nemo-parakeet_tdt_transducer_110m-en-36000-int8.tar.bz2`,
    sha256: 'f628312e9fdf8686374cb01a69425c41732529d540860311f16f37cbc32cfe9b',
    sizeBytes: 108035095,
    format: 'tar.bz2',
    requiredFiles: ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'],
    engine: { kind: 'offline-nemo-transducer', ...transducerFiles('', '.int8.onnx') },
    license: 'CC-BY-4.0',
    licenseUrl: 'https://huggingface.co/nvidia/parakeet-tdt_ctc-110m',
  },
  {
    id: 'final-parakeet-tdt-0.6b-v2-en-int8',
    role: 'final',
    title: 'NVIDIA Parakeet TDT 0.6B v2, English (int8)',
    url: `${ASR}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2`,
    sha256: '157c157bc51155e03e37d2466522a3a737dd9c72bb25f36eb18912964161e1ad',
    sizeBytes: 482468385,
    format: 'tar.bz2',
    requiredFiles: ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'],
    engine: { kind: 'offline-nemo-transducer', ...transducerFiles('', '.int8.onnx') },
    license: 'CC-BY-4.0',
    licenseUrl: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2',
  },

  // ------------------------------------------------------------------ VAD
  {
    id: 'vad-silero',
    role: 'vad',
    title: 'Silero VAD',
    url: `${ASR}/silero_vad.onnx`,
    sha256: '9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6',
    sizeBytes: 643854,
    format: 'file',
    fileName: 'silero_vad.onnx',
    requiredFiles: ['silero_vad.onnx'],
    engine: { kind: 'silero-vad', model: 'silero_vad.onnx' },
    license: 'MIT',
    licenseUrl: 'https://github.com/snakers4/silero-vad/blob/master/LICENSE',
  },

  // ------------------------------------------------------------------ diarization (M3)
  // Measured on the fixture meetings (packages/stt/scripts/diarize-bench.ts, numbers in docs/stt.md):
  // TitaNet-small separated every fixture's speakers across the widest range of thresholds, at half the
  // cost of the next best (WeSpeaker ResNet34); CAM++ and ERes2Net over-split badly.
  {
    id: 'segmentation-pyannote-3.0',
    role: 'segmentation',
    title: 'pyannote speaker segmentation 3.0',
    url: `${SEGMENTATION}/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2`,
    sha256: '24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488',
    sizeBytes: 6958444,
    format: 'tar.bz2',
    requiredFiles: ['model.onnx', 'LICENSE'],
    engine: { kind: 'pyannote-segmentation', model: 'model.onnx' },
    license: 'MIT',
    licenseUrl: 'https://huggingface.co/pyannote/segmentation-3.0',
  },
  {
    id: 'embedding-titanet-small-en',
    role: 'embedding',
    title: 'NVIDIA TitaNet-small speaker embeddings, English',
    url: `${SPEAKER}/nemo_en_titanet_small.onnx`,
    sha256: 'ad4a1802485d8b34c722d2a9d04249662f2ece5d28a7a039063ca22f515a789e',
    sizeBytes: 40257283,
    format: 'file',
    fileName: 'nemo_en_titanet_small.onnx',
    requiredFiles: ['nemo_en_titanet_small.onnx'],
    engine: { kind: 'speaker-embedding', model: 'nemo_en_titanet_small.onnx' },
    license: 'CC-BY-4.0',
    licenseUrl: 'https://huggingface.co/nvidia/speakerverification_en_titanet_small',
  },
  {
    id: 'embedding-wespeaker-resnet34-en',
    role: 'embedding',
    title: 'WeSpeaker ResNet34 speaker embeddings (VoxCeleb)',
    url: `${SPEAKER}/wespeaker_en_voxceleb_resnet34.onnx`,
    sha256: '5ef208a9da1453335308a6b6f4e6dfbd7e183a38b604de0a57664f45d257fe94',
    sizeBytes: 26534365,
    format: 'file',
    fileName: 'wespeaker_en_voxceleb_resnet34.onnx',
    requiredFiles: ['wespeaker_en_voxceleb_resnet34.onnx'],
    engine: { kind: 'speaker-embedding', model: 'wespeaker_en_voxceleb_resnet34.onnx' },
    license: 'CC-BY-4.0 (model trained on VoxCeleb); code Apache-2.0',
    licenseUrl: 'https://github.com/wenet-e2e/wespeaker/blob/master/docs/pretrained.md',
  },

  // ------------------------------------------------------------------ TTS (fixture synthesis only)
  // Voices chosen for licence clarity and intelligibility: each scores <5% WER with Parakeet on the
  // fixture script (packages/stt/scripts/voice-check.ts), and each is trained on public-domain, CC0 or
  // Apache-2.0 data (licence from the voice's MODEL_CARD).
  piper(
    'en_US-joe-medium',
    '644527f29eca0ada5595d7b6e4daf6388f5ac0c4870b4d42996a6687fcefeb37',
    21230019,
    'MIT (Piper) / voice data CC0 (NabuCasa voice-datasets)',
  ),
  piper(
    'en_US-ljspeech-medium',
    '24dc3bd77dd48c291e52c297878d3437c9492f245d823d7f6a06c4bbb67f4b6b',
    21090429,
    'MIT (Piper) / voice data public domain (LJ Speech)',
  ),
  piper(
    'en_US-sam-medium',
    'e4c55b5a389ac0f586486ce23ff4ff38d89752fd3c55852ab3159f5eb02d41c0',
    20874946,
    'MIT (Piper) / voice data Apache-2.0 (Sam non-binary voice)',
  ),
  piper(
    'en_GB-cori-medium',
    '169ca8aff3adb271f009a4924c99928a811dbf2b52eaca2dbb460e8c34478c93',
    20768736,
    'MIT (Piper) / voice data public domain (LibriVox)',
  ),
]

/** The defaults, chosen from measured WER and real-time factor — see docs/stt.md. */
export const DEFAULT_MODELS = {
  live: 'live-nemo-fastconformer-en-80ms-int8',
  final: 'final-parakeet-tdt-110m-en-int8',
  vad: 'vad-silero',
  segmentation: 'segmentation-pyannote-3.0',
  embedding: 'embedding-titanet-small-en',
} as const

export function catalogEntry(id: string, catalog: readonly CatalogEntry[] = CATALOG): CatalogEntry {
  const e = catalog.find((m) => m.id === id)
  if (!e) throw new Error(`unknown model ${JSON.stringify(id)}`)
  return e
}
