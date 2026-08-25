package com.vhanma.scalaraudioforge

enum class WaveCategory(val label: String, val description: String) {
    PUHARICH_ELF("Puharich / ELF", "ELF, 8 Hz, 256 Hz and PHASER-inspired concepts associated with Andrija Puharich."),
    SCHUMANN_BRAIN("Schumann / Brain Rhythms", "Earth-ionosphere resonance and ordinary audio modulation mapped to low-frequency brain-rhythm bands."),
    TESLA_RESONANCE("Tesla / Resonance", "Resonance and harmonic structures inspired by later Tesla-wave interpretations."),
    SCALAR_LONGITUDINAL("Scalar / Longitudinal", "Digital simulations of phase opposition, center-field, standing-wave and longitudinal-style ideas."),
    MEYL("Meyl", "Phase-rotation and longitudinal/scalar-style interpretations associated with Konstantin Meyl."),
    BEARDEN("Bearden / Conjugate", "Conjugate, reversed and phase-opposed signal models inspired by Bearden-style terminology."),
    GATEWAY("Gateway / Binaural", "Stereo difference-frequency and binaural-style signal structures."),
    BIO_DNA("Bio / DNA / Water", "Experimental biological-information and harmonic models. These labels are hypotheses, not established biological effects."),
    INFORMATION("Information / Distance", "Correlation-friendly chirps, deterministic carriers and information-transfer signal structures."),
    WAVE_GEOMETRY("Wave Geometry", "Conventional DSP constructions involving nodes, phase, polarity, stereo field and time reversal.")
}

