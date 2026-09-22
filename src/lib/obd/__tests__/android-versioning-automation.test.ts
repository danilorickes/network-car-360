import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_VERSION } from '@/lib/version'

describe('Validação de Versionamento Automático e Consistência de Build (v0.0.45+)', () => {
  const root = process.cwd()
  const pkgPath = resolve(root, 'package.json')
  const gradlePath = resolve(root, 'android/app/build.gradle')
  const workflowPath = resolve(root, '.github/workflows/build-android-apk.yml')
  const syncScriptPath = resolve(root, 'scripts/sync-android-version.mjs')

  it('1. Constante APP_VERSION em src/lib/version.ts deve bater exatamente com package.json', () => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe('0.0.45')
  })

  it('2. android/app/build.gradle deve ter versionName e versionCode correspondentes', () => {
    const gradle = readFileSync(gradlePath, 'utf-8')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    expect(gradle).toContain(`versionName "${pkg.version}"`)
    expect(gradle).toMatch(/versionCode\s+45/)
  })

  it('3. Script sync-android-version.mjs deve existir e atualizar build.gradle corretamente', () => {
    expect(existsSync(syncScriptPath)).toBe(true)
    const scriptContent = readFileSync(syncScriptPath, 'utf-8')
    expect(scriptContent).toContain('syncAndroidVersion')
    expect(scriptContent).toContain('versionCode')
    expect(scriptContent).toContain('versionName')
  })

  it('4. Workflow do GitHub Actions deve automatizar sincronização e renomear artefato com versão', () => {
    expect(existsSync(workflowPath)).toBe(true)
    const workflow = readFileSync(workflowPath, 'utf-8')

    // Deve extrair versão do app
    expect(workflow).toContain('node -p "require(\'./package.json\').version"')
    // Deve rodar o script de sincronização de versão
    expect(workflow).toContain('node scripts/sync-android-version.mjs')
    // Deve nomear o artefato com a versão
    expect(workflow).toContain(
      'network-car-homologacao-apk-v${{ steps.app_version.outputs.VERSION }}',
    )
    // Deve renomear o arquivo APK com a versão
    expect(workflow).toContain('NetworkCar-v${VERSION}-homologacao.apk')
  })
})
