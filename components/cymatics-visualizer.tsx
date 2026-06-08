/**
 * Cymatics Visualizer
 * Renders a Chladni nodal pattern based on the current synthesis frequencies.
 * Uses React Native View with a computed pattern image.
 */

import React, { useEffect, useState, useMemo } from "react";
import { View, Image, Dimensions, StyleSheet, Text } from "react-native";

export interface CymaticsVisualizerProps {
  frequencies: number[];
  imageUri?: string;
  overlayMode?: "pattern-only" | "image-only" | "overlay";
  patternColor?: string;
  opacity?: number;
}

/**
 * Compute Chladni eigenfrequencies for an 8×8 modal grid.
 * f(m,n) = C × (m² + n²), where C ≈ 55 Hz for a standard plate.
 */
function getChladniFrequencies(c: number = 55): number[] {
  const freqs: number[] = [];
  for (let m = 1; m <= 8; m++) {
    for (let n = 1; n <= 8; n++) {
      freqs.push(c * (m * m + n * n));
    }
  }
  return freqs;
}

/**
 * Compute the nodal pattern amplitude at a point (x, y) on the plate.
 * Sum the contributions of all active modes weighted by their frequency content.
 */
function computeNodalAmplitude(
  x: number,
  y: number,
  width: number,
  height: number,
  frequencies: number[],
): number {
  const chladniFreqs = getChladniFrequencies(55);
  let amplitude = 0;

  // Normalize x, y to [0, 1]
  const nx = x / width;
  const ny = y / height;

  // For each Chladni mode, compute its nodal pattern
  for (let m = 1; m <= 8; m++) {
    for (let n = 1; n <= 8; n++) {
      const modeIdx = (m - 1) * 8 + (n - 1);
      const modeFreq = chladniFreqs[modeIdx];

      // Find how much energy is in this frequency from the input
      let modeEnergy = 0;
      for (const freq of frequencies) {
        const ratio = freq / modeFreq;
        // Gaussian weighting: peak at exact frequency match, decay around it
        modeEnergy += Math.exp(-Math.pow(Math.log2(ratio), 2) / 0.5);
      }

      if (modeEnergy < 0.01) continue; // Skip negligible modes

      // Compute the nodal pattern for this mode
      // Chladni patterns are typically cos(m*π*x) * cos(n*π*y) or similar
      const patternX = Math.cos(m * Math.PI * nx);
      const patternY = Math.cos(n * Math.PI * ny);
      const pattern = Math.abs(patternX * patternY);

      amplitude += pattern * modeEnergy;
    }
  }

  return Math.min(1, amplitude);
}

/**
 * Generate a data URL for the Chladni pattern as a PNG.
 * Uses a low-res grid (64×64) for performance, then scales up.
 */
function generateChladniPatternDataUrl(
  frequencies: number[],
  patternColor: string,
  opacity: number,
  size: number = 256,
): string {
  const resolution = 64; // Low-res for performance
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Parse color (assume hex like #RRGGBB)
  const r = parseInt(patternColor.slice(1, 3), 16);
  const g = parseInt(patternColor.slice(3, 5), 16);
  const b = parseInt(patternColor.slice(5, 7), 16);
  const a = Math.round(opacity * 255);

  const imageData = ctx.createImageData(resolution, resolution);
  const data = imageData.data;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const amp = computeNodalAmplitude(x, y, resolution, resolution, frequencies);
      const idx = (y * resolution + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(amp * a);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function CymaticsVisualizer({
  frequencies,
  imageUri,
  overlayMode = "overlay",
  patternColor = "#2ECC9A",
  opacity = 0.8,
}: CymaticsVisualizerProps) {
  const { width: screenWidth } = Dimensions.get("window");
  const size = Math.min(screenWidth - 32, 400);

  // Generate pattern data URL (memoized to avoid regeneration on every render)
  const patternDataUrl = useMemo(() => {
    // On web, generate the pattern; on native, return a placeholder
    if (typeof document !== "undefined") {
      return generateChladniPatternDataUrl(frequencies, patternColor, opacity, size);
    }
    return "";
  }, [frequencies, patternColor, opacity, size]);

  if (overlayMode === "image-only" && imageUri) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      </View>
    );
  }

  if (overlayMode === "pattern-only") {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        {patternDataUrl ? (
          <Image source={{ uri: patternDataUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Cymatics Pattern</Text>
          </View>
        )}
      </View>
    );
  }

  // Overlay mode: pattern + image
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      )}
      {patternDataUrl && (
        <Image source={{ uri: patternDataUrl }} style={styles.image} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0D1117",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E2022",
  },
  placeholderText: {
    color: "#7D8590",
    fontSize: 14,
    fontWeight: "600",
  },
});
