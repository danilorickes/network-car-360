import React, { useState } from 'react'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { EventType } from '@/types/obd'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Flag } from 'lucide-react'

const SYMPTOM_OPTIONS: { type: EventType; label: string; desc: string }[] = [
  {
    type: 'falha',
    label: 'Falha de Ignição / Combustão',
    desc: 'Engasgo, falha em cilindro ou corte momentâneo',
  },
  {
    type: 'trepidação',
    label: 'Trepidação / Vibração',
    desc: 'Vibração excessiva na carroceria ou volante',
  },
  {
    type: 'perda de potência',
    label: 'Perda de Potência',
    desc: 'Falta de resposta ao pisar no acelerador',
  },
  {
    type: 'ruído',
    label: 'Ruído Anômalo',
    desc: 'Batida de pino, chiado, estalo mecânico ou escape',
  },
  {
    type: 'oscilação',
    label: 'Oscilação de Marcha Lenta',
    desc: 'RPM instável sem ação do condutor',
  },
  {
    type: 'apagamento',
    label: 'Apagamento do Motor',
    desc: 'Motor morreu durante parada ou desaceleração',
  },
  {
    type: 'outro/livre',
    label: 'Outro Sintoma Livre',
    desc: 'Qualquer outra anomalia observada na pista',
  },
]

export const SymptomMarkerButton: React.FC = () => {
  const { telemetry, markSymptom, config } = useTelemetry()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<EventType>('trepidação')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isTesting = telemetry.sessionState === 'TESTE ATIVO'

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await markSymptom(selectedType, description)
      setDescription('')
      setModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isTesting) {
    return null
  }

  return (
    <>
      {/* Botão flutuante destacado no canto inferior direito para acesso rápido em teste na pista */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#E53935] hover:bg-[#c62828] text-white font-black text-sm md:text-base px-5 py-6 rounded-full shadow-2xl flex items-center space-x-2 border-2 border-red-300 animate-pulse hover:scale-105 active:scale-95 transition-all"
        >
          <Flag className="w-5 h-5 fill-current" />
          <span>MARCAR SINTOMA</span>
        </Button>
      </div>

      {/* Modal de Detalhamento do Sintoma (Caixa-Preta ±30s) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#131A22] border-[#263340] text-white max-w-lg">
          <DialogHeader>
            <div className="flex items-center space-x-2 text-[#E53935] mb-1">
              <AlertCircle className="w-6 h-6" />
              <DialogTitle className="text-xl font-bold">Marcar Sintoma / Anomalia</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#9AA7B4]">
              Garante a gravação da <strong>Caixa-Preta</strong>: janela de{' '}
              {config.windowPreMs / 1000}s anteriores + instante + {config.windowPostMs / 1000}s
              posteriores. A telemetria bruta original é imutável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-[#9AA7B4] uppercase tracking-wider mb-2">
                Tipo do Sintoma Observado:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SYMPTOM_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`p-2.5 rounded-md text-left border transition-all text-xs ${
                      selectedType === opt.type
                        ? 'bg-red-950/80 border-[#E53935] text-white font-medium ring-1 ring-[#E53935]'
                        : 'bg-[#0B0F14] border-[#263340] text-[#9AA7B4] hover:border-gray-600 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9AA7B4] uppercase tracking-wider mb-1">
                Descrição Adicional (Opcional):
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Trepidação sentida no volante ao acelerar em subida..."
                className="bg-[#0B0F14] border-[#263340] text-xs text-white resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-[#263340] text-[#9AA7B4] hover:bg-[#1A232E]"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="bg-[#E53935] hover:bg-[#c62828] text-white font-bold"
            >
              Confirmar Sintoma (Caixa-Preta)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
