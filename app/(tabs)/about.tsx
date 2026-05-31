import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  Pressable,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Section {
  title: string;
  color: string;
  content: string;
}

const THEORY_SECTIONS: Section[] = [
  {
    title: "Wave Genetics — Peter Gariaev",
    color: "#F0A500",
    content:
      "Peter Gariaev's Linguistic Wave Genetics posits that DNA is not merely a biochemical molecule but a wave biocomputer. Using a helium-neon laser (632.8 nm), Gariaev's team demonstrated the DNA Phantom Effect: after removing a DNA sample from a chamber, the laser light-scattering pattern continued for up to 40 days — evidence of a persistent holographic field left by the DNA. The chromosome apparatus acts as a holographic memory and a biological laser, emitting coherent biophotons. Non-coding DNA (98% of the genome) encodes linguistic, holographic wave programs that govern morphogenesis and healing. In collaboration with Dr. Jiang Kanzhen, Gariaev demonstrated inter-species information transfer using modulated electromagnetic fields — the famous duck-chicken experiment in which duck DNA wave information was transmitted to developing chicken embryos, producing hybrid morphological features. BioSonify's Wave Genetics mode converts image luminance into a 40 Hz coherence carrier and maps RGB color channels to the 396 / 528 / 741 Hz Solfeggio tones, approximating the modulation principle of Gariaev's laser scanner.",
  },
  {
    title: "Solfeggio Frequencies & DNA",
    color: "#2ECC9A",
    content:
      "The ancient Solfeggio scale (UT-RE-MI-FA-SOL-LA) was rediscovered by Dr. Joseph Puleo and Len Horowitz. Each tone is proposed to carry specific healing information. Most significant for BioSonify is 528 Hz (MI — Transformation and Miracles), which Horowitz and researcher Glen Rein demonstrated increases UV light absorption in DNA samples by 5–9%, suggesting direct interaction with the DNA molecule's photon-absorbing properties. The full scale — 396, 417, 528, 639, 741, 852, and 963 Hz — maps to chakra activations, emotional releases, and states of consciousness. BioSonify uses 396 Hz (R channel), 528 Hz (G channel), and 741 Hz (B channel) as the three primary Solfeggio carriers in Wave Genetics mode, encoding the full color information of the image into biologically resonant tones.",
  },
  {
    title: "Schumann Resonances",
    color: "#4A9EFF",
    content:
      "In 1952, physicist W.O. Schumann calculated that the Earth-ionosphere cavity resonates at approximately 7.83 Hz, with harmonics at 14.1, 20.25, 26.4, and 32.45 Hz. These are not merely electromagnetic curiosities — they are the electromagnetic heartbeat of the planet. Itzhak Bentov's research on the 7 Hz micromotion of the body demonstrated that the human body resonates sympathetically with this fundamental. The Schumann resonances fall precisely within the alpha-theta brainwave border, the state associated with deep meditation, creative insight, and healing. Lakhovsky's Multiple Wave Oscillator (MWO) was designed to flood cells with a broad spectrum of oscillations including these Earth frequencies, restoring cellular coherence. BioSonify's Biofield mode includes all five primary Schumann harmonics as additive carriers.",
  },
  {
    title: "Brainwave Entrainment & Robert Monroe",
    color: "#A78BFA",
    content:
      "Robert Monroe, founder of the Monroe Institute, discovered in the 1950s that specific audio frequency differentials between the two ears (binaural beats) could reliably induce altered states of consciousness. His Hemi-Sync technology uses precise frequency combinations to synchronize left and right brain hemispheres. Monroe mapped consciousness states to frequency bands: delta (0.5–4 Hz) for deep healing and sleep; theta (4–8 Hz) for the hypnagogic state, shamanic journeying, and intuition; alpha (8–13 Hz) for relaxed focus and accelerated learning; beta (13–30 Hz) for active cognition; and gamma (30–100 Hz) for peak coherence and binding of sensory information. Itzhak Bentov's model of consciousness evolution proposed that the 7 Hz standing wave in the aorta creates a resonant circuit with the brain's ventricles, enabling the kundalini experience. BioSonify encodes these states as selectable carrier frequencies.",
  },
  {
    title: "Royal Rife & Mortal Oscillatory Rates",
    color: "#F85149",
    content:
      "Royal Raymond Rife developed a universal microscope in the 1930s capable of resolving living viruses and bacteria — decades before electron microscopy. He observed that every microorganism has a unique Mortal Oscillatory Rate (MOR): a resonant frequency at which it shatters via cymatics-like resonance, analogous to a soprano shattering a wine glass. Rife's frequencies (728, 787, 880 Hz and others) were documented to devitalize pathogens in vitro. The Spooky2 system is the modern open-source implementation of Rife frequency therapy, maintaining a database of thousands of frequencies. BioSonify includes selected Rife frequencies in the library for completeness, honoring Rife's foundational insight that biological matter is fundamentally vibrational.",
  },
  {
    title: "Lakhovsky & Cellular Oscillation",
    color: "#F0A500",
    content:
      "Georges Lakhovsky proposed in the 1920s that every living cell is both a transmitter and receiver of electromagnetic oscillations. The nucleus of each cell acts as a resonant circuit, with chromosomes as inductors and cellular fluid as the dielectric. Health is coherent oscillation; disease is incoherent oscillation. His Multiple Wave Oscillator generated a broad spectrum of frequencies from very low to microwave, bathing cells in their own natural resonant frequencies and restoring coherence. Lakhovsky's model directly anticipates Gariaev's wave genetics: both propose that the genetic apparatus is fundamentally electromagnetic and that information can be transmitted via resonant fields.",
  },
  {
    title: "Morphic Resonance — Rupert Sheldrake",
    color: "#2ECC9A",
    content:
      "Rupert Sheldrake's theory of morphic resonance proposes that form and behavior are shaped by non-local morphic fields — invisible organizing fields that carry the memory of all previous similar forms. DNA does not contain the full blueprint for an organism; the morphic field does. This directly supports Gariaev's wave genetics: the wave program of DNA is the morphic field interface. When BioSonify converts an image into sound, it is — in Sheldrake's framework — encoding the morphic field signature of that image into an acoustic carrier that can resonate with the listener's own morphic field.",
  },
  {
    title: "How BioSonify Works",
    color: "#2ECC9A",
    content:
      "BioSonify implements three sonification engines. The Spectral Scan engine maps each image column to a time slice, vertical pixel position to frequency (200–4000 Hz), brightness to amplitude, and hue to timbre blend (sine/triangle/sawtooth). The Wave Genetics engine treats the image as a biophoton emission map: average luminance modulates a 40 Hz coherence carrier, while the R, G, B channel averages amplitude-modulate 396, 528, and 741 Hz Solfeggio carriers respectively. The Biofield Overlay engine combines the Spectral base with additive synthesis of any user-selected carriers from the Frequency Library — Schumann resonances, Solfeggio tones, brainwave entrainment frequencies, and Rife frequencies. All synthesis is performed in pure JavaScript using the Web Audio API's PCM encoding, producing a standard WAV file that can be exported and shared.",
  },
];

