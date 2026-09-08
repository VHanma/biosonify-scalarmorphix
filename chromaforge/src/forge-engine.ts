export type Pixel = { r: number; g: number; b: number; a?: number };
export type ScanMode = "sweep" | "columns" | "orbit";
export type ScaleMode = "major" | "minor" | "pentatonic" | "dorian";

export interface ForgeSettings {
  tempo: number;
  root: string;
  scale: ScaleMode;
  moments: number;
  scan: ScanMode;
}

export interface NoteEvent {
  beat: number;
  duration: number;
  midi: number;
  velocity: number;
}

export interface ScoreTrack {
  name: string;
  channel: number;
  program: number;
  pan: number;
  events: NoteEvent[];
}

export interface VisualMoment {
  luminance: number;
  hue: number;
  saturation: number;
  edge: number;
}

export interface Composition {
  tracks: ScoreTrack[];
  visual: VisualMoment[];
  metrics: {
    luminance: number;
    saturation: number;
    edge: number;
    hue: number;
  };
}

const ROOTS: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const SCALES: Record<ScaleMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rgbFeatures(pixel: Pixel): { luminance: number; saturation: number; hue: number } {
  const r = clamp(pixel.r / 255, 0, 1);
  const g = clamp(pixel.g / 255, 0, 1);
  const b = clamp(pixel.b / 255, 0, 1);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const luminance = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b, 0, 1);
  const saturation = max === 0 ? 0 : delta / max;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return { luminance, saturation, hue };
}

function orderedPixels(pixels: Pixel[], width: number, height: number, mode: ScanMode): Pixel[] {
  if (mode === "sweep") return [...pixels];

  if (mode === "columns") {
    const out: Pixel[] = [];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const pixel = pixels[y * width + x];
        if (pixel) out.push(pixel);
      }
    }
    return out;
  }

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const indexed = pixels.map((pixel, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    const spiral = radius + (angle / (Math.PI * 2)) * 3.5;
    return { pixel, spiral };
  });
  indexed.sort((a, b) => a.spiral - b.spiral);
  return indexed.map((item) => item.pixel);
}

function quantizeToScale(value01: number, root: string, scale: ScaleMode, lowMidi: number, highMidi: number): number {
  const rootPc = ROOTS[root] ?? 0;
  const pcs = new Set(SCALES[scale].map((interval) => (rootPc + interval) % 12));
  const target = lowMidi + clamp(value01, 0, 1) * (highMidi - lowMidi);
  let best = lowMidi;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    if (!pcs.has(midi % 12)) continue;
    const dist = Math.abs(midi - target);
    if (dist < bestDist) {
      best = midi;
      bestDist = dist;
    }
  }
  return clamp(best, 0, 127);
}

function aggregateMoments(pixels: Pixel[], width: number, height: number, settings: ForgeSettings): VisualMoment[] {
  const ordered = orderedPixels(pixels, width, height, settings.scan);
  const count = clamp(Math.round(settings.moments), 16, 72);
  const moments: VisualMoment[] = [];

  for (let i = 0; i < count; i++) {
    const start = Math.floor((i / count) * ordered.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * ordered.length));
    const segment = ordered.slice(start, end);
    const luminance: number[] = [];
    const saturation: number[] = [];
    let hueX = 0;
    let hueY = 0;
    for (const pixel of segment) {
      const f = rgbFeatures(pixel);
      luminance.push(f.luminance);
      saturation.push(f.saturation);
      hueX += Math.cos(f.hue * Math.PI * 2) * Math.max(0.05, f.saturation);
      hueY += Math.sin(f.hue * Math.PI * 2) * Math.max(0.05, f.saturation);
    }
    let hue = Math.atan2(hueY, hueX) / (Math.PI * 2);
    if (hue < 0) hue += 1;
    moments.push({
      luminance: mean(luminance),
      saturation: mean(saturation),
      hue,
      edge: 0,
    });
  }

  for (let i = 0; i < moments.length; i++) {
    const prev = moments[Math.max(0, i - 1)];
    const next = moments[Math.min(moments.length - 1, i + 1)];
    moments[i].edge = clamp(Math.abs(next.luminance - prev.luminance) * 3.2, 0, 1);
  }
  return moments;
}

