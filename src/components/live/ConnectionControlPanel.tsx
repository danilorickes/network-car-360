import React, { useState } from 'react'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RealSerialTransport } from '@/lib/obd/transports/real-serial-transport'
import { BluetoothTransport } from '@/lib/obd/transports/bluetooth-transport'
import { AndroidBluetoothTransport } from '@/lib/obd/transports/android-bluetooth-transport'
import { AndroidNativeTransport } from '@/lib/obd/transports/android-native-transport'
import { AndroidBluetoothDevice } from '@/types/android-bridge'
import { detectPlatformCapabilities } from '@/lib/obd/platform-detector'
import { SIMULATOR_SCENARIOS, SimulatorScenario } from '@/lib/obd/transports/simulated-transport'
import {
  Play,
  Square,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Radio,
  Bluetooth,
  Smartphone,
  Car,
  Plus,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ConnectionWizardModal } from './ConnectionWizardModal'

export const ConnectionControlPanel: React.FC = () => {
  const navigate = useNavigate()
  const [showDiscoveryWizard, setShowDiscoveryWizard] = useState(false)
  const {
    telemetry,
    vehicles,
    selectedVehicle,
    setSelectedVehicle,
    activeScenario,
    setActiveScenario,
    setTransportType,
    connectTransport,
    disconnectTransport,
    startSession,
    endSession,
    simulateCommunicationDrop,
    simulateReconnect,
    readDtcsManual,
  } = useTelemetry()

  const isWebSerialAvailable = RealSerialTransport.isWebSerialSupported()
  const isWebBluetoothAvailable = BluetoothTransport.isWebBluetoothSupported()
  const btClassicEnv = AndroidBluetoothTransport.inspectEnvironment()
  const platform = detectPlatformCapabilities()

  const isConnected = telemetry.connectionState === 'CONECTADO'
  const isTesting = telemetry.sessionState === 'TESTE ATIVO'
  const isSimulator = telemetry.transportType === 'SIMULADOR'
  const isBluetoothClassic = telemetry.transportType === 'OBD REAL BLUETOOTH CLASSIC'
  const isBluetooth = telemetry.transportType === 'OBD REAL BLUETOOTH'
  const isSerial = telemetry.transportType === 'OBD REAL'

  // Estados específicos para a Ponte Nativa Android / Bluetooth Classic
  const [pairedDevices, setPairedDevices] = useState<AndroidBluetoothDevice[]>([])
  const [selectedPairedMac, setSelectedPairedMac] = useState<string>('')
  const [nativeBtState, setNativeBtState] = useState<{
    hasBt: boolean
    isEnabled: boolean
    isLoading: boolean
  }>({
    hasBt: true,
    isEnabled: true,
    isLoading: false,
  })

  // Carrega lista de dispositivos pareados se estiver em ambiente com ponte nativa
  const loadNativePairedDevices = React.useCallback(async () => {
    if (!AndroidNativeTransport.isNativeBridgeAvailable()) return
    setNativeBtState((prev) => ({ ...prev, isLoading: true }))
    try {
      const native = new AndroidNativeTransport()
      const hasBt = await native.hasBluetooth()
      const isEnabled = await native.isBluetoothEnabled()
      setNativeBtState({ hasBt, isEnabled, isLoading: false })

      if (hasBt && isEnabled) {
        const devices = await native.getPairedDevices()
        setPairedDevices(devices)
        if (devices.length > 0 && !selectedPairedMac) {
          const lastUsed = native.getSelectedDevice()
          if (lastUsed && devices.some((d) => d.address === lastUsed.address)) {
            setSelectedPairedMac(lastUsed.address)
          } else {
            const obdMatch = devices.find((d) => /obd|elm|car/i.test(d.name))
            setSelectedPairedMac(obdMatch ? obdMatch.address : devices[0].address)
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar ponte nativa Android:', e)
      setNativeBtState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [selectedPairedMac])

  React.useEffect(() => {
    if (isBluetoothClassic && AndroidNativeTransport.isNativeBridgeAvailable()) {
      loadNativePairedDevices()
    }
  }, [isBluetoothClassic, loadNativePairedDevices])

  const handleRequestEnableBt = async () => {
    if (AndroidNativeTransport.isNativeBridgeAvailable()) {
      const native = new AndroidNativeTransport()
      await native.requestEnableBluetooth()
      toast.info('Solicitação de ativação do Bluetooth enviada ao Android.')
      setTimeout(() => loadNativePairedDevices(), 1500)
    }
  }

  return (
    <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 md:p-5 mb-6 space-y-4">
      {/* Top Row: Transport Selector and Quick State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#263340]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-[#9AA7B4] uppercase tracking-wider">
            Transporte:
          </span>
          <div className="inline-flex rounded-md p-1 bg-[#0B0F14] border border-[#263340]">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => setTransportType('SIMULADOR')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                isSimulator ? 'bg-blue-600 text-white shadow' : 'text-[#9AA7B4] hover:text-white'
              }`}
            >
              SIMULADOR
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => setTransportType('OBD REAL')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                isSerial ? 'bg-purple-600 text-white shadow' : 'text-[#9AA7B4] hover:text-white'
              }`}
            >
              USB/SERIAL (ELM327)
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => setTransportType('OBD REAL BLUETOOTH CLASSIC')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all flex items-center space-x-1 ${
                isBluetoothClassic
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-[#9AA7B4] hover:text-white'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5 mr-0.5 inline text-[#FFB300]" />
              <span>BLUETOOTH OBD (Ponte Nativa / Classic)</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => setTransportType('OBD REAL BLUETOOTH')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all flex items-center space-x-1 ${
                isBluetooth ? 'bg-cyan-600 text-white shadow' : 'text-[#9AA7B4] hover:text-white'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5 mr-0.5 inline" />
              <span>BLE (GATT)</span>
            </button>
          </div>

          {isSerial && !isWebSerialAvailable && (
            <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800 px-2 py-0.5 rounded">
              Aviso: Web Serial requer Google Chrome ou MS Edge no Desktop
            </span>
          )}

          {isBluetooth && !isWebBluetoothAvailable && (
            <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800 px-2 py-0.5 rounded">
              Aviso: Web Bluetooth requer navegador compatível (Chrome Android/Desktop)
            </span>
          )}

          {isBluetoothClassic && (
            <span className="text-xs text-amber-300 bg-amber-950/50 border border-amber-700 px-2 py-0.5 rounded">
              {AndroidNativeTransport.isNativeBridgeAvailable()
                ? 'Ponte nativa Android detectada (window.AndroidOBD).'
                : btClassicEnv.diagnosticMessage}
            </span>
          )}

          {!isSimulator && (
            <span className="text-xs text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">
              Status: <strong>IMPLEMENTADO — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL</strong>
            </span>
          )}
        </div>

        {/* Action Buttons: Connect / Start Test / End Test */}
        <div className="flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <Button
              size="sm"
              onClick={async () => {
                if (!selectedVehicle && vehicles.length === 0) {
                  toast.error(
                    'Nenhum veículo cadastrado. Cadastre o cliente e o veículo antes de iniciar a conexão OBD.',
                  )
                  navigate('/clientes')
                  return
                }

                if (isBluetoothClassic && AndroidNativeTransport.isNativeBridgeAvailable()) {
                  const targetDev = pairedDevices.find((d) => d.address === selectedPairedMac)
                  await connectTransport(selectedPairedMac || undefined, targetDev?.name)
                } else {
                  await connectTransport()
                }
              }}
              className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-semibold shadow"
            >
              <Wifi className="w-4 h-4 mr-1.5" />
              {isSimulator ? 'INICIAR SIMULADOR' : 'CONECTAR VEÍCULO'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isTesting}
              onClick={() => disconnectTransport()}
              className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]"
            >
              <WifiOff className="w-4 h-4 mr-1.5" />
              DESCONECTAR
            </Button>
          )}

          {isConnected && !isTesting && (
            <Button
              size="sm"
              onClick={() => {
                if (!selectedVehicle && vehicles.length === 0) {
                  toast.error(
                    'Veículo Obrigatório: cadastre ou selecione um veículo com seu respectivo cliente.',
                  )
                  navigate('/clientes')
                  return
                }
                startSession(selectedVehicle?.id)
              }}
              className="bg-[#2ECC71] hover:bg-[#27ae60] text-black font-bold tracking-wide shadow"
            >
              <Play className="w-4 h-4 mr-1.5 fill-current" />
              INICIAR TESTE
            </Button>
          )}
          {isTesting && (
            <Button
              size="sm"
              onClick={() => endSession()}
              className="bg-[#E53935] hover:bg-[#c62828] text-white font-bold tracking-wide shadow"
            >
              <Square className="w-4 h-4 mr-1.5 fill-current" />
              ENCERRAR TESTE
            </Button>
          )}
        </div>
      </div>

      {/* Painel Específico Bluetooth Classic / Ponte Nativa Android (E6.6.1) */}
      {isBluetoothClassic && AndroidNativeTransport.isNativeBridgeAvailable() && (
        <div className="bg-[#0B0F14] border border-[#263340] rounded-lg p-3 text-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C2633] pb-2">
            <div className="flex items-center space-x-2">
              <Bluetooth className="w-4 h-4 text-[#FFB300]" />
              <span className="font-bold text-white uppercase tracking-wider">
                Controle Nativo Bluetooth OBD (Android)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                  nativeBtState.isEnabled
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-red-950 text-red-300 border border-red-800'
                }`}
              >
                {nativeBtState.isEnabled ? 'BLUETOOTH LIGADO' : 'BLUETOOTH DESLIGADO'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadNativePairedDevices}
                className="h-6 px-2 text-[10px] text-gray-400 hover:text-white"
              >
                <RefreshCw
                  className={`w-3 h-3 mr-1 ${nativeBtState.isLoading ? 'animate-spin' : ''}`}
                />
                Atualizar Pareados
              </Button>
            </div>
          </div>

          {!nativeBtState.isEnabled ? (
            <div className="p-3 bg-red-950/40 border border-red-800/80 rounded flex items-center justify-between">
              <div className="flex items-center space-x-2 text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <span>O rádio Bluetooth do aparelho está desligado.</span>
              </div>
              <Button
                size="sm"
                onClick={handleRequestEnableBt}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs h-7"
              >
                Ligar Bluetooth
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-[11px] font-medium text-[#9AA7B4] mb-1">
                  Dispositivo Pareado Selecionado:
                </label>
                {pairedDevices.length === 0 ? (
                  <div className="text-gray-400 italic text-[11px] bg-[#121A24] p-2 rounded border border-[#202B37]">
                    Nenhum dispositivo Bluetooth pareado no Android. Pareie o adaptador ELM327
                    (&quot;OBDII&quot;) nas configurações do sistema.
                  </div>
                ) : (
                  <Select
                    value={selectedPairedMac}
                    onValueChange={(val) => setSelectedPairedMac(val)}
                    disabled={isConnected || isTesting}
                  >
                    <SelectTrigger className="bg-[#121A24] border-[#263340] text-xs text-white">
                      <SelectValue placeholder="Selecione o adaptador pareado..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131A22] border-[#263340] text-white">
                      {pairedDevices.map((d) => (
                        <SelectItem key={d.address} value={d.address}>
                          {d.name} ({d.address})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="text-[11px] text-gray-300 bg-[#121A24] p-2.5 rounded border border-[#202B37] space-y-1">
                <div className="font-bold text-[#FFB300] flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fluxo Nativo RFCOMM SPP</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Conexão direta pelo Android via UUID SPP 00001101-0000-1000-8000-00805f9b34fb sem
                  dependência das flags ou seletor do navegador Chrome.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Second Row: Seleção do Veículo & Cenário do Simulador */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Perfil do Veículo (Requisito 1 da OS-ME001-E2) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-[#9AA7B4] flex items-center space-x-1">
              <Car className="w-3.5 h-3.5 text-[#FFB300]" />
              <span>Veículo em Teste (Perfil Reutilizável):</span>
            </label>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => navigate('/veiculos')}
              className="text-[11px] text-[#FFB300] hover:underline flex items-center"
            >
              <Plus className="w-3 h-3 mr-0.5" /> Gerenciar
            </button>
          </div>

          <Select
            value={selectedVehicle?.id || ''}
            onValueChange={(val) => {
              const v = vehicles.find((item) => item.id === val)
              if (v) setSelectedVehicle(v)
            }}
            disabled={isTesting}
          >
            <SelectTrigger className="bg-[#0B0F14] border-[#263340] text-sm text-white">
              <SelectValue placeholder="Selecione o veículo..." />
            </SelectTrigger>
            <SelectContent className="bg-[#131A22] border-[#263340] text-white">
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id!}>
                  {v.plate} — {v.make} {v.model} ({v.engine || 'OBD-II'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVehicle ? (
            <div className="text-[11px] text-[#9AA7B4] mt-1 font-mono truncate">
              VIN: {selectedVehicle.vin || 'N/D'} • Km:{' '}
              {selectedVehicle.odometer_km?.toLocaleString('pt-BR') || '--'}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="mt-1.5 p-2 bg-[#1A232E] border border-amber-800/60 rounded text-[11px] text-amber-300 flex items-center justify-between">
              <span>Nenhum cliente/veículo registrado ainda.</span>
              <button
                type="button"
                onClick={() => navigate('/clientes')}
                className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-bold px-2 py-0.5 rounded text-[10px]"
              >
                Cadastrar Cliente & Veículo
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500 mt-1 italic">
              Selecione o veículo acima para vincular os dados OBD à ordem e histórico técnico.
            </div>
          )}
        </div>

        {/* Cenário do Simulador (Requisito 8: Múltiplos Cenários Reproduzíveis) */}
        {isSimulator && (
          <div>
            <label className="block text-xs font-medium text-[#9AA7B4] mb-1">
              Cenário Reproduzível (Simulador):
            </label>
            <Select
              value={activeScenario}
              onValueChange={(val: any) => setActiveScenario(val)}
              disabled={isTesting}
            >
              <SelectTrigger className="bg-[#0B0F14] border-[#263340] text-sm text-white">
                <SelectValue placeholder="Selecione o cenário" />
              </SelectTrigger>
              <SelectContent className="bg-[#131A22] border-[#263340] text-white">
                {SIMULATOR_SCENARIOS.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[11px] text-gray-400 mt-1 truncate">
              {SIMULATOR_SCENARIOS.find((s) => s.id === activeScenario)?.description}
            </div>
          </div>
        )}

        {/* Ferramentas de Teste e Validação */}
        <div className="flex flex-col justify-end">
          <label className="block text-xs font-medium text-[#9AA7B4] mb-1">
            Testes de Resiliência & Diagnóstico:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDiscoveryWizard(true)}
              className="border-[#FFB300]/50 text-[#FFB300] hover:bg-[#FFB300]/10 text-xs"
              title="Assistente passo a passo de descoberta de adaptador, protocolo e PIDs"
            >
              <Radio className="w-3.5 h-3.5 mr-1" />
              Assistente OBD
            </Button>

            {isSimulator && isConnected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateCommunicationDrop}
                  className="border-amber-800 text-amber-400 hover:bg-amber-950/40 text-xs"
                  title="Simula perda de sinal de comunicação"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  Perda Sinal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateReconnect}
                  className="border-emerald-800 text-[#2ECC71] hover:bg-emerald-950/40 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Reconectar
                </Button>
              </>
            )}

            {isConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={readDtcsManual}
                className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
              >
                Ler DTCs Agora
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Assinatura / Capacidade OBD do Veículo (Requisito 2) */}
      {telemetry.activeObdCapability && (
        <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340] text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="bg-[#1A232E] text-[#FFB300] font-mono px-2 py-0.5 rounded border border-[#263340] font-bold">
              ASSINATURA OBD REGISTRADA
            </span>
            <span className="text-gray-300">
              Protocolo: <strong>{telemetry.activeObdCapability.protocol_detected}</strong> | VIN:{' '}
              <strong className="font-mono">
                {telemetry.activeObdCapability.vin_read || 'N/D'}
              </strong>{' '}
              | MIL:{' '}
              <strong
                className={
                  telemetry.activeObdCapability.mil_initial_state
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {telemetry.activeObdCapability.mil_initial_state ? 'ACESO' : 'APAGADO'}
              </strong>
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#9AA7B4]">
            <span>PIDs Disponíveis: {telemetry.activeObdCapability.pids_supported.length}</span>
            <span>•</span>
            <span>Indisponíveis: {telemetry.activeObdCapability.pids_unavailable.length}</span>
          </div>
        </div>
      )}

      {/* PIDs Descobertos */}
      {telemetry.discoveredPids.length > 0 && (
        <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340] text-xs flex flex-wrap items-center gap-1.5">
          <span className="text-[#9AA7B4] font-medium mr-2">
            PIDs Descobertos ({telemetry.discoveredPids.length}):
          </span>
          {telemetry.discoveredPids.map((pid) => (
            <span
              key={pid}
              className="bg-[#1A232E] text-[#FFB300] px-1.5 py-0.5 rounded font-mono border border-[#263340]"
            >
              {pid}
            </span>
          ))}
        </div>
      )}

      {/* Orientação da Plataforma */}
      {(isBluetooth || isSerial || platform.isAndroid) && (
        <div className="bg-[#0B0F14] border border-[#263340] rounded p-2.5 text-xs text-[#9AA7B4] flex items-start space-x-2">
          {platform.isAndroid ? (
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          ) : (
            <Radio className="w-4 h-4 text-[#FFB300] shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-semibold text-white">
              {platform.isAndroid
                ? 'Ambiente Android / Multimídia:'
                : 'Estratégia de Conexão Física:'}
            </span>
            <p className="text-gray-400">{platform.guidanceText}</p>
          </div>
        </div>
      )}

      {/* Falha de Comunicação */}
      {telemetry.connectionState === 'FALHA' && telemetry.lastError && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 px-3 py-2 rounded text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            <strong>SEM COMUNICAÇÃO:</strong> {telemetry.lastError} (O sistema mantém buffers e
            dados gravados intactos).
          </span>
        </div>
      )}

      {/* Modal do Assistente de Descoberta OBD */}
      <ConnectionWizardModal
        open={showDiscoveryWizard}
        onClose={() => setShowDiscoveryWizard(false)}
        onConnectionSuccess={(res) => {
          setShowDiscoveryWizard(false)
        }}
      />
    </div>
  )
}
