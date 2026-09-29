import { OBDTransport } from './transports/obd-transport'
import { ElmProtocolParser, DtcReadStatus } from './elm-parser'
import { DtcModel } from '../types/obd'
import pb from '../pocketbase/client'

export interface DtcServiceResult {
  status: DtcReadStatus
  dtcs: DtcModel[]
  milOn: boolean
  errorMessage?: string
}

/**
 * DtcService: Leitura de DTCs (Modo 03 Ativos e Modo 07 Pendentes).
 * Regra inegociável da OS: NUNCA implementar limpeza de DTCs (Modo 04) ou comandos destrutivos.
 */
export class DtcService {
  private transport: OBDTransport
  private dbSessionRecordId: string | null = null
  private sessionUniqueId: string
  private currentDtcs: DtcModel[] = []
  private milOn = false

  constructor(transport: OBDTransport, sessionUniqueId: string, dbSessionRecordId?: string) {
    this.transport = transport
    this.sessionUniqueId = sessionUniqueId
    this.dbSessionRecordId = dbSessionRecordId || null
  }

  setDbSessionId(id: string): void {
    this.dbSessionRecordId = id
  }

  getDtcs(): DtcModel[] {
    return [...this.currentDtcs]
  }

  isMilOn(): boolean {
    return this.milOn
  }

  async readDtcs(): Promise<DtcServiceResult> {
    if (!this.transport.isConnected()) {
      return {
        status: 'FALHA_DE_LEITURA',
        dtcs: this.currentDtcs,
        milOn: this.milOn,
        errorMessage: 'Adaptador OBD desconectado.',
      }
    }

    try {
      // 1. Ler status MIL e quantidade de DTCs via PID 01 01
      // 41 01 XX YY ZZ WW -> Bit 7 de XX indica se a lâmpada MIL está acesa
      try {
        const milRaw = await this.transport.send('0101', 2000)
        const parsedMil = ElmProtocolParser.parseMode01(milRaw, '01')
        if (!parsedMil.isError && parsedMil.bytes.length > 0) {
          this.milOn = (parsedMil.bytes[0] & 0x80) !== 0
        }
      } catch {
        // Falha no PID 0101 não impede leitura dos Modos 03/07
      }

      const foundList: DtcModel[] = []
      const readAt = new Date().toISOString()
      let mode03Failed = false
      let mode07Failed = false
      let commErrorMessage: string | undefined

      // 2. Ler DTCs confirmados/ativos (Modo 03)
      try {
        const mode03Raw = await this.transport.send('03', 2500)
        const parsed03 = ElmProtocolParser.parseDtcResponse(mode03Raw, '03')
        if (parsed03.isError) {
          mode03Failed = true
          commErrorMessage = parsed03.errorMessage || 'Falha ao consultar Modo 03 (DTCs ativos)'
        } else {
          for (const code of parsed03.codes) {
            foundList.push({
              dtc_code: code,
              status: 'ATIVO',
              mil_on: this.milOn,
              read_at_utc: readAt,
              session: this.dbSessionRecordId || undefined,
              session_id: this.sessionUniqueId,
            })
          }
        }
      } catch (err: any) {
        mode03Failed = true
        commErrorMessage = err?.message || 'Timeout/Erro no envio do comando Modo 03'
      }

      // 3. Ler DTCs pendentes (Modo 07)
      try {
        const mode07Raw = await this.transport.send('07', 2500)
        const parsed07 = ElmProtocolParser.parseDtcResponse(mode07Raw, '07')
        if (parsed07.isError) {
          mode07Failed = true
          if (!commErrorMessage) {
            commErrorMessage =
              parsed07.errorMessage || 'Falha ao consultar Modo 07 (DTCs pendentes)'
          }
        } else {
          for (const code of parsed07.codes) {
            if (!foundList.some((d) => d.dtc_code === code)) {
              foundList.push({
                dtc_code: code,
                status: 'PENDENTE',
                mil_on: this.milOn,
                read_at_utc: readAt,
                session: this.dbSessionRecordId || undefined,
                session_id: this.sessionUniqueId,
              })
            }
          }
        }
      } catch (err: any) {
        mode07Failed = true
        if (!commErrorMessage) {
          commErrorMessage = err?.message || 'Timeout/Erro no envio do comando Modo 07'
        }
      }

      // Se ambos os modos falharam e nenhum DTC foi obtido, caracteriza FALHA_DE_LEITURA
      if (mode03Failed && mode07Failed && foundList.length === 0) {
        return {
          status: 'FALHA_DE_LEITURA',
          dtcs: this.currentDtcs,
          milOn: this.milOn,
          errorMessage: commErrorMessage || 'Falha de comunicação com o barramento OBD da ECU',
        }
      }

      // Se encontrou DTC ativo e MIL não tinha sido detectada, considera MIL ativada
      if (foundList.some((d) => d.status === 'ATIVO')) {
        this.milOn = true
      }

      this.currentDtcs = foundList

      // Persiste oportunisticamente no PocketBase quando houver códigos confirmados
      if (this.dbSessionRecordId && foundList.length > 0) {
        for (const item of foundList) {
          if (!item.id) {
            try {
              const rec = await pb.collection('dtcs').create({
                session: this.dbSessionRecordId,
                dtc_code: item.dtc_code,
                status: item.status,
                mil_on: item.mil_on,
                read_at_utc: item.read_at_utc,
              })
              item.id = rec.id
            } catch {
              // Silencioso em fallback local
            }
          }
        }
      }

      const finalStatus: DtcReadStatus = foundList.length > 0 ? 'COM_CODIGOS' : 'SEM_CODIGOS'

      return {
        status: finalStatus,
        dtcs: this.currentDtcs,
        milOn: this.milOn,
      }
    } catch (err: any) {
      return {
        status: 'FALHA_DE_LEITURA',
        dtcs: this.currentDtcs,
        milOn: this.milOn,
        errorMessage: err?.message || 'Erro inesperado durante leitura de DTCs',
      }
    }
  }
}
