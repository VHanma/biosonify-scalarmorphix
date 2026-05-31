/**
 * BioSonify global state store using React Context + useReducer.
 * Manages: selected image, sonification mode, active frequencies, playback state.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FrequencyEntry, FREQUENCY_LIBRARY, getDefaultEnabled } from './frequencies';
import type { SonificationMode } from './sonification-engine';

// ─── State ────────────────────────────────────────────────────────────────────

export interface SonificationState {
  imageUri: string | null;
  imageWidth: number;
  imageHeight: number;
  mode: SonificationMode;
  durationSeconds: number;
  enabledFrequencies: string[]; // frequency IDs
  isPlaying: boolean;
  isProcessing: boolean;
  /** data: URI (base64) — used for web playback and export */
  audioDataUri: string | null;
  /** file:// URI — used for native (Android/iOS) playback via expo-audio */
  audioUri: string | null;
  waveformBars: number[];
  recentImages: { uri: string; timestamp: number }[];
}

const defaultEnabled = getDefaultEnabled().map((f) => f.id);

const initialState: SonificationState = {
  imageUri: null,
  imageWidth: 0,
  imageHeight: 0,
  mode: 'SPECTRAL',
  durationSeconds: 10,
  enabledFrequencies: defaultEnabled,
  isPlaying: false,
  isProcessing: false,
  audioDataUri: null,
  audioUri: null,
  waveformBars: [],
  recentImages: [],
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_IMAGE'; uri: string; width: number; height: number }
  | { type: 'SET_MODE'; mode: SonificationMode }
  | { type: 'SET_DURATION'; seconds: number }
  | { type: 'TOGGLE_FREQUENCY'; id: string }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_PROCESSING'; processing: boolean }
  | { type: 'SET_AUDIO'; dataUri: string; audioUri: string; waveformBars: number[] }
  | { type: 'CLEAR_AUDIO' }
  | { type: 'ADD_RECENT'; uri: string }
  | { type: 'LOAD_PERSISTED'; state: Partial<SonificationState> };

function reducer(state: SonificationState, action: Action): SonificationState {
  switch (action.type) {
    case 'SET_IMAGE':
      return {
        ...state,
        imageUri: action.uri,
        imageWidth: action.width,
        imageHeight: action.height,
        audioDataUri: null,
        audioUri: null,
        waveformBars: [],
        isPlaying: false,
      };
    case 'SET_MODE':
      return { ...state, mode: action.mode, audioDataUri: null, audioUri: null, waveformBars: [] };
    case 'SET_DURATION':
      return { ...state, durationSeconds: action.seconds, audioDataUri: null, audioUri: null };
    case 'TOGGLE_FREQUENCY': {
      const enabled = state.enabledFrequencies.includes(action.id)
        ? state.enabledFrequencies.filter((id) => id !== action.id)
        : [...state.enabledFrequencies, action.id];
      return { ...state, enabledFrequencies: enabled };
    }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.processing };
    case 'SET_AUDIO':
      return {
        ...state,
        audioDataUri: action.dataUri,
        audioUri: action.audioUri,
        waveformBars: action.waveformBars,
        isProcessing: false,
      };
    case 'CLEAR_AUDIO':
      return { ...state, audioDataUri: null, audioUri: null, waveformBars: [], isPlaying: false };
    case 'ADD_RECENT': {
      const existing = state.recentImages.filter((r) => r.uri !== action.uri);
      const updated = [{ uri: action.uri, timestamp: Date.now() }, ...existing].slice(0, 5);
      return { ...state, recentImages: updated };
    }
    case 'LOAD_PERSISTED':
      return { ...state, ...action.state };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SonificationContextValue {
  state: SonificationState;
  dispatch: React.Dispatch<Action>;
  getEnabledFrequencies: () => FrequencyEntry[];
  getEnabledHz: () => number[];
  persistSettings: () => Promise<void>;
}

const SonificationContext = createContext<SonificationContextValue | null>(null);

const STORAGE_KEY = '@biosonify_settings';

export function SonificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load persisted settings on mount
  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          dispatch({ type: 'LOAD_PERSISTED', state: saved });
        } catch {
          // ignore corrupt data
        }
      }
    });
  }, []);

  const persistSettings = useCallback(async () => {
    const toSave = {
      mode: state.mode,
      durationSeconds: state.durationSeconds,
      enabledFrequencies: state.enabledFrequencies,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state.mode, state.durationSeconds, state.enabledFrequencies]);

  const getEnabledFrequencies = useCallback((): FrequencyEntry[] => {
    return FREQUENCY_LIBRARY.filter((f) => state.enabledFrequencies.includes(f.id));
  }, [state.enabledFrequencies]);

  const getEnabledHz = useCallback((): number[] => {
    return getEnabledFrequencies().map((f) => f.hz);
  }, [getEnabledFrequencies]);

  return React.createElement(
    SonificationContext.Provider,
    { value: { state, dispatch, getEnabledFrequencies, getEnabledHz, persistSettings } },
    children,
  );
}

export function useSonification(): SonificationContextValue {
  const ctx = useContext(SonificationContext);
  if (!ctx) throw new Error('useSonification must be used within SonificationProvider');
  return ctx;
}
