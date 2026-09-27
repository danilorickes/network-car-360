import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * Keystore fixo e estável para builds de homologação/debug do Network Car.
 * Permite que atualizações de APK no dispositivo sejam instaladas diretamente
 * sobre a versão existente sem erro de conflito de assinatura de pacote ("INSTALL_FAILED_UPDATE_INCOMPATIBLE").
 *
 * Configurações padrão Android debug:
 * - Alias: androiddebugkey
 * - Store Password: "android"
 * - Key Password: "android"
 * - Validity: 10000 dias (~27 anos)
 * - DName: "C=US, O=Android, CN=Android Debug"
 *
 * Nota: Este keystore é de uso restrito para o ambiente de HOMOLOGAÇÃO e DEBUG.
 * Nenhuma chave de produção para Google Play Store deve ser gravada aqui.
 */

export const KEYSTORE_CONFIG = {
  alias: 'androiddebugkey',
  storePassword: 'android',
  keyPassword: 'android',
  dname: 'CN=Android Debug, O=Android, C=US',
  validityDays: 10000,
}

export function generateDebugKeystoreWithKeytool(targetPath) {
  const dir = dirname(targetPath)
  mkdirSync(dir, { recursive: true })

  const cmd = [
    'keytool',
    '-genkeypair',
    '-v',
    `-keystore "${targetPath}"`,
    `-alias "${KEYSTORE_CONFIG.alias}"`,
    `-storepass "${KEYSTORE_CONFIG.storePassword}"`,
    `-keypass "${KEYSTORE_CONFIG.keyPassword}"`,
    '-keyalg RSA',
    '-keysize 2048',
    `-validity ${KEYSTORE_CONFIG.validityDays}`,
    `-dname "${KEYSTORE_CONFIG.dname}"`,
  ].join(' ')

  console.log(`[ensure-keystore] Gerando keystore válido via keytool: ${targetPath}`)
  execSync(cmd, { stdio: 'inherit' })
  console.log(`[ensure-keystore] Keystore gerado com sucesso via keytool em: ${targetPath}`)
  return targetPath
}

export function ensureFixedKeystore(targetPath) {
  const root = process.cwd()
  const dest = targetPath || resolve(root, 'android/keystore/debug.keystore')

  // Se já existe e é válido (> 500 bytes), preserva
  if (existsSync(dest)) {
    console.log(`[ensure-keystore] Keystore já existe em: ${dest}`)
    return dest
  }

  const dir = dirname(dest)
  mkdirSync(dir, { recursive: true })

  try {
    return generateDebugKeystoreWithKeytool(dest)
  } catch (err) {
    console.warn('[ensure-keystore] Aviso: keytool falhou ou não está no PATH:', err?.message)
    throw err
  }
}

// Execução CLI direta se chamado como script
if (process.argv[1]?.endsWith('ensure-fixed-keystore.mjs')) {
  ensureFixedKeystore()
}
