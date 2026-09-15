import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadAssistantIdentity,
  saveAssistantIdentity,
  getAssistantStorageKey,
  getAssistantDisplayName,
  DEFAULT_ASSISTANT_IDENTITY,
} from '@/lib/assistant/assistant-identity-store'
import {
  AssistantCopilotService,
  NinaCopilotService,
} from '@/lib/assistant/assistant-copilot-service'
import {
  AssistantPeriodicBulletinService,
  NinaPeriodicBulletinService,
} from '@/lib/assistant/assistant-periodic-bulletin-service'
import { VehicleSafetyMonitor } from '@/lib/diagnostic/vehicle-safety-monitor'
import { CopilotContext } from '@/types/etapa6'
import pb from '@/lib/pocketbase/client'

describe('OS-ME001-E6.2: ASSISTENTE PERSONALIZÁVEL (Validação Rigorosa)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    pb.authStore.clear()
  })

  // -------------------------------------------------------------
  // REQUISITO 1 & 2: Identidade e Nina como Instância Configurável
  // -------------------------------------------------------------
  describe('Requisito 1 & 2: Identidade, nome livre, estilo e preservação do padrão Danilo', () => {
    it('1.1 Inicializa com denominação neutra "ASSISTENTE" antes da personalização', () => {
      const defaultId = loadAssistantIdentity('ABC1234')
      expect(defaultId.isCustomized).toBe(false)
      // Denominação neutra quando isCustomized === false
      expect(getAssistantDisplayName(defaultId)).toBe('Assistente')
      expect(getAssistantDisplayName(defaultId, true)).toBe('ASSISTENTE')
    })

    it('1.2 Permite configurar nome livre, wake word e estilo Objetivo / Amigável / Técnico', () => {
      const saved = saveAssistantIdentity(
        {
          name: 'Luna',
          wakeWord: 'luna',
          style: 'TECNICO',
        },
        'BRA2E19',
      )

      expect(saved.isCustomized).toBe(true)
      expect(saved.name).toBe('Luna')
      expect(saved.wakeWord).toBe('luna')
      expect(saved.style).toBe('TECNICO')
      expect(getAssistantDisplayName(saved)).toBe('Luna')
      expect(getAssistantDisplayName(saved, true)).toBe('LUNA')
    })

    it('1.3 Nina é apenas uma configuração utilizada pelo Danilo, não identidade mandatória', () => {
      // Danilo usa a configuração "Nina"
      const daniloConfig = saveAssistantIdentity(
        {
          name: 'Nina',
          wakeWord: 'nina',
          style: 'AMIGAVEL',
        },
        'DAN1L01',
      )
      expect(daniloConfig.name).toBe('Nina')
      expect(getAssistantDisplayName(daniloConfig)).toBe('Nina')

      // Outro condutor usa "Luna"
      const outroCondutor = saveAssistantIdentity(
        {
          name: 'Luna',
          wakeWord: 'luna',
          style: 'OBJETIVO',
        },
        'OUT2024',
      )
      expect(outroCondutor.name).toBe('Luna')
      expect(getAssistantDisplayName(outroCondutor)).toBe('Luna')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 4: Wake Word Dinâmico
  // -------------------------------------------------------------
  describe('Requisito 4: Wake Word Dinâmico e Desativação do Wake Word Anterior', () => {
    it('4.1 Ativação dinâmica com o wake word configurado ("Luna...")', () => {
      const service = new AssistantCopilotService('CAR1234', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'AMIGAVEL',
        isCustomized: true,
      })

      const match1 = service.matchWakeWord('Luna, como está o carro?')
      expect(match1).toBe('como está o carro?')

      const match2 = service.matchWakeWord('luna como está o carro')
      expect(match2).toBe('como está o carro')
    })

    it('4.2 Antigo wake word "Nina" NÃO ativa após troca para "Luna"', () => {
      const service = new AssistantCopilotService('CAR1234', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'AMIGAVEL',
        isCustomized: true,
      })

      // Comando com "Nina" deve ser rejeitado (retorna null)
      const matchNina = service.matchWakeWord('Nina, como está o carro?')
      expect(matchNina).toBeNull()

      // Comandos de boletins também devem rejeitar a antiga wake word
      const bulletinService = new AssistantPeriodicBulletinService('CAR1234', undefined, {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'AMIGAVEL',
        isCustomized: true,
      })

      const ninaVoiceCmd = bulletinService.parseVoiceCommand('Nina, me avisa a cada 20 minutos')
      expect(ninaVoiceCmd).toBeNull()

      // Mas ativando com "Luna" deve ser processado com sucesso
      const lunaVoiceCmd = bulletinService.parseVoiceCommand('Luna, me avisa a cada 20 minutos')
      expect(lunaVoiceCmd).not.toBeNull()
      expect(lunaVoiceCmd?.handled).toBe(true)
      expect(bulletinService.getConfig().intervalOption).toBe(20)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 5: Arquitetura Generalizada e Compatibilidade Retroativa
  // -------------------------------------------------------------
  describe('Requisito 5: Arquitetura Generalizada e Compatibilidade Retroativa', () => {
    it('5.1 NinaCopilotService é subclasse compatível com AssistantCopilotService', () => {
      const ninaService = new NinaCopilotService()
      expect(ninaService instanceof AssistantCopilotService).toBe(true)
      expect(ninaService.getIdentity().name).toBe('Nina')
      expect(ninaService.matchWakeWord('Nina, como está o carro?')).toBe('como está o carro?')
    })

    it('5.2 NinaPeriodicBulletinService é subclasse compatível com AssistantPeriodicBulletinService', () => {
      const bulletinService = new NinaPeriodicBulletinService('DAN1L01')
      expect(bulletinService instanceof AssistantPeriodicBulletinService).toBe(true)
      expect(bulletinService.getIdentity().name).toBe('Nina')

      // Processa comando com Nina normalmente
      const res = bulletinService.parseVoiceCommand('Nina, deixa os boletins mais detalhados')
      expect(res?.handled).toBe(true)
      expect(bulletinService.getConfig().detailLevel).toBe('DETALHADO')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 6: Persistência por Usuário, Veículo e Isolamento por Oficina
  // -------------------------------------------------------------
  describe('Requisito 6: Persistência Isolada por Oficina, Usuário e Placa', () => {
    it('6.1 Gera chaves de armazenamento distintas para veículos diferentes', () => {
      const keyCar1 = getAssistantStorageKey('ABC1234')
      const keyCar2 = getAssistantStorageKey('XYZ9876')
      expect(keyCar1).not.toBe(keyCar2)
      expect(keyCar1).toContain('ABC1234')
      expect(keyCar2).toContain('XYZ9876')
    })

    it('6.2 Mantém identidades independentes por placa no mesmo usuário', () => {
      saveAssistantIdentity({ name: 'Luna', wakeWord: 'luna', style: 'OBJETIVO' }, 'PLACA_A')
      saveAssistantIdentity({ name: 'Jarvis', wakeWord: 'jarvis', style: 'TECNICO' }, 'PLACA_B')

      const idA = loadAssistantIdentity('PLACA_A')
      const idB = loadAssistantIdentity('PLACA_B')

      expect(idA.name).toBe('Luna')
      expect(idA.style).toBe('OBJETIVO')

      expect(idB.name).toBe('Jarvis')
      expect(idB.style).toBe('TECNICO')
    })

    it('6.3 Mantém isolamento multitenant entre oficinas e usuários distintos', () => {
      // Simula Usuário 1 da Oficina Alfa
      pb.authStore.save('token_1', {
        id: 'usr_danilo',
        workshop_id: 'ws_alfa',
      } as any)
      saveAssistantIdentity({ name: 'Sofia', wakeWord: 'sofia' }, 'ECO2020')

      // Simula Usuário 2 da Oficina Beta com o mesmo carro/placa
      pb.authStore.save('token_2', {
        id: 'usr_mecanico_beta',
        workshop_id: 'ws_beta',
      } as any)
      const idBeta = loadAssistantIdentity('ECO2020')
      // Oficina Beta não deve enxergar a customização da Oficina Alfa
      expect(idBeta.isCustomized).toBe(false)
      expect(idBeta.name).toBe('Nina') // Padrão
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 7: Vozes Reais e Independência do Nome/Estilo
  // -------------------------------------------------------------
  describe('Requisito 7: Seleção de Vozes Reais', () => {
    it('7.1 A escolha de voz é independente do nome da assistente e do estilo', () => {
      const custom = saveAssistantIdentity(
        {
          name: 'Apollo',
          wakeWord: 'apollo',
          style: 'TECNICO',
          selectedVoiceUri: 'Google Português do Brasil',
        },
        'TEST_VOICE',
      )

      expect(custom.name).toBe('Apollo')
      expect(custom.style).toBe('TECNICO')
      expect(custom.selectedVoiceUri).toBe('Google Português do Brasil')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 8: Preservação Integral dos Boletins E6.1
  // -------------------------------------------------------------
  describe('Requisito 8: Preservação Integral dos Boletins E6.1', () => {
    const mockContext: CopilotContext = {
      vehicleName: 'Ford EcoSport 2020',
      vehiclePlate: 'BRA2E19',
      connectionStatus: 'CONECTADO',
      transportType: 'BLE',
      drivingContext: 'VELOCIDADE_ESTABILIZADA',
      speedKmh: 90,
      rpm: 2100,
      coolantTemp: 89,
      batteryVoltage: 14.1,
      activeDtcs: [],
      milOn: false,
      safetyLevel: 'NORMAL',
      activeAlerts: [],
      isTripActive: true,
      tripTitle: 'Viagem Serra da Mantiqueira',
    }

    it('8.1 Boletim periódico utiliza o nome dinâmico configurado (ex: Luna)', () => {
      const bulletinService = new AssistantPeriodicBulletinService('BRA2E19', undefined, {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'OBJETIVO',
        isCustomized: true,
      })

      const bulletin = bulletinService.generateBulletin({
        copilotContext: mockContext,
        supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
        hasSufficientBaseline: true,
      })

      expect(bulletin.text).toContain('Luna')
      expect(bulletin.text).not.toContain('Boletim Nina')
    })

    it('8.2 Níveis de detalhe (Resumido / Normal / Detalhado) continuam preservados', () => {
      const service = new AssistantPeriodicBulletinService('BRA2E19')

      // Normal
      service.updateConfig({ detailLevel: 'NORMAL' })
      const bNormal = service.generateBulletin({
        copilotContext: mockContext,
        supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
        hasSufficientBaseline: true,
      })
      expect(bNormal.detailLevel).toBe('NORMAL')

      // Resumido
      service.updateConfig({ detailLevel: 'RESUMIDO' })
      const bResumido = service.generateBulletin({
        copilotContext: mockContext,
        supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
        hasSufficientBaseline: true,
      })
      expect(bResumido.detailLevel).toBe('RESUMIDO')
      expect(bResumido.text.length).toBeLessThan(bNormal.text.length)

      // Detalhado
      service.updateConfig({ detailLevel: 'DETALHADO' })
      const bDetalhado = service.generateBulletin({
        copilotContext: mockContext,
        supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
        hasSufficientBaseline: true,
      })
      expect(bDetalhado.detailLevel).toBe('DETALHADO')
    })

    it('8.3 Regra de linguagem segura: explicita quando PID for indisponível e nunca inventa', () => {
      const service = new AssistantPeriodicBulletinService('BRA2E19')
      service.updateConfig({ detailLevel: 'NORMAL' })

      // Simulando falta de sensor de temperatura (PID 0x05 indisponível)
      const bulletinNoTemp = service.generateBulletin({
        copilotContext: { ...mockContext, coolantTemp: undefined },
        supportedPids: ['0x0C', '0x0D', '0x42'], // Sem 0x05
        hasSufficientBaseline: false,
      })

      expect(bulletinNoTemp.text).toContain(
        'Temperatura do motor: esse dado não está disponível neste veículo ou conexão',
      )
      expect(bulletinNoTemp.text).toContain('Baseline individual ainda em fase de aprendizado')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 5 & 9: Camada Crítica 100% Independente da Assistente
  // -------------------------------------------------------------
  describe('Camada Crítica e Regressão: Alertas Críticos Independentes da Assistente', () => {
    it('9.1 VehicleSafetyMonitor opera determinístico mesmo sem instância de assistente', () => {
      const safetyMonitor = new VehicleSafetyMonitor()

      // Temperatura de superaquecimento crítico
      const res = safetyMonitor.evaluateSafety({
        coolantTemp: 116,
        batteryVoltage: 13.8,
        rpm: 3200,
        speed: 80,
        milOn: true,
        dtcCodes: ['P0217'],
        communicationState: 'CONECTADO',
      })

      expect(res.overallLevel).toBe('CRITICO')
      expect(res.alerts.length).toBeGreaterThan(0)
      expect(res.alerts[0].source).toBe('TEMPERATURA')
      expect(res.alerts[0].recommendedAction).toContain('estacione')
    })

    it('9.2 Trocar a identidade da assistente jamais altera ou bloqueia alertas de segurança', () => {
      const safetyMonitor = new VehicleSafetyMonitor()
      const service = new AssistantCopilotService('TEST_SAFETY', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'OBJETIVO',
        isCustomized: true,
      })

      // Alerta de sub-tensão crítica
      const evaluation = safetyMonitor.evaluateSafety({
        coolantTemp: 90,
        batteryVoltage: 10.5,
        communicationState: 'CONECTADO',
      })

      expect(evaluation.overallLevel).toBe('CRITICO')
      expect(evaluation.alerts[0].source).toBe('TENSAO')

      // Troca identidade em runtime
      service.setIdentity({
        name: 'Zeus',
        wakeWord: 'zeus',
        style: 'TECNICO',
        isCustomized: true,
      })

      // Segurança permanece idêntica e intacta
      const reEvaluation = safetyMonitor.evaluateSafety({
        coolantTemp: 90,
        batteryVoltage: 10.5,
        communicationState: 'CONECTADO',
      })
      expect(reEvaluation.overallLevel).toBe('CRITICO')
    })

    it('9.3 Estilos de resposta (Objetivo / Amigável / Técnico) produzem saídas adequadas', async () => {
      const asstObjetivo = new AssistantCopilotService('CAR1', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'OBJETIVO',
        isCustomized: true,
      })
      const asstAmigavel = new AssistantCopilotService('CAR1', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'AMIGAVEL',
        isCustomized: true,
      })
      const asstTecnico = new AssistantCopilotService('CAR1', {
        name: 'Luna',
        wakeWord: 'luna',
        style: 'TECNICO',
        isCustomized: true,
      })

      const ctx: CopilotContext = {
        vehicleName: 'EcoSport',
        vehiclePlate: 'BRA2E19',
        connectionStatus: 'CONECTADO',
        transportType: 'BLE',
        drivingContext: 'VELOCIDADE_ESTABILIZADA',
        speedKmh: 90,
        coolantTemp: 88,
        activeDtcs: [],
        milOn: false,
        safetyLevel: 'NORMAL',
        activeAlerts: [],
        isTripActive: false,
      }

      const rObj = await asstObjetivo.sendMessage('como está o carro?', ctx)
      const rAmi = await asstAmigavel.sendMessage('como está o carro?', ctx)
      const rTec = await asstTecnico.sendMessage('como está o carro?', ctx)

      expect(rObj.content).toContain('Carro normal')
      expect(rAmi.content).toContain('Tudo funcionando normalmente')
      expect(rTec.content).toContain('Parâmetros nominais')
    })
  })
})
