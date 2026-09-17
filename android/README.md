# Build local do APK Network Car (Android)
#
# Para compilar e gerar o APK de Homologação em sua máquina ou no Android Studio:
#
# 1. Gerar o build web:
#    npm run build
#
# 2. Copiar os arquivos gerados (pasta dist/) para a pasta de assets do app Android:
#    mkdir -p android/app/src/main/assets
#    cp -r dist/* android/app/src/main/assets/
#
# 3. Compilar o APK via linha de comando (requer JDK 17 e Android SDK instalados):
#    cd android
#    chmod +x gradlew
#    ./gradlew assembleDebug
#
# 4. O APK gerado estará em:
#    android/app/build/outputs/apk/debug/app-debug.apk
#
# Alternativamente, abra a pasta "android" diretamente no Android Studio e clique em "Run" ou "Build > Build APK(s)".
