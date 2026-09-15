import React, { useState } from 'react'
import { loadAppConfig, saveAppConfig, DEFAULT_CONFIG } from '@/lib/config-store'
import { AppConfig } from '@/types/obd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Settings, Save, RotateCcw, Cpu, Radio, Activity, Clock } from 'lucide-react'

export default function Configuracoes() {
  const { toast } = useToast()
  const [config, setConfig] = useState<AppConfig>(loadAppConfig())

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
        {/* Seção 1: Transporte Serial OBD-II */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[#FFB300] font-bold text-sm">
            <Radio className="w-4 h-4" />
            <span>Transporte Serial Real (ELM327 / Web Serial)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Baud Rate Padrão (bps):
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

        {/* Seção 3: Parâmetros da Caixa-Preta (Eventos) */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[#E53935] font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>Janelas da Caixa-Preta (RF06)</span>
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
