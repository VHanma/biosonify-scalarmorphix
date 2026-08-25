package com.vhanma.scalaraudioforge

import android.util.Base64

object PresetDna {
    data class State(
        val stack: List<TransformSpec>,
        val matrix: ForgeMatrix
    )

    fun encode(state: State): String {
        val stack = encodeTransforms(state.stack)
        val branches = state.matrix.branches.joinToString("|") { branch ->
            "${branch.weight.coerceIn(-4f, 4f)}~${encodeTransforms(branch.transforms)}"
        }
        val raw = buildString {
            append("mode=").append(state.matrix.mode.name).append(';')
            append("enabled=").append(if (state.matrix.enabled) 1 else 0).append(';')
            append("stack=").append(stack).append(';')
            append("branches=").append(branches)
        }
        val encoded = Base64.encodeToString(raw.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP)
        return "SAF2:$encoded"
    }

    fun decode(code: String): State {
        val clean = code.trim()
        require(clean.startsWith("SAF2:")) { "Preset DNA must start with SAF2:" }
        val bytes = Base64.decode(clean.removePrefix("SAF2:"), Base64.URL_SAFE or Base64.NO_WRAP)
        val raw = bytes.toString(Charsets.UTF_8)
        val fields = raw.split(';').mapNotNull { part ->
            val i = part.indexOf('=')
            if (i <= 0) null else part.substring(0, i) to part.substring(i + 1)
        }.toMap()

        val mode = runCatching { MergeMode.valueOf(fields["mode"] ?: "") }
            .getOrDefault(MergeMode.NORMALIZED_WEIGHTED)
        val enabled = fields["enabled"] == "1"
        val stack = parseTransforms(fields["stack"].orEmpty())
        val branches = fields["branches"].orEmpty()
            .split('|')
            .filter { it.isNotBlank() }
            .mapIndexed { index, rawBranch ->
                val i = rawBranch.indexOf('~')
                val weight = if (i >= 0) rawBranch.substring(0, i).toFloatOrNull() ?: 1f else 1f
                val encodedTransforms = if (i >= 0) rawBranch.substring(i + 1) else rawBranch
                ForgeBranch(
                    name = "Branch ${index + 1}",
                    weight = weight.coerceIn(-4f, 4f),
                    transforms = parseTransforms(encodedTransforms)
                )
            }

        return State(
            stack = stack,
            matrix = ForgeMatrix(enabled = enabled, mode = mode, branches = branches, master = stack)
        )
    }

    private fun encodeTransforms(items: List<TransformSpec>): String =
        items.joinToString(",") { "${it.kind.name}@${"%.4f".format(java.util.Locale.US, it.amount.coerceIn(0f, 1f))}" }

    private fun parseTransforms(raw: String): List<TransformSpec> =
        raw.split(',').filter { it.isNotBlank() }.mapNotNull { token ->
            val i = token.indexOf('@')
            if (i <= 0) return@mapNotNull null
            val kind = runCatching { TransformKind.valueOf(token.substring(0, i)) }.getOrNull() ?: return@mapNotNull null
            val amount = token.substring(i + 1).toFloatOrNull()?.coerceIn(0f, 1f) ?: 0.35f
            TransformSpec(kind, amount)
        }
}
