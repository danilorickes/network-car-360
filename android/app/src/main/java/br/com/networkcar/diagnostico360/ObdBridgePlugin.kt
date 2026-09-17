package br.com.networkcar.diagnostico360

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * ObdBridgePlugin / AndroidOBD:
 * Ponte nativa para comunicação direta com adaptadores ELM327 Bluetooth Classic (SPP/RFCOMM).
 * Injetada no WebView como `window.AndroidOBD` e utilizável por Capacitor Plugins.
 *
 * Arquitetura Nativa:
 * - BluetoothAdapter / BluetoothManager do Android
 * - UUID SPP padrão: 00001101-0000-1000-8000-00805f9b34fb (Serial Port Profile)
 * - createRfcommSocketToServiceRecord
 * - Handshake I/O com InputStream / OutputStream
 * - Tratamento de runtime permissions (Android 12+ BLUETOOTH_CONNECT e legadas)
 */
class ObdBridgePlugin(
    private val activity: Activity,
    private val webView: WebView
) {
    companion object {
        private const val TAG = "AndroidOBD_Bridge"
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
        const val PERMISSION_REQUEST_CODE = 1001
        const val ENABLE_BT_REQUEST_CODE = 1002
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val bluetoothManager = activity.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothManager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }

    private var currentSocket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    private var connectedDevice: BluetoothDevice? = null
    private var connectionState: String = "DISCONNECTED"
    private var lastErrorMessage: String? = null

    /**
     * 1. Verifica se o aparelho possui hardware Bluetooth
     */
    @JavascriptInterface
    fun hasBluetooth(): Boolean {
        val available = bluetoothAdapter != null
        Log.d(TAG, "hasBluetooth: $available")
        return available
    }

    /**
     * 2. Verifica se o rádio Bluetooth está atualmente LIGADO no aparelho
     */
    @JavascriptInterface
    fun isBluetoothEnabled(): Boolean {
        val enabled = bluetoothAdapter?.isEnabled == true
        Log.d(TAG, "isBluetoothEnabled: $enabled")
        return enabled
    }

    /**
     * 3. Solicita ao usuário a ativação do rádio Bluetooth
     */
    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun requestEnableBluetooth(): Boolean {
        val adapter = bluetoothAdapter ?: return false
        if (adapter.isEnabled) return true

        return try {
            val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
            activity.startActivityForResult(enableBtIntent, ENABLE_BT_REQUEST_CODE)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao solicitar ativação do Bluetooth: ${e.message}", e)
            false
        }
    }

    /**
     * 4. Verifica e solicita permissões de runtime conforme versão do Android:
     * - Android 12+ (API 31+): BLUETOOTH_CONNECT e BLUETOOTH_SCAN
     * - Android 11 ou anterior: BLUETOOTH e BLUETOOTH_ADMIN
     */
    @JavascriptInterface
    fun requestPermissions(): Boolean {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
        } else {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH)
            }
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_ADMIN)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_ADMIN)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                activity,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
            return false
        }
        return true
    }

    private fun checkHasConnectPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * 5. Lista todos os adaptadores Bluetooth pareados no sistema
     * Retorna JSON Array: [{"name":"OBDII","address":"00:1D:A5:...","bondState":12,"type":1}]
     */
    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun getPairedDevices(): String {
        val jsonArray = JSONArray()
        val adapter = bluetoothAdapter

        if (adapter == null) {
            Log.w(TAG, "BluetoothAdapter nulo ao consultar pareados")
            return jsonArray.toString()
        }

        if (!checkHasConnectPermission()) {
            Log.w(TAG, "Permissão BLUETOOTH_CONNECT ausente ao consultar pareados")
            requestPermissions()
            return jsonArray.toString()
        }

        try {
            val paired = adapter.bondedDevices
            if (paired != null) {
                for (device in paired) {
                    val obj = JSONObject()
                    obj.put("name", device.name ?: "Dispositivo Desconhecido")
                    obj.put("address", device.address)
                    obj.put("bondState", device.bondState)
                    obj.put("type", device.type)
                    jsonArray.put(obj)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao obter dispositivos pareados: ${e.message}", e)
        }

        Log.d(TAG, "Dispositivos pareados encontrados: ${jsonArray.length()}")
        return jsonArray.toString()
    }

    /**
     * 6. Conecta via RFCOMM SPP ao dispositivo especificado pelo MAC Address
     */
    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun connect(macAddress: String?): Boolean {
        val adapter = bluetoothAdapter
        if (adapter == null || !adapter.isEnabled) {
            lastErrorMessage = "Bluetooth desativado ou não suportado"
            connectionState = "BLUETOOTH_OFF"
            notifyStateChange()
            return false
        }

        if (!checkHasConnectPermission()) {
            lastErrorMessage = "Permissão Bluetooth não concedida"
            connectionState = "PERMISSION_DENIED"
            notifyStateChange()
            return false
        }

        // Se já houver um socket aberto, encerra antes de reconectar
        disconnect()

        val targetAddress = macAddress?.trim()
        if (targetAddress.isNullOrEmpty()) {
            lastErrorMessage = "Endereço MAC do dispositivo não informado"
            connectionState = "ERROR"
            notifyStateChange()
            return false
        }

        connectionState = "CONNECTING_SOCKET"
        notifyStateChange()

        return try {
            val device = adapter.getRemoteDevice(targetAddress)
            Log.i(TAG, "Iniciando conexão RFCOMM com ${device.name ?: targetAddress} ($targetAddress)...")

            // Cancela discovery para otimizar velocidade e estabilidade da conexão
            try {
                adapter.cancelDiscovery()
            } catch (e: Exception) {
                Log.w(TAG, "Aviso ao cancelar discovery: ${e.message}")
            }

            // Criação do socket RFCOMM SPP padrão
            var socket: BluetoothSocket? = null
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket.connect()
            } catch (e1: Exception) {
                Log.w(TAG, "Tentativa primária de socket RFCOMM falhou: ${e1.message}. Tentando fallback via reflexão...")
                // Fallback para adaptadores Bluetooth Classic com implementação personalizada de canal
                try {
                    val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                    socket = m.invoke(device, 1) as BluetoothSocket
                    socket.connect()
                } catch (e2: Exception) {
                    Log.e(TAG, "Falha definitiva ao abrir socket RFCOMM: ${e2.message}", e2)
                    throw e2
                }
            }

            currentSocket = socket
            inputStream = socket.inputStream
            outputStream = socket.outputStream
            connectedDevice = device

            connectionState = "SOCKET_CONNECTED"
            lastErrorMessage = null
            notifyStateChange()

            Log.i(TAG, "Socket RFCOMM conectado com sucesso a ${device.name ?: targetAddress}!")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao conectar RFCOMM: ${e.message}", e)
            lastErrorMessage = "Erro socket RFCOMM: ${e.message}"
            connectionState = "ERROR"
            disconnect()
            notifyStateChange()
            false
        }
    }

    /**
     * 7. Envia comando ELM327 e aguarda prompt '>' ou timeout
     */
    @JavascriptInterface
    fun send(command: String, timeoutMs: Long): String {
        val out = outputStream
        val input = inputStream

        if (currentSocket == null || out == null || input == null) {
            throw IllegalStateException("SEM COMUNICAÇÃO: Socket Bluetooth nativo desconectado.")
        }

        val cleanCmd = command.trim()
        val toSend = "$cleanCmd\r".toByteArray(Charsets.US_ASCII)

        return synchronized(this) {
            try {
                // Limpa bytes remanescentes no buffer de entrada
                while (input.available() > 0) {
                    input.read()
                }

                // Envia comando
                out.write(toSend)
                out.flush()

                // Leitura até receber o caractere '>' ou atingir o timeout
                val responseBuilder = StringBuilder()
                val effectiveTimeout = if (timeoutMs > 0) timeoutMs else 2500L
                val deadline = System.currentTimeMillis() + effectiveTimeout
                val buffer = ByteArray(256)

                while (System.currentTimeMillis() < deadline) {
                    if (input.available() > 0) {
                        val bytesRead = input.read(buffer)
                        if (bytesRead > 0) {
                            val chunk = String(buffer, 0, bytesRead, Charsets.US_ASCII)
                            responseBuilder.append(chunk)
                            if (responseBuilder.contains(">")) {
                                break
                            }
                        }
                    } else {
                        Thread.sleep(15)
                    }
                }

                val finalResponse = responseBuilder.toString()
                if (!finalResponse.contains(">") && finalResponse.isEmpty()) {
                    throw RuntimeException("TIMEOUT de resposta do ELM327 (${effectiveTimeout}ms)")
                }

                finalResponse
            } catch (e: Exception) {
                Log.e(TAG, "Erro I/O no comando $command: ${e.message}")
                throw RuntimeException("Erro I/O Bluetooth: ${e.message}", e)
            }
        }
    }

    /**
     * 8. Desconecta o socket e streams
     */
    @JavascriptInterface
    fun disconnect(): Boolean {
        Log.i(TAG, "Desconectando socket Bluetooth nativo...")
        return try {
            try { inputStream?.close() } catch (_: Exception) {}
            try { outputStream?.close() } catch (_: Exception) {}
            try { currentSocket?.close() } catch (_: Exception) {}
            true
        } finally {
            inputStream = null
            outputStream = null
            currentSocket = null
            connectedDevice = null
            connectionState = "DISCONNECTED"
            notifyStateChange()
        }
    }

    /**
     * 9. Retorna JSON com o estado da conexão física
     */
    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun getConnectionState(): String {
        val obj = JSONObject()
        obj.put("connected", currentSocket?.isConnected == true)
        obj.put("state", connectionState)
        obj.put("deviceAddress", connectedDevice?.address)
        obj.put("deviceName", if (checkHasConnectPermission()) connectedDevice?.name else null)
        obj.put("error", lastErrorMessage)
        return obj.toString()
    }

    /**
     * 10. Retorna informações do dispositivo atualmente conectado
     */
    @SuppressLint("MissingPermission")
    @JavascriptInterface
    fun getConnectedDevice(): String? {
        val dev = connectedDevice ?: return null
        val obj = JSONObject()
        obj.put("address", dev.address)
        if (checkHasConnectPermission()) {
            obj.put("name", dev.name ?: "OBDII")
        } else {
            obj.put("name", "OBDII")
        }
        return obj.toString()
    }

    private fun notifyStateChange() {
        val info = getConnectionState()
        activity.runOnUiThread {
            webView.evaluateJavascript(
                "if (window.__onAndroidOBDStateChange) { window.__onAndroidOBDStateChange($info); }",
                null
            )
        }
    }
}
