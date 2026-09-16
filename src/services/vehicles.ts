import pb from '@/lib/pocketbase/client'
import { VehicleModel, ObdCapabilityModel } from '@/types/obd'

export const vehicleService = {
  async getAll(): Promise<VehicleModel[]> {
    try {
      return await pb.collection('vehicles').getFullList<VehicleModel>({
        sort: 'make,model',
      })
    } catch (e) {
      console.warn('Falha ao listar veículos no PocketBase:', e)
      return []
    }
  },

  async getById(id: string): Promise<VehicleModel | null> {
    try {
      return await pb.collection('vehicles').getOne<VehicleModel>(id)
    } catch {
      return null
    }
  },

  async getByPlate(plate: string): Promise<VehicleModel | null> {
    try {
      return await pb
        .collection('vehicles')
        .getFirstListItem<VehicleModel>(`plate = "${plate.trim().toUpperCase()}"`)
    } catch {
      return null
    }
  },

  async create(data: Omit<VehicleModel, 'id' | 'created' | 'updated'>): Promise<VehicleModel> {
    const cleanPlate = data.plate.trim().toUpperCase()
    const authWorkshopId = (pb.authStore.record as any)?.workshop_id || ''
    const payload: any = {
      ...data,
      plate: cleanPlate,
    }
    if (authWorkshopId && !payload.workshop_id) {
      payload.workshop_id = authWorkshopId
    }
    return await pb.collection('vehicles').create<VehicleModel>(payload)
  },

  async update(id: string, data: Partial<VehicleModel>): Promise<VehicleModel> {
    const payload = { ...data }
    if (payload.plate) payload.plate = payload.plate.trim().toUpperCase()
    return await pb.collection('vehicles').update<VehicleModel>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('vehicles').delete(id)
  },
}

export const obdCapabilityService = {
  async getByVehicleId(vehicleId: string): Promise<ObdCapabilityModel | null> {
    try {
      return await pb
        .collection('obd_capabilities')
        .getFirstListItem<ObdCapabilityModel>(`vehicle = "${vehicleId}"`, {
          sort: '-created',
        })
    } catch {
      return null
    }
  },

  async saveOrUpdateCapability(
    data: Omit<ObdCapabilityModel, 'id' | 'created' | 'updated'>,
  ): Promise<ObdCapabilityModel> {
    if (data.vehicle) {
      try {
        const existing = await this.getByVehicleId(data.vehicle)
        if (existing?.id) {
          return await pb
            .collection('obd_capabilities')
            .update<ObdCapabilityModel>(existing.id, data)
        }
      } catch {
        /* intentionally ignored */
      }
    }
    return await pb.collection('obd_capabilities').create<ObdCapabilityModel>(data)
  },
}
