/**
 * Mobile TypeScript port/adaptation of concepts from erinspace/sonify.
 * Original project: https://github.com/erinspace/sonify
 * Copyright (c) 2017 Erin Braswell, MIT License.
 *
 * The original Python project maps arbitrary numeric data to MIDI: scaling,
 * quantization, key locking, General MIDI instruments/percussion, and single/
 * multi-track MIDI creation. This module preserves those capabilities and adds
 * a deterministic WAV preview renderer suitable for React Native/Expo.
 */

export type DataPoint = { x: number; y: number };
export type SourceKind = "melodic" | "percussion";

export interface SourceChoice {
  id: string;
  label: string;
  kind: SourceKind;
  /** 0-based GM program for melodic sources, MIDI drum note for percussion. */
  midi: number;
}

export interface MusicalTrack {
  name: string;
  source: SourceChoice;
  points: DataPoint[];
}

export interface MusicalOptions {
  key: KeyName | null;
  octaveStart: number;
  numberOfOctaves: number;
  quantizeStep: number;
  tempoBpm: number;
  noteDurationBeats: number;
  velocity: number;
  midiMin: number;
  midiMax: number;
  normalizeTime: boolean;
}

export interface ParsedNumericTable {
  headers: string[];
  rows: number[][];
  delimiter: string;
}

export type ProgressCallback = (progress: number) => void;

const NOTE_TO_PC: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export const KEYS = {
  c_major: ["C", "D", "E", "F", "G", "A", "B"],
  d_major: ["D", "E", "F#", "G", "A", "B", "C#"],
  e_major: ["E", "F#", "G#", "A", "B", "C#", "D#"],
  f_major: ["F", "G", "A", "Bb", "C", "D", "E"],
  g_major: ["G", "A", "B", "C", "D", "E", "F#"],
  a_major: ["A", "B", "C#", "D", "E", "F#", "G#"],
  b_major: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
  c_sharp_major: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
  d_sharp_major: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
  f_sharp_major: ["F#", "G#", "A#", "B", "C#", "D#", "F"],
  g_sharp_major: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
  a_sharp_major: ["Bb", "C", "D", "Eb", "F", "G", "A"],
  d_flat_major: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
  e_flat_major: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
  g_flat_major: ["F#", "G#", "A#", "B", "C#", "D#", "F"],
  a_flat_major: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
  b_flat_major: ["Bb", "C", "D", "Eb", "F", "G", "A"],
} as const;

export type KeyName = keyof typeof KEYS;

export const KEY_CHOICES: { value: KeyName | null; label: string }[] = [
  { value: null, label: "Chromatic / raw" },
  { value: "c_major", label: "C major" },
  { value: "d_major", label: "D major" },
  { value: "e_major", label: "E major" },
  { value: "f_major", label: "F major" },
  { value: "g_major", label: "G major" },
  { value: "a_major", label: "A major" },
  { value: "b_major", label: "B major" },
  { value: "d_flat_major", label: "D♭ major" },
  { value: "e_flat_major", label: "E♭ major" },
  { value: "g_flat_major", label: "G♭ major" },
  { value: "a_flat_major", label: "A♭ major" },
  { value: "b_flat_major", label: "B♭ major" },
];

// General MIDI Level 1 program names. Original erinspace/sonify uses 1-based
// values; these are stored 0-based because MIDI Program Change is 0..127.
const GM_NAMES = [
  "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano",
  "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavi",
  "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
  "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
  "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)",
  "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
  "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
  "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
  "String Ensemble 1", "String Ensemble 2", "SynthStrings 1", "SynthStrings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
  "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "SynthBrass 1", "SynthBrass 2",
  "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
  "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
  "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass + lead)",
  "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
  "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)",
  "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
  "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
  "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot",
] as const;

export const MELODIC_SOURCES: SourceChoice[] = GM_NAMES.map((label, midi) => ({
  id: `gm-${midi}`,
  label,
  kind: "melodic" as const,
  midi,
}));

