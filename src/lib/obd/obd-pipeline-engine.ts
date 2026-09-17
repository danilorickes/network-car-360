/**
 * Pipeline Estruturado de Decodificação OBD-II / SAE J1979
 * Missão E6.6.1: Correção estrutural e universal do pipeline de leitura/decodificação OBD-II.
 *
 * Separação rigorosa das 10 etapas da telemetria:
 * (1) rawReceived: string recebida do transporte (ELM327 / Android Bridge / Serial / BLE)
 * (2) normalizedRaw: texto limpo de ruídos de transporte (prompt, ecos, quebras CR/LF, etc.)
 * (3) frames: frames identificados (com ou sem headers CAN, multilinhas, múltiplas ECUs)
 * (4) responderEcu: identificador da ECU respondedora (ex: '7E8', '7E9' ou 'GENERIC_ECU')
 * (5) mode / pid: identificadores numéricos e hexadecimais validados
 * (6) dataBytes: bytes de carga útil estritamente extraídos
 * (7) decodedValue: valor físico após aplicação de fórmula SAE J1979
 * (8) unit: unidade SAE (RPM, km/h, °C, kPa, V, %, g/s etc.)
 * (9) timestampUtc: carimbo de tempo da amostra
 * (10) sampleStatus: estado da amostra ('OK' | 'PID_NAO_SUPORTADO' | 'TIMEOUT' | 'RESPOSTA_INVALIDA' | 'SEM_COMUNICACAO' | 'ERRO_PARSER' | 'ERRO_DECODER' | 'AGUARDANDO_AMOSTRA' | 'DADO_STALE')
 */

import { PID_DEFINITIONS } from './pid-decoder'

export type SampleDiagnosticStatus =
  | 'OK' // Dado válido obtido e decodificado
  | 'PID_NAO_SUPORTADO' // Veículo respondeu NO DATA ou bitmap indica PID ausente
  | 'TIMEOUT' // Não houve resposta no tempo limite
  | 'RESPOSTA_INVALIDA' // Resposta com erro de barramento ('?', 'BUFFER FULL', 'FB ERROR')
  | 'SEM_COMUNICACAO' // ECU ou barramento sem comunicação ('UNABLE TO CONNECT', 'CAN ERROR', etc.)
  | 'ERRO_PARSER' // Formato de frame incompreensível
  | 'ERRO_DECODER' // Bytes insuficientes ou fórmula inválida
  | 'AGUARDANDO_AMOSTRA' // Pipeline inicializado mas ainda sem leitura
  | 'DADO_STALE' // Dado expirado

export interface ParsedOBDFrame {
  ecuId?: string // ex: '7E8'
  pciLength?: number // ex: 4 (para single frames CAN)
  mode: string // ex: '01' ou '41'
  pid: string // ex: '0C' ou '0x0C'
  cleanPidHex: string // ex: '0C'
  dataBytes: number[] // bytes de dados extraídos
  rawFrameText: string // linha ou pedaço do frame
}

export interface DecodedOBDResult {
  // 1. RAW Recebido
  rawReceived: string
  // 2. RAW Normalizado
  normalizedRaw: string
  // 3. Frames identificados
  frames: ParsedOBDFrame[]
  // 4. ECU Respondedora
  responderEcu: string
  // 5. Mode e PID
  mode: string
  pid: string
  cleanPidHex: string
  // 6. Bytes de dados
  dataBytes: number[]
  // 7. Valor decodificado
  decodedValue?: number
  formattedValue?: string
  // 8. Unidade
  unit?: string
  // 9. Timestamp
  timestampUtc: string
  monoOffsetMs: number
  // 10. Qualidade / Estado
  sampleStatus: SampleDiagnosticStatus
  errorReason?: string
  stage?:
    | 'RAW_TRANSPORT'
    | 'NORMALIZATION'
    | 'FRAME_PARSER'
    | 'PID_VALIDATION'
    | 'DECODER_SAE'
    | 'DECODER_EXTENSION'
}

