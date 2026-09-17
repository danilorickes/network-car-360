import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

describe('Validação de Recursos e Ícones Android E6.6.1 (minSdk 24 & API 26+)', () => {
  const resDir = join(process.cwd(), 'android', 'app', 'src', 'main', 'res')
  const manifestPath = join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  const buildGradlePath = join(process.cwd(), 'android', 'app', 'build.gradle')

  it('garante que o AndroidManifest referencia @mipmap/ic_launcher e @mipmap/ic_launcher_round', () => {
    expect(existsSync(manifestPath)).toBe(true)
    const manifestContent = readFileSync(manifestPath, 'utf-8')
    expect(manifestContent).toContain('android:icon="@mipmap/ic_launcher"')
    expect(manifestContent).toContain('android:roundIcon="@mipmap/ic_launcher_round"')
  })

  it('garante que build.gradle define minSdk 24 e compileSdk 34', () => {
    expect(existsSync(buildGradlePath)).toBe(true)
    const gradleContent = readFileSync(buildGradlePath, 'utf-8')
    expect(gradleContent).toMatch(/minSdk\s+24/)
    expect(gradleContent).toMatch(/compileSdk\s+34/)
  })

  it('garante a existência dos Adaptive Icons XML para Android 8.0+ (API 26+)', () => {
    const anydpiDir = join(resDir, 'mipmap-anydpi-v26')
    const launcherXml = join(anydpiDir, 'ic_launcher.xml')
    const roundLauncherXml = join(anydpiDir, 'ic_launcher_round.xml')
    const bgXml = join(resDir, 'values', 'ic_launcher_background.xml')

    expect(existsSync(launcherXml)).toBe(true)
    expect(existsSync(roundLauncherXml)).toBe(true)
    expect(existsSync(bgXml)).toBe(true)

    const launcherContent = readFileSync(launcherXml, 'utf-8')
    const roundContent = readFileSync(roundLauncherXml, 'utf-8')
    const bgContent = readFileSync(bgXml, 'utf-8')

    expect(launcherContent).toContain('<adaptive-icon')
    expect(launcherContent).toContain('android:drawable="@color/ic_launcher_background"')
    expect(launcherContent).toContain('android:drawable="@mipmap/ic_launcher_foreground"')

    expect(roundContent).toContain('<adaptive-icon')
    expect(roundContent).toContain('android:drawable="@color/ic_launcher_background"')
    expect(roundContent).toContain('android:drawable="@mipmap/ic_launcher_foreground"')

    expect(bgContent).toContain('<color name="ic_launcher_background">#0B0F14</color>')
  })

  it('garante fallbacks legacy PNG válidos para todas as densidades (API 24/25 e compatibilidade universal)', () => {
    const densities = [
      { name: 'mipmap-mdpi', minBytes: 100 },
      { name: 'mipmap-hdpi', minBytes: 150 },
      { name: 'mipmap-xhdpi', minBytes: 200 },
      { name: 'mipmap-xxhdpi', minBytes: 300 },
      { name: 'mipmap-xxxhdpi', minBytes: 400 },
    ]

    const expectedFiles = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']

    for (const density of densities) {
      const dirPath = join(resDir, density.name)
      expect(existsSync(dirPath)).toBe(true)

      for (const file of expectedFiles) {
        const filePath = join(dirPath, file)
        expect(existsSync(filePath)).toBe(true)

        // Verificar assinatura PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        const buffer = readFileSync(filePath)
        expect(buffer.length).toBeGreaterThan(density.minBytes)
        expect(buffer[0]).toBe(0x89)
        expect(buffer[1]).toBe(0x50) // 'P'
        expect(buffer[2]).toBe(0x4e) // 'N'
        expect(buffer[3]).toBe(0x47) // 'G'
        expect(buffer[4]).toBe(0x0d)
        expect(buffer[5]).toBe(0x0a)
        expect(buffer[6]).toBe(0x1a)
        expect(buffer[7]).toBe(0x0a)
      }
    }
  })

  it('garante que o script gerador de ícones está referenciado no package.json (prebuild e generate:icons)', () => {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts.prebuild).toBe('node scripts/generate-android-icons.mjs')
    expect(pkg.scripts['generate:icons']).toBe('node scripts/generate-android-icons.mjs')
  })
})
