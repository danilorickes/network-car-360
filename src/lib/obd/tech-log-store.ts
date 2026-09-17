export interface TechLogEntry {
  id: string
  timestamp: string // ISO ou HH:mm:ss.SSS
  direction: 'TX' | 'RX' | 'INFO' | 'ERR'
  command?: string
  response?: string
  rawResponse?: string // Resposta serial bruta sem sanitização (com \r, \n, >, etc)
  latencyMs?: number
  stage?: string
  details?: string
  protocol?: string // Protocolo OBD detectado ou em negociação
  errorReason?: string // Motivo de falha / parse error (ex: 'FORMATO NÃO RECONHECIDO', 'NO DATA', timeout)
  transport?: 'ANDROID_BRIDGE' | 'WEB_SERIAL' | 'WEB_BLUETOOTH' | 'SIMULATOR' | 'OTHER'
}

type TechLogListener = (entries: TechLogEntry[]) => void

class TechLogStore {
  private entries: TechLogEntry[] = []
  private maxEntries = 1000
  private listeners: Set<TechLogListener> = new Set()

  getEntries(): TechLogEntry[] {
    return [...this.entries]
  }

  /**
   * Exporta os logs em formato textual cronológico estruturado
   */
  exportAsText(): string {
    const sorted = [...this.entries].reverse() // Cronológico do mais antigo para o mais recente
    return sorted
      .map((entry) => {
        const parts: string[] = [`[${entry.timestamp}]`, `[${entry.direction}]`]
        if (entry.transport) parts.push(`[${entry.transport}]`)
        if (entry.stage) parts.push(`[${entry.stage}]`)

        if (entry.direction === 'TX') {
          parts.push(`TX -> "${entry.command || ''}"`)
        } else if (entry.direction === 'RX') {
          const lat = entry.latencyMs !== undefined ? ` (${entry.latencyMs}ms)` : ''
          const raw =
            entry.rawResponse !== undefined ? ` [RAW: ${JSON.stringify(entry.rawResponse)}]` : ''
          parts.push(`RX <- "${entry.response || ''}"${lat}${raw}`)
        } else if (entry.direction === 'ERR') {
          const lat = entry.latencyMs !== undefined ? ` (${entry.latencyMs}ms)` : ''
          const cmd = entry.command ? ` [cmd: ${entry.command}]` : ''
          parts.push(`ERR${cmd}: ${entry.details || entry.errorReason || 'Erro'}${lat}`)
        } else {
          parts.push(`INFO: ${entry.details || ''}`)
        }

        if (entry.protocol) parts.push(`[PROTO: ${entry.protocol}]`)
        if (entry.errorReason && entry.direction !== 'ERR')
          parts.push(`[REASON: ${entry.errorReason}]`)

        return parts.join(' ')
      })
      .join('\n')
  }

  addEntry(entry: Omit<TechLogEntry, 'id' | 'timestamp'> & { timestamp?: string }): TechLogEntry {
    const fullEntry: TechLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp:
        entry.timestamp ||
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        } as any),
      ...entry,
    }

    this.entries.unshift(fullEntry)
    if (this.entries.length > this.maxEntries) {
      this.entries.pop()
    }

    this.notify()
    return fullEntry
  }

  clear() {
    this.entries = []
    this.notify()
  }

  subscribe(listener: TechLogListener): () => void {
    this.listeners.add(listener)
    listener(this.getEntries())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const copy = this.getEntries()
    this.listeners.forEach((l) => {
      try {
        l(copy)
      } catch (e) {
        console.error('Erro em listener do TechLogStore:', e)
      }
    })
  }
}

export const techLogStore = new TechLogStore()
