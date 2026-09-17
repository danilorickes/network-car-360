export interface PlatformCapabilities {
  isAndroid: boolean
  isIOS: boolean
  isWindows: boolean
  isMacOS: boolean
  isLinux: boolean
  hasWebSerial: boolean
  hasWebBluetooth: boolean
  chromeVersion: number | null
  canUseWebSerialRfcomm: boolean
  hasNativeBridge?: boolean
  recommendedTransport:
    | 'SIMULADOR'
    | 'OBD REAL SERIAL'
    | 'OBD REAL BLUETOOTH'
    | 'OBD REAL BLUETOOTH CLASSIC'
  guidanceText: string
}

export function detectPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isAndroid: false,
      isIOS: false,
      isWindows: false,
      isMacOS: false,
      isLinux: false,
      hasWebSerial: false,
      hasWebBluetooth: false,
      chromeVersion: null,
      canUseWebSerialRfcomm: false,
      recommendedTransport: 'SIMULADOR',
      guidanceText: 'Ambiente sem navegador identificado. Operando em modo simulador.',
    }
  }

  const userAgent = (navigator.userAgent || '').toLowerCase()
  const isAndroid = /android/i.test(userAgent)
  const isIOS = /iphone|ipad|ipod/i.test(userAgent)
  const isWindows = /windows/i.test(userAgent)
  const isMacOS = /macintosh|mac os x/i.test(userAgent) && !isIOS
  const isLinux = /linux/i.test(userAgent) && !isAndroid

  const hasWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator
  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const chromeMatch = userAgent.match(/chrome\/(\d+)/i)
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1], 10) : null
  const canUseWebSerialRfcomm =
    hasWebSerial && (isAndroid ? chromeVersion !== null && chromeVersion >= 138 : true)

  let recommendedTransport:
    | 'SIMULADOR'
    | 'OBD REAL SERIAL'
    | 'OBD REAL BLUETOOTH'
    | 'OBD REAL BLUETOOTH CLASSIC' = 'SIMULADOR'
  let guidanceText = ''

  if (isAndroid) {
    // No Android, Bluetooth Classic é a opção PRINCIPAL
    recommendedTransport = 'OBD REAL BLUETOOTH CLASSIC'
    if (canUseWebSerialRfcomm) {
      guidanceText = `Chrome Android ${chromeVersion} detectado: Web Serial ativa. Se o seletor nativo informar "Nenhum dispositivo compatível encontrado", consulte a ferramenta "Diag BT OBD" (/diagnostico-bluetooth). Pareamento no Android não garante elegibilidade no seletor Web Serial.`
    } else if (hasWebSerial) {
      guidanceText = `Chrome Android ${chromeVersion || 'atual'} detectado. Web Serial disponível. Se o adaptador Bluetooth Classic "OBDII" não aparecer no seletor nativo, utilize a ferramenta "Diag BT OBD" ou a ponte nativa Android.`
    } else {
      guidanceText =
        'Ambiente Android detectado. Para Bluetooth Classic ELM327 ("OBDII"), utilize Google Chrome com Web Serial ativa ou o APK wrapper com ponte nativa (Plano B).'
    }
  } else if (hasWebSerial) {
    recommendedTransport = 'OBD REAL SERIAL'
    guidanceText =
      'Desktop Chromium detectado (Chrome/Edge/Opera). Recomendado: Web Serial (USB ou porta serial Bluetooth virtual pareada no SO).'
  } else if (hasWebBluetooth) {
    recommendedTransport = 'OBD REAL BLUETOOTH'
    guidanceText = 'Navegador com suporte a Web Bluetooth detectado. Conexão BLE disponível.'
  } else {
    recommendedTransport = 'SIMULADOR'
    guidanceText =
      'Navegador sem suporte a Web Serial ou Web Bluetooth direto. Utilize Google Chrome / MS Edge ou teste com o Simulador veicular.'
  }

  return {
    isAndroid,
    isIOS,
    isWindows,
    isMacOS,
    isLinux,
    hasWebSerial,
    hasWebBluetooth,
    chromeVersion,
    canUseWebSerialRfcomm,
    hasNativeBridge:
      typeof window !== 'undefined' &&
      Boolean(
        (window as any).AndroidOBD ||
        (window as any).Capacitor?.Plugins?.AndroidOBD ||
        (window as any).Capacitor?.Plugins?.OBDPlugin,
      ),
    recommendedTransport,
    guidanceText,
  }
}
