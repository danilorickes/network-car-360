import React, { useState } from 'react'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RealSerialTransport } from '@/lib/obd/transports/real-serial-transport'
import { BluetoothTransport } from '@/lib/obd/transports/bluetooth-transport'
import { detectPlatformCapabilities } from '@/lib/obd/platform-detector'
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
} from 'lucide-react'

export const ConnectionControlPanel: React.FC = () => {
  const {
    telemetry,
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

  const [vehicleNameInput, setVehicleNameInput] = useState('Ford EcoSport 2020 1.5 Dragon 3C')
  const isWebSerialAvailable = RealSerialTransport.isWebSerialSupported()
  const isWebBluetoothAvailable = BluetoothTransport.isWebBluetoothSupported()
  const platform = detectPlatformCapabilities()

  const isConnected = telemetry.connectionState === 'CONECTADO'
  const isTesting = telemetry.sessionState === 'TESTE ATIVO'
  const isSimulator = telemetry.transportType === 'SIMULADOR'
  const isBluetooth = telemetry.transportType === 'OBD REAL BLUETOOTH'
  const isSerial = telemetry.transportType === 'OBD REAL'

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
              onClick={() => setTransportType('OBD REAL BLUETOOTH')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all flex items-center space-x-1 ${
                isBluetooth ? 'bg-cyan-600 text-white shadow' : 'text-[#9AA7B4] hover:text-white'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5 mr-0.5 inline" />
              <span>BLUETOOTH (BLE/Android)</span>
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

          {!isSimulator && (
            <span className="text-xs text-[#9AA7B4] bg-[#1A232E] px-2 py-0.5 rounded border border-[#263340]">
              Status: <strong>IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL</strong>
            </span>
          )}
        </div>

        {/* Action Buttons: Connect / Start Test / End Test */}
        <div className="flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <Button
              size="sm"
              onClick={() => connectTransport()}
              className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-semibold shadow"
            >
              <Wifi className="w-4 h-4 mr-1.5" />
              {isSimulator ? 'INICIAR SIMULADOR' : 'CONECTAR ADAPTADOR'}
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
              onClick={() => startSession(vehicleNameInput)}
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

      {/* Second Row: Configuration parameters for the active test */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Veículo de Validação */}
        <div>
          <label className="block text-xs font-medium text-[#9AA7B4] mb-1">
            Veículo (Metadado de Validação):
          </label>
          <Input
            value={vehicleNameInput}
            onChange={(e) => setVehicleNameInput(e.target.value)}
            disabled={isTesting}
            placeholder="Ex: Ford EcoSport 2020 1.5 Dragon"
            className="bg-[#0B0F14] border-[#263340] text-sm text-white"
          />
        </div>

        {/* Cenário do Simulador (quando ativo) */}
        {isSimulator && (
          <div>
            <label className="block text-xs font-medium text-[#9AA7B4] mb-1">
              Cenário de Condução Simulado:
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
                <SelectItem value="NORMAL">Cenário Normal (Ciclo Completo)</SelectItem>
                <SelectItem value="ANOMALIA">
                  Cenário com Evento/Sintoma (Falha P0301 + Trepidação)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ferramentas de Teste e Validação de Falhas */}
        <div className="flex flex-col justify-end">
          <label className="block text-xs font-medium text-[#9AA7B4] mb-1">
            Testes de Resiliência e Varredura:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {isSimulator && isConnected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateCommunicationDrop}
                  className="border-amber-800 text-amber-400 hover:bg-amber-950/40 text-xs"
                  title="Simula desconexão física/timeout súbito para validar tratamento de falhas"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  Simular Perda Sinal
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

      {/* Discovered PIDs Collapsible summary */}
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

      {/* Banner de Orientação da Plataforma (Android/Desktop) */}
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

      {/* Falha de comunicação evidente */}
      {telemetry.connectionState === 'FALHA' && telemetry.lastError && (
        <div className="bg-red-950/60 border border-red-800 text-red-200 px-3 py-2 rounded text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            <strong>SEM COMUNICAÇÃO:</strong> {telemetry.lastError} (O sistema mantém buffers e
            dados gravados intactos).
          </span>
        </div>
      )}
    </div>
  )
}
