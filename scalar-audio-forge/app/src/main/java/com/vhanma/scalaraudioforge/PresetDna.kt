package com.vhanma.scalaraudioforge

import android.util.Base64

object PresetDna {
    data class State(
        val stack: List<TransformSpec>,
        val matrix: ForgeMatrix
    )

    fun encode(state: State): String {
        val raw = buildString {
            append("mode=").append(state.matrix.mode.name).append(';')
            append("enabled=").append(if (state.matrix.enabled) 1 else 0).append(';')
            append("stack=").append(encodeTransforms(state.stack)).append(';')
            append("branches=").append(
                state.matrix.branches.joinToString("|") { encodeTransforms(it.transforms) }
            )
        }
        val encoded = Base64.encodeToString(raw.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP)
        return "SAF3:$encoded"
    }

    fun decode(code: String): State {
        val clean = code.trim()
        return when {
            clean.startsWith("SAF3:") -> decodeRaw(clean.removePrefix("SAF3:"), legacy = false)
            clean.startsWith("SAF2:") -> decodeRaw(clean.removePrefix("SAF2:"), legacy = true)
            else -> error("Preset DNA must start with SAF3: or legacy SAF2:")
        }
    }

    private fun decodeRaw(encoded: String, legacy: Boolean): State {
        val raw = Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_WRAP).toString(Charsets.UTF_8)
        val fields = raw.split(';').mapNotNull { part ->
            val i = part.indexOf('=')
            if (i <= 0) null else part.substring(0, i) to part.substring(i + 1)
        }.toMap()

        val oldMode = fields["mode"].orEmpty()
        val mode = when {
            oldMode == MergeMode.STEREO_SIDE_BY_SIDE.name -> MergeMode.STEREO_SIDE_BY_SIDE
            else -> MergeMode.FULL_MERGE
        }
        val enabled = fields["enabled"] == "1"
        val stack = parseTransforms(fields["stack"].orEmpty(), legacy)
        val branches = fields["branches"].orEmpty()
            .split('|')
            .filter { it.isNotBlank() }
            .mapIndexed { index, rawBranch ->
                val payload = if (legacy && rawBranch.contains('~')) rawBranch.substringAfter('~') else rawBranch
                ForgeBranch("Branch ${index + 1}", parseTransforms(payload, legacy))
            }
            .filter { it.transforms.isNotEmpty() }

        return State(
            stack = stack,
            matrix = ForgeMatrix(
                enabled = enabled && branches.isNotEmpty(),
                mode = mode,
                branches = branches,
                master = stack
            )
        )
    }

    private fun encodeTransforms(items: List<TransformSpec>): String =
        items.joinToString(",") { it.kind.name }

    private fun parseTransforms(raw: String, legacy: Boolean): List<TransformSpec> =
        raw.split(',').filter { it.isNotBlank() }.mapNotNull { token ->
            val name = if (legacy) token.substringBefore('@') else token
            runCatching { TransformSpec(TransformKind.valueOf(name)) }.getOrNull()
        }
}
