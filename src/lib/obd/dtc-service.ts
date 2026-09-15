import { OBDTransport } from './transports/obd-transport'
import { ElmProtocolParser } from './elm-parser'
import { DtcModel, DtcStatus } from '../types/obd'
import pb from '../pocketbase/client'

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

  async readDtcs(): Promise<{ dtcs: DtcModel[]; milOn: boolean }> {
    if (!this.transport.isConnected()) {
      return { dtcs: this.currentDtcs, milOn: this.milOn }
    }

    try {
      // 1. Ler status MIL e quantidade de DTCs via PID 01 01
      // 41 01 XX YY ZZ WW -> Bit 7 de XX indica se a lâmpada MIL está acesa
      const milRaw = await this.transport.send('0101', 2000).catch(() => '')
      const parsedMil = ElmProtocolParser.parseMode01(milRaw, '01')
      if (!parsedMil.isError && parsedMil.bytes.length > 0) {
        this.milOn = (parsedMil.bytes[0] & 0x80) !== 0
      }

      const foundList: DtcModel[] = []
      const readAt = new Date().toISOString()

      // 2. Ler DTCs confirmados/ativos (Modo 03)
      const mode03Raw = await this.transport.send('03', 2500).catch(() => '')
      const parsed03 = ElmProtocolParser.parseDtcResponse(mode03Raw, '03')
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

      // 3. Ler DTCs pendentes (Modo 07)
      const mode07Raw = await this.transport.send('07', 2500).catch(() => '')
      const parsed07 = ElmProtocolParser.parseDtcResponse(mode07Raw, '07')
      for (const code of parsed07.codes) {
        // Evita duplicar se já estiver em ativos
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

      // Se encontrou DTC ativo e MIL não tinha sido detectada, considera MIL ativada
      if (foundList.some((d) => d.status === 'ATIVO')) {
        this.milOn = true
      }

      this.currentDtcs = foundList

      // Persiste oportunisticamente no PocketBase
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

      return { dtcs: this.currentDtcs, milOn: this.milOn }
    } catch {
      return { dtcs: this.currentDtcs, milOn: this.milOn }
    }
  }
}