enum class TransformKind(
    val title: String,
    val category: WaveCategory,
    val concept: String,
    val dsp: String,
    val evidence: String
) {
    PUHARICH_8(
        "Puharich 8 Hz",
        WaveCategory.PUHARICH_ELF,
        "Inspired by Puharich's emphasis on approximately 8 Hz ELF biological resonance and entrainment concepts.",
        "Applies a complete 8 Hz amplitude-envelope pattern to the audio with a fixed, internally safe modulation profile.",
        "8 Hz amplitude modulation is ordinary DSP. Puharich's broader biological/scalar interpretation is unconventional and not established by the DSP itself."
    ),
    SCHUMANN_783(
        "Schumann 7.83 Hz",
        WaveCategory.SCHUMANN_BRAIN,
        "Uses the commonly cited approximate fundamental Schumann-resonance frequency as a modulation rhythm.",
        "Applies a complete 7.83 Hz amplitude-envelope pattern.",
        "Schumann resonances are real atmospheric electromagnetic resonances. Playing 7.83 Hz as an audio modulation does not reproduce the Earth's electromagnetic cavity field."
    ),
    CONTROL_256(
        "Puharich 256 Hz Control",
        WaveCategory.PUHARICH_ELF,
        "Inspired by the 256 Hz quartz-control/reference layer described in Puharich material.",
        "Adds a fixed low-level 256 Hz reference carrier to the signal.",
        "The 256 Hz audio carrier is measurable DSP. Any claimed scalar or biological role is an experimental interpretation."
    ),
    GATEWAY_STEREO(
        "Gateway-Puharich Stereo",
        WaveCategory.GATEWAY,
        "Combines a stereo carrier pair whose frequency difference is 8 Hz.",
        "Adds 252 Hz to the left channel and 260 Hz to the right channel, creating an 8 Hz binaural difference when heard in stereo.",
        "Binaural difference tones are a conventional acoustic phenomenon. Broader consciousness claims vary in evidence."
    ),
    TESLA_HARMONICS(
        "Tesla Harmonic Stack",
        WaveCategory.TESLA_RESONANCE,
        "A harmonic-resonance layer inspired by later Tesla resonance interpretations.",
        "Adds a fixed harmonic family at 144, 432 and 864 Hz with descending harmonic gain.",
        "The harmonic relationship is ordinary acoustics/DSP. Calling the result a Tesla or scalar wave is an experimental naming convention."
    ),
    MEYL_VORTEX(
        "Meyl Phase Vortex",
        WaveCategory.MEYL,
        "A stereo phase-rotation model inspired by Meyl's scalar/longitudinal and potential-vortex language.",
        "Continuously rotates left/right audio through a stereo phase matrix.",
        "Stereo phase rotation is conventional DSP. The scalar-vortex interpretation is not established by the audio operation."
    ),
    PHASE_OPPOSED(
        "Phase-Opposed Pair",
        WaveCategory.SCALAR_LONGITUDINAL,
        "Models the opposed-polarity/cancellation idea common in scalar-wave literature.",
        "Converts stereo into a strong mid/side opposition structure with opposite polarity on the side component.",
        "Phase cancellation and polarity inversion are established signal operations. Exotic propagation claims are separate."
    ),
    STANDING_WAVE(
        "Standing-Wave Nodes",
        WaveCategory.WAVE_GEOMETRY,
        "Models repeating nodes and antinodes in the amplitude domain.",
        "Applies a complete periodic node envelope to the audio.",
        "Standing waves are established physics. This audio envelope is a simulation of node structure, not a spatial field generator."
    ),
    ADVANCED_RETARDED(
        "Advanced / Retarded Pair",
        WaveCategory.BEARDEN,
        "Models forward plus time-reversed signal pairing associated with advanced/retarded-wave discussions.",
        "Combines each processing window with a time-reversed copy using energy-normalized summation.",
        "Time reversal of recorded audio is ordinary DSP. It does not demonstrate backward-time propagation."
    ),
    DNA_WATER(
        "DNA / Water Harmonics",
        WaveCategory.BIO_DNA,
        "A harmonic-information preset inspired by Puharich/Gariaev-adjacent DNA and water-resonance literature.",
        "Uses 256, 512 and 1024 Hz related components as a fixed modulation ladder.",
        "The harmonic DSP is measurable. Specific DNA/water information-transfer claims remain experimental or fringe."
    ),
    TRIPLE_ELF(
        "Triple ELF 7.83 / 8 / 9",
        WaveCategory.SCHUMANN_BRAIN,
        "Combines three nearby low-frequency rhythms to create slow beating relationships.",
        "Applies a compound envelope generated from 7.83, 8 and 9 Hz components.",
        "The beating and modulation are conventional DSP. Any special biological interpretation is separate."
    ),
    BRAIN_LADDER(
        "Brain-Rhythm Ladder",
        WaveCategory.SCHUMANN_BRAIN,
        "Cycles through several commonly discussed low-frequency rhythm bands.",
        "Steps the modulation rhythm through 4, 7.83, 8, 10, 20 and 40 Hz.",
        "The frequencies are ordinary modulation values. Effects on cognition depend on delivery, context and evidence beyond the waveform itself."
    ),
    PHASER_SWEEP(
        "Puharich PHASER Sweep",
        WaveCategory.PUHARICH_ELF,
        "Inspired by Puharich's carrier/envelope and PHASER terminology.",
        "Sweeps a modulation oscillator continuously from 20 to 200 Hz and back.",
        "The sweep is conventional DSP. The historical PHASER interpretation is experimental."
    ),
    CHIRP_SPREAD(
        "Chirp / Spread Pattern",
        WaveCategory.INFORMATION,
        "Designed for correlation-friendly information experiments rather than a single fixed tone.",
        "Applies a repeating swept carrier pattern from 300 to 3000 Hz.",
        "Chirps and matched-correlation concepts are established communications techniques. This phone-audio implementation is not a scalar transmitter."
    ),
    LONGITUDINAL_MONO(
        "Longitudinal Center Projection",
        WaveCategory.SCALAR_LONGITUDINAL,
        "A digital center-field analogue for longitudinal-style experiments.",
        "Projects every channel fully onto the shared mono/center component.",
        "Center projection is ordinary channel matrixing. It is only a longitudinal-style simulation in this app."
    ),
    BEARDEN_CONJUGATE(
        "Bearden Conjugate Pair",
        WaveCategory.BEARDEN,
        "Models conjugate/opposed waveform language using a reversed-polarity partner.",
        "Combines each window with a time-reversed, polarity-inverted copy using energy-normalized summation.",
        "The conjugate-style audio construction is DSP. Bearden's vacuum/scalar interpretation is not established by it."
    ),
    INFORMATION_CARRIER(
        "Information Carrier",
        WaveCategory.INFORMATION,
        "Adds a deterministic phase-coded reference pattern so the output contains a repeatable mathematical fingerprint.",
        "Uses a deterministic pseudo-random polarity code on a 256 Hz reference carrier.",
        "Deterministic coding and correlation are conventional signal-processing ideas. Any nonstandard propagation claim requires separate evidence."
    )
}

data class TransformSpec(val kind: TransformKind)

enum class PresetCategory(val label: String) {
    CONVERTER("Converter"),
    PUHARICH("Puharich / ELF"),
    SCALAR("Scalar / Longitudinal"),
    TESLA_MEYL("Tesla / Meyl"),
    BEARDEN("Bearden / Time-Pair"),
    BIO("Bio / DNA / Water"),
    INFORMATION("Information / Distance"),
    MAX("Multi-System MAX")
}

data class ForgePreset(
    val name: String,
    val category: PresetCategory,
    val description: String,
    val transforms: List<TransformSpec>
)

enum class MergeMode(val label: String, val description: String) {
    FULL_MERGE(
        "FULL MERGE • combine all methods",
        "Each branch processes its own full copy. The engine keeps the original once, adds every branch's full transformation delta, then only peak-limits if clipping would occur."
    ),
    STEREO_SIDE_BY_SIDE(
        "SIDE-BY-SIDE • independent stereo copies",
        "Independent full-method copies are routed to opposite stereo sides. With more than two branches, additional branches alternate left/right. Mono sources are expanded to stereo."
    )
}

data class ForgeBranch(
    val name: String,
    val transforms: List<TransformSpec>
)

data class ForgeMatrix(
    val enabled: Boolean = false,
    val mode: MergeMode = MergeMode.FULL_MERGE,
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
