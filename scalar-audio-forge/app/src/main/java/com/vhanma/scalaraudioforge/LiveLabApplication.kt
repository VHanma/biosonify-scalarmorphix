package com.vhanma.scalaraudioforge

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.CompoundButton
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import java.util.WeakHashMap

/**
 * Clone-only UX layer. It observes the existing Forge screen without replacing
 * its controls, then gives immediate visible feedback plus an animated method
 * preview whenever routing or methods change.
 */
class LiveLabApplication : Application(), Application.ActivityLifecycleCallbacks {
    private data class PanelState(
        val panel: LinearLayout,
        val headline: TextView,
        val detail: TextView,
        val live: LiveAnalysisView,
        var active: Boolean = true,
        var signature: String = "",
        var lastAction: String = "Ready",
        var expanded: Boolean = true
    )

    private val panels = WeakHashMap<Activity, PanelState>()

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityResumed(activity: Activity) {
        if (activity !is MainActivity) return
        val state = panels[activity] ?: inject(activity).also { panels[activity] = it }
        state.active = true
        scheduleSync(activity, state)
    }

    override fun onActivityPaused(activity: Activity) {
        panels[activity]?.active = false
    }

    override fun onActivityDestroyed(activity: Activity) {
        panels.remove(activity)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

    private fun inject(activity: MainActivity): PanelState {
        val content = activity.findViewById<FrameLayout>(android.R.id.content)
        val density = activity.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val panel = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(Color.argb(246, 14, 17, 26))
                setStroke(dp(1), Color.rgb(111, 233, 202))
            }
            elevation = dp(14).toFloat()
        }

        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val headline = TextView(activity).apply {
            text = "⚡ LIVE FEEDBACK • READY"
            textSize = 15f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
        }
        val toggle = Button(activity).apply {
            text = "MINIMIZE"
            isAllCaps = false
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(45, 36, 73))
        }
        header.addView(headline, LinearLayout.LayoutParams(0, dp(44), 1f))
        header.addView(toggle, LinearLayout.LayoutParams(dp(112), dp(44)))
        panel.addView(header)

        val detail = TextView(activity).apply {
            text = "Tap a method or routing choice. You will immediately see what changed."
            textSize = 12.5f
            setTextColor(Color.rgb(205, 211, 227))
            setPadding(0, dp(2), 0, dp(6))
        }
        panel.addView(detail)

        val live = LiveAnalysisView(activity)
        panel.addView(live, LinearLayout.LayoutParams(-1, dp(220)))

        val note = TextView(activity).apply {
            text = "Animated preview = representative DSP behavior. The full analyzer below uses your actual processed audio."
            textSize = 10.5f
            setTextColor(Color.rgb(158, 166, 187))
        }
        panel.addView(note)

        val lp = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        ).apply {
            leftMargin = dp(8)
            rightMargin = dp(8)
            bottomMargin = dp(8)
        }
        content.addView(panel, lp)

        val state = PanelState(panel, headline, detail, live)
        toggle.setOnClickListener {
            state.expanded = !state.expanded
            live.visibility = if (state.expanded) View.VISIBLE else View.GONE
            note.visibility = if (state.expanded) View.VISIBLE else View.GONE
            detail.visibility = if (state.expanded) View.VISIBLE else View.GONE
            toggle.text = if (state.expanded) "MINIMIZE" else "EXPAND LIVE"
        }

        // Observe taps without consuming them, so the original Forge handlers still run.
        attachTapObservers(content, state)
        content.postDelayed({ sync(activity, state, force = true) }, 120L)
        return state
    }

    private fun attachTapObservers(view: View, state: PanelState) {
        when (view) {
            is Button -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    val label = view.text?.toString().orEmpty()
                    state.lastAction = actionMessage(label)
                    state.headline.text = "⚡ LIVE FEEDBACK • ACTION"
                    state.detail.text = state.lastAction
                }
                false
            }
            is CompoundButton -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    view.postDelayed({
                        state.lastAction = if (view.isChecked) {
                            "${view.text} enabled. The live route/state has been recalculated."
                        } else {
                            "${view.text} disabled. The live route/state has been recalculated."
                        }
                        state.detail.text = state.lastAction
                    }, 80L)
                }
                false
            }
            is Spinner -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    state.lastAction = "Selection opened. The preview will update immediately after your new choice is applied."
                    state.detail.text = state.lastAction
                }
                false
            }
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) attachTapObservers(view.getChildAt(i), state)
        }
    }

    private fun scheduleSync(activity: MainActivity, state: PanelState) {
        if (!state.active) return
        sync(activity, state, force = false)
        state.panel.postDelayed({ scheduleSync(activity, state) }, 220L)
    }

    private fun sync(activity: MainActivity, state: PanelState, force: Boolean) {
        val content = activity.findViewById<FrameLayout>(android.R.id.content)
        val texts = mutableListOf<String>()
        val spinnerSelections = mutableListOf<String>()
        collect(content, texts, spinnerSelections, state.panel)

        val activeLegend = texts.firstOrNull { it.startsWith("Active methods:", ignoreCase = true) }.orEmpty()
        val methods = TransformKind.entries.filter { kind -> activeLegend.contains(kind.title, ignoreCase = true) }

        val route = when {
            activeLegend.contains("L:") || activeLegend.contains("R:") -> RecommendedRoute.SIDE_BY_SIDE
            activeLegend.contains("M1:") || activeLegend.contains("M2:") -> RecommendedRoute.FULL_MERGE
            spinnerSelections.any { it.equals(MergeMode.STEREO_SIDE_BY_SIDE.label, true) } && texts.any { it.contains("LEFT •") || it.contains("RIGHT •") } -> RecommendedRoute.SIDE_BY_SIDE
            texts.any { it.contains("MERGE •") } -> RecommendedRoute.FULL_MERGE
            else -> RecommendedRoute.FULL_CHAIN
        }

        val signature = buildString {
            append(route.name).append('|')
            methods.forEach { append(it.name).append(',') }
            append('|').append(activeLegend)
        }
        if (!force && signature == state.signature) return
        state.signature = signature

        val report = ComboEngine.analyze(methods)
        state.headline.text = "⚡ LIVE • ${route.label} • ${methods.size} METHOD${if (methods.size == 1) "" else "S"}"
        state.detail.text = buildString {
            append(state.lastAction)
            append("\nNOW: ")
            if (methods.isEmpty()) append("Convert Only / dry") else append(methods.joinToString(" + ") { it.title })
            append("\nEXPECT: ").append(report.summary)
        }
        state.live.setState(methods, route, state.lastAction)
    }

    private fun collect(
        view: View,
        texts: MutableList<String>,
        spinners: MutableList<String>,
        skip: View
    ) {
        if (view === skip) return
        if (view is TextView) texts += view.text?.toString().orEmpty()
        if (view is Spinner) spinners += view.selectedItem?.toString().orEmpty()
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) collect(view.getChildAt(i), texts, spinners, skip)
        }
    }

    private fun actionMessage(label: String): String = when {
        label.contains("FULL CHAIN", true) -> "FULL CHAIN applied: the complete audio goes through A, then the full result goes through B, then C."
        label.contains("FULL MERGE", true) -> "FULL MERGE applied: every selected method receives a complete source copy, then the full transformed results are combined."
        label.contains("SIDE-BY-SIDE", true) -> "SIDE-BY-SIDE applied: complete independent versions are routed to left and right rather than partially blending a method."
        label.contains("ADD FULL METHOD", true) -> "Full method added to the working chain. The animated output preview is recalculating now."
        label.contains("SOLO SELECTED", true) -> "Solo mode selected: only this complete method remains active for a clean comparison."
        label.contains("ADD CURRENT FULL CHAIN AS ONE BRANCH", true) -> "The complete current chain was copied into one independent Matrix branch."
        label.contains("SPLIT EACH", true) -> "Each method is becoming its own complete parallel source copy before the Matrix merge."
        label.contains("REMOVE", true) -> "Last item removed. The preview is recalculating the remaining route."
        label.contains("CLEAR", true) -> "Selection cleared. The preview is returning toward the remaining active state."
        label.contains("PROCESS", true) -> "Processing/export requested. The full-file analyzer will show the actual rendered signal."
        label.contains("IMPORT", true) -> "Source selection opened. Your routing stays intact while you choose media."
        label.contains("ANALYZE", true) -> "Combination analysis refreshed from the currently selected methods."
        label.contains("LOAD SAVED", true) -> "Saved routing loaded. Live analysis is syncing to the restored methods."
        else -> if (label.isBlank()) "Control changed. Live state is syncing." else "$label selected. Live state is syncing now."
    }
}
