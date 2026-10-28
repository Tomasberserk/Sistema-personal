package com.jarvis.personal.widget;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente mínimo entre la app web y el widget nativo.
 *
 * La app envía un resumen ya calculado; el widget solo lo cachea y lo pinta.
 * No se exponen tokens ni credenciales al proceso del widget.
 */
@CapacitorPlugin(name = "MetasWidget")
public class MetasWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.reject("json es obligatorio");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(MetasWidgetProvider.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(MetasWidgetProvider.KEY_JSON, json).apply();
        MetasWidgetProvider.updateAll(context);

        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(MetasWidgetProvider.PREFS, Context.MODE_PRIVATE);
        prefs.edit().remove(MetasWidgetProvider.KEY_JSON).apply();
        MetasWidgetProvider.updateAll(context);
        call.resolve();
    }
}
