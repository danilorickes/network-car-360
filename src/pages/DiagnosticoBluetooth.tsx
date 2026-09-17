import React, { useState, useEffect, useCallback } from 'react'
import {
  Bluetooth,
  Terminal,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Radio,
  Layers,
  FileCode,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BLUETOOTH_CLASSIC_SPP_UUID } from '@/lib/obd/transports/android-bluetooth-transport'

interface DiagnosticLogEntry {
  timestamp: string
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DETAIL'
  category: string
  message: string
  payload?: any
}

interface TestExecutionSummary {
  testRunAt: string
  browserUa: string
  chromeVersion: number | null
  isAndroid: boolean
  hasNavigatorSerial: boolean
  hasGetPorts: boolean
  hasRequestPort: boolean
  authorizedPortsCount: number
  authorizedPortsDetails: any[]
  requestParamsUsed: any
  requestResult: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'NOT_RUN'
  portInfo: any | null
  errorName?: string
  errorMessage?: string
  errorCode?: any
  bluetoothRadioStateDeterminable: boolean
  bluetoothRadioNote: string
}

export const DiagnosticoBluetooth: React.FC = () => {
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [summary, setSummary] = useState<TestExecutionSummary | null>(null)
  const [testMode, setTestMode] = useState<
    'STANDARD_NO_PARAMS' | 'ALLOWED_UUID_SPP' | 'FILTER_UUID_SPP' | 'ALL_COMBINED'
  >('ALLOWED_UUID_SPP')

  const addLog = useCallback(
    (type: DiagnosticLogEntry['type'], category: string, message: string, payload?: any) => {
      const entry: DiagnosticLogEntry = {
        timestamp: new Date().toISOString(),
        type,
        category,
        message,
        payload,
      }
      setLogs((prev) => [entry, ...prev])
      console.log(`[DIAG-BT][${type}][${category}] ${message}`, payload || '')
    },
    [],
  )

  const inspectEnvironment = useCallback(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isAndroid = /android/i.test(ua)
    const chromeMatch = ua.match(/Chrome\/(\d+)/i)
    const chromeVersion = chromeMatch ? parseInt(chromeMatch[1], 10) : null
    const hasNavigatorSerial = typeof navigator !== 'undefined' && 'serial' in navigator
    const hasGetPorts = Boolean(
      hasNavigatorSerial && (navigator as any).serial && 'getPorts' in (navigator as any).serial,
    )
    const hasRequestPort = Boolean(
      hasNavigatorSerial && (navigator as any).serial && 'requestPort' in (navigator as any).serial,
    )

    return {
      ua,
      isAndroid,
      chromeVersion,
      hasNavigatorSerial,
      hasGetPorts,
      hasRequestPort,
    }
  }, [])

  // Auto-inspeção inicial ao carregar
  useEffect(() => {
    const env = inspectEnvironment()
    addLog('INFO', 'INIT', 'Ferramenta de Diagnóstico Bluetooth OBD carregada.')
    addLog(
      'INFO',
      'ENV',
      `Navegador: Chrome ${env.chromeVersion ?? 'N/D'} | Android: ${env.isAndroid ? 'SIM' : 'NÃO'} | Web Serial API: ${env.hasNavigatorSerial ? 'DISPONÍVEL' : 'AUSENTE'}`,
      {
        userAgent: env.ua,
        hasGetPorts: env.hasGetPorts,
        hasRequestPort: env.hasRequestPort,
      },
    )

    // Avaliação de getPorts inicial
    if (env.hasGetPorts) {
      ;(navigator as any).serial
        .getPorts()
        .then((ports: any[]) => {
          addLog(
            ports.length > 0 ? 'SUCCESS' : 'INFO',
            'GET_PORTS_INIT',
            `Portas previamente autorizadas encontradas via getPorts(): ${ports.length}`,
            ports.map((p, idx) => ({
              index: idx,
              info: p.getInfo ? p.getInfo() : null,
              connected: 'connected' in p ? p.connected : 'N/D',
            })),
          )
        })
        .catch((err: any) => {
          addLog('WARN', 'GET_PORTS_INIT_FAIL', `Falha ao ler getPorts() inicial: ${err?.message}`)
        })
    }
  }, [addLog, inspectEnvironment])

  const runBluetoothTest = async () => {
    setIsRunning(true)
    const env = inspectEnvironment()
    const runTimestamp = new Date().toISOString()

    addLog('INFO', 'TEST_START', `=== INICIANDO TESTE BLUETOOTH RFCOMM [${testMode}] ===`)

    let authorizedPorts: any[] = []
    let authorizedPortsDetails: any[] = []

    // 1. Consulta navigator.serial.getPorts()
    if (env.hasGetPorts) {
      try {
        authorizedPorts = await (navigator as any).serial.getPorts()
        authorizedPortsDetails = authorizedPorts.map((p, idx) => {
          const info = p.getInfo ? p.getInfo() : null
          return {
            index: idx,
            usbVendorId: info?.usbVendorId,
            usbProductId: info?.usbProductId,
            bluetoothServiceClassId: info?.bluetoothServiceClassId,
            connectedProperty: 'connected' in p ? p.connected : 'não suportado nesta versão',
          }
        })
        addLog(
          'INFO',
          'GET_PORTS',
          `Portas previamente concedidas: ${authorizedPorts.length}`,
          authorizedPortsDetails,
        )
      } catch (gpErr: any) {
        addLog('ERROR', 'GET_PORTS_ERR', `Exceção em getPorts(): ${gpErr?.message}`, {
          name: gpErr?.name,
          message: gpErr?.message,
        })
      }
    } else {
      addLog(
        'WARN',
        'GET_PORTS',
        'navigator.serial.getPorts() não está disponível neste navegador.',
      )
    }

    // 2. Monta opções exatas do requestPort de acordo com o modo
    let requestOptions: any = undefined
    if (testMode === 'ALLOWED_UUID_SPP') {
      requestOptions = {
        allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID],
      }
    } else if (testMode === 'FILTER_UUID_SPP') {
      requestOptions = {
        allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID],
        filters: [{ bluetoothServiceClassId: BLUETOOTH_CLASSIC_SPP_UUID }],
      }
    } else if (testMode === 'ALL_COMBINED') {
      requestOptions = {
        allowedBluetoothServiceClassIds: [
          BLUETOOTH_CLASSIC_SPP_UUID,
          '00001101-0000-1000-8000-00805f9b34fb',
          '00001800-0000-1000-8000-00805f9b34fb',
        ],
      }
    } else {
      // STANDARD_NO_PARAMS
      requestOptions = undefined
    }

    addLog(
      'INFO',
      'REQUEST_PARAMS',
      `Chamando navigator.serial.requestPort(${requestOptions ? JSON.stringify(requestOptions) : ''})`,
      requestOptions,
    )

    let selectedPort: any = null
    let portInfoResult: any = null
    let errName: string | undefined
    let errMsg: string | undefined
    let errCode: any | undefined
    let requestResult: TestExecutionSummary['requestResult'] = 'FAILED'

    if (!env.hasRequestPort) {
      addLog(
        'ERROR',
        'API_UNAVAILABLE',
        'navigator.serial.requestPort NÃO existe neste navegador/dispositivo.',
      )
      setIsRunning(false)
      return
    }

    try {
      if (requestOptions) {
        selectedPort = await (navigator as any).serial.requestPort(requestOptions)
      } else {
        selectedPort = await (navigator as any).serial.requestPort()
      }

      if (selectedPort) {
        requestResult = 'SUCCESS'
        portInfoResult = selectedPort.getInfo
          ? selectedPort.getInfo()
          : { info: 'getInfo indisponível' }
        addLog(
          'SUCCESS',
          'PORT_SELECTED',
          `Dispositivo serial/Bluetooth selecionado com sucesso pelo usuário!`,
          portInfoResult,
        )

        // Tenta teste de abertura mínima se desejado
        try {
          addLog('INFO', 'PORT_OPEN_TEST', 'Tentando open({ baudRate: 38400 })...')
          await selectedPort.open({ baudRate: 38400 })
          addLog('SUCCESS', 'PORT_OPENED', 'Porta serial/Bluetooth aberta com sucesso!')
          await selectedPort.close()
          addLog('INFO', 'PORT_CLOSED', 'Porta serial fechada após teste.')
        } catch (openErr: any) {
          addLog(
            'WARN',
            'PORT_OPEN_FAIL',
            `Porta selecionada mas falha no open: ${openErr?.message}`,
            {
              name: openErr?.name,
              message: openErr?.message,
            },
          )
        }
      }
    } catch (reqErr: any) {
      errName = reqErr?.name || 'Error'
      errMsg = reqErr?.message || String(reqErr)
      errCode = reqErr?.code || (reqErr as any)?.number

      if (
        errName === 'NotFoundError' ||
        errMsg.includes('No port selected') ||
        errMsg.includes('User cancelled')
      ) {
        requestResult = 'REJECTED'
        addLog(
          'WARN',
          'CHOOSER_DISMISSED',
          `Seletor fechado sem seleção ou nenhum dispositivo compatível selecionado. Erro: [${errName}] ${errMsg}`,
          {
            name: errName,
            message: errMsg,
            code: errCode,
            notaTecnica:
              'A mensagem nativa do Android "Nenhum dispositivo compatível encontrado" dentro da janela do sistema resulta na rejeição desta Promise com NotFoundError.',
          },
        )
      } else {
        requestResult = 'FAILED'
        addLog(
          'ERROR',
          'REQUEST_EXCEPTION',
          `Exceção ao chamar requestPort: [${errName}] ${errMsg}`,
          {
            name: errName,
            message: errMsg,
            code: errCode,
            stack: reqErr?.stack,
          },
        )
      }
    }

    const testSummary: TestExecutionSummary = {
      testRunAt: runTimestamp,
      browserUa: env.ua,
      chromeVersion: env.chromeVersion,
      isAndroid: env.isAndroid,
      hasNavigatorSerial: env.hasNavigatorSerial,
      hasGetPorts: env.hasGetPorts,
      hasRequestPort: env.hasRequestPort,
      authorizedPortsCount: authorizedPorts.length,
      authorizedPortsDetails,
      requestParamsUsed: requestOptions || '(nenhum parâmetro - requestPort())',
      requestResult,
      portInfo: portInfoResult,
      errorName: errName,
      errorMessage: errMsg,
      errorCode: errCode,
      bluetoothRadioStateDeterminable: false,
      bluetoothRadioNote:
        'Estado Bluetooth não determinável de forma confiável via aplicação web: a Web Serial API não expõe o estado do rádio Bluetooth do sistema operacional (ligado/desligado); quando o rádio está desligado ou o dispositivo não é pareado/elegível, o Chrome exibe o mesmo diálogo nativo "Nenhum dispositivo compatível encontrado" e rejeita com NotFoundError.',
    }

    setSummary(testSummary)
    addLog('INFO', 'TEST_END', `=== FIM DO TESTE: Resultado = ${requestResult} ===`)
    setIsRunning(false)
  }

  const handleCopyLog = () => {
    const text = generateFullLogReport()
    navigator.clipboard
      .writeText(text)
      .then(() => {
        addLog('INFO', 'CLIPBOARD', 'Log copiado para a área de transferência com sucesso.')
      })
      .catch((e) => {
        addLog('ERROR', 'CLIPBOARD_ERR', `Falha ao copiar log: ${e?.message}`)
      })
  }

  const handleExportTxt = () => {
    const text = generateFullLogReport()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diagnostico-bluetooth-obd-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addLog('INFO', 'EXPORT', 'Arquivo de log .txt gerado para download.')
  }

  const generateFullLogReport = (): string => {
    const header = [
      '========================================================================',
      'NETWORK CAR — FERRAMENTA DE ISOLAMENTO: DIAGNÓSTICO BLUETOOTH OBD',
      'ETAPA 6.6 / INVESTIGAÇÃO DE HARDWARE REAL',
      '========================================================================',
      `Data/Hora da Geração: ${new Date().toISOString()}`,
      `Navegador User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/D'}`,
      `Plataforma: ${typeof navigator !== 'undefined' ? navigator.platform : 'N/D'}`,
      '',
      '--- RESUMO EXECUTIVO DO TESTE ---',
      summary ? JSON.stringify(summary, null, 2) : 'Nenhum teste executado ainda.',
      '',
      '--- REGISTRO CRONOLÓGICO DE EVENTOS (LOGS) ---',
      ...logs.map(
        (l) =>
          `[${l.timestamp}] [${l.type}] [${l.category}] ${l.message} ${
            l.payload ? '\n  Payload: ' + JSON.stringify(l.payload) : ''
          }`,
      ),
      '',
      '--- CONSTATAÇÕES TÉCNICAS MANDATÓRIAS ---',
      '1. Origem da mensagem "Nenhum dispositivo compatível encontrado":',
      '   Trata-se do diálogo modal nativo do sistema operacional Android exibido pelo Google Chrome.',
      '   A Web Serial API do Chromium Android abre um seletor nativo da plataforma.',
      '2. Diferenciação de estado Bluetooth Ligado vs Desligado:',
      '   ESTADO BLUETOOTH NÃO DETERMINÁVEL DE FORMA CONFIÁVEL VIA APLICAÇÃO WEB.',
      '   A especificação Web Serial API (W3C/WICG) não possui evento, método ou propriedade para consultar o estado do rádio Bluetooth.',
      '   Tanto com Bluetooth ligado (sem dispositivo RFCOMM elegível selecionado) quanto com Bluetooth desligado,',
      '   o Chromium Android apresenta a mesma tela e devolve a mesma exceção (NotFoundError).',
      '3. Relação Pareamento vs Web Serial:',
      '   Pareado no Android != Elegível para Web Serial RFCOMM != Autorizado no navegador.',
      '   Muitos adaptadores ELM327 genéricos (clones v1.5/v2.1) anunciam apenas perfis SPP legados sem identificadores',
      '   que o Chromium Android 152 mapeie como serial elegível sem permissões nativas BLUETOOTH_CONNECT do SO.',
      '========================================================================',
    ].join('\n')
    return header
  }

  const env = inspectEnvironment()

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-6 text-[#F2F5F7]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263340]">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#FFB300]" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              DIAGNÓSTICO BLUETOOTH OBD
            </h1>
            <span className="text-xs bg-amber-500/20 text-[#FFB300] border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
              ISOLAMENTO E6.6
            </span>
          </div>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Ferramenta mínima de isolamento e auditoria da Web Serial API / RFCOMM no Xiaomi
            Android. Execução direta e independente dos demais módulos do Network Car.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLog}
            className="border-[#263340] text-gray-300 hover:text-white hover:bg-[#1A232E] text-xs"
          >
            <Copy className="w-4 h-4 mr-1.5" />
            COPIAR LOG
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportTxt}
            className="border-[#263340] text-[#FFB300] hover:text-white hover:bg-[#1A232E] text-xs"
          >
            <Download className="w-4 h-4 mr-1.5" />
            EXPORTAR LOG .TXT
          </Button>
        </div>
      </div>

      {/* Alerta de Verdade Técnica */}
      <div className="bg-[#101720] border border-[#263340] p-4 rounded-lg text-xs space-y-2">
        <div className="flex items-center space-x-2 text-[#FFB300] font-bold">
          <Info className="w-4 h-4" />
          <span>Diretriz de Rigor Técnico E6.6 (Sem Estados Fictícios):</span>
        </div>
        <p className="text-gray-300 leading-relaxed">
          <strong>Regra Absoluta:</strong> É proibido inferir estado físico sem evidência da
          plataforma. Se a Web API não fornecer a informação do rádio Bluetooth, o sistema
          documenta:{' '}
          <em>
            &quot;Estado Bluetooth não determinável de forma confiável via aplicação web&quot;
          </em>
          . Nunca substituir &quot;Nenhum dispositivo compatível encontrado&quot; por mensagens
          adivinhadas.
        </p>
      </div>

      {/* Grid de Ambiente e Controles de Teste */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Capacidades do Navegador & Seletor de Chamada */}
        <div className="space-y-4">
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Ambiente de Execução Atual</span>
            </h3>
            <div className="text-xs space-y-1.5 font-mono text-gray-300">
              <div className="flex justify-between border-b border-[#202B37] pb-1">
                <span className="text-[#9AA7B4]">Sistema Operacional:</span>
                <span className={env.isAndroid ? 'text-emerald-400 font-bold' : 'text-gray-300'}>
                  {env.isAndroid ? 'Android' : 'Desktop / Outro'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#202B37] pb-1">
                <span className="text-[#9AA7B4]">Google Chrome:</span>
                <span className="text-white font-bold">
                  {env.chromeVersion ? `v${env.chromeVersion}` : 'Não detectado'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#202B37] pb-1">
                <span className="text-[#9AA7B4]">navigator.serial:</span>
                <span
                  className={
                    env.hasNavigatorSerial ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
                  }
                >
                  {env.hasNavigatorSerial ? 'DISPONÍVEL' : 'AUSENTE'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#202B37] pb-1">
                <span className="text-[#9AA7B4]">serial.getPorts():</span>
                <span className={env.hasGetPorts ? 'text-emerald-400' : 'text-red-400'}>
                  {env.hasGetPorts ? 'SIM' : 'NÃO'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA7B4]">serial.requestPort():</span>
                <span className={env.hasRequestPort ? 'text-emerald-400' : 'text-red-400'}>
                  {env.hasRequestPort ? 'SIM' : 'NÃO'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-[#FFB300]" />
              <span>Parâmetros de Chamada do requestPort()</span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Teste as variações aceitas pela especificação do Chromium para verificar se alguma
              desbloqueia o adaptador ELM327 no Android:
            </p>

            <div className="space-y-1.5 text-xs">
              <label
                className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition-all ${
                  testMode === 'ALLOWED_UUID_SPP'
                    ? 'bg-amber-950/60 border-[#FFB300] text-white'
                    : 'bg-[#0B0F14] border-[#263340] text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="testMode"
                  checked={testMode === 'ALLOWED_UUID_SPP'}
                  onChange={() => setTestMode('ALLOWED_UUID_SPP')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">allowedBluetoothServiceClassIds: [SPP UUID]</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {'{ allowedBluetoothServiceClassIds: ["00001101-..."] }'}
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition-all ${
                  testMode === 'STANDARD_NO_PARAMS'
                    ? 'bg-amber-950/60 border-[#FFB300] text-white'
                    : 'bg-[#0B0F14] border-[#263340] text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="testMode"
                  checked={testMode === 'STANDARD_NO_PARAMS'}
                  onChange={() => setTestMode('STANDARD_NO_PARAMS')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">Sem parâmetros: requestPort()</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    navigator.serial.requestPort()
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition-all ${
                  testMode === 'FILTER_UUID_SPP'
                    ? 'bg-amber-950/60 border-[#FFB300] text-white'
                    : 'bg-[#0B0F14] border-[#263340] text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="testMode"
                  checked={testMode === 'FILTER_UUID_SPP'}
                  onChange={() => setTestMode('FILTER_UUID_SPP')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">Filtro explícito: filters + allowedIds</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {'{ filters: [{ bluetoothServiceClassId }], allowed... }'}
                  </div>
                </div>
              </label>
            </div>

            <Button
              size="lg"
              disabled={isRunning || !env.hasRequestPort}
              onClick={runBluetoothTest}
              className="w-full bg-[#FFB300] hover:bg-[#e09e00] text-black font-bold text-xs shadow-lg mt-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  AGUARDANDO INTERAÇÃO COM O SELETOR...
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 mr-2" />
                  TESTAR BLUETOOTH RFCOMM
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Coluna 2 e 3: Resumo do Teste e Terminal de Logs ao Vivo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card Resumo do Teste */}
          {summary && (
            <div
              className={`p-4 rounded-lg border text-xs space-y-3 ${
                summary.requestResult === 'SUCCESS'
                  ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                  : summary.requestResult === 'REJECTED'
                    ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                    : 'bg-red-950/40 border-red-700 text-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {summary.requestResult === 'SUCCESS' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : summary.requestResult === 'REJECTED' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                  <span>
                    {summary.requestResult === 'SUCCESS'
                      ? 'Dispositivo Selecionado com Sucesso!'
                      : summary.requestResult === 'REJECTED'
                        ? 'Seletor Fechado / Nenhum Dispositivo Selecionado (NotFoundError)'
                        : 'Falha na Execução do requestPort()'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-gray-400">
                  {new Date(summary.testRunAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-[#0B0F14] p-3 rounded border border-[#202B37] text-gray-300">
                <div>
                  <span className="text-[#9AA7B4]">Portas pré-autorizadas:</span>{' '}
                  <strong className="text-white">{summary.authorizedPortsCount}</strong>
                </div>
                <div>
                  <span className="text-[#9AA7B4]">Resultado requestPort:</span>{' '}
                  <strong
                    className={
                      summary.requestResult === 'SUCCESS'
                        ? 'text-emerald-400'
                        : summary.requestResult === 'REJECTED'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }
                  >
                    {summary.requestResult}
                  </strong>
                </div>
                {summary.errorName && (
                  <div className="sm:col-span-2">
                    <span className="text-[#9AA7B4]">Exceção capturada:</span>{' '}
                    <span className="text-red-300 font-bold">
                      [{summary.errorName}] {summary.errorMessage}
                    </span>
                  </div>
                )}
                {summary.portInfo && (
                  <div className="sm:col-span-2">
                    <span className="text-[#9AA7B4]">Port Info retornado:</span>{' '}
                    <span className="text-emerald-400">{JSON.stringify(summary.portInfo)}</span>
                  </div>
                )}
              </div>

              {/* Nota sobre determinação do estado do rádio */}
              <div className="text-[11px] bg-[#121A24] p-2.5 rounded border border-amber-800/60 text-amber-200 leading-relaxed">
                <strong>Constatação Técnica Documentada:</strong> {summary.bluetoothRadioNote}
              </div>
            </div>
          )}

          {/* Terminal de Logs */}
          <div className="bg-[#0B0F14] border border-[#263340] rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#202B37]">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Console de Eventos Técnicos ({logs.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[11px] text-gray-400 hover:text-white"
              >
                Limpar Log
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
              {logs.length === 0 ? (
                <div className="text-gray-500 py-6 text-center italic">
                  Nenhum registro ainda. Clique em &quot;TESTAR BLUETOOTH RFCOMM&quot; acima.
                </div>
              ) : (
                logs.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border text-left leading-relaxed ${
                      item.type === 'SUCCESS'
                        ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                        : item.type === 'ERROR'
                          ? 'bg-red-950/30 border-red-800 text-red-300'
                          : item.type === 'WARN'
                            ? 'bg-amber-950/30 border-amber-800 text-amber-300'
                            : 'bg-[#121A24] border-[#202B37] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>[{item.timestamp.split('T')[1]?.replace('Z', '')}]</span>
                      <span className="font-bold uppercase tracking-wider">{item.category}</span>
                    </div>
                    <div>{item.message}</div>
                    {item.payload && (
                      <pre className="mt-1 p-1.5 bg-[#080B0E] rounded text-[10px] text-gray-400 overflow-x-auto">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiagnosticoBluetooth
