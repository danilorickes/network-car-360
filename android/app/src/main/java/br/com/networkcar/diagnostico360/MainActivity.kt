package br.com.networkcar.diagnostico360

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var obdPlugin: ObdBridgePlugin

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)

        // Configurações do WebView
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        // Injeção da Ponte Nativa AndroidOBD
        obdPlugin = ObdBridgePlugin(this, webView)
        webView.addJavascriptInterface(obdPlugin, "AndroidOBD")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Injeta sinalizador explícito de presença de container nativo Android
                view?.evaluateJavascript(
                    """
                    (function() {
                        window.__IS_ANDROID_NATIVE_CONTAINER = true;
                        console.log('[NETWORK-CAR-ANDROID] Ponte nativa window.AndroidOBD pronta.');
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }

        // Carrega aplicação a partir dos assets locais empacotados pelo build web (dist)
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onDestroy() {
        obdPlugin.disconnect()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
