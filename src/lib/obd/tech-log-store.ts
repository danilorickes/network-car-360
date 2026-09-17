export interface TechLogEntry {
  id: string
  timestamp: string // ISO ou HH:mm:ss.SSS
  direction: 'TX' | 'RX' | 'INFO' | 'ERR'
  command?: string
  response?: string
  latencyMs?: number
  stage?: string
  details?: string
}

type TechLogListener = (entries: TechLogEntry[]) => void

class TechLogStore {
  private entries: TechLogEntry[] = []
  private maxEntries = 500
  private listeners: Set<TechLogListener> = new Set()

  getEntries(): TechLogEntry[] {
    return [...this.entries]
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
