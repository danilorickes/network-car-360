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

  if (isAndroid) {
    if (hasWebBluetooth) {
      recommendedTransport = 'OBD REAL BLUETOOTH'
      guidanceText =
        'Ambiente Android detectado. Recomendado: ELM327 Bluetooth BLE via Web Bluetooth no Chrome/Edge. Para adaptadores Bluetooth Clássico SPP (v1.5/2.1), use o modo Bridge/Proxy Local ou pareamento via Web Serial OTG.'
    } else {
      recommendedTransport = 'SIMULADOR'
      guidanceText =
        'Ambiente Android sem Web Bluetooth ativo. Habilite chrome://flags/#enable-web-bluetooth-new-permissions-backend ou utilize navegador compatível.'
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
