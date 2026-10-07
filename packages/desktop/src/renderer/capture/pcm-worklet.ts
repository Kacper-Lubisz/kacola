import { Pcm16Framer } from '../../shared/pcm-framer.ts'

// The capture window's AudioWorklet: each render quantum (128 samples) of the track's first channel into
// 40 ms 16 kHz s16 frames, posted (transferred) to the page, which forwards them to main.

// AudioWorkletGlobalScope (TypeScript ships no lib for it)
declare const sampleRate: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

class PcmProcessor extends AudioWorkletProcessor {
  private readonly framer = new Pcm16Framer(sampleRate)

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (channel) for (const f of this.framer.push(channel)) this.port.postMessage(f.buffer, [f.buffer])
    return true
  }
}

registerProcessor('kacola-pcm', PcmProcessor)
