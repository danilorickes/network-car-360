import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AndroidNativeTransport } from '../transports/android-native-transport'
import { AndroidBluetoothTransport } from '../transports/android-bluetooth-transport'
import { AndroidOBDBridge } from '@/types/android-bridge'
import { techLogStore } from '../tech-log-store'

describe('E6.6.1 — Ponte Nativa Android / ELM327 Bluetooth Classic', () => {
  let mockBridge: AndroidOBDBridge
  const globalTarget = typeof window !== 'undefined' ? window : (globalThis as any)

  beforeEach(() => {
    techLogStore.clear()
    localStorage.clear()

    mockBridge = {
      hasBluetooth: vi.fn().mockResolvedValue(true),
      isBluetoothEnabled: vi.fn().mockResolvedValue(true),
      requestEnableBluetooth: vi.fn().mockResolvedValue(true),
      requestPermissions: vi.fn().mockResolvedValue(true),
      getPairedDevices: vi.fn().mockResolvedValue([
        { name: 'OBDII', address: '00:1D:A5:01:23:45', bondState: 12, type: 1 },
        { name: 'Mi True Wireless', address: 'AA:BB:CC:DD:EE:FF', bondState: 12, type: 1 },
      ]),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      send: vi.fn().mockImplementation(async (cmd: string) => {
        const c = cmd.trim()
        if (c === 'ATZ') return 'ELM327 v1.5\r\r>'
        if (c === 'ATE0') return 'OK\r\r>'
        if (c === 'ATL0') return 'OK\r\r>'
        if (c === 'ATH0') return 'OK\r\r>'
        if (c === 'ATS0') return 'OK\r\r>'
        if (c === 'ATSP0') return 'OK\r\r>'
        if (c === '0100') return '41 00 BE 3F B8 11\r\r>'
        if (c === '010C') return '41 0C 1F 40\r\r>' // 2000 RPM
        if (c === '010D') return '41 0D 50\r\r>' // 80 km/h
        if (c === '0105') return '41 05 7D\r\r>' // 85 °C
        if (c === 'ATDP') return 'ISO 15765-4 (CAN 11/500)\r\r>'
        return 'OK\r\r>'
      }),
      getConnectionState: vi.fn().mockResolvedValue({
        connected: true,
        state: 'SOCKET_CONNECTED',
        deviceAddress: '00:1D:A5:01:23:45',
        deviceName: 'OBDII',
        protocol: 'ISO 15765-4 (CAN 11/500)',
      }),
      getConnectedDevice: vi.fn().mockResolvedValue({
        name: 'OBDII',
        address: '00:1D:A5:01:23:45',
      }),
    }

    // Injeta mockBridge em window.AndroidOBD
    globalTarget.AndroidOBD = mockBridge
  })

  afterEach(() => {
    delete globalTarget.AndroidOBD
    delete globalTarget.__IS_ANDROID_NATIVE_CONTAINER
  })

  describe('1. Detecção da Bridge e Inspeção de Ambiente', () => {
    it('Detecta disponibilidade da ponte quando window.AndroidOBD existe', () => {
      expect(AndroidNativeTransport.isNativeBridgeAvailable()).toBe(true)
      const env = AndroidBluetoothTransport.inspectEnvironment()
      expect(env.hasNativeBridge).toBe(true)
      expect(env.diagnosticMessage).toContain('Ponte nativa Android detectada')
    })

    it('Detecta ausência da ponte quando window.AndroidOBD não existe', () => {
      delete globalTarget.AndroidOBD
      expect(AndroidNativeTransport.isNativeBridgeAvailable()).toBe(false)
      const env = AndroidBluetoothTransport.inspectEnvironment()
      expect(env.hasNativeBridge).toBe(false)
    })
  })

  describe('2. Métodos de Hardware e Bluetooth Nativo', () => {
    it('Consulta se o dispositivo possui hardware Bluetooth', async () => {
      const transport = new AndroidNativeTransport()
      const hasBt = await transport.hasBluetooth()
      expect(hasBt).toBe(true)
      expect(mockBridge.hasBluetooth).toHaveBeenCalled()
    })

    it('Detecta Bluetooth desligado e emite erro explicativo sem quebrar a app', async () => {
      ;(mockBridge.isBluetoothEnabled as any).mockResolvedValue(false)
      const transport = new AndroidNativeTransport()
      const isEnabled = await transport.isBluetoothEnabled()
      expect(isEnabled).toBe(false)

      await expect(transport.connect('00:1D:A5:01:23:45')).rejects.toThrow(/Bluetooth desligado/i)
      expect(mockBridge.requestEnableBluetooth).toHaveBeenCalled()
    })

    it('Lista dispositivos pareados sem fixar OBDII obrigatoriamente', async () => {
      const transport = new AndroidNativeTransport()
      const paired = await transport.getPairedDevices()
      expect(paired).toHaveLength(2)
      expect(paired[0].name).toBe('OBDII')
      expect(paired[0].address).toBe('00:1D:A5:01:23:45')
      expect(paired[1].name).toBe('Mi True Wireless')
    })
  })

  describe('3. Conexão RFCOMM, Handshake ELM327 e Confirmação de ECU', () => {
    it('Executa fluxo completo até VEICULO_CONECTADO via AndroidBluetoothTransport', async () => {
      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      const ok = await transport.connect()

      expect(ok).toBe(true)
      expect(transport.isConnected()).toBe(true)
      expect(transport.getActiveMode()).toBe('NATIVE_BRIDGE')
      expect(transport.getDetailedStatus()).toBe('VEICULO_CONECTADO')
      expect(transport.getProtocol()).toBe('ISO 15765-4 (CAN 11/500)')

      // Verifica chamadas sequenciais obrigatórias
      expect(mockBridge.connect).toHaveBeenCalledWith('00:1D:A5:01:23:45')
      expect(mockBridge.send).toHaveBeenCalledWith('ATZ', expect.any(Number))
      expect(mockBridge.send).toHaveBeenCalledWith('ATE0', expect.any(Number))
      expect(mockBridge.send).toHaveBeenCalledWith('0100', expect.any(Number))
    })

    it('Recusa conexão se ECU NÃO responder ao comando 0100 (nunca declarar conectado)', async () => {
      ;(mockBridge.send as any).mockImplementation(async (cmd: string) => {
        if (cmd === 'ATZ') return 'ELM327 v1.5\r\r>'
        if (cmd === 'ATE0') return 'OK\r\r>'
        if (cmd === '0100') return 'UNABLE TO CONNECT\r\r>'
        return 'OK\r\r>'
      })

      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      await expect(transport.connect()).rejects.toThrow(/ECU NÃO RESPONDEU/i)

      expect(transport.isConnected()).toBe(false)
      expect(transport.getDetailedStatus()).toBe('ECU_NAO_RESPONDEU')
    })

    it('Faz leitura dos 3 PIDs essenciais de homologação: RPM (010C), Speed (010D) e Temp (0105)', async () => {
      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      await transport.connect()

      const rpmResp = await transport.send('010C')
      expect(rpmResp).toContain('41 0C 1F 40')

      const speedResp = await transport.send('010D')
      expect(speedResp).toContain('41 0D 50')

      const tempResp = await transport.send('0105')
      expect(tempResp).toContain('41 05 7D')
    })
  })

  describe('4. Log Técnico e Persistência de Preferência de Reconexão', () => {
    it('Registra eventos no TechLogStore com direção TX/RX/INFO/ERR e rawResponse não-sanitizado', async () => {
      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      await transport.connect()
      await transport.send('010C')

      const entries = techLogStore.getEntries()
      expect(entries.length).toBeGreaterThan(5)
      expect(entries.some((e) => e.direction === 'TX' && e.command === 'ATZ')).toBe(true)
      expect(entries.some((e) => e.direction === 'RX')).toBe(true)
      expect(entries.some((e) => e.direction === 'INFO')).toBe(true)

      // Verifica presença de rawResponse e exportAsText
      const rxEntry = entries.find((e) => e.direction === 'RX' && e.command === '010C')
      expect(rxEntry).toBeDefined()
      expect(rxEntry?.rawResponse).toContain('41 0C 1F 40')

      const exportedText = techLogStore.exportAsText()
      expect(exportedText).toContain('TX -> "ATZ"')
      expect(exportedText).toContain('TX -> "010C"')
      expect(exportedText).toContain('RX <- "41 0C 1F 40"')
    })

    it('Captura e registra exceção da bridge nativa em TechLogStore sem mascarar', async () => {
      ;(mockBridge.send as any).mockRejectedValueOnce(
        new Error('Bluetooth socket closed by remote peer'),
      )
      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      await transport.connect()

      await expect(transport.send('010C')).rejects.toThrow(/Bluetooth socket closed/i)

      const entries = techLogStore.getEntries()
      const errEntry = entries.find((e) => e.direction === 'ERR' && e.command === '010C')
      expect(errEntry).toBeDefined()
      expect(errEntry?.details).toContain('Bluetooth socket closed by remote peer')
      expect(errEntry?.errorReason).toContain('Bluetooth socket closed by remote peer')
    })

    it('Memoriza o último dispositivo pareado no localStorage para reconexão sem repetição', async () => {
      const transport = new AndroidNativeTransport()
      transport.setSelectedDevice({
        name: 'OBDII_ECOSPORT',
        address: '11:22:33:44:55:66',
      })

      // Nova instância deve recuperar automaticamente
      const newTransport = new AndroidNativeTransport()
      const restored = newTransport.getSelectedDevice()
      expect(restored).toBeDefined()
      expect(restored?.name).toBe('OBDII_ECOSPORT')
      expect(restored?.address).toBe('11:22:33:44:55:66')
    })

    it('Resiliência: bridge ausente ou com erro nativo não quebra a aplicação nem lança exceção em topo de módulo', () => {
      // Garante que mesmo sem bridge, instanciar e checar disponibilidade é 100% tolerante
      delete globalTarget.AndroidOBD
      expect(AndroidNativeTransport.getBridge()).toBeNull()
      expect(AndroidNativeTransport.isNativeBridgeAvailable()).toBe(false)
      const transport = new AndroidNativeTransport()
      expect(transport.isConnected()).toBe(false)
    })

    it('Desconecta com segurança encerrando streams e ponte nativa', async () => {
      const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
      await transport.connect()
      expect(transport.isConnected()).toBe(true)

      await transport.disconnect()
      expect(transport.isConnected()).toBe(false)
      expect(mockBridge.disconnect).toHaveBeenCalled()
    })
  })
})
