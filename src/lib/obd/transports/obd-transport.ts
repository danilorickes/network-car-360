export interface OBDTransportEvents {
  statusChange: (
    status: 'DESCONECTADO' | 'CONECTANDO' | 'CONECTADO' | 'RECONECTANDO' | 'FALHA',
    message?: string,
  ) => void
  data: (line: string) => void
  error: (err: Error) => void
}

export interface OBDTransport {
  readonly name: string
  connect(): Promise<boolean>
  disconnect(): Promise<void>
  send(cmd: string, timeoutMs?: number): Promise<string>
  isConnected(): boolean
  on<K extends keyof OBDTransportEvents>(event: K, listener: OBDTransportEvents[K]): void
  off<K extends keyof OBDTransportEvents>(event: K, listener: OBDTransportEvents[K]): void
}