export function buildComposition(
  pixels: Pixel[],
  width: number,
  height: number,
  settings: ForgeSettings,
): Composition {
  if (!pixels.length || width <= 0 || height <= 0) throw new Error("Image pixel data is empty.");
  const visual = aggregateMoments(pixels, width, height, settings);
  const step = 0.5;

  const melody: ScoreTrack = { name: "Light", channel: 0, program: 10, pan: -0.48, events: [] };
  const harmony: ScoreTrack = { name: "Hue", channel: 1, program: 88, pan: 0.42, events: [] };
  const texture: ScoreTrack = { name: "Texture", channel: 2, program: 12, pan: -0.08, events: [] };
  const percussion: ScoreTrack = { name: "Edges", channel: 9, program: 0, pan: 0.1, events: [] };

  visual.forEach((moment, i) => {
    const beat = i * step;
    melody.events.push({
      beat,
      duration: 0.46,
      midi: quantizeToScale(moment.luminance, settings.root, settings.scale, 48, 84),
      velocity: Math.round(56 + moment.luminance * 55),
    });

    if (i % 2 === 0) {
      harmony.events.push({
        beat,
        duration: 0.96,
        midi: quantizeToScale(moment.hue, settings.root, settings.scale, 55, 91),
        velocity: Math.round(42 + moment.saturation * 45),
      });
    }

    if (i % 2 === 1 || moment.saturation > 0.55) {
      texture.events.push({
        beat,
        duration: 0.34,
        midi: quantizeToScale(moment.saturation, settings.root, settings.scale, 43, 79),
        velocity: Math.round(35 + moment.saturation * 52),
      });
    }

    if (moment.edge > 0.08) {
      const midi = moment.edge > 0.58 ? 36 : moment.edge > 0.3 ? 38 : 42;
      percussion.events.push({
        beat,
        duration: 0.16,
        midi,
        velocity: Math.round(32 + moment.edge * 85),
      });
    }
  });

  return {
    tracks: [melody, harmony, texture, percussion],
    visual,
    metrics: {
      luminance: mean(visual.map((m) => m.luminance)),
      saturation: mean(visual.map((m) => m.saturation)),
      edge: mean(visual.map((m) => m.edge)),
      hue: mean(visual.map((m) => m.hue)),
    },
  };
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function envelope(t: number, duration: number): number {
  const attack = Math.min(0.025, duration * 0.18);
  const release = Math.min(0.11, duration * 0.32);
  if (t < attack) return t / Math.max(attack, 0.001);
  if (t > duration - release) return clamp((duration - t) / Math.max(release, 0.001), 0, 1);
  return 1;
}

function tone(track: ScoreTrack, event: NoteEvent, t: number): number {
  if (track.channel === 9) {
    const base = event.midi === 36 ? 74 : event.midi === 38 ? 150 : 320;
    const fall = Math.exp(-t * (event.midi === 42 ? 26 : 15));
    return Math.sin(Math.PI * 2 * base * t) * fall;
  }

  const f = midiToHz(event.midi);
  const p = Math.PI * 2 * f * t;
  if (track.name === "Light") return Math.sin(p) * 0.78 + Math.sin(p * 2) * 0.16 + Math.sin(p * 3) * 0.06;
  if (track.name === "Hue") return Math.sin(p) * 0.7 + Math.sin(p * 1.5) * 0.15 + Math.sin(p * 0.5) * 0.15;
  const triangle = (2 / Math.PI) * Math.asin(Math.sin(p));
  return triangle * 0.74 + Math.sin(p * 2) * 0.12;
}

export function renderWav(composition: Composition, tempo: number, sampleRate = 32000): ArrayBuffer {
  const safeTempo = clamp(tempo, 48, 180);
  const secondsPerBeat = 60 / safeTempo;
  let maxBeat = 1;
  for (const track of composition.tracks) {
    for (const event of track.events) maxBeat = Math.max(maxBeat, event.beat + event.duration);
  }
  const durationSeconds = Math.min(28, maxBeat * secondsPerBeat + 0.45);
  const frames = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);

  for (const track of composition.tracks) {
    const trackGain = track.channel === 9 ? 0.12 : track.name === "Hue" ? 0.11 : 0.14;
    const pan = clamp(track.pan, -1, 1);
    const lg = Math.sqrt((1 - pan) * 0.5);
    const rg = Math.sqrt((1 + pan) * 0.5);
    for (const event of track.events) {
      const startSec = event.beat * secondsPerBeat;
      const eventSec = Math.max(0.05, event.duration * secondsPerBeat);
      const startFrame = Math.floor(startSec * sampleRate);
      const endFrame = Math.min(frames, Math.ceil((startSec + eventSec) * sampleRate));
      const velocity = clamp(event.velocity / 127, 0, 1);
      for (let frame = startFrame; frame < endFrame; frame++) {
        const t = (frame - startFrame) / sampleRate;
        const sample = tone(track, event, t) * envelope(t, eventSec) * velocity * trackGain;
        left[frame] += sample * lg;
        right[frame] += sample * rg;
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const norm = peak > 0.94 ? 0.94 / peak : 1;

  const dataBytes = frames * 4;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const l = clamp(left[i] * norm, -1, 1);
    const r = clamp(right[i] * norm, -1, 1);
    view.setInt16(offset, Math.round(l * 32767), true);
    view.setInt16(offset + 2, Math.round(r * 32767), true);
    offset += 4;
  }
  return buffer;
}

const TICKS = 480;

function pushAscii(out: number[], text: string): void {
  for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i) & 0xff);
}

