package com.jarvis.personal.device;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.BatteryManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native Android device controls for Zero-PC Jarvis & Tomás 2.0 (torch, app intents, battery).
 */
@CapacitorPlugin(name = "JarvisDevice")
public class JarvisDevicePlugin extends Plugin {

    @PluginMethod
    public void setTorch(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        try {
            String cameraId = TorchHelper.setTorch(getContext(), enabled);
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("enabled", enabled);
            res.put("cameraId", cameraId);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("No se pudo activar la linterna: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName", "");
        String url = call.getString("url", "");
        Context context = getContext();

        try {
            Intent intent;
            if (url != null && !url.trim().isEmpty()) {
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
                if (packageName != null && !packageName.trim().isEmpty()) {
                    intent.setPackage(packageName.trim());
                }
            } else if (packageName != null && !packageName.trim().isEmpty()) {
                intent = context.getPackageManager().getLaunchIntentForPackage(packageName.trim());
                if (intent == null) {
                    call.reject("La aplicación '" + packageName + "' no está instalada o no tiene lanzador.");
                    return;
                }
            } else {
                call.reject("Se requiere packageName o url para abrir una aplicación.");
                return;
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("packageName", packageName);
            res.put("url", url);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error abriendo aplicación: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getBatteryStatus(PluginCall call) {
        try {
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = getContext().registerReceiver(null, ifilter);
            if (batteryStatus == null) {
                call.reject("No se pudo leer el estado de la batería.");
                return;
            }
            int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            int tempTenths = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0);

            int pct = (scale > 0 && level >= 0) ? Math.round((level * 100f) / scale) : -1;
            boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                    || status == BatteryManager.BATTERY_STATUS_FULL;

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("percentage", pct);
            res.put("isCharging", isCharging);
            res.put("temperatureC", tempTenths / 10.0);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Error leyendo batería: " + e.getMessage(), e);
        }
    }
}
