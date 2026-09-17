import { OBDTransport } from './transports/obd-transport'
import { PID_DEFINITIONS, PidDecoder } from './pid-decoder'
import { ElmProtocolParser } from './elm-parser'
import { OBDPipelineEngine } from './obd-pipeline-engine'
import { RawRecorder } from './raw-recorder'
import { RawSampleModel, SampleQuality } from '../types/obd'
import { techLogStore } from './tech-log-store'

export interface SamplerEvents {
  sample: (sample: RawSampleModel) => void
  frequencyUpdate: (effectiveHz: number, targetHz: number) => void
  pidDiscovered: (pids: string[]) => void
  error: (err: Error) => void
}

export class SamplerScheduler {
  private transport: OBDTransport
  private recorder: RawRecorder
  private sessionMonoStart: number
  private isRunning = false
  private loopTimeoutId: any = null

  private priorityFreqHz: number
  private secondaryFreqHz: number
  private supportedPids: string[] = []
  private origin: 'REAL' | 'SIMULATED' = 'REAL'
  private maintenanceStage: 'ANTES_MANUTENCAO' | 'DEPOIS_MANUTENCAO' | 'PADRAO' = 'PADRAO'

  // PIDs a consultar (prioritários e secundários para homologação Ford EcoSport 1.5 Dragon)
  private priorityPids: string[] = ['0x0C', '0x0D', '0x05', '0x04', '0x11']
  private secondaryPids: string[] = [
    '0x10',
    '0x0B',
    '0x42',
    '0x06',
    '0x07',
    '0x0E',
    '0x0F',
    '0x1F',
    '0x14',
    '0x24',
  ]

  // Controle de frequência efetiva
  private sampleTimestampsMono: number[] = []
  private effectiveFreqHz = 0
  private listeners: { [K in keyof SamplerEvents]?: Set<SamplerEvents[K]> } = {}

  private secondaryRoundRobinIdx = 0

  constructor(
    transport: OBDTransport,
    recorder: RawRecorder,
    sessionMonoStart: number,
    priorityFreqHz = 5,
    secondaryFreqHz = 1,
  ) {
    this.transport = transport
    this.recorder = recorder
    this.sessionMonoStart = sessionMonoStart
    this.priorityFreqHz = priorityFreqHz
    this.secondaryFreqHz = secondaryFreqHz
  }

  setOrigin(origin: 'REAL' | 'SIMULATED'): void {
    this.origin = origin
  }

  setMaintenanceStage(stage: 'ANTES_MANUTENCAO' | 'DEPOIS_MANUTENCAO' | 'PADRAO'): void {
    this.maintenanceStage = stage
  }

  setSupportedPids(pids: string[]): void {
    this.supportedPids = pids
    this.priorityPids = ['0x0C', '0x0D', '0x05', '0x04', '0x11'].filter(
      (p) => pids.length === 0 || pids.includes(p),
    )
    this.secondaryPids = [
      '0x10',
      '0x0B',
      '0x42',
      '0x06',
      '0x07',
      '0x0E',
      '0x0F',
      '0x1F',
      '0x14',
      '0x24',
    ].filter((p) => pids.length === 0 || pids.includes(p))
  }

