package br.com.networkcar.diagnostico360

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "NC-WEBVIEW"
    }

    private lateinit var webView: WebView
    private lateinit var obdPlugin: ObdBridgePlugin

    // Painel Técnico de Homologação (Overlay visível se houver erro crítico)
    private lateinit var errorPanel: View
    private lateinit var errorDetailsText: TextView
    private lateinit var btnCopyError: Button
    private lateinit var btnRetryLoad: Button

    private val errorLogs = StringBuilder()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        errorPanel = findViewById(R.id.technical_error_panel)
        errorDetailsText = findViewById(R.id.error_details_text)
        btnCopyError = findViewById(R.id.btn_copy_error)
        btnRetryLoad = findViewById(R.id.btn_retry_load)

        setupErrorPanelActions()

        // Log inicial com detalhes de versão e diretório
        logDiagnostic("INFO", "MainActivity iniciada. Versão 0.0.45-homologacao-e6.6.1")
        verifyAssetPresence()

        // Configurações do WebView
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.mediaPlaybackRequiresUserGesture = false

        // Injeção da Ponte Nativa AndroidOBD
        obdPlugin = ObdBridgePlugin(this, webView)
        webView.addJavascriptInterface(obdPlugin, "AndroidOBD")

        // 1. WebChromeClient para capturar logs do console JavaScript e erros JS
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage != null) {
                    val level = consoleMessage.messageLevel().name
                    val msg = consoleMessage.message()
                    val sourceId = consoleMessage.sourceId()
                    val line = consoleMessage.lineNumber()

                    val logEntry = "[$level] $msg (origem: $sourceId:$line)"
                    when (consoleMessage.messageLevel()) {
                        ConsoleMessage.MessageLevel.ERROR -> {
                            Log.e(TAG, logEntry)
                            // Se for erro de módulo ou sintaxe que cause tela branca, registra no painel técnico
                            if (msg.contains("Error") || msg.contains("Failed") || msg.contains("Uncaught") || msg.contains("SyntaxError")) {
                                recordCriticalError("Erro JS Console: $logEntry")
                            }
                        }
                        ConsoleMessage.MessageLevel.WARNING -> Log.w(TAG, logEntry)
                        else -> Log.d(TAG, logEntry)
                    }
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }

        // 2. WebViewClient com captura rigorosa de erros de recursos e carregamento
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                val url = request?.url?.toString() ?: "desconhecida"
                val isMainFrame = request?.isForMainFrame == true
                val errCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    error?.errorCode?.toString() ?: "N/D"
                } else {
                    "N/D"
                }
                val desc = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    error?.description?.toString() ?: "Erro desconhecido"
                } else {
                    "Erro ao carregar recurso"
                }

                val failureLog = "Falha em recurso: [código: $errCode] [mainFrame: $isMainFrame] URL: $url - Detalhe: $desc"
                Log.e(TAG, failureLog)
                recordCriticalError(failureLog)

                if (isMainFrame || url.endsWith(".js") || url.endsWith("index.html")) {
                    showErrorPanel(failureLog)
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val url = request?.url?.toString() ?: "desconhecida"
                val statusCode = errorResponse?.statusCode ?: -1
                val reason = errorResponse?.reasonPhrase ?: "HTTP Error"
                val logMsg = "HTTP Error [$statusCode $reason] ao carregar: $url"
                Log.w(TAG, logMsg)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                logDiagnostic("INFO", "onPageFinished carregado: $url")

                // Injeta sinalizador explícito de presença de container nativo Android
                view?.evaluateJavascript(
                    """
                    (function() {
                        window.__IS_ANDROID_NATIVE_CONTAINER = true;
                        console.log('[NETWORK-CAR-ANDROID] Container Nativo Android detectado. URL: ' + window.location.href);
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }

        // Carrega aplicação a partir dos assets locais empacotados pelo build web (dist)
        logDiagnostic("INFO", "Disparando loadUrl('file:///android_asset/index.html')...")
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun setupErrorPanelActions() {
        btnCopyError.setOnClickListener {
            val textToCopy = errorLogs.toString()
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Network Car Homologação Log", textToCopy)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Logs copiados para a área de transferência!", Toast.LENGTH_SHORT).show()
        }

        btnRetryLoad.setOnClickListener {
            errorPanel.visibility = View.GONE
            logDiagnostic("INFO", "Tentando recarregar aplicação a partir de file:///android_asset/index.html...")
            webView.loadUrl("file:///android_asset/index.html")
        }
    }

    private fun verifyAssetPresence() {
        try {
            val assetsList = assets.list("") ?: emptyArray()
            val hasIndex = assetsList.contains("index.html")
            logDiagnostic("INFO", "Assets na raiz do APK: [${assetsList.joinToString(", ")}]")
            logDiagnostic("INFO", "index.html presente na raiz dos assets: $hasIndex")
            if (!hasIndex) {
                recordCriticalError("CRÍTICO: 'index.html' NÃO FOI ENCONTRADO em android_asset! A WebView ficará branca.")
                showErrorPanel("CRÍTICO: 'index.html' ausente nos assets empacotados.")
            }
        } catch (e: Exception) {
            logDiagnostic("ERROR", "Erro ao listar assets: ${e.message}")
        }
    }

    private fun logDiagnostic(level: String, message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        val entry = "[$timestamp] [$level] $message"
        when (level) {
            "ERROR" -> Log.e(TAG, entry)
            "WARN" -> Log.w(TAG, entry)
            else -> Log.i(TAG, entry)
        }
        errorLogs.append(entry).append("\n")
    }

    private fun recordCriticalError(error: String) {
        logDiagnostic("ERROR", error)
    }

    private fun showErrorPanel(summary: String) {
        runOnUiThread {
            errorPanel.visibility = View.VISIBLE
            errorDetailsText.text = buildString {
                append("RELATÓRIO TÉCNICO DE FALHA (HOMOLOGAÇÃO E6.6.1):\n\n")
                append(summary).append("\n\n")
                append("--- LOGS CAPTURADOS ---\n")
                append(errorLogs.toString())
            }
        }
    }

    override fun onDestroy() {
        obdPlugin.disconnect()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (errorPanel.visibility == View.VISIBLE) {
            errorPanel.visibility = View.GONE
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
