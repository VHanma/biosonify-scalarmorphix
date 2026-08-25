package com.vhanma.scalaraudioforge

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class PresetStore(context: Context) {
    private val prefs = context.getSharedPreferences("forge_presets", Context.MODE_PRIVATE)

    fun save(name: String, state: PresetDna.State) {
        val root = readRoot()
        root.put(name, PresetDna.encode(state))
        prefs.edit().putString("presets", root.toString()).apply()
    }

    fun names(): List<String> {
        val root = readRoot()
        val out = mutableListOf<String>()
        val keys = root.keys()
        while (keys.hasNext()) out += keys.next()
        return out.sorted()
    }

    fun load(name: String): PresetDna.State {
        val root = readRoot()
        val value = root.opt(name) ?: return PresetDna.State(emptyList(), ForgeMatrix())
        if (value is String && (value.startsWith("SAF3:") || value.startsWith("SAF2:"))) {
            return runCatching { PresetDna.decode(value) }
                .getOrElse { PresetDna.State(emptyList(), ForgeMatrix()) }
        }

        // Backward compatibility with 1.0/1.1 presets stored as JSON arrays.
        val arr = value as? JSONArray ?: return PresetDna.State(emptyList(), ForgeMatrix())
        val transforms = mutableListOf<TransformSpec>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val kind = runCatching { TransformKind.valueOf(obj.getString("kind")) }.getOrNull() ?: continue
            transforms += TransformSpec(kind)
        }
        return PresetDna.State(
            stack = transforms,
            matrix = ForgeMatrix(enabled = false, master = transforms)
        )
    }

    fun delete(name: String) {
        val root = readRoot()
        root.remove(name)
        prefs.edit().putString("presets", root.toString()).apply()
    }

    private fun readRoot(): JSONObject = runCatching {
        JSONObject(prefs.getString("presets", "{}") ?: "{}")
    }.getOrElse { JSONObject() }
}
