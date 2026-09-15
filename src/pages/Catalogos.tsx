import React, { useState, useEffect } from 'react'
import {
  Wrench,
  Package,
  Plus,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { serviceCatalogService, partsCatalogService } from '@/services/commercial'
import { ServiceCatalogModel, PartsCatalogModel } from '@/types/commercial'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export default function Catalogos() {
  const { user } = useAuth()
  const [services, setServices] = useState<ServiceCatalogModel[]>([])
  const [parts, setParts] = useState<PartsCatalogModel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'servicos' | 'pecas'>('servicos')

  // Search
  const [searchSrv, setSearchSrv] = useState('')
  const [searchPrt, setSearchPrt] = useState('')

  // Modais
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [partModalOpen, setPartModalOpen] = useState(false)

  // Form Serviço
  const [srvCode, setSrvCode] = useState('')
  const [srvDesc, setSrvDesc] = useState('')
  const [srvCategory, setSrvCategory] = useState('')
  const [srvPrice, setSrvPrice] = useState<number | ''>('')
  const [srvMinutes, setSrvMinutes] = useState<number | ''>('')
  const [srvNotes, setSrvNotes] = useState('')

  // Form Peça
  const [prtCode, setPrtCode] = useState('')
  const [prtDesc, setPrtDesc] = useState('')
  const [prtManufacturer, setPrtManufacturer] = useState('')
  const [prtRef, setPrtRef] = useState('')
  const [prtCost, setPrtCost] = useState<number | ''>('')
  const [prtSale, setPrtSale] = useState<number | ''>('')
  const [prtUnit, setPrtUnit] = useState('UN')
  const [prtNotes, setPrtNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [sList, pList] = await Promise.all([
        serviceCatalogService.getAll(),
        partsCatalogService.getAll(),
      ])
      setServices(sList)
      setParts(pList)
    } catch {
      toast.error('Erro ao carregar catálogos mestre.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!srvDesc.trim() || srvPrice === '') {
      toast.error('Descrição e valor padrão são obrigatórios.')
      return
    }

    try {
      await serviceCatalogService.create({
        workshop_id: (user as any)?.workshop_id || 'wsnetmatriz0001',
        code: srvCode.trim() || `SRV-${Date.now().toString().slice(-4)}`,
        description: srvDesc.trim(),
        category: srvCategory.trim() || 'Geral',
        default_price: Number(srvPrice),
        estimated_minutes: Number(srvMinutes) || 30,
        notes: srvNotes.trim(),
        active: true,
      })
      toast.success('Serviço cadastrado com sucesso!')
      setServiceModalOpen(false)
      setSrvCode('')
      setSrvDesc('')
      setSrvCategory('')
      setSrvPrice('')
      setSrvMinutes('')
      setSrvNotes('')
      loadData()
    } catch {
      toast.error('Erro ao cadastrar serviço no backend.')
    }
  }

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prtCode.trim() || !prtDesc.trim() || prtSale === '') {
      toast.error('Código, descrição e preço de venda são obrigatórios.')
      return
    }

    try {
      await partsCatalogService.create({
        workshop_id: (user as any)?.workshop_id || 'wsnetmatriz0001',
        code: prtCode.trim().toUpperCase(),
        description: prtDesc.trim(),
        manufacturer: prtManufacturer.trim(),
        reference_code: prtRef.trim(),
        cost_price: Number(prtCost) || 0,
        sale_price: Number(prtSale),
        unit: prtUnit.trim() || 'UN',
        notes: prtNotes.trim(),
        active: true,
      })
      toast.success('Peça cadastrada no catálogo com sucesso!')
      setPartModalOpen(false)
      setPrtCode('')
      setPrtDesc('')
      setPrtManufacturer('')
      setPrtRef('')
      setPrtCost('')
      setPrtSale('')
      setPrtNotes('')
      loadData()
    } catch {
      toast.error('Erro ao cadastrar peça no backend.')
    }
  }

  const filteredServices = searchSrv.trim()
    ? services.filter(
        (s) =>
          s.description.toLowerCase().includes(searchSrv.toLowerCase()) ||
          s.code.toLowerCase().includes(searchSrv.toLowerCase()) ||
          s.category?.toLowerCase().includes(searchSrv.toLowerCase()),
      )
    : services

  const filteredParts = searchPrt.trim()
    ? parts.filter(
        (p) =>
          p.description.toLowerCase().includes(searchPrt.toLowerCase()) ||
          p.code.toLowerCase().includes(searchPrt.toLowerCase()) ||
          p.reference_code?.toLowerCase().includes(searchPrt.toLowerCase()),
      )
    : parts

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-[#FFB300]" />
            Catálogos Mestre: Serviços e Peças
          </h1>
          <p className="text-sm text-[#9AA7B4]">
            Preços de referência, tempos padrão e insumos. Preços podem ser ajustados na OS sem
            alterar o mestre.
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'servicos' ? (
            <Button
              onClick={() => setServiceModalOpen(true)}
              className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Serviço
            </Button>
          ) : (
            <Button
              onClick={() => setPartModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Peça / Produto
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        className="w-full space-y-4"
      >
        <TabsList className="bg-[#131A22] border border-[#263340]">
          <TabsTrigger
            value="servicos"
            className="data-[state=active]:bg-[#1A232E] data-[state=active]:text-[#FFB300] text-xs font-semibold"
          >
            <Wrench className="w-4 h-4 mr-1.5" />
            Serviços & Mão de Obra ({services.length})
          </TabsTrigger>
          <TabsTrigger
            value="pecas"
            className="data-[state=active]:bg-[#1A232E] data-[state=active]:text-amber-400 text-xs font-semibold"
          >
            <Package className="w-4 h-4 mr-1.5" />
            Peças & Insumos ({parts.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Serviços */}
        <TabsContent value="servicos" className="space-y-4">
          <div className="max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9AA7B4]" />
              <Input
                className="pl-9 bg-[#131A22] border-[#263340] text-white text-xs"
                placeholder="Buscar serviço por código ou descrição..."
                value={searchSrv}
                onChange={(e) => setSearchSrv(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((s) => (
              <Card key={s.id} className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
                <CardHeader className="pb-2 border-b border-[#263340]/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#FFB300] font-bold">{s.code}</span>
                    <Badge variant="outline" className="border-gray-600 text-gray-300 text-[10px]">
                      {s.category || 'Geral'}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-white mt-1">
                    {s.description}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9AA7B4] flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Preço Padrão:
                    </span>
                    <span className="font-mono font-bold text-white text-sm">
                      R$ {s.default_price?.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#9AA7B4] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-400" /> Tempo Estimado:
                    </span>
                    <span className="font-mono text-gray-300">{s.estimated_minutes} min</span>
                  </div>

                  {s.notes && (
                    <p className="text-[11px] text-gray-400 italic pt-1 border-t border-[#263340]/40">
                      {s.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Peças */}
        <TabsContent value="pecas" className="space-y-4">
          <div className="max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9AA7B4]" />
              <Input
                className="pl-9 bg-[#131A22] border-[#263340] text-white text-xs"
                placeholder="Buscar peça por código, ref ou fabricante..."
                value={searchPrt}
                onChange={(e) => setSearchPrt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParts.map((p) => (
              <Card key={p.id} className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
                <CardHeader className="pb-2 border-b border-[#263340]/60">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-400 font-bold">{p.code}</span>
                    <Badge variant="outline" className="border-gray-600 text-gray-300 text-[10px]">
                      {p.unit}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-white mt-1">
                    {p.description}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-[#9AA7B4]">Fabricante / Ref:</span>
                    <span className="font-mono">
                      {p.manufacturer || '-'} {p.reference_code ? `(${p.reference_code})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#9AA7B4]">Preço de Venda:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      R$ {p.sale_price?.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Preço de Custo:</span>
                    <span className="font-mono">R$ {p.cost_price?.toFixed(2)}</span>
                  </div>

                  {p.notes && (
                    <p className="text-[11px] text-gray-400 italic pt-1 border-t border-[#263340]/40">
                      {p.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Novo Serviço */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Cadastrar Serviço</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveService} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Código</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={srvCode}
                  onChange={(e) => setSrvCode(e.target.value)}
                  placeholder="SRV-006"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[#9AA7B4]">Categoria</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={srvCategory}
                  onChange={(e) => setSrvCategory(e.target.value)}
                  placeholder="Ex: Freios, Injeção, Suspensão"
                />
              </div>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Descrição do Serviço *</Label>
              <Input
                className="bg-[#1A232E] border-[#263340] text-white"
                value={srvDesc}
                onChange={(e) => setSrvDesc(e.target.value)}
                placeholder="Ex: Sangria e troca de fluido de freio DOT 4"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Preço Padrão (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={srvPrice}
                  onChange={(e) => setSrvPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Tempo Estimado (min)</Label>
                <Input
                  type="number"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={srvMinutes}
                  onChange={(e) =>
                    setSrvMinutes(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="45"
                />
              </div>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Observações Técnicas</Label>
              <Textarea
                className="bg-[#1A232E] border-[#263340] text-white"
                value={srvNotes}
                onChange={(e) => setSrvNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setServiceModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold"
              >
                Salvar Serviço
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Peça */}
      <Dialog open={partModalOpen} onOpenChange={setPartModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Cadastrar Peça / Insumo
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePart} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Código *</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={prtCode}
                  onChange={(e) => setPrtCode(e.target.value)}
                  placeholder="PEC-100"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[#9AA7B4]">Fabricante</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={prtManufacturer}
                  onChange={(e) => setPrtManufacturer(e.target.value)}
                  placeholder="Bosch, NGK, Mahle"
                />
              </div>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Descrição do Produto *</Label>
              <Input
                className="bg-[#1A232E] border-[#263340] text-white"
                value={prtDesc}
                onChange={(e) => setPrtDesc(e.target.value)}
                placeholder="Ex: Pastilha de Freio Dianteira"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Referência</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={prtRef}
                  onChange={(e) => setPrtRef(e.target.value)}
                  placeholder="HQ-2144"
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Preço Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={prtCost}
                  onChange={(e) => setPrtCost(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Preço Venda *</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={prtSale}
                  onChange={(e) => setPrtSale(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              >
                Salvar Peça
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
