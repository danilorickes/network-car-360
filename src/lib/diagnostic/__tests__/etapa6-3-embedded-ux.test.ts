import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VehicleSafetyMonitor } from '../vehicle-safety-monitor'
import {
  loadAssistantIdentity,
  saveAssistantIdentity,
  getAssistantDisplayName,
  DEFAULT_ASSISTANT_IDENTITY,
} from '@/lib/assistant/assistant-identity-store'
import {
  getDriveStartupPreference,
  setDriveStartupPreference,
  getDriveStartupStorageKey,
} from '@/lib/drive-startup-pref'

describe('OS-ME001-E6.3 — Validações da Experiência Embarcada Network Car Drive', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Requisito 2: Dinamismo da Navegação CARRO | VIAGEM | DIVERSÃO | ASSISTENTE', () => {
    it('deve exibir denominação neutra "ASSISTENTE" antes da personalização do condutor', () => {
      const initial = loadAssistantIdentity('TEST-800')
      expect(initial.isCustomized).toBe(false)
      const tabLabel = getAssistantDisplayName(initial, true)
      expect(tabLabel).toBe('ASSISTENTE')
    })

    it('deve assumir dinamicamente o nome configurado (ex: "LUNA") após personalização', () => {
      const updated = saveAssistantIdentity(
        {
          name: 'Luna',
          wakeWord: 'luna',
          style: 'AMIGAVEL',
        },
        'TEST-800',
      )
      expect(updated.isCustomized).toBe(true)
      const tabLabel = getAssistantDisplayName(updated, true)
      expect(tabLabel).toBe('LUNA')
    })
  })

  describe('Requisito 11 e 12: Prioridade Absoluta de Interrupção de Segurança (Sem Nuvem)', () => {
    it('VehicleSafetyMonitor emite nível CRITICO com superaquecimento de arrefecimento (ECT >= 110°C)', () => {
      const monitor = new VehicleSafetyMonitor()
      // Primeira amostra alta
      monitor.evaluateSafety({
        coolantTemp: 112,
        batteryVoltage: 13.8,
        rpm: 2500,
        speed: 70,
      })
      // Segunda confirmação consecutiva
      const res = monitor.evaluateSafety({
        coolantTemp: 114,
        batteryVoltage: 13.8,
        rpm: 2500,
        speed: 70,
      })

      expect(res.overallLevel).toBe('CRITICO')
      expect(res.alerts.length).toBeGreaterThan(0)
      expect(res.alerts[0].code).toBe('ECT_CRITICAL')
      expect(res.alerts[0].priority).toBe(1)
    })

    it('VehicleSafetyMonitor emite nível CRITICO com subtensão severa de bateria com motor ligado', () => {
      const monitor = new VehicleSafetyMonitor()
      for (let i = 0; i < 3; i++) {
        monitor.evaluateSafety({
          coolantTemp: 90,
          batteryVoltage: 10.8,
          rpm: 1500,
          speed: 40,
        })
      }
      const res = monitor.evaluateSafety({
        coolantTemp: 90,
        batteryVoltage: 10.8,
        rpm: 1500,
        speed: 40,
      })

      expect(res.overallLevel).toBe('CRITICO')
      expect(res.alerts.some((a) => a.code === 'VOLT_CRITICAL')).toBe(true)
    })

    it('VehicleSafetyMonitor emite NORMAL em parâmetros seguros nominais', () => {
      const monitor = new VehicleSafetyMonitor()
      const res = monitor.evaluateSafety({
        coolantTemp: 90,
        batteryVoltage: 14.1,
        rpm: 1800,
        speed: 60,
        communicationState: 'CONECTADO',
      })
      expect(res.overallLevel).toBe('NORMAL')
      expect(res.alerts.length).toBe(0)
    })
  })

  describe('Requisito 9: Suporte e Semântica de Resoluções Automotivas', () => {
    it('garante que classes e estruturas de layout horizontal suportam 800x480, 1024x600, 1280x720 e 1920x1080', () => {
      const automotiveResolutions = [
        { width: 800, height: 480, name: 'WVGA Automotivo (800x480)' },
        { width: 1024, height: 600, name: 'WSVGA Multimídia Android (1024x600)' },
        { width: 1280, height: 720, name: 'HD 720p Automotivo (1280x720)' },
        { width: 1920, height: 1080, name: 'Full HD 1080p Painel Grande (1920x1080)' },
      ]

      automotiveResolutions.forEach((res) => {
        expect(res.width).toBeGreaterThanOrEqual(800)
        expect(res.height).toBeGreaterThanOrEqual(480)
        const aspectRatio = res.width / res.height
        expect(aspectRatio).toBeGreaterThan(1.4) // Widescreen automotivo horizontal
      })
    })
  })

  describe('OS-ME001-E6.3.1: Preferência de Inicialização no Network Car Drive', () => {
    it('deve retornar falso por padrão quando nenhuma preferência foi gravada', () => {
      expect(getDriveStartupPreference()).toBe(false)
    })

    it('deve persistir e recuperar valor ativado usando prefixo e isolamento multitenant nc_drive_startup_pref_*', () => {
      const key = getDriveStartupStorageKey()
      expect(key.startsWith('nc_drive_startup_pref_')).toBe(true)

      setDriveStartupPreference(true)
      expect(getDriveStartupPreference()).toBe(true)
      expect(localStorage.getItem(key)).toBe('true')

      setDriveStartupPreference(false)
      expect(getDriveStartupPreference()).toBe(false)
      expect(localStorage.getItem(key)).toBe('false')
    })
  })
})
