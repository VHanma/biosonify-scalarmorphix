package com.vhanma.scalaraudioforge

enum class TransformKind(val title: String, val dsp: String) {
    PUHARICH_8("Puharich 8 Hz", "8 Hz amplitude-envelope modulation"),
    SCHUMANN_783("Schumann 7.83", "7.83 Hz amplitude-envelope modulation"),
    CONTROL_256("256 Hz Control", "low-level 256 Hz reference carrier"),
    GATEWAY_STEREO("Gateway-Puharich Stereo", "252/260 Hz stereo carrier pair with an 8 Hz difference"),
    TESLA_HARMONICS("Tesla Harmonic Stack", "harmonically related carrier mixture"),
    MEYL_VORTEX("Meyl Phase Vortex", "stereo phase-rotation matrix"),
    PHASE_OPPOSED("Phase-Opposed Pair", "mid/side opposition and polarity rotation"),
    STANDING_WAVE("Standing Wave", "periodic amplitude-node simulation"),
    ADVANCED_RETARDED("Advanced/Retarded Pair", "forward plus locally time-reversed waveform pairing"),
    DNA_WATER("DNA/Water Harmonics", "256 Hz harmonic modulation ladder"),
    TRIPLE_ELF("Triple ELF", "7.83 + 8 + 9 Hz compound envelope"),
    BRAIN_LADDER("Brain Rhythm Ladder", "4/7.83/8/10/20/40 Hz stepped envelope"),
    PHASER_SWEEP("Puharich PHASER", "20-200 Hz swept modulation"),
    CHIRP_SPREAD("Chirp / Spread", "swept correlation-friendly carrier modulation"),
    LONGITUDINAL_MONO("Longitudinal Mono", "center-field mono projection"),
    BEARDEN_CONJUGATE("Bearden Conjugate", "windowed reverse/polarity-conjugate simulation"),
    INFORMATION_CARRIER("Information Carrier", "deterministic phase-coded reference carrier")
}

data class TransformSpec(
    val kind: TransformKind,
    val amount: Float = 0.35f
)

data class ForgePreset(
    val name: String,
    val description: String,
    val transforms: List<TransformSpec>
)

enum class MergeMode(val label: String) {
    NORMALIZED_WEIGHTED("Normalized weighted merge"),
    EQUAL_AVERAGE("Equal branch average"),
    ALTERNATING_POLARITY("Alternating-polarity interferometry")
}

data class ForgeBranch(
    val name: String,
    val weight: Float = 1f,
    val transforms: List<TransformSpec>
)

data class ForgeMatrix(
    val enabled: Boolean = false,
    val mode: MergeMode = MergeMode.NORMALIZED_WEIGHTED,
    val branches: List<ForgeBranch> = emptyList(),
    val master: List<TransformSpec> = emptyList()
)

enum class OutputFormat(
    val label: String,
    val extension: String,
    val mimeType: String
) {
    WAV16("WAV PCM 16-bit", "wav", "audio/wav"),
    WAV24("WAV PCM 24-bit", "wav", "audio/wav"),
    WAV_FLOAT32("WAV Float 32-bit", "wav", "audio/wav"),
    RF64("RF64 PCM 16-bit • huge files", "wav", "audio/wav"),
    AAC_M4A("AAC-LC • M4A", "m4a", "audio/mp4"),
    OPUS_OGG("Opus • OGG", "ogg", "audio/ogg")
}