export default function AboutScreen() {
  return (
    <ScreenContainer containerClassName="bg-background" className="bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Theoretical Foundations</Text>
          <Text style={styles.subtitle}>
            The science and philosophy behind BioSonify
          </Text>
        </View>

        {/* ── Theory Sections ────────────────────────────────────────── */}
        {THEORY_SECTIONS.map((section) => (
          <View
            key={section.title}
            style={[styles.section, { borderLeftColor: section.color }]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={[styles.dot, { backgroundColor: section.color }]}
              />
              <Text style={[styles.sectionTitle, { color: section.color }]}>
                {section.title}
              </Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* ── Credits ────────────────────────────────────────────────── */}
        <View style={styles.credits}>
          <Text style={styles.creditsTitle}>Researchers & Traditions</Text>
          {[
            "Peter Gariaev — Linguistic Wave Genetics",
            "Jiang Kanzhen — Bioelectromagnetic information transfer",
            "Royal Raymond Rife — Mortal Oscillatory Rates",
            "Georges Lakhovsky — Multiple Wave Oscillator",
            "W.O. Schumann — Earth-ionosphere resonance",
            "Robert Monroe — Hemi-Sync & consciousness mapping",
            "Itzhak Bentov — Micromotion & kundalini resonance",
            "Rupert Sheldrake — Morphic resonance fields",
            "Len Horowitz & Joseph Puleo — Solfeggio rediscovery",
            "Tom Bearden — Scalar electromagnetics",
            "Spooky2 — Open-source Rife frequency platform",
          ].map((credit) => (
            <Text key={credit} style={styles.creditItem}>
              · {credit}
            </Text>
          ))}
        </View>

        {/* ── Disclaimer ─────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <IconSymbol name="info.circle" size={16} color="#7D8590" />
          <Text style={styles.disclaimerText}>
            BioSonify is an experimental creative and research tool. The
            theoretical frameworks presented here represent alternative and
            emerging science traditions. This app is not a medical device and
            makes no therapeutic claims. Use for exploration, meditation, and
            creative research.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#E6EDF3",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#7D8590",
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#161B22",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  sectionContent: {
    fontSize: 13,
    color: "#7D8590",
    lineHeight: 20,
  },
  credits: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#161B22",
    borderRadius: 12,
    padding: 16,
  },
  creditsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E6EDF3",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  creditItem: {
    fontSize: 12,
    color: "#7D8590",
    lineHeight: 22,
  },
  disclaimer: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: "#161B22",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: "#7D8590",
    lineHeight: 17,
  },
});
