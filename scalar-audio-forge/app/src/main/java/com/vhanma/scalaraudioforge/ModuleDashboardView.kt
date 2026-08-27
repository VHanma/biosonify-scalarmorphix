package com.vhanma.scalaraudioforge

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class ModuleDashboardView(
    context: Context,
    private val modules: List<LabModuleSpec>,
    private val workspaceStore: ModularWorkspaceStore,
    private val onOpen: (Int) -> Unit
) : LinearLayout(context) {

    private val recentHost = LinearLayout(context).apply { orientation = VERTICAL }

    init {
        orientation = VERTICAL
        setPadding(dp(12), dp(12), dp(12), dp(24))

        addView(TextView(context).apply {
            text = "MODULAR WORKSPACE"
            textSize = 19f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
            setPadding(0, dp(8), 0, dp(4))
        })
        addView(TextView(context).apply {
            text = "Each system has its own page. Your selected audio, chain, Matrix, presets, and analyzer state remain active while you move between labs."
            textSize = 12.5f
            setTextColor(Color.rgb(183, 190, 209))
            setPadding(0, 0, 0, dp(12))
        })

        addView(recentHost)
        refreshResume()

        addView(TextView(context).apply {
            text = "START BY GOAL"
            textSize = 13f
            setTextColor(Color.rgb(111, 233, 202))
            setTypeface(typeface, 1)
            setPadding(0, dp(14), 0, dp(6))
        })

        val quickRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER
        }
        quickRow.addView(quickButton("🎚 QUICK\nCONVERT", 0), LayoutParams(0, dp(76), 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        quickRow.addView(quickButton("🧬 BUILD\nEXPERIMENT", 2), LayoutParams(0, dp(76), 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        quickRow.addView(quickButton("⚡ ANALYZE /\nCOMPARE", 6), LayoutParams(0, dp(76), 1f).apply { setMargins(dp(3), 0, dp(3), 0) })
        addView(quickRow)

        addView(TextView(context).apply {
            text = "ALL LABS"
            textSize = 13f
            setTextColor(Color.rgb(111, 233, 202))
            setTypeface(typeface, 1)
            setPadding(0, dp(16), 0, dp(4))
        })

        modules.chunked(2).forEachIndexed { rowIndex, pair ->
            val row = LinearLayout(context).apply {
                orientation = HORIZONTAL
                gravity = Gravity.CENTER
            }
            pair.forEachIndexed { colIndex, module ->
                val index = rowIndex * 2 + colIndex
                row.addView(moduleButton(module) { open(index) }, LayoutParams(0, dp(112), 1f).apply {
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                })
            }
            if (pair.size == 1) row.addView(android.view.View(context), LayoutParams(0, dp(112), 1f))
            addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        }

        addView(TextView(context).apply {
            text = "RECOMMENDED FLOW\nConvert & Export → Wave Library → Forge Chain / Matrix Lab → Combo Atlas → Live Analysis → Save / Notebook"
            textSize = 12.5f
            setTextColor(Color.rgb(111, 233, 202))
            setPadding(dp(6), dp(16), dp(6), dp(4))
        })
    }

    fun refreshResume() {
        recentHost.removeAllViews()
        val last = workspaceStore.lastModuleIndex()
        if (last in modules.indices) {
            val module = modules[last]
            recentHost.addView(Button(context).apply {
                text = "▶ CONTINUE • ${module.icon} ${module.title}"
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.rgb(45, 36, 73))
                setOnClickListener { open(last) }
            }, LayoutParams(LayoutParams.MATCH_PARENT, dp(52)))
        }

        val recent = workspaceStore.recentModuleIndices().filter { it != last }
        if (recent.isNotEmpty()) {
            recentHost.addView(TextView(context).apply {
                text = "RECENT LABS"
                textSize = 11.5f
                setTextColor(Color.rgb(158, 166, 187))
                setPadding(0, dp(8), 0, dp(3))
            })
            val row = LinearLayout(context).apply { orientation = HORIZONTAL }
            recent.take(3).forEach { index ->
                val module = modules[index]
                row.addView(Button(context).apply {
                    text = "${module.icon}\n${module.title}"
                    textSize = 10.5f
                    isAllCaps = false
                    setTextColor(Color.WHITE)
                    setBackgroundColor(Color.rgb(29, 33, 47))
                    setOnClickListener { open(index) }
                }, LayoutParams(0, dp(66), 1f).apply { setMargins(dp(2), 0, dp(2), 0) })
            }
            recentHost.addView(row)
        }
    }

    private fun open(index: Int) {
        workspaceStore.recordModule(index)
        refreshResume()
        onOpen(index)
    }

    private fun quickButton(label: String, index: Int): Button = Button(context).apply {
        text = label
        textSize = 10.5f
        isAllCaps = false
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        background = GradientDrawable().apply {
            cornerRadius = dp(12).toFloat()
            setColor(Color.rgb(25, 31, 43))
            setStroke(dp(1), Color.rgb(73, 84, 112))
        }
        setOnClickListener { open(index) }
    }

    private fun moduleButton(module: LabModuleSpec, action: () -> Unit): Button = Button(context).apply {
        text = "${module.icon}  ${module.title}\n${module.subtitle}"
        textSize = 11.5f
        isAllCaps = false
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        setPadding(dp(12), dp(8), dp(10), dp(8))
        setTextColor(Color.WHITE)
        background = GradientDrawable().apply {
            cornerRadius = dp(14).toFloat()
            setColor(Color.rgb(29, 33, 47))
            setStroke(dp(1), Color.rgb(73, 84, 112))
        }
        setOnClickListener { action() }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
