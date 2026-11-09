package com.jarvis.personal.voice;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

public class AudioFocusController {
    private static final String TAG = "AudioFocusController";

    public interface AudioFocusListener {
        void onFocusLost(boolean isTransient);
        void onFocusGained();
        void onBecomingNoisy();
    }

    private final Context context;
    private final AudioManager audioManager;
    private final AudioFocusListener listener;
    private AudioFocusRequest focusRequest;
    private boolean isRegisteredNoisyReceiver = false;
    private boolean hasFocus = false;

    private final AudioManager.OnAudioFocusChangeListener focusChangeListener =
            new AudioManager.OnAudioFocusChangeListener() {
                @Override
                public void onAudioFocusChange(int focusChange) {
                    switch (focusChange) {
                        case AudioManager.AUDIOFOCUS_LOSS:
                            Log.w(TAG, "Audio focus lost permanently (e.g. phone call).");
                            hasFocus = false;
                            listener.onFocusLost(false);
                            break;
                        case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                        case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                            Log.w(TAG, "Audio focus lost transiently.");
                            hasFocus = false;
                            listener.onFocusLost(true);
                            break;
                        case AudioManager.AUDIOFOCUS_GAIN:
                            Log.i(TAG, "Audio focus gained.");
                            hasFocus = true;
                            listener.onFocusGained();
                            break;
                    }
                }
            };

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                Log.w(TAG, "Headphones/Bluetooth disconnected (becoming noisy).");
                listener.onBecomingNoisy();
            }
        }
    };

    public AudioFocusController(Context context, AudioFocusListener listener) {
        this.context = context.getApplicationContext();
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        this.listener = listener;
    }

    public boolean requestFocus() {
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener(focusChangeListener)
                    .build();

            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                    focusChangeListener,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
            );
        }

        hasFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        if (hasFocus) {
            registerNoisyReceiver();
        }
        return hasFocus;
    }

    public void abandonFocus() {
        unregisterNoisyReceiver();
        if (audioManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest);
                focusRequest = null;
            }
        } else {
            audioManager.abandonAudioFocus(focusChangeListener);
        }
        hasFocus = false;
    }

    private void registerNoisyReceiver() {
        if (!isRegisteredNoisyReceiver) {
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            context.registerReceiver(becomingNoisyReceiver, filter);
            isRegisteredNoisyReceiver = true;
        }
    }

    private void unregisterNoisyReceiver() {
        if (isRegisteredNoisyReceiver) {
            try {
                context.unregisterReceiver(becomingNoisyReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering noisy receiver", e);
            }
            isRegisteredNoisyReceiver = false;
        }
    }

    public boolean isHasFocus() {
        return hasFocus;
    }
}
