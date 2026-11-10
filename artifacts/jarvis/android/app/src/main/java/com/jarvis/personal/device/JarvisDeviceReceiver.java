package com.jarvis.personal.device;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Explicit BroadcastReceiver for verified hardware torch control via ADB or local intents.
 * Sets resultCode=1 only when CameraManager.setTorchMode succeeds empirically.
 */
public class JarvisDeviceReceiver extends BroadcastReceiver {
    private static final String TAG = "JarvisDeviceReceiver";
    public static final String ACTION_TORCH = "com.jarvis.personal.ACTION_TORCH";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_TORCH.equals(intent.getAction())) {
            return;
        }
        boolean enabled = intent.getBooleanExtra("enabled", true);
        try {
            String camId = TorchHelper.setTorch(context, enabled);
            Log.i(TAG, "Torch updated cleanly on cameraId=" + camId + " enabled=" + enabled);
            setResultCode(1);
            setResultData(enabled ? "TORCH_ON" : "TORCH_OFF");
        } catch (Exception e) {
            Log.e(TAG, "Torch error", e);
            setResultCode(0);
            setResultData("TORCH_ERR: " + e.getMessage());
        }
    }
}
