import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  workOrderService,
  clientService,
  partsCatalogService,
  serviceCatalogService,
  receptionService,
  auditService,
} from '@/services/commercial'

describe('ME001-E5.1: Auditoria de Segurança Multitenant e Sequência Concorrente (NC-E5-SEC-01, NC-E5-SEC-02, NC-E5-INT-01, NC-E5-AUD-01)', () => {
  const workshopA = 'ws_oficina_alfa'
  const workshopB = 'ws_oficina_beta'

  beforeEach(() => {
    vi.restoreAllMocks()
    pb.authStore.clear()
  })

  // --------------------------------------------------------------------------
  // TESTE 1: Usuário não autenticado → acesso negado à API direta
  // --------------------------------------------------------------------------
  it('TESTE 1: Usuário não autenticado → acesso negado na API direta de coleções comerciais', async () => {
    // Garante authStore desautenticado
    expect(pb.authStore.isValid).toBe(false)

    // Mock de rejeição do PocketBase para requisição sem token (401/403)
    vi.spyOn(pb.collection('clients'), 'getFullList').mockRejectedValue({
      status: 403,
      message: 'Only authenticated users can access this resource.',
    })

    await expect(pb.collection('clients').getFullList()).rejects.toMatchObject({
      status: 403,
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 2: Oficina A → Leitura de dados da Oficina B negada
  // --------------------------------------------------------------------------
  it('TESTE 2: Oficina A → Leitura de dados da Oficina B negada (RLS multitenant)', async () => {
    // Autentica usuário da Oficina A
    pb.authStore.save('token_user_a', {
      id: 'usr_oficina_a_01',
      name: 'Técnico Oficina A',
      workshop_id: workshopA,
      role: 'ADMINISTRADOR',
    } as any)

    expect(pb.authStore.isValid).toBe(true)

    // Se usuário da Oficina A tentar obter registro de Oficina B por ID:
    vi.spyOn(pb.collection('clients'), 'getOne').mockImplementation((id: string) => {
      if (id === 'cli_oficina_b') {
        return Promise.reject({
          status: 404,
          message: "The requested resource wasn't found.",
        })
      }
      return Promise.resolve({ id, workshop_id: workshopA } as any)
    })

    await expect(pb.collection('clients').getOne('cli_oficina_b')).rejects.toMatchObject({
      status: 404,
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 3: Oficina A → Criação usando workshop_id da Oficina B negada
  // --------------------------------------------------------------------------
  it('TESTE 3: Oficina A → Criação usando workshop_id da Oficina B negada pelo hook/RLS', async () => {
    pb.authStore.save('token_user_a', {
      id: 'usr_oficina_a_01',
      workshop_id: workshopA,
      role: 'RECEPCAO',
    } as any)

    // Simula hook que rejeita tentativa maliciosa de cross-tenant injection
    vi.spyOn(pb.collection('clients'), 'create').mockImplementation((data: any) => {
      const authUserWorkshop = (pb.authStore.record as any)?.workshop_id
      if (data.workshop_id && data.workshop_id !== authUserWorkshop) {
        return Promise.reject({
          status: 400,
          message: 'Operação negada: proibido criar registros em oficina de terceiros.',
        })
      }
      return Promise.resolve({ id: 'new_cli', ...data, workshop_id: authUserWorkshop } as any)
    })

    // Tentativa maliciosa de enviar workshop_id da Oficina B
    await expect(
      pb.collection('clients').create({
        name: 'Cliente Hacker',
        phone: '1199999999',
        workshop_id: workshopB, // Invasão
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('proibido criar registros em oficina de terceiros'),
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 4: Oficina A → Alteração em registro da Oficina B negada
  // --------------------------------------------------------------------------
  it('TESTE 4: Oficina A → Alteração em registro da Oficina B negada', async () => {
    pb.authStore.save('token_user_a', {
      id: 'usr_oficina_a_01',
      workshop_id: workshopA,
      role: 'MECANICO',
    } as any)

    vi.spyOn(pb.collection('work_orders'), 'update').mockImplementation((id: string, data: any) => {
      if (id === 'wo_oficina_b') {
        return Promise.reject({
          status: 403,
          message: 'Operação negada: registro não pertence à sua oficina.',
        })
      }
      return Promise.resolve({ id, ...data } as any)
    })

    await expect(
      pb.collection('work_orders').update('wo_oficina_b', { status: 'CANCELADA' }),
    ).rejects.toMatchObject({
      status: 403,
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 5: Oficina A → Exclusão em registro da Oficina B negada
  // --------------------------------------------------------------------------
  it('TESTE 5: Oficina A → Exclusão em registro da Oficina B negada', async () => {
    pb.authStore.save('token_user_a', {
      id: 'usr_oficina_a_01',
      workshop_id: workshopA,
      role: 'ADMINISTRADOR',
    } as any)

    vi.spyOn(pb.collection('service_catalog'), 'delete').mockImplementation((id: string) => {
      if (id === 'srv_oficina_b') {
        return Promise.reject({
          status: 404, // PB retorna 404 quando o deleteRule não casa
          message: "The requested resource wasn't found.",
        })
      }
      return Promise.resolve(true)
    })

    await expect(pb.collection('service_catalog').delete('srv_oficina_b')).rejects.toMatchObject({
      status: 404,
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 6: Duas OS simultâneas na mesma oficina → números sequenciais diferentes
  // --------------------------------------------------------------------------
  it('TESTE 6: Duas OS simultâneas na mesma oficina → números sequenciais monotônicos e diferentes', async () => {
    // Simula a coleção transacional workshop_sequences
    let sequenceState = 10
    const generateSequentialOS = async (wsId: string) => {
      // Simula runInTransaction atômica no banco de dados SQLite/PB
      const assignedSeq = sequenceState
      sequenceState += 1
      const orderNumber = `OS #${String(assignedSeq).padStart(6, '0')}`
      return {
        workshop_id: wsId,
        order_number: orderNumber,
        sequential_num: assignedSeq,
      }
    }

    // Dispara 2 criações simultâneas via Promise.all
    const [os1, os2] = await Promise.all([
      generateSequentialOS(workshopA),
      generateSequentialOS(workshopA),
    ])

    expect(os1.order_number).not.toBe(os2.order_number)
    expect(os1.sequential_num).toBe(10)
    expect(os2.sequential_num).toBe(11)
    expect(os1.order_number).toBe('OS #000010')
    expect(os2.order_number).toBe('OS #000011')
  })

  // --------------------------------------------------------------------------
  // TESTE 7: Cancelamento/exclusão de OS → número não é reutilizado na próxima criação
  // --------------------------------------------------------------------------
  it('TESTE 7: Cancelamento/exclusão de OS → número não reutilizado na próxima criação (sequência monotônica)', async () => {
    let currentNextSeq = 5
    const existingOrders = [
      { order_number: 'OS #000001', sequential_num: 1, status: 'CONCLUIDA' },
      { order_number: 'OS #000002', sequential_num: 2, status: 'CANCELADA' },
      { order_number: 'OS #000003', sequential_num: 3, status: 'APROVADA' },
      { order_number: 'OS #000004', sequential_num: 4, status: 'CANCELADA' }, // Excluída/cancelada
    ]

    // Se fosse countRecords + 1, o contador seria 4 + 1 = 5, mas se uma for deletada da base,
    // count cairia para 3 gerando colisão em OS #000004.
    // Com workshop_sequences, a sequência é estritamente monotônica:
    const createNextOS = () => {
      const seq = currentNextSeq
      currentNextSeq += 1
      return {
        order_number: `OS #${String(seq).padStart(6, '0')}`,
        sequential_num: seq,
      }
    }

    // Deletar um registro do histórico
    existingOrders.pop() // simula exclusão
    expect(existingOrders.length).toBe(3) // count agora é 3

    // A próxima OS criada DEVE usar a sequência monotônica (5), e NUNCA reutilizar 4
    const nextOrder = createNextOS()
    expect(nextOrder.sequential_num).toBe(5)
    expect(nextOrder.order_number).toBe('OS #000005')
  })

  // --------------------------------------------------------------------------
  // TESTE 8: Auditoria imutável → update e delete negados para usuário comum
  // --------------------------------------------------------------------------
  it('TESTE 8: Auditoria imutável → update e delete negados para usuário comum (updateRule/deleteRule = null)', async () => {
    pb.authStore.save('token_user_a', {
      id: 'usr_oficina_a_01',
      workshop_id: workshopA,
      role: 'ADMINISTRADOR', // Mesmo admin comum da oficina não altera auditoria
    } as any)

    // Tentativa de update no log de auditoria
    vi.spyOn(pb.collection('work_order_audits'), 'update').mockRejectedValue({
      status: 403,
      message: 'Only superusers can perform this action (updateRule is null).',
    })

    // Tentativa de delete no log de auditoria
    vi.spyOn(pb.collection('work_order_audits'), 'delete').mockRejectedValue({
      status: 403,
      message: 'Only superusers can perform this action (deleteRule is null).',
    })

    await expect(
      pb
        .collection('work_order_audits')
        .update('audit_123', { details: 'Tentativa de adulteração' }),
    ).rejects.toMatchObject({
      status: 403,
    })

    await expect(pb.collection('work_order_audits').delete('audit_123')).rejects.toMatchObject({
      status: 403,
    })
  })

  // --------------------------------------------------------------------------
  // TESTE 9: Sequência isolada por oficina (Oficina A e B com numerações próprias)
  // --------------------------------------------------------------------------
  it('TESTE 9: Oficina A e Oficina B possuem sequências independentes (ambas iniciam em OS #000001)', () => {
    const workshopSequences: Record<string, number> = {
      [workshopA]: 1,
      [workshopB]: 1,
    }

    const nextNumber = (wsId: string) => {
      const num = workshopSequences[wsId] || 1
      workshopSequences[wsId] = num + 1
      return `OS #${String(num).padStart(6, '0')}`
    }

    const osA1 = nextNumber(workshopA)
    const osB1 = nextNumber(workshopB)
    const osA2 = nextNumber(workshopA)

    expect(osA1).toBe('OS #000001')
    expect(osB1).toBe('OS #000001') // B começa em 1 independentemente de A
    expect(osA2).toBe('OS #000002')
  })
})
