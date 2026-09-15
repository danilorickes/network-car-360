import { RawSampleModel } from '../types/obd'

export interface ReplayCallbacks {
  onSample: (sample: RawSampleModel) => void
  onProgress: (currentMonoMs: number, totalMonoMs: number, percent: number) => void
  onFinished: () => void
}

/**
 * ReplayEngine: Reproduz uma sessão armazenada alimentando o painel
 * através do EXATO MESMO MODELO DE DADOS do Live.
 * Suporta velocidades 1x, 2x, 5x e 10x, Play, Pause e Scrubbing.
 */
export class ReplayEngine {
  private samples: RawSampleModel[] = []
  private speed = 1
  private isPlaying = false
  private currentSampleIndex = 0
  private totalDurationMs = 0
  private timerId: any = null
  private callbacks: ReplayCallbacks

  constructor(samples: RawSampleModel[], callbacks: ReplayCallbacks) {
    // Garante ordenação cronológica pelo offset monotônico ou utc
    this.samples = [...samples].sort((a, b) => a.ts_mono_offset_ms - b.ts_mono_offset_ms)
    this.callbacks = callbacks
    if (this.samples.length > 0) {
      this.totalDurationMs = this.samples[this.samples.length - 1].ts_mono_offset_ms
    }
  }

  setSpeed(speed: number): void {
    this.speed = speed
  }

  getSpeed(): number {
    return this.speed
  }

  getTotalDurationMs(): number {
    return this.totalDurationMs
  }

  getCurrentMonoMs(): number {
    if (this.currentSampleIndex >= this.samples.length) {
      return this.totalDurationMs
    }
    return this.samples[this.currentSampleIndex]?.ts_mono_offset_ms || 0
  }

  isPlayingStatus(): boolean {
    return this.isPlaying
  }

  play(): void {
    if (this.isPlaying) return
    if (this.currentSampleIndex >= this.samples.length) {
      this.currentSampleIndex = 0
    }
    this.isPlaying = true
    this.scheduleNextSample()
  }

  pause(): void {
    this.isPlaying = false
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  seek(percent: number): void {
    const wasPlaying = this.isPlaying
    this.pause()

    const targetOffset = (percent / 100) * this.totalDurationMs
    let closestIdx = 0
    let minDiff = Infinity

    for (let i = 0; i < this.samples.length; i++) {
      const diff = Math.abs(this.samples[i].ts_mono_offset_ms - targetOffset)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = i
      }
    }

    this.currentSampleIndex = closestIdx
    const currentSample = this.samples[this.currentSampleIndex]
    if (currentSample) {
      this.callbacks.onSample(currentSample)
      this.callbacks.onProgress(currentSample.ts_mono_offset_ms, this.totalDurationMs, percent)
    }

    if (wasPlaying) {
      this.play()
    }
  }

  private scheduleNextSample(): void {
    if (!this.isPlaying || this.currentSampleIndex >= this.samples.length) {
      this.isPlaying = false
      this.callbacks.onFinished()
      return
    }

    const currentSample = this.samples[this.currentSampleIndex]
    this.callbacks.onSample(currentSample)

    const nextIndex = this.currentSampleIndex + 1
    if (nextIndex >= this.samples.length) {
      this.currentSampleIndex = nextIndex
      this.isPlaying = false
      this.callbacks.onFinished()
      return
    }

    const nextSample = this.samples[nextIndex]
    const rawDeltaMs = Math.max(0, nextSample.ts_mono_offset_ms - currentSample.ts_mono_offset_ms)
    const scaledDeltaMs = Math.max(1, rawDeltaMs / this.speed)

    this.callbacks.onProgress(
      currentSample.ts_mono_offset_ms,
      this.totalDurationMs,
      this.totalDurationMs > 0
        ? (currentSample.ts_mono_offset_ms / this.totalDurationMs) * 100
        : 100,
    )

    this.currentSampleIndex = nextIndex
    this.timerId = setTimeout(() => this.scheduleNextSample(), scaledDeltaMs)
  }
}
