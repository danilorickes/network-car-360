import pb from '@/lib/pocketbase/client'

const STARTUP_PREF_PREFIX = 'nc_drive_startup_pref_'

/**
 * Retorna a chave isolada por oficina e usuário:
 * nc_drive_startup_pref_{workshopId}_{userId}
 */
export function getDriveStartupStorageKey(): string {
  const authUser = pb.authStore.model
  const workshopId = authUser?.workshop_id || 'ws_default'
  const userId = authUser?.id || 'anon'
  return `${STARTUP_PREF_PREFIX}${workshopId}_${userId}`
}

/**
 * Lê a preferência se o usuário optou por iniciar diretamente no Network Car Drive.
 */
export function getDriveStartupPreference(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const key = getDriveStartupStorageKey()
    const val = localStorage.getItem(key)
    return val === 'true'
  } catch {
    return false
  }
}

/**
 * Salva a preferência de inicialização direta no Network Car Drive.
 */
export function setDriveStartupPreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    const key = getDriveStartupStorageKey()
    localStorage.setItem(key, enabled ? 'true' : 'false')
  } catch {
    /* ignore storage error */
  }
}
