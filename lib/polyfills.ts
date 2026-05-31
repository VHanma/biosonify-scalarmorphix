/**
 * Polyfills for Android Hermes JS engine.
 * Hermes does not ship btoa/atob — we install them globally here.
 * This file MUST be imported at the very top of app/_layout.tsx.
 */

// @ts-ignore — no types for base-64
import { encode, decode } from 'base-64';

if (typeof globalThis.btoa === 'undefined') {
  // @ts-ignore
  globalThis.btoa = encode;
}

if (typeof globalThis.atob === 'undefined') {
  // @ts-ignore
  globalThis.atob = decode;
}
