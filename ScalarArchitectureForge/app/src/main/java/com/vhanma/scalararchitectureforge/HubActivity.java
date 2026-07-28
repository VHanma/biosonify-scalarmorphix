package com.vhanma.scalararchitectureforge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class HubActivity extends Activity {
    private static final int BG = Color.rgb(5, 11, 13);
    private static final int CARD = Color.rgb(14, 31, 34);
    private static final int MINT = Color.rgb(131, 241, 215);
    private static final int PURPLE = Color.rgb(144, 114, 224);
    private static final int GOLD = Color.rgb(250, 203, 101);
    private static final int TEXT = Color.rgb(235, 244, 242);
    private static final int MUTED = Color.rgb(165, 193, 188);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(22), dp(20), dp(30));
        root.setBackgroundColor(BG);
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = text("BIO-INFORMATIONAL TRANSFER FORGE", 27, TEXT, true);
        title.setLetterSpacing(0.035f);
        root.addView(title);

        TextView subtitle = text(
                "Scalar architecture audio forge + bifilar and caduceus engineering blueprint lab",
                14, MUTED, false);
        subtitle.setPadding(0, dp(6), 0, dp(16));
        root.addView(subtitle);

        LinearLayout forgeCard = card();
        root.addView(forgeCard, marginTop(0));
        forgeCard.addView(text("SCALAR ARCHITECTURE FORGE", 17, MINT, true));
        TextView forgeText = text(
                "Image, audio, and text encoding. 144-code map, 15 dimensional bands, custom ratios, phase-conjugate stereo WAV, animated visualizer, and JSON report.",
                13, TEXT, false);
        forgeText.setPadding(0, dp(8), 0, dp(12));
        forgeCard.addView(forgeText);
        Button openForge = button("OPEN AUDIO / IMAGE FORGE", MINT, Color.rgb(34, 42, 76));
        openForge.setOnClickListener(v -> startActivity(new Intent(this, MainActivity.class)));
        forgeCard.addView(openForge, height(dp(58)));

        LinearLayout engineeringCard = card();
        root.addView(engineeringCard, marginTop(dp(13)));
        engineeringCard.addView(text("GENERATOR ENGINEERING LAB", 17, PURPLE, true));
        TextView engineeringText = text(
                "Simple bifilar pancake and advanced caduceus/soliton profiles. Configure geometry, turns, wire gauge, voltage, carrier frequency, burst width, ferrite, core gap, TTL encoding, materials, crystals, plasmonic interface, and protocol records.",
                13, TEXT, false);
        engineeringText.setPadding(0, dp(8), 0, dp(12));
        engineeringCard.addView(engineeringText);
        Button openEngineering = button("OPEN ENGINEERING BLUEPRINT", PURPLE, Color.WHITE);
        openEngineering.setOnClickListener(v -> startActivity(new Intent(this, EngineeringActivity.class)));
        engineeringCard.addView(openEngineering, height(dp(58)));

        LinearLayout splitCard = card();
        root.addView(splitCard, marginTop(dp(13)));
        splitCard.addView(text("TWO OUTPUT PATHS", 15, GOLD, true));
        TextView splitText = text(
                "PHONE PATH\nAudible monitor, phase-pair WAV, waveform and code visualization.\n\nEXTERNAL-HARDWARE PATH\nMicrosecond TTL event sequence and complete generator profile export for a separate function generator or controller. The phone does not pretend its speaker is producing a 100–205 kHz carrier.",
                13, TEXT, false);
        splitText.setPadding(0, dp(8), 0, 0);
        splitCard.addView(splitText);

        TextView note = text(
                "This app implements the supplied blueprint as an experimental design, simulation, encoding, visualization, and logging system. Biological and non-Hertzian effects remain hypotheses to be tested rather than app-certified outcomes.",
                12, MUTED, false);
        note.setPadding(0, dp(14), 0, 0);
        root.addView(note);

        setContentView(scroll);
    }

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(18), dp(17), dp(18), dp(17));
        layout.setBackground(rounded(CARD, Color.rgb(28, 58, 61), 20));
        return layout;
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(foreground);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setBackground(rounded(background, background, 28));
        return button;
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setLineSpacing(0f, 1.18f);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams marginTop(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = top;
        return params;
    }

    private LinearLayout.LayoutParams height(int height) {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, height);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
