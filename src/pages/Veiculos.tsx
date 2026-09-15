import React, { useState, useEffect } from 'react'
import { vehicleService, obdCapabilityService } from '@/services/vehicles'
import { VehicleModel, ObdCapabilityModel } from '@/types/obd'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Car,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Veiculos() {
  const { toast } = useToast()
  const { vehicles, selectedVehicle, setSelectedVehicle, refreshVehicles } = useTelemetry()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<ObdCapabilityModel | null>(null)

  // Formulário
  const [formData, setFormData] = useState({
    plate: '',
    make: '',
    model: '',
    version: '',
    year_model: '',
    engine: '',
    fuel: 'Flex',
    transmission: 'Manual',
    odometer_km: 0,
    vin: '',
    notes: '',
  })

  useEffect(() => {
    if (selectedVehicle?.id) {
      obdCapabilityService.getByVehicleId(selectedVehicle.id).then((cap) => {
        setSelectedCapability(cap)
      })
    }
  }, [selectedVehicle])

  const openNewModal = () => {
    setEditingVehicle(null)
    setFormData({
      plate: '',
      make: '',
      model: '',
      version: '',
      year_model: '',
      engine: '',
      fuel: 'Flex',
      transmission: 'Manual',
      odometer_km: 0,
      vin: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (v: VehicleModel) => {
    setEditingVehicle(v)
    setFormData({
      plate: v.plate,
      make: v.make,
      model: v.model,
      version: v.version || '',
      year_model: v.year_model || '',
      engine: v.engine || '',
      fuel: v.fuel || 'Flex',
      transmission: v.transmission || 'Manual',
      odometer_km: v.odometer_km || 0,
      vin: v.vin || '',
      notes: v.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.plate || !formData.make || !formData.model) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Placa, Fabricante e Modelo são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      if (editingVehicle?.id) {
        await vehicleService.update(editingVehicle.id, formData)
        toast({ title: 'Veículo Atualizado', description: `Dados de ${formData.plate} salvos.` })
      } else {
        await vehicleService.create(formData)
        toast({
          title: 'Veículo Cadastrado',
          description: `Veículo ${formData.plate} criado com sucesso.`,
        })
      }
      setModalOpen(false)
      await refreshVehicles()
    } catch (err: any) {
      toast({
        title: 'Erro ao Salvar',
        description: err?.message || 'Falha na gravação do perfil veicular.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (v: VehicleModel) => {
    if (!v.id) return
    if (!confirm(`Deseja realmente remover o veículo ${v.plate} — ${v.make} ${v.model}?`)) return
    try {
      await vehicleService.delete(v.id)
      toast({ title: 'Veículo Removido', description: 'Registro apagado com sucesso.' })
      await refreshVehicles()
    } catch (err: any) {
      toast({ title: 'Erro ao Excluir', description: err?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Car className="w-5 h-5 text-[#FFB300]" />
            <span>Cadastro & Perfis de Veículos (Genérico OBD-II)</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Requisito 1 da OS-ME001-E2: Perfis reutilizáveis com assinatura OBD, sem regras
            engessadas no código.
          </p>
        </div>

        <Button
          onClick={openNewModal}
          className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs shadow"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Veículo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Veículos */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider">
              Veículos Cadastrados ({vehicles.length})
            </h2>
          </div>

          <div className="space-y-2">
            {vehicles.map((v) => {
              const isSelected = selectedVehicle?.id === v.id
              return (
                <div
                  key={v.id || v.plate}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1A232E] border-[#FFB300] ring-1 ring-[#FFB300]'
                      : 'bg-[#131A22] border-[#263340] hover:border-gray-600 hover:bg-[#1A232E]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">
                      {v.make} {v.model}
                    </span>
                    <span className="bg-[#0B0F14] text-[#FFB300] font-mono font-bold text-xs px-2 py-0.5 rounded border border-[#263340]">
                      {v.plate}
                    </span>
                  </div>

                  <div className="text-xs text-[#9AA7B4] space-y-0.5">
                    <div>
                      {v.version || 'Versão padrão'} • {v.year_model || 'Ano N/D'}
                    </div>
                    <div className="font-mono text-[11px] text-gray-400">
                      Motor: {v.engine || 'OBD-II Genérico'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[#263340] text-[11px]">
                    <span className="text-emerald-400 flex items-center space-x-1">
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-[#2ECC71]" />
                          <span>Selecionado para Teste</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Clique para selecionar</span>
                      )}
                    </span>

                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(v)
                        }}
                        className="h-7 w-7 p-0 text-[#9AA7B4] hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(v)
                        }}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detalhes & Assinatura OBD do Veículo Selecionado */}
        <div className="lg:col-span-2">
          {selectedVehicle ? (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#263340]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-white">
                      {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.version}
                    </span>
                    <span className="bg-[#FFB300] text-black font-bold font-mono text-xs px-2 py-0.5 rounded">
                      {selectedVehicle.plate}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#9AA7B4]">
                    VIN / Chassi: {selectedVehicle.vin || 'Não disponível'}
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={() => openEditModal(selectedVehicle)}
                  className="bg-[#1A232E] hover:bg-[#263340] text-white border border-[#263340] text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                  Editar Perfil
                </Button>
              </div>

              {/* Ficha Técnica */}
              <div>
                <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
                  Especificações Técnicas do Veículo
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Motorização:
                    </span>
                    <span className="font-semibold text-white">
                      {selectedVehicle.engine || 'Genérico'}
                    </span>
                  </div>
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Combustível:
                    </span>
                    <span className="font-semibold text-white">
                      {selectedVehicle.fuel || 'Flex'}
                    </span>
                  </div>
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Câmbio / Transmissão:
                    </span>
                    <span className="font-semibold text-white">
                      {selectedVehicle.transmission || 'Manual'}
                    </span>
                  </div>
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Ano / Modelo:
                    </span>
                    <span className="font-semibold text-white">
                      {selectedVehicle.year_model || 'N/D'}
                    </span>
                  </div>
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Odômetro:
                    </span>
                    <span className="font-mono text-[#2ECC71]">
                      {selectedVehicle.odometer_km
                        ? `${selectedVehicle.odometer_km.toLocaleString('pt-BR')} km`
                        : 'Não informado'}
                    </span>
                  </div>
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                      Arquitetura:
                    </span>
                    <span className="text-blue-400 font-semibold">Genérico OBD-II / SAE J1979</span>
                  </div>
                </div>

                {selectedVehicle.notes && (
                  <div className="mt-3 bg-[#0B0F14] p-3 rounded border border-[#263340] text-xs">
                    <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold mb-1">
                      Observações da Oficina:
                    </span>
                    <p className="text-gray-300 italic">{selectedVehicle.notes}</p>
                  </div>
                )}
              </div>

              {/* Assinatura / Capacidade OBD do Veículo (Requisito 2) */}
              <div>
                <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-[#FFB300]" />
                  <span>Assinatura & Capacidade OBD Registrada</span>
                </h3>

                {selectedCapability ? (
                  <div className="bg-[#0B0F14] border border-[#263340] rounded p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263340] pb-2">
                      <span className="text-gray-300">
                        Protocolo Detectado:{' '}
                        <strong className="text-white">
                          {selectedCapability.protocol_detected}
                        </strong>
                      </span>
                      <span className="text-gray-300">
                        Adaptador:{' '}
                        <strong className="text-blue-400">
                          {selectedCapability.adapter_name || selectedCapability.adapter_type}
                        </strong>
                      </span>
                      <span className="text-gray-300">
                        MIL Inicial:{' '}
                        <strong
                          className={
                            selectedCapability.mil_initial_state
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {selectedCapability.mil_initial_state ? 'ACESO' : 'APAGADO'}
                        </strong>
                      </span>
                    </div>

                    <div>
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold mb-1.5">
                        PIDs Suportados Registrados ({selectedCapability.pids_supported.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCapability.pids_supported.map((p) => (
                          <span
                            key={p}
                            className="bg-[#1A232E] text-[#FFB300] px-2 py-0.5 rounded font-mono text-xs border border-[#263340]"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedCapability.pids_unavailable.length > 0 && (
                      <div>
                        <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold mb-1.5">
                          PIDs Indisponíveis / Não Respondidos:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCapability.pids_unavailable.map((p) => (
                            <span
                              key={p}
                              className="bg-[#131A22] text-gray-500 px-2 py-0.5 rounded font-mono text-xs border border-[#263340]"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] text-xs text-[#9AA7B4] flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Nenhuma assinatura OBD gravada para este veículo ainda. Conecte o adaptador no
                      Painel Live para registrar automaticamente os protocolos e capacidades.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-12 text-center text-xs text-[#9AA7B4]">
              Selecione um veículo à esquerda ou cadastre um novo para visualizar o perfil e sua
              capacidade OBD.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Veículo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#131A22] border-[#263340] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center space-x-2">
              <Car className="w-5 h-5 text-[#FFB300]" />
              <span>{editingVehicle ? 'Editar Perfil do Veículo' : 'Cadastrar Novo Veículo'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Placa *:</label>
                <Input
                  required
                  value={formData.plate}
                  onChange={(e) =>
                    setFormData({ ...formData, plate: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: BRA2E20"
                  className="bg-[#0B0F14] border-[#263340] text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">
                  Fabricante / Marca *:
                </label>
                <Input
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Ex: Ford, Volkswagen, Fiat"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Modelo *:</label>
                <Input
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Ex: EcoSport, T-Cross"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">
                  Versão / Acabamento:
                </label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="Ex: Freestyle 1.5 AT"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Ano / Modelo:</label>
                <Input
                  value={formData.year_model}
                  onChange={(e) => setFormData({ ...formData, year_model: e.target.value })}
                  placeholder="Ex: 2020/2020"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Motorização:</label>
                <Input
                  value={formData.engine}
                  onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                  placeholder="Ex: 1.5 Dragon 3C / 1.0 TSI"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Combustível:</label>
                <Input
                  value={formData.fuel}
                  onChange={(e) => setFormData({ ...formData, fuel: e.target.value })}
                  placeholder="Ex: Flex, Gasolina, Diesel"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Transmissão:</label>
                <Input
                  value={formData.transmission}
                  onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                  placeholder="Ex: Automático 6M / Manual"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Quilometragem (km):</label>
                <Input
                  type="number"
                  value={formData.odometer_km}
                  onChange={(e) =>
                    setFormData({ ...formData, odometer_km: parseInt(e.target.value) || 0 })
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Chassi / VIN (quando disponível):
              </label>
              <Input
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="Ex: 9BFBJ55E6L8104921"
                className="bg-[#0B0F14] border-[#263340] text-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Observações Mecânicas:
              </label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Sintomas relatados pelo cliente, histórico de manutenção..."
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#263340]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#263340] text-[#9AA7B4] hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold"
              >
                {loading ? 'Salvando...' : 'Salvar Veículo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
