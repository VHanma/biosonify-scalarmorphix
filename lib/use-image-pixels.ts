/**
 * useImagePixels — Android/iOS/Web compatible pixel extraction
 *
 * Strategy:
 *  - Web: canvas ImageData (exact pixel values)
 *  - Native (Android/iOS): expo-image-manipulator resizes to target grid,
 *    returns a JPEG base64 string, then jpeg-js decodes it to exact RGBA pixels.
 *    No atob/btoa. No browser globals. Works on Android Hermes.
 *
 * The target grid is 64×64 — large enough to capture meaningful image
 * structure while keeping synthesis time reasonable.
 */
import { useState, useCallback } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import type { PixelData } from "./sonification-engine";

const TARGET_W = 64;
const TARGET_H = 64;

export interface UseImagePixelsResult {
  extractPixels: (uri: string) => Promise<{
    pixels: PixelData[];
    width: number;
    height: number;
    thumbUri: string;
  }>;
  isExtracting: boolean;
  error: string | null;
}

// ─── Pure-JS base64 → Uint8Array decoder (no atob — Hermes safe) ─────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const outputLen = (clean.length * 3) >> 2;
  const bytes = new Uint8Array(outputLen);
  let bi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[bi++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[bi++] = ((b & 0xf) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[bi++] = ((c & 0x3) << 6) | d;
  }
  return bytes;
}

// ─── Decode JPEG bytes → PixelData[] using jpeg-js ───────────────────────────
function decodeJpegBytesToPixels(bytes: Uint8Array): PixelData[] {
  // jpeg-js is a pure-JS JPEG decoder — no native modules, works on Hermes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jpegJs = require("jpeg-js") as {
    decode: (buf: Uint8Array, opts?: { useTArray?: boolean; colorTransform?: boolean }) => {
      width: number;
      height: number;
      data: Uint8Array;
    };
  };
  const decoded = jpegJs.decode(bytes, { useTArray: true, colorTransform: true });
  const pixels: PixelData[] = [];
  for (let i = 0; i < decoded.data.length; i += 4) {
    pixels.push({
      r: decoded.data[i],
      g: decoded.data[i + 1],
      b: decoded.data[i + 2],
      a: decoded.data[i + 3],
    });
  }
  return pixels;
}

// ─── Deterministic fallback (no randomness) ───────────────────────────────────
function generateDeterministicFallback(uri: string, w: number, h: number): PixelData[] {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    hash = ((hash << 5) - hash + uri.charCodeAt(i)) | 0;
  }
  const pixels: PixelData[] = [];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const seed = (hash + row * w + col) | 0;
      const r = ((seed * 1664525 + 1013904223) >>> 0) & 0xff;
      const g = ((seed * 22695477 + 1) >>> 0) & 0xff;
      const b = ((seed * 1103515245 + 12345) >>> 0) & 0xff;
      pixels.push({ r, g, b, a: 255 });
    }
  }
  return pixels;
}

export function useImagePixels(): UseImagePixelsResult {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractPixels = useCallback(
    async (
      uri: string
    ): Promise<{ pixels: PixelData[]; width: number; height: number; thumbUri: string }> => {
      setIsExtracting(true);
      setError(null);
      try {
        if (Platform.OS === "web") {
          const pixels = await decodePixelsWeb(uri, TARGET_W, TARGET_H);
          return { pixels, width: TARGET_W, height: TARGET_H, thumbUri: uri };
        } else {
          // Native: resize via expo-image-manipulator, get base64 JPEG
          const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: TARGET_W, height: TARGET_H } }],
            {
              format: ImageManipulator.SaveFormat.JPEG,
              compress: 1.0, // maximum quality — we need accurate pixel data
              base64: true,
            }
          );

          const thumbUri = result.uri;
          const base64 = result.base64 ?? "";

          // Decode base64 → Uint8Array using pure JS (no atob)
          const bytes = base64ToUint8Array(base64);

          // Decode JPEG bytes → RGBA pixels using jpeg-js (pure JS, Hermes safe)
          const pixels = decodeJpegBytesToPixels(bytes);
          return { pixels, width: TARGET_W, height: TARGET_H, thumbUri };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        // Deterministic fallback: gradient derived from URI hash (not random)
        return {
          pixels: generateDeterministicFallback(uri, TARGET_W, TARGET_H),
          width: TARGET_W,
          height: TARGET_H,
          thumbUri: uri,
        };
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  return { extractPixels, isExtracting, error };
}

// ─── Web: canvas pixel extraction ────────────────────────────────────────────
async function decodePixelsWeb(uri: string, w: number, h: number): Promise<PixelData[]> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = (globalThis as any).document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const raw = imageData.data;
      const pixels: PixelData[] = [];
      for (let i = 0; i < raw.length; i += 4) {
        pixels.push({ r: raw[i], g: raw[i + 1], b: raw[i + 2], a: raw[i + 3] });
      }
      resolve(pixels);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = uri;
  });
}