const DRUMS: [string, number][] = [
  ["Acoustic Bass Drum", 35], ["Bass Drum 1", 36], ["Side Stick", 37], ["Acoustic Snare", 38],
  ["Hand Clap", 39], ["Electric Snare", 40], ["Low Floor Tom", 41], ["Closed Hi Hat", 42],
  ["High Floor Tom", 43], ["Pedal Hi-Hat", 44], ["Low Tom", 45], ["Open Hi-Hat", 46],
  ["Low-Mid Tom", 47], ["Hi-Mid Tom", 48], ["Crash Cymbal 1", 49], ["High Tom", 50],
  ["Ride Cymbal 1", 51], ["Chinese Cymbal", 52], ["Ride Bell", 53], ["Tambourine", 54],
  ["Splash Cymbal", 55], ["Cowbell", 56], ["Crash Cymbal 2", 57], ["Vibraslap", 58],
  ["Ride Cymbal 2", 59], ["Hi Bongo", 60], ["Low Bongo", 61], ["Mute Hi Conga", 62],
  ["Open Hi Conga", 63], ["Low Conga", 64], ["High Timbale", 65], ["Low Timbale", 66],
  ["High Agogo", 67], ["Low Agogo", 68], ["Cabasa", 69], ["Maracas", 70],
  ["Short Whistle", 71], ["Long Whistle", 72], ["Short Guiro", 73], ["Long Guiro", 74],
  ["Claves", 75], ["Hi Wood Block", 76], ["Low Wood Block", 77], ["Mute Cuica", 78],
  ["Open Cuica", 79], ["Mute Triangle", 80], ["Open Triangle", 81],
];

export const PERCUSSION_SOURCES: SourceChoice[] = DRUMS.map(([label, midi]) => ({
  id: `drum-${midi}`,
  label,
  kind: "percussion" as const,
  midi,
}));

export const ALL_SOURCES = [...MELODIC_SOURCES, ...PERCUSSION_SOURCES];

