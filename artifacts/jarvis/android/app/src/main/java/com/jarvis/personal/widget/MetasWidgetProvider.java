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

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Widget de pantalla de inicio con el resumen de metas del día.
 *
 * La app actualiza el JSON mediante el plugin MetasWidget. El widget no guarda
 * tokens ni llama a la API por su cuenta: solo pinta la última instantánea que
 * recibió de la sesión autenticada.
 */
public class MetasWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "metas_widget";
    public static final String KEY_JSON = "metas_widget_json";

    private static final int[] ROW_IDS = {
        R.id.widget_meta_row_1,
        R.id.widget_meta_row_2,
        R.id.widget_meta_row_3,
        R.id.widget_meta_row_4,
        R.id.widget_meta_row_5,
    };
    private static final int[] DOT_IDS = {
        R.id.widget_meta_dot_1,
        R.id.widget_meta_dot_2,
        R.id.widget_meta_dot_3,
        R.id.widget_meta_dot_4,
        R.id.widget_meta_dot_5,
    };
    private static final int[] TITLE_IDS = {
        R.id.widget_meta_title_1,
        R.id.widget_meta_title_2,
        R.id.widget_meta_title_3,
        R.id.widget_meta_title_4,
        R.id.widget_meta_title_5,
    };
    private static final int[] TIME_IDS = {
        R.id.widget_meta_time_1,
        R.id.widget_meta_time_2,
        R.id.widget_meta_time_3,
        R.id.widget_meta_time_4,
        R.id.widget_meta_time_5,
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MetasWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_metas);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            renderEmpty(views);
            return views;
        }

        try {
            JSONObject summary = new JSONObject(raw);
            int total = summary.optInt("total", 0);
            int completadas = summary.optInt("completadas", 0);
            int porcentaje = summary.optInt("porcentaje", 0);
            String fecha = summary.optString("fecha", "");
            String actualizado = summary.optString("actualizado_en", "");

            views.setTextViewText(R.id.widget_date, formatDate(fecha));
            views.setTextViewText(R.id.widget_progress_text, completadas + " de " + total);
            views.setProgressBar(R.id.widget_progress, 100, Math.max(0, Math.min(100, porcentaje)), false);
            views.setTextViewText(R.id.widget_updated, formatUpdated(actualizado));

            JSONArray metas = summary.optJSONArray("metas");
            for (int i = 0; i < ROW_IDS.length; i++) {
                if (metas == null || i >= metas.length()) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                    continue;
                }
                JSONObject meta = metas.optJSONObject(i);
                if (meta == null) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                    continue;
                }

                boolean completada = meta.optBoolean("completada", false);
                String prioridad = meta.optString("prioridad", "media");
                String titulo = meta.optString("titulo", "Meta");
                String hora = meta.optString("hora", "");
                if ("null".equals(hora)) {
                    hora = "";
                }

                views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(DOT_IDS[i], completada ? "✓" : "●");
                views.setTextColor(DOT_IDS[i], completada ? Color.parseColor("#5DE8C4") : colorPrioridad(prioridad));
                views.setTextViewText(TITLE_IDS[i], titulo);
                views.setTextColor(TITLE_IDS[i], completada ? Color.parseColor("#7A7A86") : Color.parseColor("#F5F5F7"));
                views.setTextViewText(TIME_IDS[i], hora);
                views.setTextColor(TIME_IDS[i], Color.parseColor("#8A8A96"));
            }

            boolean sinMetas = total == 0;
            views.setViewVisibility(R.id.widget_empty, sinMetas ? View.VISIBLE : View.GONE);
            if (sinMetas) {
                views.setTextViewText(R.id.widget_empty, "Sin metas para hoy. Abre Jarvis para agregar una.");
            }
        } catch (Exception exception) {
            renderEmpty(views);
        }

        return views;
    }

    private static void renderEmpty(RemoteViews views) {
        views.setTextViewText(R.id.widget_date, "Metas del día");
        views.setTextViewText(R.id.widget_progress_text, "0 de 0");
        views.setProgressBar(R.id.widget_progress, 100, 0, false);
        views.setTextViewText(R.id.widget_updated, "Abre Jarvis para actualizar");
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        views.setTextViewText(R.id.widget_empty, "Abre Jarvis y entra a Metas del día para activar el widget.");
        for (int i = 0; i < ROW_IDS.length; i++) {
            views.setViewVisibility(ROW_IDS[i], View.GONE);
        }
    }

    private static int colorPrioridad(String prioridad) {
        switch (prioridad) {
            case "alta":
                return Color.parseColor("#E85D5D");
            case "baja":
                return Color.parseColor("#5D8AE8");
            default:
                return Color.parseColor("#E8A85D");
        }
    }

    private static String formatDate(String isoDate) {
        if (isoDate == null || isoDate.isEmpty()) return "Hoy";
        try {
            SimpleDateFormat input = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
            Date date = input.parse(isoDate);
            if (date == null) return isoDate;
            SimpleDateFormat output = new SimpleDateFormat("EEE d MMM", new Locale("es", "CO"));
            String formatted = output.format(date);
            return formatted.substring(0, 1).toUpperCase(new Locale("es", "CO")) + formatted.substring(1);
        } catch (Exception ignored) {
            return isoDate;
        }
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
            if (date == null) {
                return "Actualizado ahora";
            }

            SimpleDateFormat output = new SimpleDateFormat("h:mm a", new Locale("es", "CO"));
            return "Actualizado " + output.format(date);
        } catch (Exception ignored) {
            return "Actualizado ahora";
        }
    }
}