  on<K extends keyof SamplerEvents>(event: K, listener: SamplerEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any
    }
    this.listeners[event]!.add(listener)
  }

  off<K extends keyof SamplerEvents>(event: K, listener: SamplerEvents[K]): void {
    this.listeners[event]?.delete(listener)
  }

  private emit<K extends keyof SamplerEvents>(
    event: K,
    ...args: Parameters<SamplerEvents[K]>
  ): void {
    const list = this.listeners[event]
    if (list) {
      list.forEach((cb: any) => {
        try {
          cb(...args)
        } catch (e) {
          console.error('Sampler event error:', e)
        }
      })
    }
  }

  async discoverSupportedPids(): Promise<string[]> {
    const discovered: string[] = []
    if (!this.transport.isConnected()) return discovered

    try {
      // 01 00: PIDs 01 a 20
      const res00 = await this.transport.send('0100', 2500).catch(() => '')
      const parsed00 = ElmProtocolParser.parseMode01(res00, '00')
      if (!parsed00.isError && parsed00.bytes.length >= 4) {
        discovered.push(...PidDecoder.parseSupportedPidsBitmap(0, parsed00.bytes))
      }

      // 01 20: PIDs 21 a 40 (se PID 20 for suportado)
      if (discovered.includes('0x20')) {
        const res20 = await this.transport.send('0120', 2500).catch(() => '')
        const parsed20 = ElmProtocolParser.parseMode01(res20, '20')
        if (!parsed20.isError && parsed20.bytes.length >= 4) {
          discovered.push(...PidDecoder.parseSupportedPidsBitmap(32, parsed20.bytes))
        }
      }

      // 01 40: PIDs 41 a 60 (se PID 40 for suportado)
      if (discovered.includes('0x40')) {
        const res40 = await this.transport.send('0140', 2500).catch(() => '')
        const parsed40 = ElmProtocolParser.parseMode01(res40, '40')
        if (!parsed40.isError && parsed40.bytes.length >= 4) {
          discovered.push(...PidDecoder.parseSupportedPidsBitmap(64, parsed40.bytes))
        }
      }

      // 01 60: PIDs 61 a 80 (se PID 60 for suportado)
      if (discovered.includes('0x60')) {
        const res60 = await this.transport.send('0160', 2500).catch(() => '')
        const parsed60 = ElmProtocolParser.parseMode01(res60, '60')
        if (!parsed60.isError && parsed60.bytes.length >= 4) {
          discovered.push(...PidDecoder.parseSupportedPidsBitmap(96, parsed60.bytes))
        }
      }
    } catch {
      // Fallback gracioso
    }

    // Se a ECU não respondeu bitmask (ou modo simulado customizado), inclui lista padrão universal
    const finalList =
      discovered.length > 0
        ? Array.from(new Set(discovered))
        : [
            '0x0C',
            '0x0D',
            '0x05',
            '0x04',
            '0x11',
            '0x10',
            '0x0B',
            '0x42',
            '0x06',
            '0x07',
            '0x0E',
            '0x0F',
            '0x1F',
          ]

    this.setSupportedPids(finalList)
    this.emit('pidDiscovered', finalList)
    return finalList
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.sampleTimestampsMono = []
    this.pollLoop()
  }

  stop(): void {
    this.isRunning = false
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId)
      this.loopTimeoutId = null
    }
  }

  private updateFrequency(): void {
    const now = performance.now()
    this.sampleTimestampsMono.push(now)

    // Mantém apenas amostras dos últimos 2 segundos para cálculo de Hz móvel
    const windowStart = now - 2000
    while (this.sampleTimestampsMono.length > 0 && this.sampleTimestampsMono[0] < windowStart) {
      this.sampleTimestampsMono.shift()
    }

    if (this.sampleTimestampsMono.length >= 2) {
      const spanSec =
        (this.sampleTimestampsMono[this.sampleTimestampsMono.length - 1] -
          this.sampleTimestampsMono[0]) /
        1000
      if (spanSec > 0.1) {
        this.effectiveFreqHz =
          Math.round(((this.sampleTimestampsMono.length - 1) / spanSec) * 10) / 10
      }
    }

    this.emit('frequencyUpdate', this.effectiveFreqHz, this.priorityFreqHz)
  }

  private async pollLoop(): Promise<void> {
    if (!this.isRunning) return

    const cycleStartTime = performance.now()

    // 1. Amostra os PIDs prioritários (RPM, Velocidade, Temp, Carga, TPS)
    for (const pid of this.priorityPids) {
      if (!this.isRunning) return
      await this.queryPid(pid)
    }

    // 2. Amostra 1 PID secundário em round-robin por ciclo para garantir frequência >= 1 Hz sem sobrecarregar barramento
    if (this.secondaryPids.length > 0) {
      const secPid = this.secondaryPids[this.secondaryRoundRobinIdx % this.secondaryPids.length]
      this.secondaryRoundRobinIdx++
      await this.queryPid(secPid)
    }

    // Calcula tempo de espera para bater a frequência-alvo prioritária (ex: 5 Hz = ciclo de 200ms)
    const cycleDuration = performance.now() - cycleStartTime
    const targetIntervalMs = 1000 / this.priorityFreqHz
    const delay = Math.max(10, targetIntervalMs - cycleDuration)

    if (this.isRunning) {
      this.loopTimeoutId = setTimeout(() => this.pollLoop(), delay)
    }
  }

  private async queryPid(pidHex: string): Promise<void> {
    const monoNow = performance.now()
    const monoOffsetMs = Math.round(monoNow - this.sessionMonoStart)
    const utcIso = new Date().toISOString()
    const cleanHex = pidHex.replace(/^0x/i, '').toUpperCase()

    if (!this.transport.isConnected()) {
      const sample: RawSampleModel = {
        sample_id: '',
        session_id: '',
        ts_utc: utcIso,
        ts_mono_offset_ms: monoOffsetMs,
        pid: pidHex,
        quality: 'NO_RESPONSE',
        origin: this.origin,
        maintenance_stage: this.maintenanceStage,
      }
      const rec = this.recorder.recordSample(sample)
      this.emit('sample', rec)
      return
    }

    try {
      const rawText = await this.transport.send(`01${cleanHex}`, 1500)
      const pipelineResult = OBDPipelineEngine.processPidResponse(
        rawText,
        cleanHex,
        '01',
        monoOffsetMs,
      )

      let quality: SampleQuality = 'OK'
      let decodedVal: number | undefined
      let rawVal: number | undefined
      let unit: string | undefined

      if (pipelineResult.sampleStatus === 'OK') {
        decodedVal = pipelineResult.decodedValue
        unit = pipelineResult.unit
        rawVal = pipelineResult.dataBytes[0]
        quality = 'OK'
      } else if (pipelineResult.sampleStatus === 'PID_NAO_SUPORTADO') {
        quality = 'UNSUPPORTED'
        techLogStore.addEntry({
          direction: 'ERR',
          command: `01${cleanHex}`,
          rawResponse: rawText,
          response: rawText.replace(/[>\r\n]/g, ' ').trim(),
          stage: 'PARSER_REJECTED',
          errorReason: 'NO DATA',
          details: `PID ${pidHex} não suportado pela ECU (NO DATA). Resposta bruta: ${JSON.stringify(rawText)}`,
        })
      } else if (pipelineResult.sampleStatus === 'SEM_COMUNICACAO') {
        quality = 'TIMEOUT'
        techLogStore.addEntry({
          direction: 'ERR',
          command: `01${cleanHex}`,
          rawResponse: rawText,
          response: rawText.replace(/[>\r\n]/g, ' ').trim(),
          stage: 'PARSER_REJECTED',
          errorReason: 'UNABLE TO CONNECT',
          details: `ECU sem comunicação: [${pipelineResult.errorReason}]. Resposta bruta: ${JSON.stringify(rawText)}`,
        })
      } else if (pipelineResult.sampleStatus === 'ERRO_DECODER') {
        quality = 'INVALID'
        techLogStore.addEntry({
          direction: 'ERR',
          command: `01${cleanHex}`,
          rawResponse: rawText,
          response: rawText.replace(/[>\r\n]/g, ' ').trim(),
          stage: 'DECODER_REJECTED',
          errorReason: pipelineResult.errorReason || 'DECODER_UNKNOWN_PID_OR_BYTES',
          details: `PID ${pidHex} possui bytes [${pipelineResult.dataBytes.join(', ')}] mas falhou no decoder: ${pipelineResult.errorReason}. Resposta bruta: ${JSON.stringify(rawText)}`,
        })
      } else {
        // ERRO_PARSER / RESPOSTA_INVALIDA / TIMEOUT
        quality = pipelineResult.sampleStatus === 'TIMEOUT' ? 'TIMEOUT' : 'INVALID'
        techLogStore.addEntry({
          direction: 'ERR',
          command: `01${cleanHex}`,
          rawResponse: rawText,
          response: rawText.replace(/[>\r\n]/g, ' ').trim(),
          stage: 'PARSER_REJECTED',
          errorReason: pipelineResult.errorReason || 'FORMATO NÃO RECONHECIDO',
          details: `PID ${pidHex} rejeitado pelo pipeline [${pipelineResult.sampleStatus}]: ${pipelineResult.errorReason}. Resposta bruta: ${JSON.stringify(rawText)}`,
        })
      }

      const sample: RawSampleModel = {
        sample_id: '',
        session_id: '',
        ts_utc: utcIso,
        ts_mono_offset_ms: monoOffsetMs,
        pid: pidHex,
        raw_value: quality === 'OK' ? rawVal : undefined,
        decoded_value: quality === 'OK' ? decodedVal : undefined,
        unit,
        quality,
        origin: this.origin,
        maintenance_stage: this.maintenanceStage,
      }

      const recorded = this.recorder.recordSample(sample)
      this.updateFrequency()
      this.emit('sample', recorded)
    } catch (err: any) {
      const isTimeout = err?.message?.includes('TIMEOUT')
      const quality: SampleQuality = isTimeout ? 'TIMEOUT' : 'NO_RESPONSE'

      const sample: RawSampleModel = {
        sample_id: '',
        session_id: '',
        ts_utc: utcIso,
        ts_mono_offset_ms: monoOffsetMs,
        pid: pidHex,
        quality,
        origin: this.origin,
        maintenance_stage: this.maintenanceStage,
      }

      const recorded = this.recorder.recordSample(sample)
      this.emit('sample', recorded)
    }
  }
}