export const DEFAULT_SOURCES: SourceChoice[] = [
  MELODIC_SOURCES[0],
  MELODIC_SOURCES[48],
  MELODIC_SOURCES[88],
  MELODIC_SOURCES[80],
  MELODIC_SOURCES[40],
  PERCUSSION_SOURCES[3],
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getScaledValue(
  oldValue: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number,
): number {
  if (!Number.isFinite(oldValue)) return newMin;
  if (oldMax === oldMin) return (newMin + newMax) / 2;
  return ((oldValue - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
}

export function scaleListToRange(values: number[], newMin: number, newMax: number): number[] {
  if (values.length === 0) return [];
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return values.map(() => newMin);
  const oldMin = Math.min(...finite);
  const oldMax = Math.max(...finite);
  return values.map((v) => getScaledValue(v, oldMin, oldMax, newMin, newMax));
}

export function quantizeXValue(values: number[], steps = 0.5): number[] {
  if (!(steps > 0)) return [...values];
  return values.map((x) => Math.round(steps * Math.round(x / steps) * 100000) / 100000);
}

export function noteNameToMidi(note: string, octave: number): number {
  const pc = NOTE_TO_PC[note];
  if (pc === undefined) throw new Error(`Unknown note: ${note}`);
  return clamp((octave + 1) * 12 + pc, 0, 127);
}

export function keyNameToNotes(
  key: KeyName,
  octaveStart = 1,
  numberOfOctaves = 4,
): number[] {
  const scale = KEYS[key];
  if (!scale) throw new Error(`No key by that name found: ${key}`);
  const targetCount = Math.max(1, Math.floor(numberOfOctaves)) * 7;
  const notes: number[] = [];
  let octave = octaveStart + 1;
  let lastPc = -1;

  for (let i = 0; i < targetCount; i++) {
    const name = scale[i % scale.length];
    const pc = NOTE_TO_PC[name];
    if (i > 0 && pc <= lastPc) octave += 1;
    notes.push(noteNameToMidi(name, octave));
    lastPc = pc;
  }
  return notes;
}

export function getClosestMidiValue(value: number, possibleValues: number[]): number {
  if (possibleValues.length === 0) return clamp(Math.round(value), 0, 127);
  let best = possibleValues[0];
  let bestDist = Math.abs(best - value);
  for (let i = 1; i < possibleValues.length; i++) {
    const d = Math.abs(possibleValues[i] - value);
    if (d < bestDist) {
      best = possibleValues[i];
      bestDist = d;
    }
  }
  return best;
}

export function makeFirstNumberMatchKey(yValues: number[], notesInKey: number[]): number[] {
  if (yValues.length === 0 || notesInKey.length === 0) return [...yValues];
  const transposeValue = notesInKey[0] - yValues[0];
  return yValues.map((y) => y + transposeValue);
}

export function convertToKey(
  data: DataPoint[],
  key: KeyName,
  numberOfOctaves = 4,
  octaveStart = 1,
): DataPoint[] {
  if (data.length === 0) return [];
  const notesInKey = keyNameToNotes(key, octaveStart, numberOfOctaves);
  const y = data.map((p) => p.y);
  const transposed = makeFirstNumberMatchKey(y, notesInKey);
  const scaled = scaleListToRange(transposed, Math.min(...notesInKey), Math.max(...notesInKey));
  return data.map((p, i) => ({ x: p.x, y: getClosestMidiValue(scaled[i], notesInKey) }));
}

export function scaleYToMidiRange(data: DataPoint[], newMin = 0, newMax = 127): DataPoint[] {
  if (newMin < 0 || newMax > 127 || newMin > newMax) {
    throw new Error("MIDI notes must be in a range from 0 to 127");
  }
  if (data.length === 0) return [];
  const scaled = scaleListToRange(data.map((p) => p.y), newMin, newMax);
  return data.map((p, i) => ({ x: p.x, y: scaled[i] }));
}

function detectDelimiter(line: string): string {
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (!quoted && line[i] === delimiter) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isNumericCell(value: string): boolean {
  if (!value.trim()) return false;
  const n = Number(value.replace(/_/g, ""));
  return Number.isFinite(n);
}

export function parseNumericTable(text: string): ParsedNumericTable {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

  if (lines.length === 0) throw new Error("The file has no data rows.");
  const delimiter = detectDelimiter(lines[0]);
  const first = parseDelimitedLine(lines[0], delimiter);
  const firstLooksNumeric = first.length > 0 && first.every(isNumericCell);
  const headers = firstLooksNumeric
    ? first.map((_, i) => (i === 0 ? "x" : `value_${i}`))
    : first.map((h, i) => h || (i === 0 ? "x" : `value_${i}`));

  const start = firstLooksNumeric ? 0 : 1;
  const rows: number[][] = [];
  const width = headers.length;
  for (let i = start; i < lines.length; i++) {
    const cells = parseDelimitedLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const row = Array.from({ length: width }, (_, c) => {
      const raw = (cells[c] ?? "").replace(/_/g, "");
      const n = Number(raw);
      return Number.isFinite(n) ? n : Number.NaN;
    });
    if (row.filter(Number.isFinite).length >= 2) rows.push(row);
  }

  if (rows.length === 0) throw new Error("No rows contained at least two numeric values.");
  return { headers, rows, delimiter };
}

export function tableToTracks(
  table: ParsedNumericTable,
  xColumn: number,
  yColumns: number[],
  sourceByColumn: Record<number, SourceChoice>,
): MusicalTrack[] {
  return yColumns.map((yColumn, index) => {
    const points: DataPoint[] = [];
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const row = table.rows[rowIndex];
      const xRaw = row[xColumn];
      const yRaw = row[yColumn];
      const x = Number.isFinite(xRaw) ? xRaw : rowIndex;
      if (Number.isFinite(yRaw)) points.push({ x, y: yRaw });
    }
    return {
      name: table.headers[yColumn] ?? `Track ${index + 1}`,
      source: sourceByColumn[yColumn] ?? DEFAULT_SOURCES[index % DEFAULT_SOURCES.length],
      points,
    };
  }).filter((t) => t.points.length > 0);
}

export function prepareTracks(tracks: MusicalTrack[], options: MusicalOptions): MusicalTrack[] {
  return tracks.map((track) => {
    if (track.points.length === 0) return { ...track, points: [] };
    const sorted = [...track.points].sort((a, b) => a.x - b.x);
    const minX = sorted[0].x;
    const xValues = quantizeXValue(
      sorted.map((p) => (options.normalizeTime ? p.x - minX : p.x)),
      options.quantizeStep,
    );
    let mapped = sorted.map((p, i) => ({ x: xValues[i], y: p.y }));

    if (track.source.kind === "melodic") {
      mapped = options.key
        ? convertToKey(mapped, options.key, options.numberOfOctaves, options.octaveStart)
        : scaleYToMidiRange(mapped, options.midiMin, options.midiMax);
    } else {
      mapped = mapped.map((p) => ({ x: p.x, y: track.source.midi }));
    }
    return { ...track, points: mapped };
  });
}

const TICKS_PER_BEAT = 480;

function pushU16(out: number[], value: number): void {
  out.push((value >> 8) & 0xff, value & 0xff);
}
function pushU32(out: number[], value: number): void {
  out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}
function pushAscii(out: number[], text: string): void {
  for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i) & 0xff);
}
function writeVarLen(value: number): number[] {
  value = Math.max(0, Math.floor(value));
  let buffer = value & 0x7f;
  const out: number[] = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return out;
}

interface MidiEvent {
  tick: number;
  priority: number;
  bytes: number[];
}

function makeTrackChunk(payload: number[]): number[] {
  const out: number[] = [];
  pushAscii(out, "MTrk");
  pushU32(out, payload.length);
  out.push(...payload);
  return out;
}

function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (cp <= 0x7f) out.push(cp);
    else if (cp <= 0x7ff) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp <= 0xffff) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

