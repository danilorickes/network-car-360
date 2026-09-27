import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Keystore fixo e estável para builds de homologação/debug do Network Car.
 * Permite que atualizações de APK no dispositivo sejam instaladas diretamente
 * sobre a versão existente sem erro de conflito de assinatura de pacote ("INSTALL_FAILED_UPDATE_INCOMPATIBLE").
 *
 * Configurações padrão:
 * - Alias: androiddebugkey
 * - Store Password: password: "android"
 * - Key Password: "android"
 * - Keystore format: JKS / PKCS12 compatível com o plugin de build do Android
 *
 * Nota: Este keystore é de uso restrito para o ambiente de HOMOLOGAÇÃO e DEBUG.
 * Nenhuma chave de produção para Google Play Store deve ser gravada aqui.
 */

// Keystore estável gerado com parâmetros padrão Android debug (JKS):
// Alias: androiddebugkey / Pass: android
// CN=Android Debug, O=Android, C=US
// Validade até 2052
const FIXED_DEBUG_KEYSTORE_BASE64 = [
  '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',
].join('')

export function ensureFixedKeystore(targetPath) {
  const root = process.cwd()
  const dest = targetPath || resolve(root, 'android/keystore/debug.keystore')

  const buf = Buffer.from(FIXED_DEBUG_KEYSTORE_BASE64, 'base64')
  writeFileSync(dest, buf)
  console.log(`[ensure-keystore] Keystore fixo gerado/garantido em: ${dest} (${buf.length} bytes)`)
  return dest
}

// Execução CLI direta se chamado como script
if (process.argv[1]?.endsWith('ensure-fixed-keystore.mjs')) {
  ensureFixedKeystore()
}
