package com.jarvis.personal.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import com.jarvis.personal.MainActivity;
import com.jarvis.personal.R;

import org.json.JSONObject;

import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Widget de pantalla de inicio para la Moto (Aceite y Odómetro).
 */
public class MotoWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "jarvis_widgets";
    public static final String KEY_MOTO_JSON = "moto_widget_json";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MotoWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_moto);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            3,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_moto_root, openPendingIntent);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_MOTO_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            renderEmpty(views);
            return views;
        }

        try {
            JSONObject data = new JSONObject(raw);
            int kmActuales = data.optInt("km_actuales", 0);
            int kmRestantes = data.optInt("km_restantes", 0);
            double porcentajeVida = data.optDouble("porcentaje_vida_aceite", 100.0);
            boolean alerta = data.optBoolean("alerta", false);
            String actualizado = data.optString("actualizado_en", "");

            DecimalFormat df = new DecimalFormat("#,###");
            views.setTextViewText(R.id.widget_moto_km_actuales, df.format(kmActuales));

            int pctInt = (int) Math.max(0, Math.min(100, Math.round(porcentajeVida)));
            views.setProgressBar(R.id.widget_moto_progress, 100, pctInt, false);
            views.setTextViewText(R.id.widget_moto_porcentaje_text, pctInt + "%");

            if (alerta || pctInt <= 10) {
                views.setViewVisibility(R.id.widget_moto_alerta_badge, View.VISIBLE);
                views.setTextColor(R.id.widget_moto_porcentaje_text, Color.parseColor("#E85D5D"));
            } else if (pctInt <= 25) {
                views.setViewVisibility(R.id.widget_moto_alerta_badge, View.GONE);
                views.setTextColor(R.id.widget_moto_porcentaje_text, Color.parseColor("#E8A85D"));
            } else {
                views.setViewVisibility(R.id.widget_moto_alerta_badge, View.GONE);
                views.setTextColor(R.id.widget_moto_porcentaje_text, Color.parseColor("#5DE8C4"));
            }

            if (kmRestantes <= 0) {
                views.setTextViewText(R.id.widget_moto_restantes_text, "Cambio de aceite vencido (" + df.format(Math.abs(kmRestantes)) + " km pasados)");
                views.setTextColor(R.id.widget_moto_restantes_text, Color.parseColor("#E85D5D"));
            } else {
                views.setTextViewText(R.id.widget_moto_restantes_text, "Restan " + df.format(kmRestantes) + " km para cambio de aceite");
                views.setTextColor(R.id.widget_moto_restantes_text, Color.parseColor("#A0A0B0"));
            }

            views.setTextViewText(R.id.widget_moto_updated, formatUpdated(actualizado));
        } catch (Exception e) {
            renderEmpty(views);
        }

        return views;
    }

    private static void renderEmpty(RemoteViews views) {
        views.setTextViewText(R.id.widget_moto_km_actuales, "0");
        views.setProgressBar(R.id.widget_moto_progress, 100, 100, false);
        views.setTextViewText(R.id.widget_moto_porcentaje_text, "100%");
        views.setViewVisibility(R.id.widget_moto_alerta_badge, View.GONE);
        views.setTextViewText(R.id.widget_moto_restantes_text, "Abre Jarvis para sincronizar la moto.");
        views.setTextViewText(R.id.widget_moto_updated, "Abre la app");
    }

    private static String formatUpdated(String isoDateTime) {
        if (isoDateTime == null || isoDateTime.isEmpty()) {
            return "Actualizado ahora";
        }
        try {
            String cleaned = isoDateTime.replace("Z", "");
            int dot = cleaned.indexOf('.');
            if (dot >= 0) {
                cleaned = cleaned.substring(0, dot);
            }
            SimpleDateFormat input = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
            input.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date date = input.parse(cleaned);
            if (date == null) return "Actualizado ahora";
            SimpleDateFormat output = new SimpleDateFormat("h:mm a", new Locale("es", "CO"));
            return "Actualizado " + output.format(date);
        } catch (Exception ignored) {
            return "Actualizado ahora";
        }
    }
}
