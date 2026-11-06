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

import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Jarvis Hub Master Widget (Mega-Widget Todo-en-Uno).
 * Carrusel interactivo que permite alternar instantáneamente entre:
 * 0 - Finanzas (Saldo total y flujo de hoy)
 * 1 - Hábitos (Cumplimiento y rachas)
 * 2 - Moto (Odómetro y vida útil del aceite)
 * 3 - Metas del día (Checklist y porcentaje)
 */
public class JarvisHubWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_HUB_PAGE = "com.jarvis.personal.ACTION_HUB_PAGE";
    public static final String EXTRA_DIRECTION = "direction";

    public static final String PREFS = "jarvis_widgets";
    public static final String KEY_HUB_PAGE = "hub_current_page";
    public static final int TOTAL_PAGES = 4;

    private static final int[] ROW_HABITO_IDS = {
        R.id.hub_habito_row_1,
        R.id.hub_habito_row_2,
        R.id.hub_habito_row_3,
        R.id.hub_habito_row_4
    };
    private static final int[] ICON_HABITO_IDS = {
        R.id.hub_habito_icon_1,
        R.id.hub_habito_icon_2,
        R.id.hub_habito_icon_3,
        R.id.hub_habito_icon_4
    };
    private static final int[] NAME_HABITO_IDS = {
        R.id.hub_habito_name_1,
        R.id.hub_habito_name_2,
        R.id.hub_habito_name_3,
        R.id.hub_habito_name_4
    };
    private static final int[] STREAK_HABITO_IDS = {
        R.id.hub_habito_streak_1,
        R.id.hub_habito_streak_2,
        R.id.hub_habito_streak_3,
        R.id.hub_habito_streak_4
    };

    private static final int[] ROW_META_IDS = {
        R.id.hub_meta_row_1,
        R.id.hub_meta_row_2,
        R.id.hub_meta_row_3,
        R.id.hub_meta_row_4
    };
    private static final int[] DOT_META_IDS = {
        R.id.hub_meta_dot_1,
        R.id.hub_meta_dot_2,
        R.id.hub_meta_dot_3,
        R.id.hub_meta_dot_4
    };
    private static final int[] TITLE_META_IDS = {
        R.id.hub_meta_title_1,
        R.id.hub_meta_title_2,
        R.id.hub_meta_title_3,
        R.id.hub_meta_title_4
    };
    private static final int[] TIME_META_IDS = {
        R.id.hub_meta_time_1,
        R.id.hub_meta_time_2,
        R.id.hub_meta_time_3,
        R.id.hub_meta_time_4
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent != null && ACTION_HUB_PAGE.equals(intent.getAction())) {
            int direction = intent.getIntExtra(EXTRA_DIRECTION, 1);
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            int currentPage = prefs.getInt(KEY_HUB_PAGE, 0);
            int newPage = (currentPage + direction) % TOTAL_PAGES;
            if (newPage < 0) {
                newPage += TOTAL_PAGES;
            }
            prefs.edit().putInt(KEY_HUB_PAGE, newPage).apply();
            updateAll(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, JarvisHubWidgetProvider.class));
        if (ids != null && ids.length > 0) {
            for (int id : ids) {
                manager.updateAppWidget(id, buildViews(context));
            }
        }
    }

    public static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_jarvis_hub);

        // Click en el cuerpo del widget abre la app
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            10,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_hub_root, openPendingIntent);

        // Botón Anterior (◀)
        Intent prevIntent = new Intent(context, JarvisHubWidgetProvider.class);
        prevIntent.setAction(ACTION_HUB_PAGE);
        prevIntent.putExtra(EXTRA_DIRECTION, -1);
        PendingIntent prevPendingIntent = PendingIntent.getBroadcast(
            context,
            1001,
            prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.hub_btn_prev, prevPendingIntent);

        // Botón Siguiente (▶)
        Intent nextIntent = new Intent(context, JarvisHubWidgetProvider.class);
        nextIntent.setAction(ACTION_HUB_PAGE);
        nextIntent.putExtra(EXTRA_DIRECTION, 1);
        PendingIntent nextPendingIntent = PendingIntent.getBroadcast(
            context,
            1002,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.hub_btn_next, nextPendingIntent);

        // Leer página actual
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int page = prefs.getInt(KEY_HUB_PAGE, 0);
        if (page < 0 || page >= TOTAL_PAGES) {
            page = 0;
        }

        // Indicador de página
        views.setTextViewText(R.id.hub_page_indicator, (page + 1) + "/4");

        // Alternar visibilidad de secciones
        views.setViewVisibility(R.id.hub_section_finanzas, page == 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.hub_section_habitos, page == 1 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.hub_section_moto, page == 2 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.hub_section_metas, page == 3 ? View.VISIBLE : View.GONE);

        // Renderizar datos de cada sección
        renderFinanzas(context, views, prefs, page == 0);
        renderHabitos(context, views, prefs, page == 1);
        renderMoto(context, views, prefs, page == 2);
        renderMetas(context, views, page == 3);

        return views;
    }

    // ==================== RENDERIZADORES ====================

    private static void renderFinanzas(Context context, RemoteViews views, SharedPreferences prefs, boolean isActive) {
        String raw = prefs.getString(FinanzasWidgetProvider.KEY_FINANZAS_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "📊 Finanzas");
                views.setTextViewText(R.id.hub_header_date, "Hoy");
            }
            views.setTextViewText(R.id.hub_finanzas_saldo_total, "$0 COP");
            views.setTextViewText(R.id.hub_finanzas_gastos_hoy, "-$0 COP");
            views.setTextViewText(R.id.hub_finanzas_ingresos_hoy, "+$0 COP");
            views.setTextViewText(R.id.hub_finanzas_medios_summary, "Abre Jarvis para sincronizar finanzas.");
            views.setTextViewText(R.id.hub_finanzas_updated, "Abre la app");
            return;
        }

        try {
            JSONObject data = new JSONObject(raw);
            double saldoTotal = data.optDouble("saldo_total", 0.0);
            double gastosHoy = data.optDouble("gastos_hoy", 0.0);
            double ingresosHoy = data.optDouble("ingresos_hoy", 0.0);
            String fecha = data.optString("fecha", "");
            String actualizado = data.optString("actualizado_en", "");

            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "📊 Finanzas");
                views.setTextViewText(R.id.hub_header_date, formatDate(fecha));
            }

            views.setTextViewText(R.id.hub_finanzas_saldo_total, formatMoney(saldoTotal));
            views.setTextViewText(R.id.hub_finanzas_gastos_hoy, "-" + formatMoney(gastosHoy));
            views.setTextViewText(R.id.hub_finanzas_ingresos_hoy, "+" + formatMoney(ingresosHoy));
            views.setTextViewText(R.id.hub_finanzas_updated, formatUpdated(actualizado));

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
                views.setTextViewText(R.id.hub_finanzas_medios_summary, sb.toString());
            } else {
                views.setTextViewText(R.id.hub_finanzas_medios_summary, "Abre Jarvis para ver el desglose.");
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.hub_finanzas_saldo_total, "$0 COP");
            views.setTextViewText(R.id.hub_finanzas_gastos_hoy, "-$0 COP");
            views.setTextViewText(R.id.hub_finanzas_ingresos_hoy, "+$0 COP");
            views.setTextViewText(R.id.hub_finanzas_medios_summary, "Abre Jarvis para sincronizar.");
            views.setTextViewText(R.id.hub_finanzas_updated, "Abre la app");
        }
    }

    private static void renderHabitos(Context context, RemoteViews views, SharedPreferences prefs, boolean isActive) {
        String raw = prefs.getString(HabitosWidgetProvider.KEY_HABITOS_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🧘 Hábitos");
                views.setTextViewText(R.id.hub_header_date, "Hoy");
            }
            views.setTextViewText(R.id.hub_habitos_progress_text, "0 de 0");
            views.setProgressBar(R.id.hub_habitos_progress, 100, 0, false);
            views.setViewVisibility(R.id.hub_habitos_empty, View.VISIBLE);
            views.setTextViewText(R.id.hub_habitos_empty, "Abre Jarvis para sincronizar hábitos.");
            views.setTextViewText(R.id.hub_habitos_updated, "Abre la app");
            for (int id : ROW_HABITO_IDS) {
                views.setViewVisibility(id, View.GONE);
            }
            return;
        }

        try {
            JSONObject data = new JSONObject(raw);
            int total = data.optInt("total", 0);
            int completados = data.optInt("completados", 0);
            int porcentaje = data.optInt("porcentaje", 0);
            String fecha = data.optString("fecha", "");
            String actualizado = data.optString("actualizado_en", "");

            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🧘 Hábitos");
                views.setTextViewText(R.id.hub_header_date, formatDate(fecha));
            }

            views.setTextViewText(R.id.hub_habitos_progress_text, completados + " de " + total);
            views.setProgressBar(R.id.hub_habitos_progress, 100, Math.max(0, Math.min(100, porcentaje)), false);
            views.setTextViewText(R.id.hub_habitos_updated, formatUpdated(actualizado));

            JSONArray habitos = data.optJSONArray("habitos");
            for (int i = 0; i < ROW_HABITO_IDS.length; i++) {
                if (habitos == null || i >= habitos.length()) {
                    views.setViewVisibility(ROW_HABITO_IDS[i], View.GONE);
                    continue;
                }
                JSONObject h = habitos.optJSONObject(i);
                if (h == null) {
                    views.setViewVisibility(ROW_HABITO_IDS[i], View.GONE);
                    continue;
                }

                boolean completado = h.optBoolean("completado", false);
                String icono = h.optString("icono", "✅");
                String nombre = h.optString("nombre", "Hábito");
                int racha = h.optInt("racha", 0);

                views.setViewVisibility(ROW_HABITO_IDS[i], View.VISIBLE);
                views.setTextViewText(ICON_HABITO_IDS[i], completado ? "✓" : icono);
                views.setTextColor(ICON_HABITO_IDS[i], completado ? Color.parseColor("#5DE8C4") : Color.parseColor("#E8A85D"));
                views.setTextViewText(NAME_HABITO_IDS[i], nombre);
                views.setTextColor(NAME_HABITO_IDS[i], completado ? Color.parseColor("#7A7A86") : Color.parseColor("#F5F5F7"));

                String streakText = racha > 0 ? ("🔥 " + racha) : "";
                views.setTextViewText(STREAK_HABITO_IDS[i], streakText);
            }

            boolean sinHabitos = total == 0;
            views.setViewVisibility(R.id.hub_habitos_empty, sinHabitos ? View.VISIBLE : View.GONE);
        } catch (Exception e) {
            views.setTextViewText(R.id.hub_habitos_progress_text, "0 de 0");
            views.setProgressBar(R.id.hub_habitos_progress, 100, 0, false);
            views.setViewVisibility(R.id.hub_habitos_empty, View.VISIBLE);
            for (int id : ROW_HABITO_IDS) {
                views.setViewVisibility(id, View.GONE);
            }
        }
    }

    private static void renderMoto(Context context, RemoteViews views, SharedPreferences prefs, boolean isActive) {
        String raw = prefs.getString(MotoWidgetProvider.KEY_MOTO_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🛵 Moto");
                views.setTextViewText(R.id.hub_header_date, "Mantenimiento");
            }
            views.setTextViewText(R.id.hub_moto_km_actuales, "0");
            views.setProgressBar(R.id.hub_moto_progress, 100, 100, false);
            views.setTextViewText(R.id.hub_moto_porcentaje_text, "100%");
            views.setViewVisibility(R.id.hub_moto_alerta_badge, View.GONE);
            views.setTextViewText(R.id.hub_moto_restantes_text, "Abre Jarvis para sincronizar moto.");
            views.setTextViewText(R.id.hub_moto_updated, "Abre la app");
            return;
        }

        try {
            JSONObject data = new JSONObject(raw);
            int kmActuales = data.optInt("km_actuales", 0);
            int kmRestantes = data.optInt("km_restantes", 0);
            double porcentajeVida = data.optDouble("porcentaje_vida_aceite", 100.0);
            boolean alerta = data.optBoolean("alerta", false);
            String actualizado = data.optString("actualizado_en", "");

            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🛵 Moto");
                views.setTextViewText(R.id.hub_header_date, "Aceite y Km");
            }

            DecimalFormat df = new DecimalFormat("#,###");
            views.setTextViewText(R.id.hub_moto_km_actuales, df.format(kmActuales));

            int pctInt = (int) Math.max(0, Math.min(100, Math.round(porcentajeVida)));
            views.setProgressBar(R.id.hub_moto_progress, 100, pctInt, false);
            views.setTextViewText(R.id.hub_moto_porcentaje_text, pctInt + "%");

            if (alerta || pctInt <= 10) {
                views.setViewVisibility(R.id.hub_moto_alerta_badge, View.VISIBLE);
                views.setTextColor(R.id.hub_moto_porcentaje_text, Color.parseColor("#E85D5D"));
            } else if (pctInt <= 25) {
                views.setViewVisibility(R.id.hub_moto_alerta_badge, View.GONE);
                views.setTextColor(R.id.hub_moto_porcentaje_text, Color.parseColor("#E8A85D"));
            } else {
                views.setViewVisibility(R.id.hub_moto_alerta_badge, View.GONE);
                views.setTextColor(R.id.hub_moto_porcentaje_text, Color.parseColor("#5DE8C4"));
            }

            if (kmRestantes <= 0) {
                views.setTextViewText(R.id.hub_moto_restantes_text, "Cambio de aceite vencido (" + df.format(Math.abs(kmRestantes)) + " km pasados)");
                views.setTextColor(R.id.hub_moto_restantes_text, Color.parseColor("#E85D5D"));
            } else {
                views.setTextViewText(R.id.hub_moto_restantes_text, "Restan " + df.format(kmRestantes) + " km para cambio de aceite");
                views.setTextColor(R.id.hub_moto_restantes_text, Color.parseColor("#A0A0B0"));
            }

            views.setTextViewText(R.id.hub_moto_updated, formatUpdated(actualizado));
        } catch (Exception e) {
            views.setTextViewText(R.id.hub_moto_km_actuales, "0");
            views.setProgressBar(R.id.hub_moto_progress, 100, 100, false);
            views.setTextViewText(R.id.hub_moto_porcentaje_text, "100%");
            views.setViewVisibility(R.id.hub_moto_alerta_badge, View.GONE);
            views.setTextViewText(R.id.hub_moto_restantes_text, "Abre Jarvis para sincronizar moto.");
            views.setTextViewText(R.id.hub_moto_updated, "Abre la app");
        }
    }

    private static void renderMetas(Context context, RemoteViews views, boolean isActive) {
        // Leer de MetasWidgetProvider.PREFS con fallback
        SharedPreferences metasPrefs = context.getSharedPreferences(MetasWidgetProvider.PREFS, Context.MODE_PRIVATE);
        String raw = metasPrefs.getString(MetasWidgetProvider.KEY_JSON, null);
        if (raw == null || raw.trim().isEmpty()) {
            SharedPreferences commonPrefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            raw = commonPrefs.getString(MetasWidgetProvider.KEY_JSON, null);
        }

        if (raw == null || raw.trim().isEmpty()) {
            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🎯 Metas de hoy");
                views.setTextViewText(R.id.hub_header_date, "Hoy");
            }
            views.setTextViewText(R.id.hub_metas_progress_text, "0 de 0");
            views.setProgressBar(R.id.hub_metas_progress, 100, 0, false);
            views.setViewVisibility(R.id.hub_metas_empty, View.VISIBLE);
            views.setTextViewText(R.id.hub_metas_empty, "Abre Jarvis para sincronizar metas.");
            views.setTextViewText(R.id.hub_metas_updated, "Abre la app");
            for (int id : ROW_META_IDS) {
                views.setViewVisibility(id, View.GONE);
            }
            return;
        }

        try {
            JSONObject summary = new JSONObject(raw);
            int total = summary.optInt("total", 0);
            int completadas = summary.optInt("completadas", 0);
            int porcentaje = summary.optInt("porcentaje", 0);
            String fecha = summary.optString("fecha", "");
            String actualizado = summary.optString("actualizado_en", "");

            if (isActive) {
                views.setTextViewText(R.id.hub_header_title, "🎯 Metas de hoy");
                views.setTextViewText(R.id.hub_header_date, formatDate(fecha));
            }

            views.setTextViewText(R.id.hub_metas_progress_text, completadas + " de " + total);
            views.setProgressBar(R.id.hub_metas_progress, 100, Math.max(0, Math.min(100, porcentaje)), false);
            views.setTextViewText(R.id.hub_metas_updated, formatUpdated(actualizado));

            JSONArray metas = summary.optJSONArray("metas");
            for (int i = 0; i < ROW_META_IDS.length; i++) {
                if (metas == null || i >= metas.length()) {
                    views.setViewVisibility(ROW_META_IDS[i], View.GONE);
                    continue;
                }
                JSONObject meta = metas.optJSONObject(i);
                if (meta == null) {
                    views.setViewVisibility(ROW_META_IDS[i], View.GONE);
                    continue;
                }

                boolean completada = meta.optBoolean("completada", false);
                String prioridad = meta.optString("prioridad", "media");
                String titulo = meta.optString("titulo", "Meta");
                String hora = meta.optString("hora", "");
                if ("null".equals(hora)) {
                    hora = "";
                }

                views.setViewVisibility(ROW_META_IDS[i], View.VISIBLE);
                views.setTextViewText(DOT_META_IDS[i], completada ? "✓" : "●");
                views.setTextColor(DOT_META_IDS[i], completada ? Color.parseColor("#5DE8C4") : colorPrioridad(prioridad));
                views.setTextViewText(TITLE_META_IDS[i], titulo);
                views.setTextColor(TITLE_META_IDS[i], completada ? Color.parseColor("#7A7A86") : Color.parseColor("#F5F5F7"));
                views.setTextViewText(TIME_META_IDS[i], hora);
                views.setTextColor(TIME_META_IDS[i], Color.parseColor("#8A8A96"));
            }

            boolean sinMetas = total == 0;
            views.setViewVisibility(R.id.hub_metas_empty, sinMetas ? View.VISIBLE : View.GONE);
        } catch (Exception exception) {
            views.setTextViewText(R.id.hub_metas_progress_text, "0 de 0");
            views.setProgressBar(R.id.hub_metas_progress, 100, 0, false);
            views.setViewVisibility(R.id.hub_metas_empty, View.VISIBLE);
            for (int id : ROW_META_IDS) {
                views.setViewVisibility(id, View.GONE);
            }
        }
    }

    // ==================== UTILIDADES DE FORMATO ====================

    private static int colorPrioridad(String prioridad) {
        if ("alta".equals(prioridad)) {
            return Color.parseColor("#E85D5D");
        } else if ("baja".equals(prioridad)) {
            return Color.parseColor("#5D8AE8");
        }
        return Color.parseColor("#E8A85D");
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
