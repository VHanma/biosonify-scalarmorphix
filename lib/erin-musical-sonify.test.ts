import { describe, expect, it } from "vitest";
import {
  DEFAULT_MUSICAL_OPTIONS,
  DEFAULT_SOURCES,
  convertToKey,
  encodeMidi,
  keyNameToNotes,
  parseNumericTable,
  prepareTracks,
  quantizeXValue,
  renderPreviewWavAsync,
  scaleListToRange,
  tableToTracks,
} from "../lib/erin-musical-sonify";

describe("erin musical sonify port", () => {
  it("matches erinspace key note behavior", () => {
    expect(keyNameToNotes("c_major", 1, 1)).toEqual([36, 38, 40, 41, 43, 45, 47]);
    expect(keyNameToNotes("g_major", 1, 1)).toEqual([43, 45, 47, 48, 50, 52, 54]);
  });

  it("maps data into a selected key", () => {
    const data = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    expect(convertToKey(data, "c_major", 2).map((p) => p.y)).toEqual([36, 59]);
    expect(convertToKey(data, "g_major", 2).map((p) => p.y)).toEqual([43, 66]);
  });

  it("handles constant input safely instead of dividing by zero", () => {
    expect(scaleListToRange([5, 5, 5], 0, 100)).toEqual([50, 50, 50]);
  });

  it("quantizes timing", () => {
    expect(quantizeXValue([0.1, 0.26, 0.74, 1.01], 0.5)).toEqual([0, 0.5, 0.5, 1]);
  });

  it("parses CSV and creates multiple tracks", () => {
    const table = parseNumericTable("time,a,b\n0,10,20\n1,15,25\n2,8,30");
    const tracks = tableToTracks(table, 0, [1, 2], { 1: DEFAULT_SOURCES[0], 2: DEFAULT_SOURCES[1] });
    expect(table.headers).toEqual(["time", "a", "b"]);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].points).toHaveLength(3);
  });

  it("creates a valid Standard MIDI File header and track chunks", () => {
    const table = parseNumericTable("time,a,b\n0,10,20\n1,15,25\n2,8,30");
    const tracks = tableToTracks(table, 0, [1, 2], { 1: DEFAULT_SOURCES[0], 2: DEFAULT_SOURCES[1] });
    const midi = encodeMidi(tracks, DEFAULT_MUSICAL_OPTIONS);
    expect(String.fromCharCode(...midi.slice(0, 4))).toBe("MThd");
    const text = String.fromCharCode(...midi);
    expect(text.match(/MTrk/g)?.length).toBe(3); // tempo + 2 musical tracks
  });

  it("prepares deterministic keyed tracks", () => {
    const table = parseNumericTable("time,a\n10,10\n11,15\n12,8");
    const tracks = tableToTracks(table, 0, [1], { 1: DEFAULT_SOURCES[0] });
    const prepared = prepareTracks(tracks, DEFAULT_MUSICAL_OPTIONS);
    expect(prepared[0].points[0].x).toBe(0);
    const cMajor = new Set(keyNameToNotes("c_major", 1, 4));
    prepared[0].points.forEach((p) => expect(cMajor.has(Math.round(p.y))).toBe(true));
  });

  it("renders a real stereo WAV", async () => {
    const table = parseNumericTable("time,a\n0,10\n0.5,15\n1,8");
    const tracks = tableToTracks(table, 0, [1], { 1: DEFAULT_SOURCES[0] });
    const wav = await renderPreviewWavAsync(tracks, { ...DEFAULT_MUSICAL_OPTIONS, noteDurationBeats: 0.25 }, 8000, 4);
    const bytes = new Uint8Array(wav);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.length).toBeGreaterThan(44);
  });
});
