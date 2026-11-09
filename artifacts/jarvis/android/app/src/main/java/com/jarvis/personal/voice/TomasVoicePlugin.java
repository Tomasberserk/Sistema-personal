package com.jarvis.personal.voice;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TomasVoice")
public class TomasVoicePlugin extends Plugin {
    private static final String TAG = "TomasVoicePlugin";

    @Override
    public void load() {
        super.load();
        VoiceForegroundService.setStateListener((state, detail) -> {
            JSObject data = new JSObject();
            data.put("state", state);
            data.put("detail", detail);
            data.put("running", VoiceForegroundService.isRunning());
            notifyListeners("voiceStateChange", data);
        });
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        try {
            Intent serviceIntent = new Intent(context, VoiceForegroundService.class);
            serviceIntent.setAction(VoiceForegroundService.ACTION_START);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("state", "STARTING");
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Error starting VoiceForegroundService", e);
            call.reject("Failed to start voice foreground service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        try {
            Intent serviceIntent = new Intent(context, VoiceForegroundService.class);
            serviceIntent.setAction(VoiceForegroundService.ACTION_STOP);
            context.startService(serviceIntent);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("state", "STOPPED");
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping VoiceForegroundService", e);
            call.reject("Failed to stop voice foreground service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject res = new JSObject();
        res.put("running", VoiceForegroundService.isRunning());
        res.put("state", VoiceForegroundService.getCurrentState());
        call.resolve(res);
    }
}
