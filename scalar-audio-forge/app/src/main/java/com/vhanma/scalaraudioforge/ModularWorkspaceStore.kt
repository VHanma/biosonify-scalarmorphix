package com.vhanma.scalaraudioforge

import android.content.Context

/** Small clone-local navigation memory. No audio/DSP state is duplicated here. */
class ModularWorkspaceStore(context: Context) {
    private val prefs = context.getSharedPreferences("modular_lab_workspace", Context.MODE_PRIVATE)

    fun lastModuleIndex(): Int = prefs.getInt("last_module", -1)

    fun recentModuleIndices(): List<Int> = prefs.getString("recent_modules", "")
        .orEmpty()
        .split(',')
        .mapNotNull { it.toIntOrNull() }
        .filter { it in LabModules.modules.indices }
        .distinct()
        .take(4)

    fun recordModule(index: Int) {
        if (index !in LabModules.modules.indices) return
        val recent = buildList {
            add(index)
            addAll(recentModuleIndices().filter { it != index })
        }.take(4)
        prefs.edit()
            .putInt("last_module", index)
            .putString("recent_modules", recent.joinToString(","))
            .apply()
    }
}
