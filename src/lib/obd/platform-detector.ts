export interface PlatformCapabilities {
  isAndroid: boolean
  isIOS: boolean
  isWindows: boolean
  isMacOS: boolean
  isLinux: boolean
  hasWebSerial: boolean
  hasWebBluetooth: boolean
  recommendedTransport: 'SIMULADOR' | 'OBD REAL SERIAL' | 'OBD REAL BLUETOOTH'
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

  let recommendedTransport: 'SIMULADOR' | 'OBD REAL SERIAL' | 'OBD REAL BLUETOOTH' = 'SIMULADOR'
  let guidanceText = ''

  const chromeMatch = userAgent.match(/chrome\/(\d+)/i)
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1], 10) : null

  if (isAndroid) {
    if (hasWebSerial && chromeVersion !== null && chromeVersion >= 138) {
      recommendedTransport = 'OBD REAL BLUETOOTH'
      guidanceText = `Chrome Android ${chromeVersion} detectado: Suporte direto a ELM327 Bluetooth Classic via Web Serial RFCOMM (SPP UUID 00001101). Pareie nas configurações do Android e selecione o dispositivo no assistente.`
    } else if (hasWebSerial) {
      recommendedTransport = 'OBD REAL SERIAL'
      guidanceText =
        'Ambiente Android com Web Serial detectado. Para adaptadores Bluetooth Classic SPP no Android, o Chrome 138+ oferece suporte nativo RFCOMM; em versões anteriores utilize cabo USB-OTG ou a ponte nativa Android.'
    } else if (hasWebBluetooth) {
      recommendedTransport = 'OBD REAL BLUETOOTH'
      guidanceText =
        'Ambiente Android detectado: Web Bluetooth (GATT/BLE) ativo. Para adaptador Bluetooth Classic SPP (v1.5/v2.1), utilize Chrome 138+ com RFCOMM ou a ponte nativa Android.'
    } else {
      recommendedTransport = 'SIMULADOR'
      guidanceText =
        'Ambiente Android sem suporte a portas seriais no navegador. Utilize Chrome 138+ ou o aplicativo nativo Android.'
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
    recommendedTransport,
    guidanceText,
  }
}
