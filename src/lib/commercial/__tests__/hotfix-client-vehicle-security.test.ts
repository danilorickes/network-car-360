import { describe, it, expect, beforeEach, vi } from 'vitest'
import { vehicleService } from '@/services/vehicles'
import { clientService, getAuthenticatedWorkshopId } from '@/services/commercial'
import pb from '@/lib/pocketbase/client'

describe('Fluxo Integrado de Segurança: Clientes, Veículos e Workshop ID', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pb.authStore.clear()
  })

  it('deve extrair o workshop_id autenticado e injetar automaticamente no cadastro do veículo', async () => {
    // Simula usuário técnico autenticado da oficina OFICINA_ALPHA
    pb.authStore.save('mock-token-xyz', {
      id: 'usr_mecanico_01',
      workshop_id: 'ws_alpha_777',
      role: 'ADMIN',
      name: 'Mecânico Chefe',
    } as any)

    let createdPayload: any = null
    const createSpy = vi
      .spyOn(pb.collection('vehicles'), 'create')
      .mockImplementation(async (data: any) => {
        createdPayload = data
        return {
          id: 'veh_ecosport_2020',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          ...data,
        } as any
      })

    // Usuário tenta cadastrar veículo sem conhecer ou digitar workshop_id
    const newVehicleData = {
      plate: 'bra2e20', // Em minúsculas para testar normalização
      make: 'Ford',
      model: 'EcoSport',
      year_model: '2020',
      engine: '1.5 Dragon 3C',
      fuel: 'Flex',
      odometer_km: 48500,
      client: 'cli_danilo_rickes_01',
      notes: 'Veículo em homologação',
    }

    const created = await vehicleService.create(newVehicleData as any)

    expect(createSpy).toHaveBeenCalled()
    expect(created.plate).toBe('BRA2E20')
    expect(createdPayload.workshop_id).toBe('ws_alpha_777')
    expect(createdPayload.client).toBe('cli_danilo_rickes_01')
  })

  it('deve identificar workshop_id pelo helper getAuthenticatedWorkshopId()', () => {
    pb.authStore.save('mock-token-xyz', {
      id: 'usr_02',
      workshop_id: 'ws_beta_999',
    } as any)

    const wId = getAuthenticatedWorkshopId()
    expect(wId).toBe('ws_beta_999')
  })

  it('deve rejeitar e bloquear o acesso se usuário não estiver autenticado em getAuthenticatedWorkshopId(true)', () => {
    pb.authStore.clear()
    expect(() => getAuthenticatedWorkshopId(true)).toThrow(/não autenticado/)
  })
})
