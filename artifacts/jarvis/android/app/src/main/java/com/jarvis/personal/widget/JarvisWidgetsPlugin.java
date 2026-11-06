package com.jarvis.personal.widget;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin unificado para sincronizar instantáneas a todos los widgets de Jarvis:
 * - Metas del día
 * - Finanzas (saldo y flujo de hoy)
 * - Hábitos y rachas
 * - Moto (aceite y odómetro)
 */
@CapacitorPlugin(name = "JarvisWidgets")
public class JarvisWidgetsPlugin extends Plugin {

    private static final String PREFS_COMMON = "jarvis_widgets";

    @PluginMethod
    public void updateMetas(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.reject("json es obligatorio");
            return;
        }

        Context context = getContext();
        // Guardamos también en MetasWidgetProvider.PREFS para mantener compatibilidad
        SharedPreferences metasPrefs = context.getSharedPreferences(MetasWidgetProvider.PREFS, Context.MODE_PRIVATE);
        metasPrefs.edit().putString(MetasWidgetProvider.KEY_JSON, json).apply();
        SharedPreferences commonPrefs = context.getSharedPreferences(PREFS_COMMON, Context.MODE_PRIVATE);
        commonPrefs.edit().putString(MetasWidgetProvider.KEY_JSON, json).apply();
        MetasWidgetProvider.updateAll(context);
        JarvisHubWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void updateFinanzas(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.reject("json es obligatorio");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_COMMON, Context.MODE_PRIVATE);
        prefs.edit().putString(FinanzasWidgetProvider.KEY_FINANZAS_JSON, json).apply();
        FinanzasWidgetProvider.updateAll(context);
        JarvisHubWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void updateHabitos(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.reject("json es obligatorio");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_COMMON, Context.MODE_PRIVATE);
        prefs.edit().putString(HabitosWidgetProvider.KEY_HABITOS_JSON, json).apply();
        HabitosWidgetProvider.updateAll(context);
        JarvisHubWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void updateMoto(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.reject("json es obligatorio");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_COMMON, Context.MODE_PRIVATE);
        prefs.edit().putString(MotoWidgetProvider.KEY_MOTO_JSON, json).apply();
        MotoWidgetProvider.updateAll(context);
        JarvisHubWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void clearAll(PluginCall call) {
        Context context = getContext();

        // Limpiar metas
        SharedPreferences metasPrefs = context.getSharedPreferences(MetasWidgetProvider.PREFS, Context.MODE_PRIVATE);
        metasPrefs.edit().clear().apply();
        MetasWidgetProvider.updateAll(context);

        // Limpiar widgets comunes
        SharedPreferences commonPrefs = context.getSharedPreferences(PREFS_COMMON, Context.MODE_PRIVATE);
        commonPrefs.edit().clear().apply();
        FinanzasWidgetProvider.updateAll(context);
        HabitosWidgetProvider.updateAll(context);
        MotoWidgetProvider.updateAll(context);
        JarvisHubWidgetProvider.updateAll(context);

        call.resolve();
    }
}
