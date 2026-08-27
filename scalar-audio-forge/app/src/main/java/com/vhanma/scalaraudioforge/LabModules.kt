package com.vhanma.scalaraudioforge

data class LabModuleSpec(
    val icon: String,
    val title: String,
    val subtitle: String,
    val sectionPrefixes: List<String>
)

object LabModules {
    val modules = listOf(
        LabModuleSpec(
            "🎚",
            "Convert & Export",
            "Import audio/video, choose output format, process single files or batches, and save directly.",
            listOf("SOURCE", "EXPORT ENGINE")
        ),
        LabModuleSpec(
            "🧬",
            "Presets & DNA",
            "Official quick combinations, full-method routing choices, saved recipes, and portable Preset DNA.",
            listOf("QUICK COMBOS", "PRESET DNA")
        ),
        LabModuleSpec(
            "〰",
            "Wave Library",
            "Browse every method by category, animated mini-diagram, concept, exact DSP, expected behavior, and pairings.",
            listOf("WAVE LIBRARY")
        ),
        LabModuleSpec(
            "⚒",
            "Forge Chain",
            "Build the sequential full-method chain and manage custom saved configurations.",
            listOf("WORKING FULL-METHOD CHAIN")
        ),
        LabModuleSpec(
            "🔀",
            "Matrix Lab",
            "Create independent full-copy branches, full merges, and stereo side-by-side routing.",
            listOf("MATRIX LAB")
        ),
        LabModuleSpec(
            "🧠",
            "Combo Atlas",
            "Explore all generated method pairs, N-way predictions, conflicts, routing advice, diagrams, and expectation radar.",
            listOf("COMBINATION ATLAS")
        ),
        LabModuleSpec(
            "⚡",
            "Live Analysis",
            "See original, processed, and difference signals. The compact live-feedback bar remains available everywhere.",
            listOf("ANALYZER")
        ),
        LabModuleSpec(
            "📓",
            "Experiment Notebook",
            "Review and copy reproducible experiment records with routing, methods, prediction, and Preset DNA.",
            listOf("EXPERIMENT NOTEBOOK")
        ),
        LabModuleSpec(
            "?",
            "Help & Concepts",
            "Installation help, routing meanings, and the distinction between experimental labels and measurable DSP.",
            listOf("INSTALL / HELP")
        )
    )

    fun moduleForSection(text: String): LabModuleSpec? {
        val normalized = text.trim().uppercase()
        return modules.firstOrNull { module ->
            module.sectionPrefixes.any { prefix -> normalized.startsWith(prefix.uppercase()) }
        }
    }

    fun isSectionHeading(text: String): Boolean = moduleForSection(text) != null
}