/**
 * Interface para extensões proprietárias de montadoras (Ford, VW, GM, Stellantis, Toyota etc.)
 * Mantém o núcleo universal limpo conforme SAE J1979.
 */
export interface ManufacturerExtensionDecoder {
  manufacturer: string
  canDecode(mode: string, pidHex: string): boolean
  decode(
    mode: string,
    pidHex: string,
    bytes: number[],
  ): { value: number; unit: string; format?: (v: number) => string } | null
}

const registeredExtensions: ManufacturerExtensionDecoder[] = []

export function registerManufacturerExtension(ext: ManufacturerExtensionDecoder): void {
  registeredExtensions.push(ext)
}

export function clearManufacturerExtensions(): void {
  registeredExtensions.length = 0
}

export class OBDResponseNormalizer {
  /**
   * Etapa 1 e 2: Normaliza a resposta textual do ELM327 / Android Bridge.
   * Lida com:
   * - Prompt `>` em qualquer posição
   * - Quebras de linha variadas `\r\n`, `\r`, `\n`
   * - Espaços redundantes, tabs, caracteres nulos
   * - Mensagens transientes do adaptador: "SEARCHING...", "BUS INIT...", "STOPPED"
   * - Echo de comandos enviados (ex: comando `010C` repetido no início)
   */
  static normalize(raw: string, commandEcho?: string): string[] {
    if (!raw) return []

    // 1. Remove prompt do ELM327
    let cleaned = raw.replace(/>/g, ' ')

    // 2. Se houver echo de comando especificado, remove do início ou do texto
    if (commandEcho) {
      const cleanEcho = commandEcho.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      if (cleanEcho) {
        // Remove linhas exatas que contenham o echo isolado
        const echoRegex = new RegExp(`^\\s*${cleanEcho}\\s*$`, 'gmi')
        cleaned = cleaned.replace(echoRegex, '')
      }
    }

    // 3. Normaliza quebras de linha e divide em linhas
    const lines = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false
        const upper = line.toUpperCase()
        // Filtra mensagens intermediárias conhecidas de handshake/adaptador
        if (upper.startsWith('SEARCHING')) return false
        if (upper.startsWith('BUS INIT')) return false
        if (upper.startsWith('STOPPED')) return false
        if (upper === 'OK') return false
        if (upper === '?') return true // Mantém para diagnóstico
        return true
      })

    return lines
  }

  /**
   * Detecta se o texto bruto normalizado contém respostas de erro ou status do ELM327
   */
  static detectAdapterStatus(lines: string[]): {
    hasStatus: boolean
    status?: SampleDiagnosticStatus
    reason?: string
  } {
    const combined = lines.join(' ').toUpperCase()

    if (!combined || combined.length === 0) {
      return { hasStatus: true, status: 'TIMEOUT', reason: 'RESPOSTA VAZIA OU AUSENTE' }
    }

    if (combined.includes('NO DATA')) {
      return {
        hasStatus: true,
        status: 'PID_NAO_SUPORTADO',
        reason: 'NO DATA (PID não suportado pela ECU)',
      }
    }

    if (
      combined.includes('UNABLE TO CONNECT') ||
      combined.includes('BUS INIT: ERROR') ||
      combined.includes('CAN ERROR') ||
      combined.includes('BUS BUSY') ||
      combined.includes('ERR94') ||
      combined.includes('ERR93')
    ) {
      return {
        hasStatus: true,
        status: 'SEM_COMUNICACAO',
        reason: `FALHA DE COMUNICAÇÃO: ${combined}`,
      }
    }

    if (
      combined.includes('?') ||
      combined.includes('BUFFER FULL') ||
      combined.includes('FB ERROR') ||
      combined.includes('DATA ERROR') ||
      combined.includes('RX ERROR')
    ) {
      return {
        hasStatus: true,
        status: 'RESPOSTA_INVALIDA',
        reason: `RESPOSTA INVÁLIDA DO ADAPTADOR: ${combined}`,
      }
    }

    return { hasStatus: false }
  }
}

