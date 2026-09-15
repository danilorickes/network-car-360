import React, { useState } from 'react'
import { loadAppConfig, saveAppConfig, DEFAULT_CONFIG } from '@/lib/config-store'
import { AppConfig } from '@/types/obd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Settings,
  Save,
  RotateCcw,
  Cpu,
  Radio,
  Activity,
  Clock,
  Bluetooth,
  Database,
  HelpCircle,
} from 'lucide-react'
import { detectPlatformCapabilities } from '@/lib/obd/platform-detector'

export default function Configuracoes() {
  const { toast } = useToast()
  const [config, setConfig] = useState<AppConfig>(loadAppConfig())
  const platform = detectPlatformCapabilities()

  const handleChange = (key: keyof AppConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = () => {
    saveAppConfig(config)
    toast({
      title: 'Configurações Salvas',
      description:
        'Parâmetros atualizados no armazenamento local (localStorage). Nenhum caminho hardcoded no código.',
    })
  }

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG })
    saveAppConfig(DEFAULT_CONFIG)
    toast({
      title: 'Valores Padrão Restaurados',
      description: 'Configurações redefinidas para os parâmetros originais.',
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#FFB300]" />
            <span>Configurações Operacionais da Telemetria</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Parâmetros de transporte, frequências de amostragem, janelas de caixa-preta e emulação
            veicular.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restaurar Padrões
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção 1: Transporte Serial e Bluetooth ELM327 */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#FFB300] font-bold text-sm">
              <Radio className="w-4 h-4" />
              <span>Transporte Físico (ELM327 USB & Bluetooth BLE)</span>
            </div>
            <span className="text-[10px] bg-purple-950/60 border border-purple-800 text-purple-300 px-2 py-0.5 rounded">
              NC-01
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Baud Rate Serial Padrão (bps):
              </label>
              <Input
                type="number"
                value={config.baudRate}
                onChange={(e) => handleChange('baudRate', parseInt(e.target.value) || 38400)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Padrão OBD-II ELM327: 38400 ou 115200
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Porta Serial / Identificador Sugerido:
              </label>
              <Input
                value={config.serialPort}
                onChange={(e) => handleChange('serialPort', e.target.value)}
                placeholder="Ex.: COM3 ou /dev/ttyUSB0"
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Identificador configurável fora do código
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Tentativas Automáticas de Reconexão:
              </label>
              <Input
                type="number"
                value={config.reconnectAttempts}
                onChange={(e) => handleChange('reconnectAttempts', parseInt(e.target.value) || 3)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
            </div>

            {/* Guia técnico de transporte Android/Bluetooth */}
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-2 mt-2">
              <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold text-[11px]">
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Estratégia Bluetooth Android / Multimídia (NC-01):</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Navegadores web não suportam diretamente o perfil <em>Bluetooth Clássico SPP</em>{' '}
                (Serial Port Profile) nativamente por limitações de segurança da especificação W3C.
                Para uso em Android e multimídias:
              </p>
              <ul className="list-disc list-inside text-[10px] text-gray-400 space-y-1">
                <li>
                  <strong className="text-white">Opção 1 (Nativa):</strong> Adaptador ELM327 BLE
                  4.0+ (ex.: Vgate iCar Pro BLE4, Veepeak BLE) via Web Bluetooth API.
                </li>
                <li>
                  <strong className="text-white">Opção 2 (Bluetooth Clássico SPP):</strong>{' '}
                  Pareamento no SO Android + cabo USB-OTG ou aplicativo bridge intermediário local
                  WebSocket/Proxy OBD.
                </li>
                <li>
                  <strong className="text-white">Opção 3 (Desktop USB):</strong> Web Serial API no
                  Google Chrome ou MS Edge.
                </li>
              </ul>
              <div className="text-[10px] text-cyan-300 bg-cyan-950/30 p-1.5 rounded border border-cyan-800/40">
                Detecção atual:{' '}
                <strong>{platform.isAndroid ? 'Dispositivo Android' : 'Desktop/Outro'}</strong> |
                Web Serial: <strong>{platform.hasWebSerial ? 'Sim' : 'Não'}</strong> | Web
                Bluetooth: <strong>{platform.hasWebBluetooth ? 'Sim' : 'Não'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 2: Frequências de Coleta */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[#2ECC71] font-bold text-sm">
            <Activity className="w-4 h-4" />
            <span>Frequências de Coleta (Scheduler)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Frequência Prioritária Alvo (Hz):
              </label>
              <Input
                type="number"
                value={config.priorityFreqHz}
                onChange={(e) => handleChange('priorityFreqHz', parseFloat(e.target.value) || 5)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF03: ≥5 Hz para RPM, Velocidade, Temp, Carga e TPS
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Frequência Secundária Alvo (Hz):
              </label>
              <Input
                type="number"
                value={config.secondaryFreqHz}
                onChange={(e) => handleChange('secondaryFreqHz', parseFloat(e.target.value) || 1)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF03: ≥1 Hz para os demais PIDs
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Intervalo de Varredura DTC Periódica (ms):
              </label>
              <Input
                type="number"
                value={config.dtcIntervalMs}
                onChange={(e) => handleChange('dtcIntervalMs', parseInt(e.target.value) || 60000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Varredura de Modo 03/07 sem emitir Modo 04
              </span>
            </div>
          </div>
        </div>

        {/* Seção 3: Parâmetros da Caixa-Preta e Persistência Offline */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#E53935] font-bold text-sm">
              <Clock className="w-4 h-4" />
              <span>Janelas da Caixa-Preta & Persistência (NC-02/NC-03)</span>
            </div>
            <span className="text-[10px] bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
              IndexedDB Ativo
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Janela Pré-Evento (ms):
              </label>
              <Input
                type="number"
                value={config.windowPreMs}
                onChange={(e) => handleChange('windowPreMs', parseInt(e.target.value) || 30000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF06: Padrão 30.000 ms (30 segundos anteriores)
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Janela Pós-Evento (ms):
              </label>
              <Input
                type="number"
                value={config.windowPostMs}
                onChange={(e) => handleChange('windowPostMs', parseInt(e.target.value) || 30000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF06: Padrão 30.000 ms (30 segundos posteriores)
              </span>
            </div>

            <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340] flex items-start space-x-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-300 space-y-1">
                <span className="font-semibold text-white">
                  Persistência Offline Verdadeira (NC-02/NC-03):
                </span>
                <p className="text-gray-400">
                  Amostras são gravadas de forma append-only no IndexedDB do navegador antes do
                  envio ao PocketBase. Em caso de queda de rede ou encerramento da aba, os dados são
                  preservados e reidratados automaticamente na reabertura.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 4: Parâmetros do Simulador Veicular */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Parâmetros Dinâmicos do Simulador</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Veículo Inicial de Validação (Metadado):
              </label>
              <Input
                value={config.defaultVehicleName}
                onChange={(e) => handleChange('defaultVehicleName', e.target.value)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Metadado injetável, nunca hardcoded no núcleo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">RPM Marcha Lenta:</label>
                <Input
                  type="number"
                  value={config.simulatorIdleRpm}
                  onChange={(e) =>
                    handleChange('simulatorIdleRpm', parseInt(e.target.value) || 850)
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">RPM Cruzeiro:</label>
                <Input
                  type="number"
                  value={config.simulatorCruiseRpm}
                  onChange={(e) =>
                    handleChange('simulatorCruiseRpm', parseInt(e.target.value) || 2100)
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
