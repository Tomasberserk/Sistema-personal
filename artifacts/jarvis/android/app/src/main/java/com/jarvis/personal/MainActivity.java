package com.jarvis.personal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.jarvis.personal.device.JarvisDevicePlugin;
import com.jarvis.personal.voice.TomasVoicePlugin;
import com.jarvis.personal.widget.JarvisWidgetsPlugin;
import com.jarvis.personal.widget.MetasWidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MetasWidgetPlugin.class);
        registerPlugin(JarvisWidgetsPlugin.class);
        registerPlugin(TomasVoicePlugin.class);
        registerPlugin(JarvisDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
