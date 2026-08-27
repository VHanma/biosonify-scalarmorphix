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
    modules: List<LabModuleSpec>,
    onOpen: (Int) -> Unit
) : LinearLayout(context) {

    init {
        orientation = VERTICAL
        setPadding(dp(12), dp(12), dp(12), dp(24))

        addView(TextView(context).apply {
            text = "CHOOSE A LAB"
            textSize = 19f
            setTextColor(Color.WHITE)
            setTypeface(typeface, 1)
            setPadding(0, dp(8), 0, dp(4))
        })
        addView(TextView(context).apply {
            text = "Each system now has its own page. Your audio and routing state stay active while you move between them."
            textSize = 12.5f
            setTextColor(Color.rgb(183, 190, 209))
            setPadding(0, 0, 0, dp(14))
        })

        modules.chunked(2).forEachIndexed { rowIndex, pair ->
            val row = LinearLayout(context).apply {
                orientation = HORIZONTAL
                gravity = Gravity.CENTER
            }
            pair.forEachIndexed { colIndex, module ->
                val index = rowIndex * 2 + colIndex
                row.addView(moduleButton(module) { onOpen(index) }, LayoutParams(0, dp(112), 1f).apply {
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                })
            }
            if (pair.size == 1) {
                row.addView(android.view.View(context), LayoutParams(0, dp(112), 1f))
            }
            addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        }

        addView(TextView(context).apply {
            text = "RECOMMENDED FLOW\nConvert & Export → Wave Library → Forge Chain / Matrix Lab → Combo Atlas → Live Analysis → Save"
            textSize = 12.5f
            setTextColor(Color.rgb(111, 233, 202))
            setPadding(dp(6), dp(16), dp(6), dp(4))
        })
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
