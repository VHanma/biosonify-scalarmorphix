package com.vhanma.scalaraudioforge

object PresetLibrary {
    private fun t(kind: TransformKind, amount: Float = 0.35f) = TransformSpec(kind, amount)

    val quick = listOf(
        ForgePreset("Convert Only", "No experimental transform. Decode and export the audio unchanged as PCM WAV/RF64.", emptyList()),
        ForgePreset("Puharich Core", "8 Hz envelope with a 256 Hz reference layer.", listOf(t(TransformKind.PUHARICH_8, .40f), t(TransformKind.CONTROL_256, .18f))),
        ForgePreset("Schumann + Puharich", "7.83 Hz and 8 Hz envelopes with the 256 Hz reference layer.", listOf(t(TransformKind.SCHUMANN_783, .25f), t(TransformKind.PUHARICH_8, .25f), t(TransformKind.CONTROL_256, .12f))),
        ForgePreset("Gateway-Puharich", "Stereo 252/260 Hz difference pair plus a gentle 8 Hz envelope.", listOf(t(TransformKind.GATEWAY_STEREO, .25f), t(TransformKind.PUHARICH_8, .25f))),
        ForgePreset("Tesla-Meyl-Puharich", "Harmonic carriers, stereo phase rotation, and an 8 Hz envelope.", listOf(t(TransformKind.TESLA_HARMONICS, .22f), t(TransformKind.MEYL_VORTEX, .30f), t(TransformKind.PUHARICH_8, .20f))),
        ForgePreset("Scalar Cancellation Lab", "Phase-opposed stereo simulation plus an ELF envelope. This is DSP phase cancellation, not a claim of exotic propagation.", listOf(t(TransformKind.PHASE_OPPOSED, .55f), t(TransformKind.SCHUMANN_783, .18f))),
        ForgePreset("Virtual Wave Pair", "Forward audio blended with a local reversed/conjugate copy.", listOf(t(TransformKind.ADVANCED_RETARDED, .45f))),
        ForgePreset("Advanced / Retarded ELF", "Forward/reverse pairing under a slow 7.83 Hz envelope.", listOf(t(TransformKind.ADVANCED_RETARDED, .35f), t(TransformKind.SCHUMANN_783, .20f))),
        ForgePreset("DNA / Water Harmonic", "256 Hz-derived harmonic ladder with an 8 Hz envelope. Experimental label; exact operation is ordinary DSP.", listOf(t(TransformKind.DNA_WATER, .28f), t(TransformKind.PUHARICH_8, .20f))),
        ForgePreset("Triple ELF", "7.83, 8 and 9 Hz compound modulation for close-frequency beating.", listOf(t(TransformKind.TRIPLE_ELF, .42f))),
        ForgePreset("PHASER Sweep", "20-200 Hz swept modulation inspired by Puharich's carrier/envelope architecture.", listOf(t(TransformKind.PHASER_SWEEP, .25f), t(TransformKind.CONTROL_256, .10f))),
        ForgePreset("Standing Scalar Simulation", "Periodic nodes, phase opposition and center-field projection.", listOf(t(TransformKind.STANDING_WAVE, .35f), t(TransformKind.PHASE_OPPOSED, .30f), t(TransformKind.LONGITUDINAL_MONO, .20f))),
        ForgePreset("Information Imprint", "Deterministic phase-coded reference carrier under an 8 Hz framing envelope.", listOf(t(TransformKind.INFORMATION_CARRIER, .22f), t(TransformKind.PUHARICH_8, .15f))),
        ForgePreset("Distance Transfer Experimental", "Chirp/spread pattern plus information carrier and phase pair for correlation experiments. It does not create a radio transmitter from a phone speaker.", listOf(t(TransformKind.CHIRP_SPREAD, .30f), t(TransformKind.INFORMATION_CARRIER, .25f), t(TransformKind.PHASE_OPPOSED, .22f))),
        ForgePreset("Puharich-Bearden-Meyl MAX", "8 Hz + 256 Hz + phase vortex + opposed pair + conjugate window. A dense multi-branch-style DSP preset.", listOf(t(TransformKind.PUHARICH_8, .18f), t(TransformKind.CONTROL_256, .10f), t(TransformKind.MEYL_VORTEX, .25f), t(TransformKind.PHASE_OPPOSED, .22f), t(TransformKind.BEARDEN_CONJUGATE, .25f)))
    )
}
