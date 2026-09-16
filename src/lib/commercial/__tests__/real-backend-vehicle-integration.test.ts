import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { vehicleService } from '@/services/vehicles'

describe('Validação Real do Backend Skip Cloud: Veículos e Workshop ID', () => {
  const testPlate = `TES${Math.floor(1000 + Math.random() * 9000)}`
  let createdVehicleId = ''

  beforeAll(async () => {
    // Autentica com o usuário real de homologação
    await pb.collection('users').authWithPassword('danilorickes@gmail.com', 'Admin123456!')
  })

  afterAll(async () => {
    if (createdVehicleId) {
      try {
        await pb.collection('vehicles').delete(createdVehicleId)
      } catch {
        /* intentionally ignored */
      }
    }
    pb.authStore.clear()
  })

  it('deve criar e persistir veículo com workshop_id resolvido no backend real', async () => {
    expect(pb.authStore.isValid).toBe(true)
    const user = pb.authStore.record as any
    expect(user.workshop_id).toBe('wsnetmatriz0001')

    // Criação com cliente existente clicarlos000001
    const newVehicle = await vehicleService.create({
      plate: testPlate,
      make: 'Ford',
      model: 'EcoSport',
      version: 'Titanium 1.5 AT',
      year_model: '2020/2020',
      engine: '1.5 Dragon 3C',
      fuel: 'Flex',
      odometer_km: 48500,
      client: 'clicarlos000001',
      notes: 'Teste real de homologação Skip Cloud',
    } as any)

    expect(newVehicle).toBeDefined()
    expect(newVehicle.id).toBeDefined()
    createdVehicleId = newVehicle.id
    expect(newVehicle.plate).toBe(testPlate)
    expect((newVehicle as any).workshop_id).toBe('wsnetmatriz0001')

    // Recupera do backend novamente para garantir persistência e regras de leitura multitenant
    const fetched = await vehicleService.getById(createdVehicleId)
    expect(fetched).not.toBeNull()
    expect(fetched?.plate).toBe(testPlate)
    expect((fetched as any)?.workshop_id).toBe('wsnetmatriz0001')
    expect((fetched as any)?.client).toBe('clicarlos000001')
  })
})
