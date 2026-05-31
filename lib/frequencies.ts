export type FrequencyCategory =
  | 'Solfeggio'
  | 'Schumann'
  | 'Brainwave'
  | 'Biofield'
  | 'Rife';

export interface FrequencyEntry {
  id: string;
  name: string;
  hz: number;
  category: FrequencyCategory;
  effect: string;
  source: string;
  enabledByDefault: boolean;
}

export const FREQUENCY_LIBRARY: FrequencyEntry[] = [
  // ── Solfeggio ──────────────────────────────────────────────────────────────
  {
    id: 'sol_396',
    name: 'UT — Liberation',
    hz: 396,
    category: 'Solfeggio',
    effect: 'Releases guilt and fear; grounding and liberating. Associated with root chakra activation.',
    source: 'Ancient Solfeggio scale; Horowitz & Puleo research',
    enabledByDefault: false,
  },
  {
    id: 'sol_417',
    name: 'RE — Transformation',
    hz: 417,
    category: 'Solfeggio',
    effect: 'Facilitates change and undoing negative patterns; cleanses traumatic experiences.',
    source: 'Ancient Solfeggio scale',
    enabledByDefault: false,
  },
  {
    id: 'sol_528',
    name: 'MI — DNA Repair',
    hz: 528,
    category: 'Solfeggio',
    effect: 'Claimed to repair DNA; increases UV light absorption in DNA by 5–9%. Central Solfeggio tone. "Love frequency."',
    source: 'Horowitz; Rein (1998) study on UV absorption; wave genetics tradition',
    enabledByDefault: true,
  },
  {
    id: 'sol_639',
    name: 'FA — Connection',
    hz: 639,
    category: 'Solfeggio',
    effect: 'Enhances communication, understanding, and relationships. Heart chakra resonance.',
    source: 'Ancient Solfeggio scale',
    enabledByDefault: false,
  },
  {
    id: 'sol_741',
    name: 'SOL — Intuition',
    hz: 741,
    category: 'Solfeggio',
    effect: 'Awakens intuition; cleanses cells of toxins. Associated with throat chakra and self-expression.',
    source: 'Ancient Solfeggio scale',
    enabledByDefault: false,
  },
  {
    id: 'sol_852',
    name: 'LA — Higher Consciousness',
    hz: 852,
    category: 'Solfeggio',
    effect: 'Returns to spiritual order; awakens inner strength and intuition. Third-eye resonance.',
    source: 'Ancient Solfeggio scale',
    enabledByDefault: false,
  },
  {
    id: 'sol_963',
    name: 'SI — Divine Consciousness',
    hz: 963,
    category: 'Solfeggio',
    effect: 'Activates the pineal gland; associated with pure consciousness and oneness.',
    source: 'Extended Solfeggio scale',
    enabledByDefault: false,
  },

  // ── Schumann Resonances ────────────────────────────────────────────────────
  {
    id: 'sch_7_83',
    name: 'Schumann 1st — Earth Pulse',
    hz: 7.83,
    category: 'Schumann',
    effect: 'Earth\'s fundamental electromagnetic resonance. Synchronizes circadian rhythms; Bentov\'s 7 Hz micromotion. Linked to alpha/theta border in brainwaves.',
    source: 'Schumann (1952); Bentov (1977); König research',
    enabledByDefault: true,
  },
  {
    id: 'sch_14_1',
    name: 'Schumann 2nd Harmonic',
    hz: 14.1,
    category: 'Schumann',
    effect: 'Second harmonic of Earth resonance. Corresponds to low beta brainwaves; alertness and focus.',
    source: 'Schumann resonance harmonics',
    enabledByDefault: false,
  },
  {
    id: 'sch_20_25',
    name: 'Schumann 3rd Harmonic',
    hz: 20.25,
    category: 'Schumann',
    effect: 'Third harmonic. Mid-beta range; active thinking and problem-solving.',
    source: 'Schumann resonance harmonics',
    enabledByDefault: false,
  },
  {
    id: 'sch_26_4',
    name: 'Schumann 4th Harmonic',
    hz: 26.4,
    category: 'Schumann',
    effect: 'Fourth harmonic. Upper beta; heightened awareness.',
    source: 'Schumann resonance harmonics',
    enabledByDefault: false,
  },
  {
    id: 'sch_32_45',
    name: 'Schumann 5th Harmonic',
    hz: 32.45,
    category: 'Schumann',
    effect: 'Fifth harmonic. Low gamma; integration and coherence.',
    source: 'Schumann resonance harmonics',
    enabledByDefault: false,
  },

  // ── Brainwave Entrainment ──────────────────────────────────────────────────
  {
    id: 'bw_delta_2',
    name: 'Delta — Deep Healing',
    hz: 2,
    category: 'Brainwave',
    effect: 'Deep sleep, cellular regeneration, pain relief, access to unconscious. HGH release.',
    source: 'Monroe Institute; brainwave entrainment research',
    enabledByDefault: false,
  },
  {
    id: 'bw_theta_6',
    name: 'Theta — Intuition Gate',
    hz: 6,
    category: 'Brainwave',
    effect: 'Meditation, creativity, intuition, emotional processing, hypnagogic imagery. Shamanic state.',
    source: 'Monroe Institute Hemi-Sync; Grinberg-Zylberbaum research',
    enabledByDefault: false,
  },
  {
    id: 'bw_alpha_10',
    name: 'Alpha — Relaxed Focus',
    hz: 10,
    category: 'Brainwave',
    effect: 'Relaxed alertness, accelerated learning, flow state, stress reduction.',
    source: 'Brainwave entrainment; Lakhovsky cellular oscillation parallels',
    enabledByDefault: false,
  },
  {
    id: 'bw_gamma_40',
    name: 'Gamma — Coherence',
    hz: 40,
    category: 'Brainwave',
    effect: 'Binding of sensory information; peak cognition; associated with compassion and insight in advanced meditators. Gariaev coherence frequency.',
    source: 'Lutz et al. (2004); Gariaev wave genetics coherence carrier',
    enabledByDefault: true,
  },

  // ── Biofield / DNA ─────────────────────────────────────────────────────────
  {
    id: 'bio_432',
    name: '432 Hz — Natural A',
    hz: 432,
    category: 'Biofield',
    effect: 'Natural tuning of A note (vs standard 440 Hz). Claimed to resonate with universal harmonics and sacred geometry proportions.',
    source: 'Alternative tuning tradition; Verdi pitch; sacred geometry research',
    enabledByDefault: false,
  },
  {
    id: 'bio_111',
    name: '111 Hz — Cell Regeneration',
    hz: 111,
    category: 'Biofield',
    effect: 'Found in ancient megalithic chambers (Malta hypogeum). Switches off prefrontal cortex; induces trance. Claimed cell regeneration frequency.',
    source: 'Jahn et al. (1996) archaeoacoustics; Malta hypogeum research',
    enabledByDefault: false,
  },
  {
    id: 'bio_285',
    name: '285 Hz — Tissue Repair',
    hz: 285,
    category: 'Biofield',
    effect: 'Claimed to influence energy fields and promote tissue and organ repair.',
    source: 'Extended Solfeggio; biofield tradition',
    enabledByDefault: false,
  },
  {
    id: 'bio_174',
    name: '174 Hz — Pain Relief',
    hz: 174,
    category: 'Biofield',
    effect: 'Lowest Solfeggio extension. Claimed to reduce pain and stress; anesthetic effect on cells.',
    source: 'Extended Solfeggio scale',
    enabledByDefault: false,
  },

  // ── Rife Frequencies (selected) ────────────────────────────────────────────
  {
    id: 'rife_880',
    name: 'Rife 880 Hz',
    hz: 880,
    category: 'Rife',
    effect: 'One of Rife\'s original frequencies for general pathogen disruption. Harmonic of 440 Hz.',
    source: 'Royal Raymond Rife (1930s); Spooky2 frequency database',
    enabledByDefault: false,
  },
  {
    id: 'rife_728',
    name: 'Rife 728 Hz',
    hz: 728,
    category: 'Rife',
    effect: 'Rife frequency associated with immune stimulation and general wellness in Rife tradition.',
    source: 'Royal Raymond Rife; Spooky2 database',
    enabledByDefault: false,
  },
  {
    id: 'rife_787',
    name: 'Rife 787 Hz',
    hz: 787,
    category: 'Rife',
    effect: 'Rife frequency for general pathogen disruption; one of the original "M.O.R." candidates.',
    source: 'Royal Raymond Rife; Spooky2 database',
    enabledByDefault: false,
  },
];

export const CATEGORIES: FrequencyCategory[] = [
  'Solfeggio',
  'Schumann',
  'Brainwave',
  'Biofield',
  'Rife',
];

export function getDefaultEnabled(): FrequencyEntry[] {
  return FREQUENCY_LIBRARY.filter((f) => f.enabledByDefault);
}

export function getByCategory(cat: FrequencyCategory): FrequencyEntry[] {
  return FREQUENCY_LIBRARY.filter((f) => f.category === cat);
}
