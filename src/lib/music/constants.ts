import type { DurationCode, TimeSignature } from './types';

export const STORAGE_KEY = 'musicblock.pieces.v1';
export const LEGACY_STORAGE_KEYS = ['staffscript.pieces.v1'];

export const DURATION_UNITS: Record<DurationCode, number> = {
  w: 16,
  h: 8,
  q: 4,
  e: 2,
  s: 1
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
    measureUnits: 16
  },
  '3/4': {
    raw: '3/4',
    beatsPerMeasure: 3,
    beatUnit: 4,
    measureValue: 3,
    measureUnits: 12
  },
  '2/4': {
    raw: '2/4',
    beatsPerMeasure: 2,
    beatUnit: 4,
    measureValue: 2,
    measureUnits: 8
  },
  '6/8': {
    raw: '6/8',
    beatsPerMeasure: 6,
    beatUnit: 8,
    measureValue: 3,
    measureUnits: 12
  }
};

export const STAFF_NAMES = ['treble', 'bass'] as const;
