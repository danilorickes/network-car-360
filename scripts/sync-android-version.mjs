import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Script utilitário para sincronizar versionName e versionCode do Android build.gradle
 * diretamente a partir do versionamento semver do package.json.
 *
 * Exemplo: version = "0.0.45"
 *   -> versionName = "0.0.45"
 *   -> versionCode = 45 (calculado a partir de major * 10000 + minor * 100 + patch, garantindo unicidade crescente)
 */
function syncAndroidVersion() {
  const root = process.cwd()
  const pkgPath = resolve(root, 'package.json')
  const gradlePath = resolve(root, 'android/app/build.gradle')

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const semver = pkg.version || '0.0.45'

  const parts = semver
    .split('-')[0]
    .split('.')
    .map((p) => parseInt(p, 10))
  const major = parts[0] || 0
  const minor = parts[1] || 0
  const patch = parts[2] || 0

  // versionCode numérico incremental: ex: 0.0.45 -> 45; 1.0.0 -> 10000
  const computedVersionCode = major * 10000 + minor * 100 + patch

  console.log(`[sync-android-version] Sincronizando versão a partir de package.json: ${semver}`)
  console.log(
    `[sync-android-version] versionName: "${semver}", versionCode: ${computedVersionCode}`,
  )

  let gradleContent = readFileSync(gradlePath, 'utf-8')

  const previousVersionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/)
  const previousVersionNameMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/)

  console.log(
    `[sync-android-version] Valores anteriores no build.gradle: versionCode=${previousVersionCodeMatch?.[1]}, versionName="${previousVersionNameMatch?.[1]}"`,
  )

  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${computedVersionCode}`)

  gradleContent = gradleContent.replace(/versionName\s+["'][^"']+["']/, `versionName "${semver}"`)

  writeFileSync(gradlePath, gradleContent, 'utf-8')
  console.log('[sync-android-version] android/app/build.gradle atualizado com sucesso!')
}

syncAndroidVersion()
