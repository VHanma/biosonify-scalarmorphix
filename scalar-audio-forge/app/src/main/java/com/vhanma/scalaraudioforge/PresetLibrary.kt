package com.vhanma.scalaraudioforge

object PresetLibrary {
    private fun t(kind:TransformKind)=TransformSpec(kind)
    val quick=listOf(
        ForgePreset("Convert Only",PresetCategory.CONVERTER,"No experimental transform. Decode and export through the selected format.",emptyList()),
        ForgePreset("Puharich Core",PresetCategory.PUHARICH,"Full 8 Hz envelope plus full 256 Hz reference layer.",listOf(t(TransformKind.PUHARICH_8),t(TransformKind.CONTROL_256))),
        ForgePreset("Schumann + Puharich",PresetCategory.PUHARICH,"Full 7.83 Hz, full 8 Hz and 256 Hz reference layer.",listOf(t(TransformKind.SCHUMANN_783),t(TransformKind.PUHARICH_8),t(TransformKind.CONTROL_256))),
        ForgePreset("Gateway-Puharich",PresetCategory.PUHARICH,"Full 252/260 Hz stereo difference pair plus complete 8 Hz modulation.",listOf(t(TransformKind.GATEWAY_STEREO),t(TransformKind.PUHARICH_8))),
        ForgePreset("Puharich PHASER System",PresetCategory.PUHARICH,"Full 20-200 Hz sweep, 8 Hz rhythm and 256 Hz reference.",listOf(t(TransformKind.PHASER_SWEEP),t(TransformKind.PUHARICH_8),t(TransformKind.CONTROL_256))),
        ForgePreset("Resonant Stereo Pulse",PresetCategory.PUHARICH,"Stereo difference pair, 8 Hz envelope and harmonic resonance bed.",listOf(t(TransformKind.GATEWAY_STEREO),t(TransformKind.PUHARICH_8),t(TransformKind.TESLA_HARMONICS))),
        ForgePreset("Scalar Cancellation Lab",PresetCategory.SCALAR,"Full phase opposition plus complete Schumann-pattern modulation.",listOf(t(TransformKind.PHASE_OPPOSED),t(TransformKind.SCHUMANN_783))),
        ForgePreset("Standing Longitudinal Lab",PresetCategory.SCALAR,"Full standing nodes, phase opposition and center projection.",listOf(t(TransformKind.STANDING_WAVE),t(TransformKind.PHASE_OPPOSED),t(TransformKind.LONGITUDINAL_MONO))),
        ForgePreset("Phase Geometry Stack",PresetCategory.SCALAR,"Phase-opposed differential field, standing nodes and Meyl-style stereo rotation.",listOf(t(TransformKind.PHASE_OPPOSED),t(TransformKind.STANDING_WAVE),t(TransformKind.MEYL_VORTEX))),
        ForgePreset("Tesla-Meyl-Puharich",PresetCategory.TESLA_MEYL,"Tesla-style harmonics, Meyl-style stereo phase rotation and Puharich 8 Hz modulation.",listOf(t(TransformKind.TESLA_HARMONICS),t(TransformKind.MEYL_VORTEX),t(TransformKind.PUHARICH_8))),
        ForgePreset("Harmonic Carrier Pulse",PresetCategory.TESLA_MEYL,"144/432/864 harmonic stack, 256 Hz reference and 8 Hz envelope.",listOf(t(TransformKind.TESLA_HARMONICS),t(TransformKind.CONTROL_256),t(TransformKind.PUHARICH_8))),
        ForgePreset("Advanced / Retarded ELF",PresetCategory.BEARDEN,"Full forward/time-reversed pairing plus complete 7.83 Hz modulation.",listOf(t(TransformKind.ADVANCED_RETARDED),t(TransformKind.SCHUMANN_783))),
        ForgePreset("Bearden Conjugate Pair",PresetCategory.BEARDEN,"Full reversed-polarity conjugate-style pair with phase-opposed stereo structure.",listOf(t(TransformKind.BEARDEN_CONJUGATE),t(TransformKind.PHASE_OPPOSED))),
        ForgePreset("Temporal Mirror Stack",PresetCategory.BEARDEN,"Advanced/retarded and conjugate window methods together for dense mirrored temporal texture.",listOf(t(TransformKind.ADVANCED_RETARDED),t(TransformKind.BEARDEN_CONJUGATE))),
        ForgePreset("DNA / Water Harmonic",PresetCategory.BIO,"Full 256/512/1024 harmonic modulation ladder plus Puharich 8 Hz.",listOf(t(TransformKind.DNA_WATER),t(TransformKind.PUHARICH_8))),
        ForgePreset("Triple ELF",PresetCategory.BIO,"Complete 7.83, 8 and 9 Hz compound modulation.",listOf(t(TransformKind.TRIPLE_ELF))),
        ForgePreset("Brain Rhythm Ladder",PresetCategory.BIO,"Complete 4 / 7.83 / 8 / 10 / 20 / 40 Hz stepped modulation.",listOf(t(TransformKind.BRAIN_LADDER))),
        ForgePreset("Information Imprint",PresetCategory.INFORMATION,"Deterministic coded carrier plus complete 8 Hz framing modulation.",listOf(t(TransformKind.INFORMATION_CARRIER),t(TransformKind.PUHARICH_8))),
        ForgePreset("Distance Transfer Experimental",PresetCategory.INFORMATION,"Full chirp/spread, deterministic information carrier and phase-opposed method for correlation experiments. It does not turn a phone speaker into a radio or scalar transmitter.",listOf(t(TransformKind.CHIRP_SPREAD),t(TransformKind.INFORMATION_CARRIER),t(TransformKind.PHASE_OPPOSED))),
        ForgePreset("Correlation Beacon",PresetCategory.INFORMATION,"Chirp/spread plus information carrier and stable 256 Hz reference for repeatable pattern analysis.",listOf(t(TransformKind.CHIRP_SPREAD),t(TransformKind.INFORMATION_CARRIER),t(TransformKind.CONTROL_256))),
        ForgePreset("Puharich-Bearden-Meyl MAX",PresetCategory.MAX,"Dense full-method combination: 8 Hz, 256 Hz control, Meyl phase rotation, phase opposition and Bearden conjugate pairing.",listOf(t(TransformKind.PUHARICH_8),t(TransformKind.CONTROL_256),t(TransformKind.MEYL_VORTEX),t(TransformKind.PHASE_OPPOSED),t(TransformKind.BEARDEN_CONJUGATE))),
        ForgePreset("Full Spectrum Lab",PresetCategory.MAX,"A broad experimental stack spanning envelope, harmonic, spatial, temporal and information-pattern families.",listOf(t(TransformKind.PUHARICH_8),t(TransformKind.TESLA_HARMONICS),t(TransformKind.MEYL_VORTEX),t(TransformKind.ADVANCED_RETARDED),t(TransformKind.INFORMATION_CARRIER),t(TransformKind.CHIRP_SPREAD)))
    )
    fun byCategory(category:PresetCategory):List<ForgePreset> = quick.filter{it.category==category}
}
