package com.jarvis.personal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.jarvis.personal.widget.MetasWidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MetasWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
