/**
 * Parser de protocolo ELM327.
 * Trata respostas de comandos AT e respostas OBD-II padrão (Modo 01, 03, 07).
 * Remove prompts '>', ecos, espaços e trata status: NO DATA, UNABLE TO CONNECT, ?, SEARCHING...
 */

import { OBDPipelineEngine } from './obd-pipeline-engine'

export interface ParsedPidResponse {
  mode: string
  pid: string
  bytes: number[]
  rawText: string
  isError: boolean
  errorMessage?: string
}

export interface ParsedDtcResponse {
  codes: string[]
  rawText: string
  isError: boolean
}

export class ElmProtocolParser {
  /**
   * Limpa resposta removendo prompts e retornos de carro
   */
  static cleanResponse(raw: string): string {
    return raw
      .replace(/>/g, '')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('SEARCHING'))
      .join('\n')
  }

  /**
   * Interpreta resposta de requisição de PID (Modo 01)
   * Formato esperado: "41 0C 1A F8" ou em múltiplas linhas
   */
  static parseMode01(raw: string, requestedPid: string): ParsedPidResponse {
    const cleanPid = requestedPid.replace(/^0x/i, '').toUpperCase().padStart(2, '0')
    const pidHex = `0x${cleanPid}`

    // Utiliza o motor estruturado OBDPipelineEngine para extração robusta e normalizada de frames
    const extraction = OBDPipelineEngine.extractFrames(raw, cleanPid, '01')

    if (extraction.adapterStatus) {
      const st = extraction.adapterStatus.status
      let errLabel = 'FORMATO NÃO RECONHECIDO'
      if (st === 'PID_NAO_SUPORTADO') errLabel = 'NO DATA'
      else if (st === 'SEM_COMUNICACAO') errLabel = 'UNABLE TO CONNECT'
      else if (st === 'RESPOSTA_INVALIDA') errLabel = 'RESPOSTA INVÁLIDA (?)'
      else if (st === 'TIMEOUT') errLabel = 'TIMEOUT'

      return {
        mode: '01',
        pid: pidHex,
        bytes: [],
        rawText: raw,
        isError: true,
        errorMessage: errLabel,
      }
    }

    if (extraction.frames.length > 0) {
      // Prioriza frame da ECU primária (ex: 7E8 Engine/PCM) se múltiplas responderem
      const frame = extraction.frames.find((f) => f.ecuId === '7E8') || extraction.frames[0]
      return {
        mode: '01',
        pid: pidHex,
        bytes: frame.dataBytes,
        rawText: frame.rawFrameText,
        isError: false,
      }
    }

    return {
      mode: '01',
      pid: pidHex,
      bytes: [],
      rawText: raw,
      isError: true,
      errorMessage: 'FORMATO NÃO RECONHECIDO',
    }
  }

  /**
   * Converte par de bytes em código DTC padrão (P0xxx, C0xxx, B0xxx, U0xxx)
   */
  static decodeDtcBytes(b1: number, b2: number): string | null {
    if (b1 === 0 && b2 === 0) return null // 00 00 = sem código

    const prefixMap = ['P', 'C', 'B', 'U']
    const prefix = prefixMap[(b1 >> 6) & 0x03]
    const digit1 = (b1 >> 4) & 0x03
    const digit2 = b1 & 0x0f
    const digit3 = (b2 >> 4) & 0x0f
    const digit4 = b2 & 0x0f

    return `${prefix}${digit1}${digit2.toString(16).toUpperCase()}${digit3.toString(16).toUpperCase()}${digit4.toString(16).toUpperCase()}`
  }

  /**
   * Decodifica resposta de DTCs (Modo 03 ou Modo 07)
   * Resposta ex: "43 01 03 01 00 00" -> P0301
   */
  static parseDtcResponse(raw: string, expectedMode = '03'): ParsedDtcResponse {
    const cleaned = this.cleanResponse(raw)
    if (!cleaned || cleaned.includes('NO DATA')) {
      return { codes: [], rawText: raw, isError: false }
    }

    if (cleaned.includes('UNABLE TO CONNECT') || cleaned.includes('ERROR')) {
      return { codes: [], rawText: raw, isError: true }
    }

    const responseHeader = (parseInt(expectedMode, 16) + 0x40).toString(16).toUpperCase() // Modo 03 -> 43, 07 -> 47
    const codes: string[] = []
    const lines = cleaned.split('\n')

    for (const line of lines) {
      const tokens = line
        .replace(/[^A-Fa-f0-9]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].toUpperCase() === responseHeader) {
          // Os bytes seguintes vêm em pares de 2 bytes por DTC
          const dataBytes = tokens.slice(i + 1).map((t) => parseInt(t, 16))
          // Se houver um byte indicador de quantidade (ex: 43 01 xx xx...), pode pular ou tratar
          let ptr = 0
          if (dataBytes.length % 2 !== 0) {
            ptr = 1 // primeiro byte é a contagem
          }
          while (ptr + 1 < dataBytes.length) {
            const dtc = this.decodeDtcBytes(dataBytes[ptr], dataBytes[ptr + 1])
            if (dtc && !codes.includes(dtc)) {
              codes.push(dtc)
            }
            ptr += 2
          }
        }
      }
    }

    return { codes, rawText: raw, isError: false }
  }
}
