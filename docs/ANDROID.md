# Android, APK y Widgets de Jarvis

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
$env:JAVA_HOME = 'C:\Users\merid\.jdk\jdk-17'
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

## Widgets de Jarvis

La aplicación provee widgets nativos de pantalla de inicio optimizados para launchers modernos (Niagara Launcher, Nova Launcher, Pixel Launcher):

### 1. Jarvis Hub Master Widget (Mega-Widget Todo-en-Uno Paginado)
- **Objetivo**: Proveer un único widget maestro en pantalla capaz de alternar interactivamente mediante botones `◀` y `▶` entre las 4 áreas principales de Jarvis:
  1. **Finanzas**: Saldo total disponible, gastos y entradas del día, y desglose de medios principales.
  2. **Hábitos**: Barra de progreso diario, porcentaje y checklist con rachas activas.
  3. **Moto**: Odómetro actual (km), porcentaje de vida útil del aceite y alertas de cambio.
  4. **Metas del día**: Checklist de metas con indicador de prioridad/completado y progreso del día.
- **Provider**: `android/app/src/main/java/com/jarvis/personal/widget/JarvisHubWidgetProvider.java`.
- **Layout**: `android/app/src/main/res/layout/widget_jarvis_hub.xml`.
- **Acción interactiva**: Recibe broadcast `com.jarvis.personal.ACTION_HUB_PAGE` para alternar la página activa (`hub_current_page` 0 a 3) en SharedPreferences (`jarvis_widgets`).
- **Sincronización**: Se refresca automáticamente mediante `JarvisHubWidgetProvider.updateAll(context)` cada vez que el plugin `JarvisWidgetsPlugin` recibe actualizaciones de cualquiera de los cuatro módulos.

### 2. Widgets Individuales Específicos
- **Metas del día**: `MetasWidgetProvider.java` (`@layout/widget_metas`).
- **Finanzas: Saldo y Flujo**: `FinanzasWidgetProvider.java` (`@layout/widget_finanzas`).
- **Hábitos y Rachas**: `HabitosWidgetProvider.java` (`@layout/widget_habitos`).
- **Moto: Aceite y Km**: `MotoWidgetProvider.java` (`@layout/widget_moto`).

### Privacidad y límites:
- Los widgets guardan exclusivamente instantáneas y resúmenes sanitizados; **no almacenan credenciales ni tokens JWT**.
- Al cerrar sesión o invalidar el token, la app limpia las instantáneas de SharedPreferences.
- Los widgets no realizan peticiones de red autónomas: se alimentan del estado validado enviado por la app cuando está en uso.
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
