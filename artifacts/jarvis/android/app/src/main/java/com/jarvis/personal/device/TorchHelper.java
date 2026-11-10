package com.jarvis.personal.device;

import android.content.Context;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Build;

/**
 * Shared hardware torch helper using official Camera2 CameraManager.setTorchMode().
 */
public final class TorchHelper {
    private TorchHelper() {}

    public static String setTorch(Context context, boolean enabled) throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            throw new UnsupportedOperationException("Android 6.0+ requerido para CameraManager.setTorchMode");
        }
        CameraManager cameraManager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (cameraManager == null) {
            throw new IllegalStateException("CameraManager no disponible en este dispositivo");
        }

        String targetCameraId = null;
        for (String id : cameraManager.getCameraIdList()) {
            CameraCharacteristics chars = cameraManager.getCameraCharacteristics(id);
            Boolean hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
            Integer lensFacing = chars.get(CameraCharacteristics.LENS_FACING);
            if (Boolean.TRUE.equals(hasFlash)) {
                targetCameraId = id;
                if (lensFacing != null && lensFacing == CameraCharacteristics.LENS_FACING_BACK) {
                    break;
                }
            }
        }

        if (targetCameraId == null) {
            throw new IllegalStateException("No se encontró cámara trasera con flash LED disponible");
        }

        cameraManager.setTorchMode(targetCameraId, enabled);
        return targetCameraId;
    }
}
