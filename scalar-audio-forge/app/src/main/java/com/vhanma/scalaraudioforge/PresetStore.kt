package com.vhanma.scalaraudioforge

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class PresetStore(context: Context) {
    private val prefs = context.getSharedPreferences("forge_presets", Context.MODE_PRIVATE)

    fun save(name: String, transforms: List<TransformSpec>) {
        val root = readRoot()
        val arr = JSONArray()
        transforms.forEach {
            arr.put(JSONObject().put("kind", it.kind.name).put("amount", it.amount.toDouble()))
        }
        root.put(name, arr)
        prefs.edit().putString("presets", root.toString()).apply()
    }

    fun names(): List<String> {
        val root = readRoot()
        val out = mutableListOf<String>()
        val keys = root.keys()
        while (keys.hasNext()) out += keys.next()
        return out.sorted()
    }

    fun load(name: String): List<TransformSpec> {
        val arr = readRoot().optJSONArray(name) ?: return emptyList()
        val out = mutableListOf<TransformSpec>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val kind = runCatching { TransformKind.valueOf(obj.getString("kind")) }.getOrNull() ?: continue
            out += TransformSpec(kind, obj.optDouble("amount", .35).toFloat().coerceIn(0f, 1f))
        }
        return out
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
