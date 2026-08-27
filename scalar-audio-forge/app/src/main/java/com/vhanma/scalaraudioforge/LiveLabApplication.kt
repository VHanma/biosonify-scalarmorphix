package com.vhanma.scalaraudioforge

import android.app.Activity
import android.app.Application
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CompoundButton
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import java.util.WeakHashMap

/** Global clone-only feedback strip. The full animation is collapsed by default. */
class LiveLabApplication : Application(), Application.ActivityLifecycleCallbacks {
    private data class PanelState(
        val panel: LinearLayout,
        val headline: TextView,
        val detail: TextView,
        val live: LiveAnalysisView,
        val note: TextView,
        var active: Boolean = true,
        var signature: String = "",
        var lastAction: String = "Ready",
        var expanded: Boolean = false
    )

    private val panels = WeakHashMap<Activity, PanelState>()

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityResumed(activity: Activity) {
        if (activity !is MainActivity) return
        ModularLabOrganizer.ensure(activity)
        val state = panels[activity] ?: inject(activity).also { panels[activity] = it }
        state.active = true
        scheduleSync(activity, state)
    }

    override fun onActivityPaused(activity: Activity) { panels[activity]?.active = false }
    override fun onActivityDestroyed(activity: Activity) { panels.remove(activity) }
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
            setPadding(dp(12), dp(8), dp(12), dp(8))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.argb(248, 14, 17, 26))
                setStroke(dp(1), Color.rgb(111, 233, 202))
            }
            elevation = dp(14).toFloat()
        }

        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val headline = TextView(activity).apply {
            text = "⚡ READY • no method change yet"
            textSize = 13.5f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
        }
        val toggle = Button(activity).apply {
            text = "OPEN WAVES"
            isAllCaps = false
            textSize = 11f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(45, 36, 73))
        }
        header.addView(headline, LinearLayout.LayoutParams(0, dp(40), 1f))
        header.addView(toggle, LinearLayout.LayoutParams(dp(108), dp(40)))
        panel.addView(header)

        val detail = TextView(activity).apply {
            text = "Tap a method or routing choice. This strip will tell you exactly what changed."
            textSize = 11.5f
            setTextColor(Color.rgb(205, 211, 227))
            setPadding(0, 0, 0, dp(3))
            maxLines = 3
        }
        panel.addView(detail)

        val live = LiveAnalysisView(activity).apply { visibility = View.GONE }
        panel.addView(live, LinearLayout.LayoutParams(-1, dp(220)))

        val note = TextView(activity).apply {
            text = "Animated preview = representative DSP behavior. Live Analysis shows the actual rendered audio after processing."
            textSize = 10.5f
            setTextColor(Color.rgb(158, 166, 187))
            visibility = View.GONE
        }
        panel.addView(note)

        val lp = FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply {
            leftMargin = dp(8)
            rightMargin = dp(8)
            bottomMargin = dp(8)
        }
        content.addView(panel, lp)

        val state = PanelState(panel, headline, detail, live, note)
        toggle.setOnClickListener {
            state.expanded = !state.expanded
            live.visibility = if (state.expanded) View.VISIBLE else View.GONE
            note.visibility = if (state.expanded) View.VISIBLE else View.GONE
            toggle.text = if (state.expanded) "HIDE WAVES" else "OPEN WAVES"
        }

        attachTapObservers(content, state, panel)
        content.postDelayed({ sync(activity, state, force = true) }, 120L)
        return state
    }

    private fun attachTapObservers(view: View, state: PanelState, skip: View) {
        if (view === skip) return
        when (view) {
            is Button -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    val label = view.text?.toString().orEmpty()
                    state.lastAction = actionMessage(label)
                    state.headline.text = shortHeadline(label)
                    state.detail.text = state.lastAction
                }
                false
            }
            is CompoundButton -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    view.postDelayed({
                        state.lastAction = if (view.isChecked) {
                            "${view.text} enabled. The current lab state has been recalculated."
                        } else {
                            "${view.text} disabled. The current lab state has been recalculated."
                        }
                        state.headline.text = "⚡ STATE CHANGED"
                        state.detail.text = state.lastAction
                    }, 80L)
                }
                false
            }
            is Spinner -> view.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    state.headline.text = "⚡ CHOOSE OPTION"
                    state.detail.text = "Selection opened. The status and animated preview update after the new choice is applied."
                }
                false
            }
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) attachTapObservers(view.getChildAt(i), state, skip)
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
        val spinners = mutableListOf<String>()
        collect(content, texts, spinners, state.panel)

        val activeLegend = texts.firstOrNull { it.startsWith("Active methods:", true) }.orEmpty()
        val methods = TransformKind.entries.filter { activeLegend.contains(it.title, true) }
        val route = when {
            activeLegend.contains("L:") || activeLegend.contains("R:") -> RecommendedRoute.SIDE_BY_SIDE
            activeLegend.contains("M1:") || activeLegend.contains("M2:") -> RecommendedRoute.FULL_MERGE
            spinners.any { it.equals(MergeMode.STEREO_SIDE_BY_SIDE.label, true) } && texts.any { it.contains("LEFT •") || it.contains("RIGHT •") } -> RecommendedRoute.SIDE_BY_SIDE
            texts.any { it.contains("MERGE •") } -> RecommendedRoute.FULL_MERGE
            else -> RecommendedRoute.FULL_CHAIN
        }

        val signature = route.name + "|" + methods.joinToString(",") { it.name } + "|" + activeLegend
        if (!force && signature == state.signature) return
        state.signature = signature

        val report = ComboEngine.analyze(methods)
        state.headline.text = "⚡ ${route.label} • ${methods.size} FULL METHOD${if (methods.size == 1) "" else "S"}"
        state.detail.text = buildString {
            append("NOW: ")
            if (methods.isEmpty()) append("Convert Only / dry") else append(methods.joinToString(" + ") { it.title })
            append("\nEXPECT: ").append(report.summary)
        }
        state.live.setState(methods, route, state.lastAction)
    }

    private fun collect(view: View, texts: MutableList<String>, spinners: MutableList<String>, skip: View) {
        if (view === skip) return
        if (view is TextView) texts += view.text?.toString().orEmpty()
        if (view is Spinner) spinners += view.selectedItem?.toString().orEmpty()
        if (view is ViewGroup) for (i in 0 until view.childCount) collect(view.getChildAt(i), texts, spinners, skip)
    }

    private fun shortHeadline(label: String): String = when {
        label.contains("FULL MERGE", true) -> "⚡ FULL MERGE APPLIED"
        label.contains("SIDE-BY-SIDE", true) -> "⚡ SIDE-BY-SIDE APPLIED"
        label.contains("FULL CHAIN", true) -> "⚡ FULL CHAIN APPLIED"
        label.contains("ADD FULL METHOD", true) -> "⚡ METHOD ADDED"
        label.contains("SOLO", true) -> "⚡ SOLO METHOD"
        label.contains("SPLIT EACH", true) -> "⚡ BRANCHES SPLIT"
        label.contains("CLEAR", true) -> "⚡ CLEARED"
        else -> "⚡ ${label.take(28).ifBlank { "STATE CHANGED" }}"
    }

    private fun actionMessage(label: String): String = when {
        label.contains("FULL CHAIN", true) -> "FULL CHAIN: the complete result of A becomes the complete input to B, then C."
        label.contains("FULL MERGE", true) -> "FULL MERGE: every selected method gets a complete source copy, then the complete transformed results are combined."
        label.contains("SIDE-BY-SIDE", true) -> "SIDE-BY-SIDE: independent complete versions are routed to left/right instead of partially blending method strength."
        label.contains("ADD FULL METHOD", true) -> "A complete method was added to the current Forge chain."
        label.contains("SOLO SELECTED", true) -> "Solo mode keeps only this complete method active for a clean comparison."
        label.contains("ADD CURRENT FULL CHAIN AS ONE BRANCH", true) -> "The entire current chain became one independent Matrix branch."
        label.contains("SPLIT EACH", true) -> "Every current method became its own independent complete source-copy branch."
        label.contains("REMOVE", true) -> "The last item was removed. Remaining routing stays intact."
        label.contains("CLEAR", true) -> "This lab selection was cleared. Other saved/project data remains untouched."
        label.contains("PROCESS", true) -> "Full-file processing/export requested. The Live Analysis page will show the rendered signal."
        label.contains("IMPORT", true) -> "Source picker opened. Your current methods and routing remain in place."
        label.contains("ANALYZE", true) -> "Combination analysis refreshed from the selected methods."
        label.contains("LOAD SAVED", true) -> "Saved routing loaded and live state synchronized."
        else -> if (label.isBlank()) "Control changed. Live state is syncing." else "$label selected. Live state is syncing now."
    }
}
