import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConnectionDiscoveryWizard } from '@/lib/obd/connection-discovery-wizard'
import { SimulatedTransport } from '@/lib/obd/transports/simulated-transport'
import { BluetoothTransport } from '@/lib/obd/transports/bluetooth-transport'
import { RealSerialTransport } from '@/lib/obd/transports/real-serial-transport'
import { AndroidNativeTransport } from '@/lib/obd/transports/android-native-transport'
import { ConnectionWizardStep, ConnectionDiscoveryResult } from '@/types/etapa6'
import {
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Bluetooth,
  Usb,
  Smartphone,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

interface ConnectionWizardModalProps {
  open: boolean
  onClose: () => void
  onConnectionSuccess: (result: ConnectionDiscoveryResult) => void
}

export const ConnectionWizardModal: React.FC<ConnectionWizardModalProps> = ({
  open,
  onClose,
  onConnectionSuccess,
}) => {
  const [selectedTransport, setSelectedTransport] = useState<
    'SIMULADOR' | 'BLE' | 'USB_SERIAL' | 'ANDROID_NATIVE'
  >('SIMULADOR')
  const [currentStep, setCurrentStep] = useState<ConnectionWizardStep>('SELECIONAR_TRANSPORTE')
  const [stepMessage, setStepMessage] = useState('Selecione o meio físico de conexão.')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConnectionDiscoveryResult | null>(null)
  const [isDiscovering, setIsDiscovering] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentStep('SELECIONAR_TRANSPORTE')
      setStepMessage('Selecione o meio físico de conexão com o veículo.')
      setProgress(0)
      setResult(null)
      setIsDiscovering(false)
    }
  }, [open])

  const handleStartDiscovery = async () => {
    setIsDiscovering(true)
    let transportInstance: any = null

    if (selectedTransport === 'SIMULADOR') {
      transportInstance = new SimulatedTransport('NORMAL')
    } else if (selectedTransport === 'BLE') {
      transportInstance = new BluetoothTransport()
    } else if (selectedTransport === 'USB_SERIAL') {
      transportInstance = new RealSerialTransport()
    } else {
      transportInstance = new AndroidNativeTransport()
    }

    const wizard = new ConnectionDiscoveryWizard(transportInstance)
    const res = await wizard.runDiscovery({
      onStepChange: (step, msg) => {
        setCurrentStep(step)
        setStepMessage(msg)
      },
      onProgress: (pct) => setProgress(pct),
    })

    setResult(res)
    setIsDiscovering(false)
    if (res.step === 'CONECTADO' || res.step === 'CONEXAO_LIMITADA') {
      onConnectionSuccess(res)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isDiscovering && !val && onClose()}>
      <DialogContent className="bg-[#131A22] border-[#263340] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-lg text-white">
            <Radio className="w-5 h-5 text-[#FFB300]" />
            <span>Assistente de Primeira Conexão OBD</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#9AA7B4]">
            Detecta, identifica versão ELM327, protocolo ECU e mapeia PIDs suportados sem inventar
            dados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seletor de Transporte */}
          {currentStep === 'SELECIONAR_TRANSPORTE' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-300 block">
                Escolha o Adaptador / Transporte:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTransport('SIMULADOR')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    selectedTransport === 'SIMULADOR'
                      ? 'bg-blue-950/60 border-blue-500 text-white'
                      : 'bg-[#0B0F14] border-[#263340] text-[#9AA7B4] hover:bg-[#1A232E]'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Wifi className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold">Simulador Virtual</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Cenários automotivos reproduzíveis
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTransport('BLE')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    selectedTransport === 'BLE'
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-[#0B0F14] border-[#263340] text-[#9AA7B4] hover:bg-[#1A232E]'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Bluetooth className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold">Bluetooth BLE</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Vgate iCar Pro, Veepeak, BLE4.0+
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTransport('USB_SERIAL')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    selectedTransport === 'USB_SERIAL'
                      ? 'bg-purple-950/60 border-purple-500 text-white'
                      : 'bg-[#0B0F14] border-[#263340] text-[#9AA7B4] hover:bg-[#1A232E]'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Usb className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold">USB Serial / OTG</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Cabo ELM327 FTDI / CH340</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTransport('ANDROID_NATIVE')}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    selectedTransport === 'ANDROID_NATIVE'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-[#0B0F14] border-[#263340] text-[#9AA7B4] hover:bg-[#1A232E]'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold">Android Nativo SPP</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Multimídias e tablets Android</span>
                </button>
              </div>

              <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#263340] text-xs text-[#9AA7B4] flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#FFB300] shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de Segurança:</strong> O Network Car nunca emite comandos de
                  reprogramação ou apagamento forçado (Mode 04). Todas as consultas são estritamente
                  passivas de leitura.
                </span>
              </div>
            </div>
          )}

          {/* Progresso / Execução */}
          {currentStep !== 'SELECIONAR_TRANSPORTE' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-semibold flex items-center space-x-1.5">
                  {isDiscovering && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFB300]" />}
                  <span>{stepMessage}</span>
                </span>
                <span className="font-mono text-[#FFB300] font-bold">{progress}%</span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full bg-[#0B0F14] h-2 rounded-full overflow-hidden border border-[#263340]">
                <div
                  className="bg-[#FFB300] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Status do Passo */}
              <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] text-xs font-mono space-y-1">
                <div>
                  Etapa: <span className="text-white font-bold uppercase">{currentStep}</span>
                </div>
                {result && (
                  <>
                    <div>
                      Adaptador: <span className="text-gray-300">{result.adapterName}</span>
                    </div>
                    {result.protocol && (
                      <div>
                        Protocolo: <span className="text-cyan-400">{result.protocol}</span>
                      </div>
                    )}
                    {result.vin && (
                      <div>
                        VIN Lida: <span className="text-emerald-400">{result.vin}</span>
                      </div>
                    )}
                    <div>
                      PIDs Suportados:{' '}
                      <span className="text-[#FFB300] font-bold">
                        {result.pidsSupported.length}
                      </span>
                    </div>
                    {result.sampleRateHz && (
                      <div>
                        Taxa Estimada: <span className="text-white">{result.sampleRateHz} Hz</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resultado Final */}
              {result && (
                <div
                  className={`p-3 rounded border text-xs flex items-start space-x-2 ${
                    result.step === 'CONECTADO'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : result.step === 'CONEXAO_LIMITADA'
                        ? 'bg-amber-950/60 border-amber-700 text-amber-200'
                        : 'bg-red-950/60 border-red-800 text-red-200'
                  }`}
                >
                  {result.step === 'CONECTADO' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">
                      {result.step === 'CONECTADO'
                        ? 'Conexão Estabelecida com Sucesso!'
                        : result.step === 'CONEXAO_LIMITADA'
                          ? 'Conexão com Limitações'
                          : 'Falha na Conexão'}
                    </span>
                    <p className="text-[11px] mt-0.5 text-gray-300">
                      {result.notes || result.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#263340]">
          {currentStep === 'SELECIONAR_TRANSPORTE' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-[#263340] text-gray-400 hover:text-white hover:bg-[#1A232E]"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleStartDiscovery}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-semibold"
              >
                Iniciar Descoberta
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={isDiscovering}
              onClick={onClose}
              className="bg-[#1A232E] hover:bg-[#263340] text-white border border-[#263340]"
            >
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