export class OBDPipelineEngine {
  /**
   * Extrai e valida frames de uma resposta Modo 01 (ou solicitada).
   * Suporta:
   * - Compacta sem espaços: "410C0D0D", "41055C", "410D00", "410B35", "414237D6"
   * - Espaçada tradicional: "41 0C 0D 0D", "41 05 5C"
   * - CAN Headers habilitados: "7E8 04 41 0C 0D 0D", "7E8 03 41 05 5C"
   * - Respostas com echo anexado: "010C\r410C0D0D"
   * - Múltiplas ECUs respondendo:
   *     "7E8 04 41 0C 0D 0D"
   *     "7E9 04 41 0C 00 00"
   * - Hexadecimal em maiúsculas ou minúsculas
   */
  static extractFrames(
    rawText: string,
    requestedPid: string,
    requestedMode = '01',
  ): {
    adapterStatus?: { status: SampleDiagnosticStatus; reason: string }
    frames: ParsedOBDFrame[]
    normalizedLines: string[]
  } {
    const cleanReqPid = requestedPid.replace(/^0x/i, '').toUpperCase().padStart(2, '0')
    const cleanReqMode = requestedMode.replace(/^0x/i, '').toUpperCase().padStart(2, '0')
    const expectedResponseMode = (parseInt(cleanReqMode, 16) + 0x40).toString(16).toUpperCase()

    // 1. Normaliza linhas
    const normalizedLines = OBDResponseNormalizer.normalize(
      rawText,
      `${cleanReqMode}${cleanReqPid}`,
    )

    // 2. Inspeciona status do ELM327
    const statusCheck = OBDResponseNormalizer.detectAdapterStatus(normalizedLines)
    if (statusCheck.hasStatus && statusCheck.status) {
      return {
        adapterStatus: { status: statusCheck.status, reason: statusCheck.reason || '' },
        frames: [],
        normalizedLines,
      }
    }

    const foundFrames: ParsedOBDFrame[] = []

    for (const line of normalizedLines) {
      // Caso 1: Linha com tokens separados por espaço
      const tokens = line
        .replace(/[^A-Fa-f0-9]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.toUpperCase())

      let frameFoundInTokens = false

      // Procura sequência: [opcional ECU header] [opcional PCI length] <expectedResponseMode> <cleanReqPid> <data...>
      for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i] === expectedResponseMode && tokens[i + 1] === cleanReqPid) {
          // Detecta header CAN precedente se houver (ex: '7E8')
          let ecuId: string | undefined
          let pciLength: number | undefined

          if (i >= 2) {
            // tokens[i-2] pode ser o CAN ID '7E8' e tokens[i-1] o length '04'
            if (tokens[i - 2].length === 3 || tokens[i - 2].length === 8) {
              ecuId = tokens[i - 2]
              pciLength = parseInt(tokens[i - 1], 16)
            }
          } else if (i === 1) {
            if (tokens[0].length === 3 || tokens[0].length === 8) {
              ecuId = tokens[0]
            }
          }

          const rawDataTokens = tokens.slice(i + 2)
          const dataBytes = rawDataTokens.map((t) => parseInt(t, 16)).filter((n) => !isNaN(n))

          foundFrames.push({
            ecuId,
            pciLength,
            mode: cleanReqMode,
            pid: `0x${cleanReqPid}`,
            cleanPidHex: cleanReqPid,
            dataBytes,
            rawFrameText: line,
          })
          frameFoundInTokens = true
          break
        }
      }

      if (frameFoundInTokens) continue

      // Caso 2: Formato compactado contínuo sem espaços (ex: "410C0D0D", "7E804410C0D0D", "41055C")
      const compactHex = line.replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
      const targetPattern = `${expectedResponseMode}${cleanReqPid}`
      const patternIdx = compactHex.indexOf(targetPattern)

      if (patternIdx !== -1) {
        // Verifica se havia header CAN antes do targetPattern
        let ecuId: string | undefined
        let pciLength: number | undefined
        const prefix = compactHex.slice(0, patternIdx)
        if (prefix.length === 5) {
          // ex: "7E804" -> ecu '7E8', pci 4
          ecuId = prefix.slice(0, 3)
          pciLength = parseInt(prefix.slice(3), 16)
        } else if (prefix.length === 3) {
          ecuId = prefix
        }

        const dataHex = compactHex.slice(patternIdx + targetPattern.length)
        const dataBytes: number[] = []
        for (let b = 0; b < dataHex.length; b += 2) {
          const byteStr = dataHex.slice(b, b + 2)
          if (byteStr.length === 2) {
            const byteVal = parseInt(byteStr, 16)
            if (!isNaN(byteVal)) dataBytes.push(byteVal)
          }
        }

        // Se o PCI length veio no frame CAN, pode limitar os bytes de dados reais
        // Observação: PCI inclui o modo (1 byte) e o PID (1 byte), logo dataBytesCount = pciLength - 2
        let effectiveBytes = dataBytes
        if (pciLength !== undefined && pciLength >= 2) {
          const expectedDataCount = pciLength - 2
          if (expectedDataCount <= dataBytes.length) {
            effectiveBytes = dataBytes.slice(0, expectedDataCount)
          }
        }

        foundFrames.push({
          ecuId,
          pciLength,
          mode: cleanReqMode,
          pid: `0x${cleanReqPid}`,
          cleanPidHex: cleanReqPid,
          dataBytes: effectiveBytes,
          rawFrameText: line,
        })
      }
    }

    return {
      frames: foundFrames,
      normalizedLines,
    }
  }

  /**
   * Processamento completo de leitura de PID (pipeline 1 a 10)
   */
  static processPidResponse(
    rawReceived: string,
    requestedPid: string,
    requestedMode = '01',
    monoOffsetMs = 0,
  ): DecodedOBDResult {
    const timestampUtc = new Date().toISOString()
    const cleanReqPid = requestedPid.replace(/^0x/i, '').toUpperCase().padStart(2, '0')
    const cleanReqMode = requestedMode.replace(/^0x/i, '').toUpperCase().padStart(2, '0')
    const pidHexWithPrefix = `0x${cleanReqPid}`

    // 1. Extração de frames e normalização
    const extraction = this.extractFrames(rawReceived, cleanReqPid, cleanReqMode)
    const normalizedRaw = extraction.normalizedLines.join(' | ')

    // Se o adaptador retornou status conhecido (NO DATA, TIMEOUT, UNABLE TO CONNECT, etc.)
    if (extraction.adapterStatus) {
      return {
        rawReceived,
        normalizedRaw,
        frames: [],
        responderEcu: 'NONE',
        mode: cleanReqMode,
        pid: pidHexWithPrefix,
        cleanPidHex: cleanReqPid,
        dataBytes: [],
        timestampUtc,
        monoOffsetMs,
        sampleStatus: extraction.adapterStatus.status,
        errorReason: extraction.adapterStatus.reason,
        stage: 'NORMALIZATION',
      }
    }

    // Se nenhum frame com a assinatura 41 XX foi encontrado
    if (extraction.frames.length === 0) {
      return {
        rawReceived,
        normalizedRaw,
        frames: [],
        responderEcu: 'NONE',
        mode: cleanReqMode,
        pid: pidHexWithPrefix,
        cleanPidHex: cleanReqPid,
        dataBytes: [],
        timestampUtc,
        monoOffsetMs,
        sampleStatus: 'ERRO_PARSER',
        errorReason: `Nenhum frame válido para Mode ${cleanReqMode} PID ${cleanReqPid} encontrado na resposta.`,
        stage: 'FRAME_PARSER',
      }
    }

    // Prioriza frame da ECU primária (ex: 7E8 Engine/PCM) se múltiplas responderem
    const selectedFrame = extraction.frames.find((f) => f.ecuId === '7E8') || extraction.frames[0]
    const responderEcu = selectedFrame.ecuId || 'GENERIC_ECU'
    const dataBytes = selectedFrame.dataBytes

    // Decodificação universal SAE J1979
    const pidDef = PID_DEFINITIONS[pidHexWithPrefix]

    if (pidDef) {
      if (dataBytes.length < pidDef.bytesCount) {
        return {
          rawReceived,
          normalizedRaw,
          frames: extraction.frames,
          responderEcu,
          mode: cleanReqMode,
          pid: pidHexWithPrefix,
          cleanPidHex: cleanReqPid,
          dataBytes,
          timestampUtc,
          monoOffsetMs,
          sampleStatus: 'ERRO_DECODER',
          errorReason: `Bytes insuficientes para PID ${pidHexWithPrefix}: recebido ${dataBytes.length}, esperado ${pidDef.bytesCount}`,
          stage: 'DECODER_SAE',
        }
      }

      try {
        const decodedValue = pidDef.decode(dataBytes.slice(0, pidDef.bytesCount))
        const formattedValue = pidDef.format ? pidDef.format(decodedValue) : String(decodedValue)

        return {
          rawReceived,
          normalizedRaw,
          frames: extraction.frames,
          responderEcu,
          mode: cleanReqMode,
          pid: pidHexWithPrefix,
          cleanPidHex: cleanReqPid,
          dataBytes,
          decodedValue,
          formattedValue,
          unit: pidDef.unit,
          timestampUtc,
          monoOffsetMs,
          sampleStatus: 'OK',
          stage: 'DECODER_SAE',
        }
      } catch (err: any) {
        return {
          rawReceived,
          normalizedRaw,
          frames: extraction.frames,
          responderEcu,
          mode: cleanReqMode,
          pid: pidHexWithPrefix,
          cleanPidHex: cleanReqPid,
          dataBytes,
          timestampUtc,
          monoOffsetMs,
          sampleStatus: 'ERRO_DECODER',
          errorReason: `Exceção na fórmula do PID ${pidHexWithPrefix}: ${err?.message || err}`,
          stage: 'DECODER_SAE',
        }
      }
    }

    // Se não for SAE universal, consulta extensões de montadoras registradas
    for (const ext of registeredExtensions) {
      if (ext.canDecode(cleanReqMode, pidHexWithPrefix)) {
        const extResult = ext.decode(cleanReqMode, pidHexWithPrefix, dataBytes)
        if (extResult) {
          return {
            rawReceived,
            normalizedRaw,
            frames: extraction.frames,
            responderEcu,
            mode: cleanReqMode,
            pid: pidHexWithPrefix,
            cleanPidHex: cleanReqPid,
            dataBytes,
            decodedValue: extResult.value,
            formattedValue: extResult.format
              ? extResult.format(extResult.value)
              : `${extResult.value} ${extResult.unit}`,
            unit: extResult.unit,
            timestampUtc,
            monoOffsetMs,
            sampleStatus: 'OK',
            stage: 'DECODER_EXTENSION',
          }
        }
      }
    }

    // PID não catalogado
    return {
      rawReceived,
      normalizedRaw,
      frames: extraction.frames,
      responderEcu,
      mode: cleanReqMode,
      pid: pidHexWithPrefix,
      cleanPidHex: cleanReqPid,
      dataBytes,
      timestampUtc,
      monoOffsetMs,
      sampleStatus: 'ERRO_DECODER',
      errorReason: `PID ${pidHexWithPrefix} não possui definição SAE J1979 ou extensão registrada.`,
      stage: 'PID_VALIDATION',
    }
  }
}
