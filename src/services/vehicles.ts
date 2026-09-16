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
    let authWorkshopId = (pb.authStore.record as any)?.workshop_id || ''

    // Fallback: se não estiver direto no authStore.record, checa no localStorage
    if (!authWorkshopId && typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawAuth = window.localStorage.getItem('pocketbase_auth')
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth)
          if (parsed?.record?.workshop_id) {
            authWorkshopId = parsed.record.workshop_id
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    const payload: any = {
      ...data,
      plate: cleanPlate,
    }

    // Garante que workshop_id seja explicitamente preenchido
    if (data.workshop_id) {
      payload.workshop_id = data.workshop_id
    } else if (authWorkshopId) {
      payload.workshop_id = authWorkshopId
    }

    try {
      return await pb.collection('vehicles').create<VehicleModel>(payload)
    } catch (err: any) {
      // Log técnico temporário de diagnóstico exigido na tarefa
      // authenticated_user_id, resolved_workshop_id, customer_id
      const diagUserId = pb.authStore.record?.id || 'none'
      const diagWorkshopId = payload.workshop_id || authWorkshopId || 'none'
      const diagCustomerId = (data as any)?.client || 'none'
      console.error(
        `[DIAG_VEHICLE_CREATE_FAIL] Falha ao cadastrar veículo: ${err?.message || err}. ` +
          `authenticated_user_id=${diagUserId}, resolved_workshop_id=${diagWorkshopId}, customer_id=${diagCustomerId}`,
        { error: err, payload },
      )
      throw err
    }
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
