import type { DurationCode, TimeSignature } from './types';

export const STORAGE_KEY = 'musicblock.pieces.v1';
export const LEGACY_STORAGE_KEYS = ['staffscript.pieces.v1'];

export const DURATION_UNITS: Record<DurationCode, number> = {
  w: 64,
  h: 32,
  q: 16,
  e: 8,
  s: 4
};

export const DURATION_LABELS: Record<DurationCode, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  e: 'eighth',
  s: 'sixteenth'
};

export const SUPPORTED_TIME_SIGNATURES: Record<string, TimeSignature> = {
  '4/4': {
    raw: '4/4',
    beatsPerMeasure: 4,
    beatUnit: 4,
    measureValue: 4,
    measureUnits: 64
  },
  '3/4': {
    raw: '3/4',
    beatsPerMeasure: 3,
    beatUnit: 4,
    measureValue: 3,
    measureUnits: 48
  },
  '2/4': {
    raw: '2/4',
    beatsPerMeasure: 2,
    beatUnit: 4,
    measureValue: 2,
    measureUnits: 32
  },
  '6/8': {
    raw: '6/8',
    beatsPerMeasure: 6,
    beatUnit: 8,
    measureValue: 3,
    measureUnits: 48
  }
};

export const STAFF_NAMES = ['treble', 'bass'] as const;
