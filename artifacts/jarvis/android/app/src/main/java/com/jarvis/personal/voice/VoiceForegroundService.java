package com.jarvis.personal.voice;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.jarvis.personal.MainActivity;
import com.jarvis.personal.R;

public class VoiceForegroundService extends Service implements AudioFocusController.AudioFocusListener {
    private static final String TAG = "VoiceFGS";
    public static final String CHANNEL_ID = "tomas_voice_channel";
    public static final int NOTIFICATION_ID = 2026;

    public static final String ACTION_START = "com.jarvis.personal.voice.START";
    public static final String ACTION_STOP = "com.jarvis.personal.voice.STOP";
    public static final String ACTION_MUTE = "com.jarvis.personal.voice.MUTE";

    public interface StateListener {
        void onStateChanged(String state, String detail);
    }

    private static StateListener stateListener;
    private static volatile boolean isServiceRunning = false;
    private static volatile String currentState = "IDLE";

    private PowerManager.WakeLock wakeLock;
    private AudioFocusController audioFocusController;
    private boolean isMuted = false;

    // AudioRecord (16kHz mono)
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean isRecording = false;

    // AudioTrack (24kHz mono)
    private AudioTrack audioTrack;

    public static void setStateListener(StateListener listener) {
        stateListener = listener;
        if (listener != null) {
            listener.onStateChanged(currentState, isServiceRunning ? "RUNNING" : "STOPPED");
        }
    }

    public static boolean isRunning() {
        return isServiceRunning;
    }

    public static String getCurrentState() {
        return currentState;
    }

    private void updateState(String state, String detail) {
        currentState = state;
        Log.i(TAG, "Voice state changed: " + state + " (" + detail + ")");
        if (stateListener != null) {
            stateListener.onStateChanged(state, detail);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        audioFocusController = new AudioFocusController(this, this);

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jarvis:tomas_voice_fgs");
            wakeLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            stopVoiceRuntime();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_MUTE.equals(action)) {
            isMuted = !isMuted;
            updateNotification(isMuted ? "Micrófono silenciado" : "Escuchando...");
            return START_STICKY;
        }

        startVoiceRuntime();
        return START_STICKY;
    }

    private void startVoiceRuntime() {
        if (isServiceRunning) return;

        Notification notification = buildNotification("Asistente ejecutivo activo");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(30 * 60 * 1000L); // 30 min max lease
        }

        boolean focus = audioFocusController.requestFocus();
        Log.i(TAG, "Audio focus requested. Granted: " + focus);

        initAudioTrack();
        startAudioRecord();

        isServiceRunning = true;
        updateState("LISTENING", "FGS active");
    }

    private void stopVoiceRuntime() {
        stopAudioRecord();
        releaseAudioTrack();

        if (audioFocusController != null) {
            audioFocusController.abandonFocus();
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }

        isServiceRunning = false;
        updateState("IDLE", "FGS stopped");
        stopForeground(true);
    }

    private void initAudioTrack() {
        try {
            int bufferSize = AudioTrack.getMinBufferSize(
                    24000,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
            );

            audioTrack = new AudioTrack(
                    AudioManager.STREAM_VOICE_CALL,
                    24000,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(bufferSize, 24000 * 2),
                    AudioTrack.MODE_STREAM
            );
            audioTrack.play();
        } catch (Exception e) {
            Log.e(TAG, "Error initializing AudioTrack (24kHz):", e);
        }
    }

    private void releaseAudioTrack() {
        if (audioTrack != null) {
            try {
                audioTrack.stop();
                audioTrack.release();
            } catch (Exception ignored) {}
            audioTrack = null;
        }
    }

    private void startAudioRecord() {
        try {
            int bufferSize = AudioRecord.getMinBufferSize(
                    16000,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
            );

            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    16000,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(bufferSize, 16000 * 2)
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord could not be initialized");
                return;
            }

            audioRecord.startRecording();
            isRecording = true;

            recordingThread = new Thread(() -> {
                short[] buffer = new short[640]; // 40ms a 16kHz
                while (isRecording && !Thread.currentThread().isInterrupted()) {
                    if (isMuted) {
                        try {
                            Thread.sleep(40);
                        } catch (InterruptedException e) {
                            break;
                        }
                        continue;
                    }

                    int read = audioRecord.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        // Chunk capturado listo para streaming
                    }
                }
            }, "TomasAudioCaptureThread");
            recordingThread.start();
        } catch (SecurityException se) {
            Log.e(TAG, "Permission RECORD_AUDIO denied for FGS", se);
        } catch (Exception e) {
            Log.e(TAG, "Error starting AudioRecord:", e);
        }
    }

    private void stopAudioRecord() {
        isRecording = false;
        if (recordingThread != null) {
            recordingThread.interrupt();
            recordingThread = null;
        }
        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception ignored) {}
            audioRecord = null;
        }
    }

    public void playPcmChunk(byte[] pcmData) {
        if (audioTrack != null && pcmData != null && pcmData.length > 0) {
            audioTrack.write(pcmData, 0, pcmData.length);
        }
    }

    private Notification buildNotification(String contentText) {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent stopIntent = new Intent(this, VoiceForegroundService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Tomás 2.0 en línea")
                .setContentText(contentText)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(contentPendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Detener", stopPendingIntent)
                .build();
    }

    private void updateNotification(String contentText) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(contentText));
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Tomás 2.0 Asistente de Voz",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mantiene activa la presencia ejecutiva de Tomás 2.0 con audio en primer plano.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onFocusLost(boolean isTransient) {
        Log.w(TAG, "Audio focus lost. isTransient=" + isTransient);
        updateState("PAUSED", isTransient ? "Transient focus loss" : "Permanent focus loss");
        if (audioTrack != null) {
            audioTrack.pause();
        }
    }

    @Override
    public void onFocusGained() {
        Log.i(TAG, "Audio focus regained.");
        updateState("LISTENING", "Focus regained");
        if (audioTrack != null) {
            audioTrack.play();
        }
    }

    @Override
    public void onBecomingNoisy() {
        Log.w(TAG, "Audio becoming noisy. Pausing audio track.");
        if (audioTrack != null) {
            audioTrack.pause();
        }
    }

    @Override
    public void onDestroy() {
        stopVoiceRuntime();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
