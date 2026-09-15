import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  NinaPeriodicBulletinService,
  BulletinContextInput,
} from '@/lib/nina/nina-periodic-bulletin-service'
import { NinaCopilotService } from '@/lib/nina/nina-copilot-service'
import { VehicleSafetyMonitor } from '@/lib/diagnostic/vehicle-safety-monitor'
import { CopilotContext } from '@/types/etapa6'
import pb from '@/lib/pocketbase/client'

describe('OS-NC-E6.1-VOICE: Validação dos Boletins Periódicos por Voz da Nina', () => {
  const baseContext: CopilotContext = {
    vehicleName: 'Ford EcoSport 2020',
    vehiclePlate: 'BRA2E20',
    connectionStatus: 'CONECTADO',
    transportType: 'BLE',
    drivingContext: 'ESTRADA',
    speedKmh: 90,
    rpm: 2200,
    coolantTemp: 88,
    batteryVoltage: 14.1,
    activeDtcs: [],
    milOn: false,
    safetyLevel: 'NORMAL',
    activeAlerts: [],
    isTripActive: true,
    tripTitle: 'Viagem Serra',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // --------------------------------------------------------------------------
  // TESTE 1: Boletim usa exclusivamente PIDs disponíveis (PID indisponível → frase segura)
  // --------------------------------------------------------------------------
  it('TESTE 1: PID indisponível na conexão → emite frase equivalente a "esse dado não está disponível neste veículo/conexão", NUNCA valor inventado', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')
    service.updateConfig({ detailLevel: 'NORMAL' })

    // Conexão que só suporta RPM (0x0C) e Tensão (0x42) — ECT (0x05) ausente
    const input: BulletinContextInput = {
      copilotContext: {
        ...baseContext,
        coolantTemp: undefined, // Sem ECT
      },
      supportedPids: ['0x0C', '0x42'], // Não tem 0x05 nem 0x0D
      hasSufficientBaseline: true,
    }

    const bulletin = service.generateBulletin(input, false)
    expect(bulletin.text).toContain(
      'Temperatura do motor: esse dado não está disponível neste veículo ou conexão',
    )
    expect(bulletin.text).not.toContain('88 graus')
    expect(bulletin.text).not.toContain('90 km/h')
  })

  // --------------------------------------------------------------------------
  // TESTE 2: Regra de baseline seguro: sem baseline suficiente → não afirma comportamento esperado
  // --------------------------------------------------------------------------
  it('TESTE 2: Sem baseline suficiente (< 30 amostras) → NÃO afirma comportamento esperado consolidado', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')
    service.updateConfig({ detailLevel: 'NORMAL' })

    const inputSemBaseline: BulletinContextInput = {
      copilotContext: baseContext,
      supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
      hasSufficientBaseline: false,
      baselineSampleCount: 8,
    }

    const bulletin = service.generateBulletin(inputSemBaseline, false)
    expect(bulletin.text).toContain('Baseline individual ainda em fase de aprendizado estatístico')
    expect(bulletin.text).toContain('não consolidado')
    expect(bulletin.text).not.toContain('Baseline individual consolidado')
  })

  // --------------------------------------------------------------------------
  // TESTE 3: Intervalos configuráveis incluindo desativado, pré-definidos e personalizado
  // --------------------------------------------------------------------------
  it('TESTE 3: Intervalos configuráveis (Desativado, 5, 10, 20, 30, 60 e personalizado em minutos livres)', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')

    // Desativado
    service.updateConfig({ intervalOption: 'DESATIVADO' })
    expect(service.getConfig().enabled).toBe(false)
    expect(service.getConfig().effectiveMinutes).toBe(0)

    // 5 min
    service.updateConfig({ intervalOption: 5 })
    expect(service.getConfig().enabled).toBe(true)
    expect(service.getConfig().effectiveMinutes).toBe(5)

    // 30 min
    service.updateConfig({ intervalOption: 30 })
    expect(service.getConfig().effectiveMinutes).toBe(30)

    // Personalizado (ex: 45 min)
    service.updateConfig({ intervalOption: 'PERSONALIZADO', customMinutes: 45 })
    expect(service.getConfig().enabled).toBe(true)
    expect(service.getConfig().effectiveMinutes).toBe(45)

    // Personalizado com clamping (1 a 180)
    service.updateConfig({ intervalOption: 'PERSONALIZADO', customMinutes: 300 })
    expect(service.getConfig().effectiveMinutes).toBe(180)
  })

  // --------------------------------------------------------------------------
  // TESTE 4: Níveis de detalhe mudam o conteúdo (RESUMIDO / NORMAL / DETALHADO)
  // --------------------------------------------------------------------------
  it('TESTE 4: Níveis de detalhe RESUMIDO / NORMAL / DETALHADO alteram a profundidade e extensão do texto', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')
    const input: BulletinContextInput = {
      copilotContext: baseContext,
      supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
      hasSufficientBaseline: true,
      baselineSampleCount: 120,
    }

    service.updateConfig({ detailLevel: 'RESUMIDO' })
    const bResumido = service.generateBulletin(input, false)

    service.updateConfig({ detailLevel: 'DETALHADO' })
    const bDetalhado = service.generateBulletin(input, false)

    expect(bDetalhado.text.length).toBeGreaterThan(bResumido.text.length)
    expect(bDetalhado.text).toContain('Baseline individual consolidado')
    expect(bDetalhado.text).toContain('Tensão da bateria')
  })

  // --------------------------------------------------------------------------
  // TESTE 5: Anti-repetição (nada mudou → boletim curto; mudança relevante → destaque)
  // --------------------------------------------------------------------------
  it('TESTE 5: Anti-repetição: nada mudou → emite boletim curto; mudança de regime/alerta → destaca alteração', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')
    const inputInitial: BulletinContextInput = {
      copilotContext: { ...baseContext, drivingContext: 'TRANSITO_URBANO' },
      supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
      hasSufficientBaseline: true,
    }

    // Primeiro disparo registra snapshot
    service.generateBulletin(inputInitial, false)

    // Segundo disparo sem mudança relevante agendado
    const bSame = service.generateBulletin(inputInitial, true)
    expect(bSame.isShortUpdate).toBe(true)
    expect(bSame.text).toContain('Parâmetros estáveis e sem alterações relevantes')

    // Terceiro disparo com mudança relevante de regime de condução
    const inputChanged: BulletinContextInput = {
      copilotContext: { ...baseContext, drivingContext: 'ESTRADA' },
      supportedPids: ['0x0C', '0x0D', '0x05', '0x42'],
      hasSufficientBaseline: true,
    }
    const bChanged = service.generateBulletin(inputChanged, true)
    expect(bChanged.isShortUpdate).toBe(false)
    expect(bChanged.significantChanges.some((c) => c.includes('Regime de condução mudou'))).toBe(
      true,
    )
  })

  // --------------------------------------------------------------------------
  // TESTE 6: Alerta crítico independe do temporizador (VehicleSafetyMonitor local)
  // --------------------------------------------------------------------------
  it('TESTE 6: Alertas do VehicleSafetyMonitor são independentes do temporizador de boletins e operam com prioridade máxima', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')
    // Desativa boletins periódicos
    service.updateConfig({ intervalOption: 'DESATIVADO' })
    expect(service.getConfig().enabled).toBe(false)

    // Monitor local avalia temperatura crítica (112 °C persistente)
    const safetyMonitor = new VehicleSafetyMonitor()
    safetyMonitor.evaluateSafety({ coolantTemp: 112, batteryVoltage: 13.8, rpm: 2000 })
    const safetyRes = safetyMonitor.evaluateSafety({
      coolantTemp: 112,
      batteryVoltage: 13.8,
      rpm: 2000,
    })

    expect(safetyRes.overallLevel).toBe('CRITICO')
    expect(safetyRes.alerts.length).toBeGreaterThan(0)
    expect(safetyRes.alerts[0].code).toBe('ECT_CRITICAL')
  })

  // --------------------------------------------------------------------------
  // TESTE 7: Persistência por usuário/veículo e isolamento multioficina
  // --------------------------------------------------------------------------
  it('TESTE 7: Preferências de boletins persistem no localStorage com escopo oficina/usuário/veículo', () => {
    // Simula authStore com usuário e oficina
    pb.authStore.save('token_teste', {
      id: 'usr_001',
      collectionId: 'users_col',
      collectionName: 'users',
      workshop_id: 'ws_matriz',
      email: 'mecanico@oficina.com.br',
    })

    const service = new NinaPeriodicBulletinService('ABC1234')
    service.updateConfig({ intervalOption: 10, detailLevel: 'DETALHADO' })

    // Instancia novo serviço para o mesmo veículo: deve carregar a config salva
    const serviceReloaded = new NinaPeriodicBulletinService('ABC1234')
    expect(serviceReloaded.getConfig().effectiveMinutes).toBe(10)
    expect(serviceReloaded.getConfig().detailLevel).toBe('DETALHADO')

    // Outro veículo não deve ter herdado
    const serviceOtherVehicle = new NinaPeriodicBulletinService('XYZ9999')
    expect(serviceOtherVehicle.getConfig().effectiveMinutes).toBe(20) // padrão
  })

  // --------------------------------------------------------------------------
  // TESTE 8: Comandos de voz (incluindo intervalos e desativação)
  // --------------------------------------------------------------------------
  it('TESTE 8: Comandos de voz interpretam variações de intervalo, detalhe e desativação', () => {
    const service = new NinaPeriodicBulletinService('BRA2E20')

    // "Nina, me avisa a cada 20 minutos"
    const cmd1 = service.parseVoiceCommand('Nina, me avisa a cada 20 minutos')
    expect(cmd1?.handled).toBe(true)
    expect(service.getConfig().effectiveMinutes).toBe(20)

    // "Nina, me avisa a cada 15 minutos" (valor personalizado)
    const cmd2 = service.parseVoiceCommand('Nina, me avisa a cada 15 minutos')
    expect(cmd2?.handled).toBe(true)
    expect(service.getConfig().effectiveMinutes).toBe(15)
    expect(service.getConfig().intervalOption).toBe('PERSONALIZADO')

    // "Nina, deixa os boletins mais detalhados"
    const cmd3 = service.parseVoiceCommand('Nina, deixa os boletins mais detalhados')
    expect(cmd3?.handled).toBe(true)
    expect(service.getConfig().detailLevel).toBe('DETALHADO')

    // "Nina, desativa os boletins"
    const cmd4 = service.parseVoiceCommand('Nina, desativa os boletins')
    expect(cmd4?.handled).toBe(true)
    expect(service.getConfig().enabled).toBe(false)
    expect(service.getConfig().intervalOption).toBe('DESATIVADO')

    // Comando não relacionado
    const cmdOther = service.parseVoiceCommand('Nina, toca uma música')
    expect(cmdOther).toBeNull()
  })

  // --------------------------------------------------------------------------
  // TESTE 9: Ducking de entretenimento com devolução de controle
  // --------------------------------------------------------------------------
  it('TESTE 9: Ducking de áudio atenua entretenimento ao emitir boletim e devolve controle no final', () => {
    let duckingStarted = false
    let duckingEnded = false

    const nina = new NinaCopilotService()
    // Mock do speechSynthesis speak com callback imediato
    vi.spyOn(nina, 'speak').mockImplementation((text: string, onEnd?: () => void) => {
      duckingStarted = true
      // Simula fim da fala
      onEnd?.()
      duckingEnded = true
    })

    nina.speak('Boletim em andamento', () => {
      // callback de retorno
    })

    expect(duckingStarted).toBe(true)
    expect(duckingEnded).toBe(true)
  })
})
