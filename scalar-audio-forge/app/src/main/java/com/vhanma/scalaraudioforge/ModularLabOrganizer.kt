package com.vhanma.scalaraudioforge

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.WeakHashMap

/**
 * Rival 3 modular shell.
 *
 * The proven MainActivity still creates the controls and owns their listeners/state.
 * This class reorganizes those already-wired controls into separate pages. Re-parenting
 * preserves listeners, references, DSP behavior, and processing state while removing the
 * giant single-scroll-wall UX.
 */
object ModularLabOrganizer {
    private data class State(
        val scroll: ScrollView,
        val pages: List<View>,
        val spinner: Spinner,
        val title: TextView,
        val subtitle: TextView,
        val dashboard: ModuleDashboardView
    )

    private val states = WeakHashMap<MainActivity, State>()

    fun ensure(activity: MainActivity) {
        if (states.containsKey(activity)) return
        val content = activity.findViewById<FrameLayout>(android.R.id.content)
        val scroll = findScrollView(content) ?: return
        val original = scroll.getChildAt(0) as? LinearLayout ?: return
        val workspaceStore = ModularWorkspaceStore(activity)

        val topLevel = (0 until original.childCount).map { original.getChildAt(it) }
        val grouped = linkedMapOf<LabModuleSpec, MutableList<View>>()
        var current: LabModuleSpec? = null

        for (view in topLevel) {
            val headingText = (view as? TextView)?.text?.toString().orEmpty()
            val headingModule = LabModules.moduleForSection(headingText)
            if (headingModule != null) current = headingModule
            if (current != null) grouped.getOrPut(current) { mutableListOf() }.add(view)
        }

        original.removeAllViews()
        scroll.removeView(original)

        val shell = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(activity, 14), dp(activity, 28), dp(activity, 14), dp(activity, 120))
            setBackgroundColor(Color.rgb(9, 11, 16))
        }

        shell.addView(TextView(activity).apply {
            text = "SCALAR AUDIO FORGE • MODULAR LAB"
            textSize = 24f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
        })
        shell.addView(TextView(activity).apply {
            text = "v1.6 TRUE CLONE • separate install • separate labs • shared in-app workspace state"
            textSize = 12f
            setTextColor(Color.rgb(111, 233, 202))
            setPadding(0, 0, 0, dp(activity, 10))
        })

        val navRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val home = Button(activity).apply {
            text = "⌂ HOME"
            isAllCaps = false
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(45, 36, 73))
        }
        navRow.addView(home, LinearLayout.LayoutParams(dp(activity, 104), dp(activity, 48)))

        val spinner = Spinner(activity).apply {
            adapter = ArrayAdapter(
                activity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("HOME") + LabModules.modules.map { "${it.icon} ${it.title}" }
            )
        }
        navRow.addView(spinner, LinearLayout.LayoutParams(0, dp(activity, 48), 1f))
        shell.addView(navRow)

        val moduleTitle = TextView(activity).apply {
            text = "HOME"
            textSize = 19f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
            setPadding(0, dp(activity, 14), 0, dp(activity, 2))
        }
        val moduleSubtitle = TextView(activity).apply {
            text = "Choose one lab. Your current file, chain, Matrix, presets, and analyzer state stay alive while switching pages."
            textSize = 12.5f
            setTextColor(Color.rgb(183, 190, 209))
            setPadding(0, 0, 0, dp(activity, 10))
        }
        shell.addView(moduleTitle)
        shell.addView(moduleSubtitle)

        val host = FrameLayout(activity).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(activity, 16).toFloat()
                setColor(Color.rgb(13, 16, 24))
                setStroke(dp(activity, 1), Color.rgb(39, 45, 62))
            }
            setPadding(dp(activity, 8), dp(activity, 8), dp(activity, 8), dp(activity, 8))
        }
        shell.addView(host, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        val pages = mutableListOf<View>()
        val dashboard = ModuleDashboardView(activity, LabModules.modules, workspaceStore) { moduleIndex ->
            spinner.setSelection(moduleIndex + 1)
        }
        pages += dashboard
        host.addView(dashboard, FrameLayout.LayoutParams(-1, -2))

        LabModules.modules.forEach { module ->
            val page = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(activity, 6), dp(activity, 2), dp(activity, 6), dp(activity, 12))
                visibility = View.GONE
            }
            val views = grouped[module].orEmpty()
            if (views.isEmpty()) {
                page.addView(TextView(activity).apply {
                    text = "This lab has no mapped controls yet."
                    setTextColor(Color.LTGRAY)
                    textSize = 14f
                    setPadding(dp(activity, 8), dp(activity, 18), dp(activity, 8), dp(activity, 18))
                })
            } else {
                views.forEach { view ->
                    (view.parent as? ViewGroup)?.removeView(view)
                    page.addView(view)
                }
            }
            pages += page
            host.addView(page, FrameLayout.LayoutParams(-1, -2))
        }

        fun show(index: Int) {
            val safe = index.coerceIn(0, pages.lastIndex)
            pages.forEachIndexed { i, page -> page.visibility = if (i == safe) View.VISIBLE else View.GONE }
            if (safe == 0) {
                dashboard.refreshResume()
                moduleTitle.text = "HOME"
                moduleSubtitle.text = "Choose a lab, continue the last one, or jump in by goal. Your experiment state follows you."
            } else {
                val moduleIndex = safe - 1
                val module = LabModules.modules[moduleIndex]
                workspaceStore.recordModule(moduleIndex)
                moduleTitle.text = "HOME › ${module.icon} ${module.title}"
                moduleSubtitle.text = module.subtitle
            }
            host.requestLayout()
            scroll.post { scroll.scrollTo(0, 0) }
        }

        spinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                show(position)
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
        }
        home.setOnClickListener { spinner.setSelection(0) }

        scroll.addView(
            shell,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        )
        val state = State(scroll, pages, spinner, moduleTitle, moduleSubtitle, dashboard)
        states[activity] = state
        show(0)
    }

    private fun findScrollView(view: View): ScrollView? {
        if (view is ScrollView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                findScrollView(view.getChildAt(i))?.let { return it }
            }
        }
        return null
    }

    private fun dp(activity: MainActivity, value: Int): Int =
        (value * activity.resources.displayMetrics.density).toInt()
}
