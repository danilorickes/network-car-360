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
      guidanceText = `Chrome Android ${chromeVersion} detectado: Suporte nativo a ELM327 Bluetooth Classic via Web Serial RFCOMM (SPP 00001101). Dispositivo "OBDII" pareado no Android será listado no seletor.`
    } else if (hasWebSerial) {
      guidanceText = `Chrome Android ${chromeVersion || 'atual'} detectado. No Android, o seletor Web Serial para dispositivos Bluetooth Classic SPP ("OBDII") exige Chrome 138+ (flag BluetoothRfcommAndroid) ou APK wrapper nativo (window.AndroidOBD). Se o seletor informar "Nenhum dispositivo compatível encontrado", atualize o Chrome para v138+ ou instale o APK.`
    } else {
      guidanceText =
        'Ambiente Android detectado. Para Bluetooth Classic ELM327 ("OBDII"), utilize Google Chrome 138+ no Android ou o APK wrapper com ponte nativa.'
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
    recommendedTransport,
    guidanceText,
  }
}
