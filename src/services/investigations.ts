import pb from '@/lib/pocketbase/client'
import {
  DiagnosticInvestigationModel,
  InvestigationStatus,
  ExecutedConfirmationTest,
  ClientComplaint,
  MechanicEvaluation,
  InvestigationHypothesisNode,
  RepairIntervention,
  PostRepairValidation,
  TimelineEntry,
} from '@/types/investigation'

export const investigationService = {
  // Lista todas as investigações
  async getAll(): Promise<DiagnosticInvestigationModel[]> {
    try {
      const records = await pb.collection('diagnostic_investigations').getFullList<any>({
        sort: '-created',
      })
      return records.map(mapRecordToInvestigation)
    } catch (e) {
      console.warn('Erro ao listar investigações:', e)
      return []
    }
  },

  // Obtém por ID
  async getById(id: string): Promise<DiagnosticInvestigationModel | null> {
    try {
      const record = await pb.collection('diagnostic_investigations').getOne<any>(id)
      return mapRecordToInvestigation(record)
    } catch {
      return null
    }
  },

  // Busca investigações vinculadas a um veículo específico
  async getByVehicleId(vehicleId: string): Promise<DiagnosticInvestigationModel[]> {
    try {
      const records = await pb.collection('diagnostic_investigations').getFullList<any>({
        filter: `vehicle = "${vehicleId}"`,
        sort: '-created',
      })
      return records.map(mapRecordToInvestigation)
    } catch {
      return []
    }
  },

  // Cria uma nova Ordem de Diagnóstico 360
  async create(data: Partial<DiagnosticInvestigationModel>): Promise<DiagnosticInvestigationModel> {
    const invNumber =
      data.investigation_number ||
      `OD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const recordPayload = {
      investigation_number: invNumber,
      vehicle: data.vehicle,
      vehicle_plate: data.vehicle_plate || 'BRA2E20',
      vehicle_model: data.vehicle_model || '',
      odometer_km: data.odometer_km || 0,
      status: data.status || 'ABERTA',
      client_complaint: data.client_complaint || {},
      mechanic_evaluation: data.mechanic_evaluation || {},
      initial_session: data.initial_session || null,
      retest_session: data.retest_session || null,
      hypotheses_tree: data.hypotheses_tree || [],
      tests_log: data.tests_log || [],
      intervention: data.intervention || null,
      post_repair_validation: data.post_repair_validation || null,
      timeline: data.timeline || [],
      final_conclusion: data.final_conclusion || '',
    }

    try {
      const created = await pb.collection('diagnostic_investigations').create<any>(recordPayload)
      return mapRecordToInvestigation(created)
    } catch (e) {
      console.warn('Fallback offline para criação de investigação:', e)
      return {
        ...recordPayload,
        id: `local_inv_${Date.now()}`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      } as DiagnosticInvestigationModel
    }
  },

  // Atualiza uma investigação
  async update(
    id: string,
    data: Partial<DiagnosticInvestigationModel>,
  ): Promise<DiagnosticInvestigationModel> {
    try {
      const updated = await pb.collection('diagnostic_investigations').update<any>(id, data)
      return mapRecordToInvestigation(updated)
    } catch (e) {
      console.warn('Erro ao atualizar investigação no PocketBase:', e)
      return {
        id,
        ...data,
      } as DiagnosticInvestigationModel
    }
  },

  // Salva teste de confirmação individual
  async saveConfirmationTest(
    test: ExecutedConfirmationTest,
    investigationId: string,
  ): Promise<void> {
    try {
      await pb.collection('confirmation_tests').create({
        investigation: investigationId,
        test_code: test.testCode,
        title: test.title,
        target_hypothesis_id: test.targetHypothesisId,
        target_component: test.targetComponent,
        status: test.status,
        responsible: test.responsible,
        measured_value: test.measuredValue || '',
        measured_unit: test.measuredUnit || '',
        observation: test.observation || '',
        attachment_meta: test.attachmentMeta || {},
        executed_at: test.executedAtUtc || new Date().toISOString(),
      })
    } catch (e) {
      console.warn('Erro ao salvar teste de confirmação na coleção:', e)
    }
  },
}

function mapRecordToInvestigation(rec: any): DiagnosticInvestigationModel {
  return {
    id: rec.id,
    investigation_number: rec.investigation_number,
    vehicle: rec.vehicle,
    vehicle_plate: rec.vehicle_plate,
    vehicle_model: rec.vehicle_model,
    odometer_km: rec.odometer_km,
    status: rec.status,
    client_complaint: rec.client_complaint || {
      description: '',
      whenOccurs: 'CONDICIONADO',
      engineState: 'QUENTE',
      movementState: 'EM_MOVIMENTO',
      accelerationState: 'ACELERANDO',
      frequency: 'MUITAS_VEZES_DIA',
      symptomsSelected: {
        checkEngineLight: false,
        noise: false,
        vibration: false,
        powerLoss: false,
        highFuelConsumption: false,
        hardStart: false,
        engineStall: false,
      },
      registeredAtUtc: new Date().toISOString(),
    },
    mechanic_evaluation: rec.mechanic_evaluation || {
      freeNotes: '',
      roughIdle: false,
      misfireUnderLoad: false,
      noiseAbnormal: false,
      unusualSmell: false,
      vibrationFelt: false,
      hardStarting: false,
      powerLossObserved: false,
      normalBehaviorObserved: false,
      technicianName: 'Técnico Responsável',
      registeredAtUtc: new Date().toISOString(),
    },
    initial_session: rec.initial_session,
    retest_session: rec.retest_session,
    hypotheses_tree: rec.hypotheses_tree || [],
    tests_log: rec.tests_log || [],
    intervention: rec.intervention || undefined,
    post_repair_validation: rec.post_repair_validation || undefined,
    timeline: rec.timeline || [],
    final_conclusion: rec.final_conclusion || '',
    created: rec.created,
    updated: rec.updated,
  }
}