function textMetaEvent(type: number, text: string): number[] {
  const bytes = utf8Bytes(text);
  return [0xff, type, ...writeVarLen(bytes.length), ...bytes];
}

export function encodeMidi(tracks: MusicalTrack[], options: MusicalOptions): Uint8Array {
  const prepared = prepareTracks(tracks, options);
  if (prepared.length === 0) throw new Error("There are no tracks to export.");

  const chunks: number[][] = [];
  const tempoPayload: number[] = [];
  const microseconds = Math.round(60_000_000 / clamp(options.tempoBpm, 20, 400));
  tempoPayload.push(0x00, 0xff, 0x51, 0x03,
    (microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff);
  tempoPayload.push(0x00, ...textMetaEvent(0x03, "BioSonify Musical Mapping"));
  tempoPayload.push(0x00, 0xff, 0x2f, 0x00);
  chunks.push(makeTrackChunk(tempoPayload));

  prepared.forEach((track, trackIndex) => {
    const baseChannel = trackIndex % 15;
    const channel = track.source.kind === "percussion" ? 9 : (baseChannel >= 9 ? baseChannel + 1 : baseChannel);
    const events: MidiEvent[] = [];
    events.push({ tick: 0, priority: -3, bytes: textMetaEvent(0x03, track.name) });
    if (track.source.kind === "melodic") {
      events.push({ tick: 0, priority: -2, bytes: [0xc0 | channel, clamp(track.source.midi, 0, 127)] });
    }

    for (const p of track.points) {
      const startTick = Math.max(0, Math.round(p.x * TICKS_PER_BEAT));
      const endTick = startTick + Math.max(1, Math.round(options.noteDurationBeats * TICKS_PER_BEAT));
      const pitch = track.source.kind === "percussion" ? track.source.midi : clamp(Math.round(p.y), 0, 127);
      const velocity = clamp(Math.round(options.velocity), 1, 127);
      events.push({ tick: startTick, priority: 1, bytes: [0x90 | channel, pitch, velocity] });
      events.push({ tick: endTick, priority: 0, bytes: [0x80 | channel, pitch, 0] });
    }

    events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
    const payload: number[] = [];
    let lastTick = 0;
    for (const event of events) {
      payload.push(...writeVarLen(event.tick - lastTick), ...event.bytes);
      lastTick = event.tick;
    }
    payload.push(0x00, 0xff, 0x2f, 0x00);
    chunks.push(makeTrackChunk(payload));
  });

  const out: number[] = [];
  pushAscii(out, "MThd");
  pushU32(out, 6);
  pushU16(out, 1);
  pushU16(out, chunks.length);
  pushU16(out, TICKS_PER_BEAT);
  chunks.forEach((c) => out.push(...c));
  return Uint8Array.from(out);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pseudoNoise(sampleIndex: number, seed: number): number {
  const x = Math.sin((sampleIndex + 1) * (12.9898 + seed * 0.171)) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function melodicSample(program: number, phase: number, t: number, duration: number): number {
  const p = phase - Math.floor(phase);
  const sine = Math.sin(Math.PI * 2 * p);
  const tri = 4 * Math.abs(p - 0.5) - 1;
  const saw = 2 * p - 1;
  const square = p < 0.5 ? 1 : -1;
  const family = Math.floor(program / 8);
  const attack = family === 11 ? Math.min(1, t / 0.18) : Math.min(1, t / 0.012);
  const release = Math.min(1, Math.max(0, (duration - t) / (family === 11 ? 0.35 : 0.08)));
  let body = sine;
  let decay = 1;

  switch (family) {
    case 0:
      body = sine + 0.38 * Math.sin(Math.PI * 4 * p) + 0.18 * Math.sin(Math.PI * 6 * p);
      decay = Math.exp(-2.8 * t / Math.max(duration, 0.15));
      break;
    case 1:
      body = sine + 0.45 * Math.sin(Math.PI * 6 * p);
      decay = Math.exp(-4.2 * t / Math.max(duration, 0.12));
      break;
    case 2:
      body = 0.72 * sine + 0.22 * Math.sin(Math.PI * 4 * p) + 0.12 * Math.sin(Math.PI * 8 * p);
      break;
    case 3:
      body = 0.65 * tri + 0.35 * sine;
      decay = Math.exp(-3.5 * t / Math.max(duration, 0.15));
      break;
    case 4:
      body = 0.58 * saw + 0.42 * sine;
      break;
    case 5:
      body = 0.58 * tri + 0.42 * Math.sin(Math.PI * 2 * (p + 0.002 * Math.sin(t * 5.5)));
      break;
    case 6:
      body = 0.45 * saw + 0.55 * sine;
      break;
    case 7:
      body = 0.65 * saw + 0.35 * square;
      break;
    case 8:
      body = 0.55 * square + 0.45 * sine;
      break;
    case 9:
      body = 0.88 * sine + 0.12 * Math.sin(Math.PI * 4 * p);
      break;
    case 10:
      body = program % 2 === 0 ? square : saw;
      break;
    case 11:
      body = 0.52 * sine + 0.28 * tri + 0.2 * Math.sin(Math.PI * 4 * p);
      break;
    case 12:
      body = 0.45 * sine + 0.3 * saw + 0.25 * Math.sin(Math.PI * 10 * p + t * 2.1);
      break;
    case 13:
      body = 0.58 * tri + 0.3 * sine + 0.12 * Math.sin(Math.PI * 6 * p);
      decay = Math.exp(-2.5 * t / Math.max(duration, 0.2));
      break;
    case 14:
      body = 0.55 * sine + 0.45 * square;
      decay = Math.exp(-5.0 * t / Math.max(duration, 0.1));
      break;
    default:
      body = 0.65 * sine + 0.35 * saw;
      break;
  }
  return (body / 1.55) * attack * release * decay;
}

function percussionSample(note: number, sampleIndex: number, t: number): number {
  const noise = pseudoNoise(sampleIndex, note);
  if (note === 35 || note === 36) {
    const hz = 48 + 95 * Math.exp(-18 * t);
    return Math.sin(2 * Math.PI * hz * t) * Math.exp(-12 * t);
  }
  if (note === 38 || note === 40 || note === 37 || note === 39) {
    return (0.72 * noise + 0.28 * Math.sin(2 * Math.PI * 180 * t)) * Math.exp(-18 * t);
  }
  if ([42, 44, 46, 49, 51, 52, 55, 57, 59].includes(note)) {
    const decay = note === 46 || note >= 49 ? 5.5 : 24;
    return noise * Math.exp(-decay * t);
  }
  const hz = midiToHz(clamp(note + 18, 36, 96));
  return (0.62 * Math.sin(2 * Math.PI * hz * t) + 0.38 * noise) * Math.exp(-11 * t);
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function renderPreviewWavAsync(
  tracks: MusicalTrack[],
  options: MusicalOptions,
  sampleRate = 44100,
  maxSeconds = 60,
  onProgress?: ProgressCallback,
): Promise<ArrayBuffer> {
  const prepared = prepareTracks(tracks, options);
  if (prepared.length === 0) throw new Error("There are no tracks to render.");
  const allPoints = prepared.flatMap((t) => t.points);
  if (allPoints.length === 0) throw new Error("There are no numeric notes to render.");
  if (allPoints.length > 12000) throw new Error("Too many notes for phone preview. Reduce rows/tracks below 12,000 notes.");

  const secPerBeat = 60 / clamp(options.tempoBpm, 20, 400);
  const lastBeat = Math.max(...allPoints.map((p) => p.x + options.noteDurationBeats));
  const durationSeconds = clamp(lastBeat * secPerBeat + 0.15, 0.25, maxSeconds);
  const totalFrames = Math.ceil(durationSeconds * sampleRate);
  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);
  const totalNotes = prepared.reduce((n, t) => n + t.points.length, 0);
  let processed = 0;

  for (let trackIndex = 0; trackIndex < prepared.length; trackIndex++) {
    const track = prepared[trackIndex];
    const pan = prepared.length <= 1 ? 0 : (trackIndex / (prepared.length - 1)) * 1.4 - 0.7;
    const leftGain = Math.cos((pan + 1) * Math.PI / 4);
    const rightGain = Math.sin((pan + 1) * Math.PI / 4);
    const velocityGain = clamp(options.velocity, 1, 127) / 127;

    for (const point of track.points) {
      const startSeconds = Math.max(0, point.x * secPerBeat);
      if (startSeconds >= durationSeconds) {
        processed += 1;
        continue;
      }
      const nominalDuration = Math.max(0.03, options.noteDurationBeats * secPerBeat);
      const noteDuration = Math.min(nominalDuration, durationSeconds - startSeconds);
      const startFrame = Math.floor(startSeconds * sampleRate);
      const frames = Math.max(1, Math.floor(noteDuration * sampleRate));
      const pitch = track.source.kind === "percussion" ? track.source.midi : clamp(Math.round(point.y), 0, 127);
      const hz = midiToHz(pitch);
      const phaseStep = hz / sampleRate;
      let phase = ((pitch * 0.61803398875 + trackIndex * 0.271828) % 1 + 1) % 1;

      for (let i = 0; i < frames && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        const sample = track.source.kind === "percussion"
          ? percussionSample(pitch, i, t)
          : melodicSample(track.source.midi, phase, t, noteDuration);
        const value = sample * velocityGain * 0.28;
        left[startFrame + i] += value * leftGain;
        right[startFrame + i] += value * rightGain;
        phase += phaseStep;
        if (phase >= 1) phase -= 1;
      }

      processed += 1;
      if (processed % 12 === 0) {
        onProgress?.(processed / totalNotes);
        await yieldToUI();
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < totalFrames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const norm = peak > 0.96 ? 0.96 / peak : 1;
  if (norm !== 1) {
    for (let i = 0; i < totalFrames; i++) {
      left[i] *= norm;
      right[i] *= norm;
    }
  }
  onProgress?.(1);
  return encodeStereoWav(left, right, sampleRate);
}

function writeAscii(view: DataView, offset: number, text: string): number {
  for (let i = 0; i < text.length; i++) view.setUint8(offset++, text.charCodeAt(i));
  return offset;
}

export function encodeStereoWav(left: Float32Array, right: Float32Array, sampleRate: number): ArrayBuffer {
  const frames = Math.min(left.length, right.length);
  const channels = 2;
  const bytesPerSample = 2;
  const dataBytes = frames * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  let o = 0;
  o = writeAscii(view, o, "RIFF");
  view.setUint32(o, 36 + dataBytes, true); o += 4;
  o = writeAscii(view, o, "WAVE");
  o = writeAscii(view, o, "fmt ");
  view.setUint32(o, 16, true); o += 4;
  view.setUint16(o, 1, true); o += 2;
  view.setUint16(o, channels, true); o += 2;
  view.setUint32(o, sampleRate, true); o += 4;
  view.setUint32(o, sampleRate * channels * bytesPerSample, true); o += 4;
  view.setUint16(o, channels * bytesPerSample, true); o += 2;
  view.setUint16(o, 16, true); o += 2;
  o = writeAscii(view, o, "data");
  view.setUint32(o, dataBytes, true); o += 4;
  for (let i = 0; i < frames; i++) {
    const l = clamp(left[i], -1, 1);
    const r = clamp(right[i], -1, 1);
    view.setInt16(o, l < 0 ? l * 32768 : l * 32767, true); o += 2;
    view.setInt16(o, r < 0 ? r * 32768 : r * 32767, true); o += 2;
  }
  return buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }
  return out;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

export const DEFAULT_MUSICAL_OPTIONS: MusicalOptions = {
  key: "c_major",
  octaveStart: 1,
  numberOfOctaves: 4,
  quantizeStep: 0.5,
  tempoBpm: 120,
  noteDurationBeats: 1,
  velocity: 90,
  midiMin: 36,
  midiMax: 96,
  normalizeTime: true,
};

export const DEMO_CSV = `time,signal,energy,coherence\n0,10,42,0.15\n0.5,18,40,0.22\n1,13,52,0.31\n1.5,31,61,0.48\n2,25,55,0.67\n2.5,44,72,0.81\n3,39,68,0.71\n3.5,53,82,0.93\n4,46,77,0.76\n4.5,62,91,0.98`;
