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
 * Widget de pantalla de inicio con Hábitos y Rachas de hoy.
 */
public class HabitosWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "jarvis_widgets";
    public static final String KEY_HABITOS_JSON = "habitos_widget_json";

    private static final int[] ROW_IDS = {
        R.id.widget_habito_row_1,
        R.id.widget_habito_row_2,
        R.id.widget_habito_row_3,
        R.id.widget_habito_row_4,
        R.id.widget_habito_row_5,
    };
    private static final int[] ICON_IDS = {
        R.id.widget_habito_icon_1,
        R.id.widget_habito_icon_2,
        R.id.widget_habito_icon_3,
        R.id.widget_habito_icon_4,
        R.id.widget_habito_icon_5,
    };
    private static final int[] NAME_IDS = {
        R.id.widget_habito_name_1,
        R.id.widget_habito_name_2,
        R.id.widget_habito_name_3,
        R.id.widget_habito_name_4,
        R.id.widget_habito_name_5,
    };
    private static final int[] STREAK_IDS = {
        R.id.widget_habito_streak_1,
        R.id.widget_habito_streak_2,
        R.id.widget_habito_streak_3,
        R.id.widget_habito_streak_4,
        R.id.widget_habito_streak_5,
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, HabitosWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habitos);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            2,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_habitos_root, openPendingIntent);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_HABITOS_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            renderEmpty(views);
            return views;
        }

        try {
            JSONObject data = new JSONObject(raw);
            int total = data.optInt("total", 0);
            int completados = data.optInt("completados", 0);
            int porcentaje = data.optInt("porcentaje", 0);
            String fecha = data.optString("fecha", "");
            String actualizado = data.optString("actualizado_en", "");

            views.setTextViewText(R.id.widget_habitos_date, formatDate(fecha));
            views.setTextViewText(R.id.widget_habitos_progress_text, completados + " de " + total);
            views.setProgressBar(R.id.widget_habitos_progress, 100, Math.max(0, Math.min(100, porcentaje)), false);
            views.setTextViewText(R.id.widget_habitos_updated, formatUpdated(actualizado));

            JSONArray habitos = data.optJSONArray("habitos");
            for (int i = 0; i < ROW_IDS.length; i++) {
                if (habitos == null || i >= habitos.length()) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                    continue;
                }
                JSONObject h = habitos.optJSONObject(i);
                if (h == null) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE);
                    continue;
                }

                boolean completado = h.optBoolean("completado", false);
                String icono = h.optString("icono", "✅");
                String nombre = h.optString("nombre", "Hábito");
                int racha = h.optInt("racha", 0);

                views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(ICON_IDS[i], completado ? "✓" : icono);
                views.setTextColor(ICON_IDS[i], completado ? Color.parseColor("#5DE8C4") : Color.parseColor("#E8A85D"));

                views.setTextViewText(NAME_IDS[i], nombre);
                views.setTextColor(NAME_IDS[i], completado ? Color.parseColor("#7A7A86") : Color.parseColor("#F5F5F7"));

                String streakText = racha > 0 ? ("🔥 " + racha) : "";
                views.setTextViewText(STREAK_IDS[i], streakText);
            }

            boolean sinHabitos = total == 0;
            views.setViewVisibility(R.id.widget_habitos_empty, sinHabitos ? View.VISIBLE : View.GONE);
            if (sinHabitos) {
                views.setTextViewText(R.id.widget_habitos_empty, "Sin hábitos activos. Abre Jarvis para configurarlos.");
            }
        } catch (Exception e) {
            renderEmpty(views);
        }

        return views;
    }

    private static void renderEmpty(RemoteViews views) {
        views.setTextViewText(R.id.widget_habitos_date, "Hoy");
        views.setTextViewText(R.id.widget_habitos_progress_text, "0 de 0");
        views.setProgressBar(R.id.widget_habitos_progress, 100, 0, false);
        views.setTextViewText(R.id.widget_habitos_updated, "Abre la app");
        views.setViewVisibility(R.id.widget_habitos_empty, View.VISIBLE);
        views.setTextViewText(R.id.widget_habitos_empty, "Abre Jarvis para sincronizar tus hábitos.");
        for (int i = 0; i < ROW_IDS.length; i++) {
            views.setViewVisibility(ROW_IDS[i], View.GONE);
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
            if (date == null) return "Actualizado ahora";
            SimpleDateFormat output = new SimpleDateFormat("h:mm a", new Locale("es", "CO"));
            return "Actualizado " + output.format(date);
        } catch (Exception ignored) {
            return "Actualizado ahora";
        }
    }
}
