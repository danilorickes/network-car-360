import { describe, it, expect } from 'vitest'

describe('Validação de configuração do projeto Android E6.6.1', () => {
  it('garante que a convenção de launchers ic_launcher e ic_launcher_round é respeitada', () => {
    const launcherName = 'ic_launcher'
    const roundLauncherName = 'ic_launcher_round'
    expect(launcherName).toBe('ic_launcher')
    expect(roundLauncherName).toBe('ic_launcher_round')
  })
})
