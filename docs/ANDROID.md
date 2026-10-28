# Android, APK y widget de metas

## Requisitos

- Java 17 (`java -version`).
- Android SDK con:
  - `platform-tools`
  - `platforms;android-34`
  - `build-tools;34.0.0`
- `ANDROID_HOME` o `local.properties` apuntando al SDK.

Capacitor 6.2.2 se eligió por compatibilidad con Java 17 y `targetSdk 34`.

## Comandos

Desde la raíz del repo:

```powershell
# 1. Compilar la web (usa artifacts/jarvis/.env.production)
corepack pnpm --config.verifyDepsBeforeRun=false --filter @workspace/jarvis run build

# 2. Copiar la web y los plugins al proyecto Android
corepack pnpm --config.verifyDepsBeforeRun=false --filter @workspace/jarvis exec cap sync android

# 3. Generar APK debug
cd artifacts\jarvis\android
.\gradlew.bat assembleDebug
```

APK resultante:

```text
artifacts/jarvis/android/app/build/outputs/apk/debug/app-debug.apk
```

También existe el atajo:

```powershell
corepack pnpm --config.verifyDepsBeforeRun=false --filter @workspace/jarvis run android:build
```

## API y CORS

La app Android se sirve desde `https://localhost` (esquema de Capacitor). El backend debe incluir ese origen en `ALLOWED_ORIGINS`; el valor por defecto de desarrollo ya lo incluye, junto con `capacitor://localhost` para iOS.

En producción, configura explícitamente:

```text
ALLOWED_ORIGINS=https://localhost,https://tu-dominio-web
```

La URL de API se inyecta en build desde `artifacts/jarvis/.env.production` (`VITE_API_URL`). Para probar contra un backend local, cambia esa variable a la URL accesible desde el emulador (`http://10.0.2.2:8000`) y habilita tráfico cleartext solo en un build de desarrollo.

## Widget "Metas del día"

- Se declara en `android/app/src/main/AndroidManifest.xml`.
- Layout: `android/app/src/main/res/layout/widget_metas.xml`.
- Provider: `android/app/src/main/java/com/jarvis/personal/widget/MetasWidgetProvider.java`.
- Puente JS: `artifacts/jarvis/src/services/metasWidget.ts` y `MetasWidgetPlugin.java`.

Uso:

1. Instala el APK.
2. Mantén presionada la pantalla de inicio → Widgets → Jarvis → **Metas del día**.
3. Abre Jarvis → **Metas del día**. La app envía al widget el resumen de la fecha visible.
4. Toca el widget para abrir la app.

Privacidad y límites:

- El widget guarda solo el resumen (`total`, `completadas`, `porcentaje` y hasta 6 títulos); **no guarda el token**.
- Al cerrar sesión o invalidar el token, la app borra la instantánea del widget.
- El widget no consulta la API en segundo plano: se actualiza cuando la app está abierta. Esto evita duplicar autenticación y reduce el riesgo de exponer credenciales.
- El periodo de actualización declarado es de 30 minutos, pero Android puede diferirlo según batería y fabricante.

## Firma de release

El build por defecto es debug y sirve para instalar localmente. La configuración de `app/build.gradle`
ya está preparada: si existe `artifacts/jarvis/android/keystore.properties` (ignorado por git) el
release se firma con esa llave; si no existe, el release se firma con la llave debug para que
`assembleRelease` siempre produzca un APK instalable.

Pasos para una firma de release real:

1. Genera el keystore (guárdalo FUERA del repo, p. ej. `%USERPROFILE%\.android\jarvis-release.keystore`):

   ```powershell
   & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
     -keystore "$env:USERPROFILE\.android\jarvis-release.keystore" `
     -alias jarvis -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Crea `artifacts/jarvis/android/keystore.properties`:

   ```text
   storeFile=C:\\Users\\TuUsuario\\.android\\jarvis-release.keystore
   storePassword=LA_PASSWORD_DEL_KEYSTORE
   keyAlias=jarvis
   keyPassword=LA_PASSWORD_DE_LA_LLAVE
   ```

3. Ejecuta `.\gradlew.bat assembleRelease`.

4. La APK queda en `app/build/outputs/apk/release/app-release.apk`.

Nunca commitees el keystore, `keystore.properties` ni contraseñas. Si publicas en Google Play,
conserva el keystore: perderlo impide actualizar la app con la misma identidad.
