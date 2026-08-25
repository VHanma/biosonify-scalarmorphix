package com.vhanma.scalaraudioforge

object PresetLibrary {
    private fun t(kind: TransformKind) = TransformSpec(kind)

    val quick = listOf(
        ForgePreset(
            "Convert Only",
            PresetCategory.CONVERTER,
            "No experimental transform. Decode and export the source audio through the selected output format.",
            emptyList()
        ),
        ForgePreset(
            "Puharich Core",
            PresetCategory.PUHARICH,
            "Full Puharich-inspired 8 Hz envelope plus the 256 Hz reference layer.",
            listOf(t(TransformKind.PUHARICH_8), t(TransformKind.CONTROL_256))
        ),
        ForgePreset(
            "Schumann + Puharich",
            PresetCategory.PUHARICH,
            "Full 7.83 Hz Schumann-pattern modulation, full 8 Hz Puharich-pattern modulation, and the 256 Hz reference layer.",
            listOf(t(TransformKind.SCHUMANN_783), t(TransformKind.PUHARICH_8), t(TransformKind.CONTROL_256))
        ),
        ForgePreset(
            "Gateway-Puharich",
            PresetCategory.PUHARICH,
            "Full 252/260 Hz stereo difference pair plus the complete 8 Hz modulation method.",
            listOf(t(TransformKind.GATEWAY_STEREO), t(TransformKind.PUHARICH_8))
        ),
        ForgePreset(
            "Puharich PHASER System",
            PresetCategory.PUHARICH,
            "Full 20-200 Hz PHASER-style sweep, 8 Hz rhythm, and 256 Hz reference carrier.",
            listOf(t(TransformKind.PHASER_SWEEP), t(TransformKind.PUHARICH_8), t(TransformKind.CONTROL_256))
        ),
        ForgePreset(
            "Tesla-Meyl-Puharich",
            PresetCategory.TESLA_MEYL,
            "Full Tesla-style harmonic layer, Meyl-style stereo phase rotation, and Puharich 8 Hz modulation.",
            listOf(t(TransformKind.TESLA_HARMONICS), t(TransformKind.MEYL_VORTEX), t(TransformKind.PUHARICH_8))
        ),
        ForgePreset(
            "Scalar Cancellation Lab",
            PresetCategory.SCALAR,
            "Full phase-opposition structure plus a complete Schumann-pattern modulation. This is a DSP phase experiment, not proof of exotic propagation.",
            listOf(t(TransformKind.PHASE_OPPOSED), t(TransformKind.SCHUMANN_783))
        ),
        ForgePreset(
            "Standing Longitudinal Lab",
            PresetCategory.SCALAR,
            "Full standing-node pattern, phase opposition and center projection.",
            listOf(t(TransformKind.STANDING_WAVE), t(TransformKind.PHASE_OPPOSED), t(TransformKind.LONGITUDINAL_MONO))
        ),
        ForgePreset(
            "Advanced / Retarded ELF",
            PresetCategory.BEARDEN,
            "Full forward/time-reversed pairing plus complete 7.83 Hz modulation.",
            listOf(t(TransformKind.ADVANCED_RETARDED), t(TransformKind.SCHUMANN_783))
        ),
        ForgePreset(
            "Bearden Conjugate Pair",
            PresetCategory.BEARDEN,
            "Full reversed-polarity conjugate-style pair with phase-opposed stereo structure.",
            listOf(t(TransformKind.BEARDEN_CONJUGATE), t(TransformKind.PHASE_OPPOSED))
        ),
        ForgePreset(
            "DNA / Water Harmonic",
            PresetCategory.BIO,
            "Full 256/512/1024 harmonic modulation ladder plus Puharich 8 Hz modulation.",
            listOf(t(TransformKind.DNA_WATER), t(TransformKind.PUHARICH_8))
        ),
        ForgePreset(
            "Triple ELF",
            PresetCategory.BIO,
            "Complete 7.83, 8 and 9 Hz compound modulation for close-frequency beating experiments.",
            listOf(t(TransformKind.TRIPLE_ELF))
        ),
        ForgePreset(
            "Brain Rhythm Ladder",
            PresetCategory.BIO,
            "Complete stepped 4 / 7.83 / 8 / 10 / 20 / 40 Hz modulation sequence.",
            listOf(t(TransformKind.BRAIN_LADDER))
        ),
        ForgePreset(
            "Information Imprint",
            PresetCategory.INFORMATION,
            "Full deterministic phase-coded carrier plus complete 8 Hz framing modulation.",
            listOf(t(TransformKind.INFORMATION_CARRIER), t(TransformKind.PUHARICH_8))
        ),
        ForgePreset(
            "Distance Transfer Experimental",
            PresetCategory.INFORMATION,
            "Full chirp/spread pattern, deterministic information carrier and phase-opposed method for correlation experiments. It does not turn a phone speaker into a radio or scalar transmitter.",
            listOf(t(TransformKind.CHIRP_SPREAD), t(TransformKind.INFORMATION_CARRIER), t(TransformKind.PHASE_OPPOSED))
        ),
        ForgePreset(
            "Puharich-Bearden-Meyl MAX",
            PresetCategory.MAX,
            "Dense full-method combination: Puharich 8 Hz, 256 Hz control, Meyl phase rotation, phase opposition and Bearden-style conjugate pairing.",
            listOf(
                t(TransformKind.PUHARICH_8),
                t(TransformKind.CONTROL_256),
                t(TransformKind.MEYL_VORTEX),
                t(TransformKind.PHASE_OPPOSED),
                t(TransformKind.BEARDEN_CONJUGATE)
            )
        )
    )

    fun byCategory(category: PresetCategory): List<ForgePreset> = quick.filter { it.category == category }
}
