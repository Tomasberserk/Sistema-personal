package com.jarvis.personal.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import com.jarvis.personal.MainActivity;
import com.jarvis.personal.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Widget de pantalla de inicio con Saldo total y Gastos/Ingresos de hoy.
 */
public class FinanzasWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "jarvis_widgets";
    public static final String KEY_FINANZAS_JSON = "finanzas_widget_json";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, FinanzasWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_finanzas);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            1,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_finanzas_root, openPendingIntent);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_FINANZAS_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            renderEmpty(views);
            return views;
        }

        try {
            JSONObject data = new JSONObject(raw);
            double saldoTotal = data.optDouble("saldo_total", 0.0);
            double gastosHoy = data.optDouble("gastos_hoy", 0.0);
            double ingresosHoy = data.optDouble("ingresos_hoy", 0.0);
            String fecha = data.optString("fecha", "");
            String actualizado = data.optString("actualizado_en", "");

            views.setTextViewText(R.id.widget_finanzas_date, formatDate(fecha));
            views.setTextViewText(R.id.widget_finanzas_saldo_total, formatMoney(saldoTotal));
            views.setTextViewText(R.id.widget_finanzas_gastos_hoy, "-" + formatMoney(gastosHoy));
            views.setTextViewText(R.id.widget_finanzas_ingresos_hoy, "+" + formatMoney(ingresosHoy));
            views.setTextViewText(R.id.widget_finanzas_updated, formatUpdated(actualizado));

            // Medios principales
            JSONArray medios = data.optJSONArray("medios_principales");
            if (medios != null && medios.length() > 0) {
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < medios.length(); i++) {
                    JSONObject m = medios.optJSONObject(i);
                    if (m != null) {
                        if (sb.length() > 0) sb.append("  •  ");
                        sb.append(m.optString("icono", "💵")).append(" ");
                        sb.append(m.optString("nombre", "Cuenta")).append(": ");
                        sb.append(formatMoney(m.optDouble("saldo_actual", 0.0)));
                    }
                }
                views.setTextViewText(R.id.widget_finanzas_medios_summary, sb.toString());
            } else {
                views.setTextViewText(R.id.widget_finanzas_medios_summary, "Abre Jarvis para ver el desglose.");
            }
        } catch (Exception e) {
            renderEmpty(views);
        }

        return views;
    }

    private static void renderEmpty(RemoteViews views) {
        views.setTextViewText(R.id.widget_finanzas_date, "Hoy");
        views.setTextViewText(R.id.widget_finanzas_saldo_total, "$0 COP");
        views.setTextViewText(R.id.widget_finanzas_gastos_hoy, "-$0 COP");
        views.setTextViewText(R.id.widget_finanzas_ingresos_hoy, "+$0 COP");
        views.setTextViewText(R.id.widget_finanzas_medios_summary, "Abre Jarvis para sincronizar finanzas.");
        views.setTextViewText(R.id.widget_finanzas_updated, "Abre la app");
    }

    private static String formatMoney(double value) {
        NumberFormat nf = NumberFormat.getCurrencyInstance(new Locale("es", "CO"));
        nf.setMaximumFractionDigits(0);
        return nf.format(value);
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