function pushU16(out: number[], value: number): void {
  out.push((value >> 8) & 0xff, value & 0xff);
}

function pushU32(out: number[], value: number): void {
  out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function varLen(value: number): number[] {
  value = Math.max(0, Math.floor(value));
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function makeTrackChunk(events: { tick: number; order: number; bytes: number[] }[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let lastTick = 0;
  for (const event of events) {
    body.push(...varLen(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  }
  body.push(0x00, 0xff, 0x2f, 0x00);
  const out: number[] = [];
  pushAscii(out, "MTrk");
  pushU32(out, body.length);
  out.push(...body);
  return out;
}

export function encodeMidi(composition: Composition, tempo: number): Uint8Array {
  const chunks: number[][] = [];
  const micros = Math.round(60000000 / clamp(tempo, 48, 180));
  const conductor = makeTrackChunk([
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x51, 0x03, (micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff],
    },
  ]);
  chunks.push(conductor);

  for (const track of composition.tracks) {
    const events: { tick: number; order: number; bytes: number[] }[] = [];
    if (track.channel !== 9) {
      events.push({ tick: 0, order: 0, bytes: [0xc0 | track.channel, track.program & 0x7f] });
    }
    for (const note of track.events) {
      const start = Math.round(note.beat * TICKS);
      const end = Math.max(start + 1, Math.round((note.beat + note.duration) * TICKS));
      const midi = clamp(Math.round(note.midi), 0, 127);
      const velocity = clamp(Math.round(note.velocity), 1, 127);
      events.push({ tick: start, order: 2, bytes: [0x90 | track.channel, midi, velocity] });
      events.push({ tick: end, order: 1, bytes: [0x80 | track.channel, midi, 0] });
    }
    chunks.push(makeTrackChunk(events));
  }

  const out: number[] = [];
  pushAscii(out, "MThd");
  pushU32(out, 6);
  pushU16(out, 1);
  pushU16(out, chunks.length);
  pushU16(out, TICKS);
  for (const chunk of chunks) out.push(...chunk);
  return new Uint8Array(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[triple & 63] : "=";
  }
  return out;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}
