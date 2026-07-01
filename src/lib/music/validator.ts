import { DURATION_UNITS, SUPPORTED_TIME_SIGNATURES } from './constants';
import type {
  DurationCode,
  MusicEvent,
  NoteEvent,
  StaffName,
  TimeSignature,
  ValidationError
} from './types';

const NOTE_TOKEN_PATTERN = /^([A-G])([#bn]?)([0-8]):([whqes])$/;
const REST_TOKEN_PATTERN = /^R:([whqes])$/;

export function parseTimeSignature(raw: string | undefined): TimeSignature | null {
  if (!raw) return null;
  return SUPPORTED_TIME_SIGNATURES[raw.trim()] ?? null;
}

export function durationToUnits(duration: DurationCode): number {
  return DURATION_UNITS[duration];
}

export function unitsToQuarterBeats(units: number): number {
  return units / DURATION_UNITS.q;
}

export function formatQuarterBeats(units: number): string {
  const beats = unitsToQuarterBeats(units);
  return Number.isInteger(beats) ? `${beats}` : `${beats}`;
}

export function parseEventToken(
  token: string,
  line: number,
  staff: StaffName,
  measure: number
): { event?: MusicEvent; error?: ValidationError } {
  if (!token.trim()) {
    return {
      error: {
        code: 'INVALID_TOKEN',
        message: 'Empty token found in measure.',
        line,
        staff,
        measure,
        token,
        fixHint: 'Remove the extra space or replace it with a valid note or rest.'
      }
    };
  }

  const restMatch = token.match(REST_TOKEN_PATTERN);
  if (restMatch) {
    const duration = restMatch[1] as DurationCode;
    const units = durationToUnits(duration);
    return {
      event: {
        type: 'rest',
        duration,
        beats: unitsToQuarterBeats(units),
        units,
        raw: token
      }
    };
  }

  if (token.startsWith('R')) {
    return {
      error: {
        code: token.includes(':') ? 'INVALID_DURATION' : 'INVALID_REST',
        message: `Invalid rest token "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use rest syntax like R:q, R:h, or R:e.'
      }
    };
  }

  const noteMatch = token.match(NOTE_TOKEN_PATTERN);
  if (noteMatch) {
    const [, pitch, accidental, octaveRaw, durationRaw] = noteMatch;
    const duration = durationRaw as DurationCode;
    const units = durationToUnits(duration);
    return {
      event: {
        type: 'note',
        pitch: pitch as NoteEvent['pitch'],
        accidental: accidental ? (accidental as '#' | 'b' | 'n') : undefined,
        octave: Number(octaveRaw),
        duration,
        beats: unitsToQuarterBeats(units),
        units,
        raw: token
      }
    };
  }

  if (/^[A-G][#bn]?(-?\d+):[whqes]$/.test(token)) {
    const octave = Number(token.match(/^[A-G][#bn]?(-?\d+):/)?.[1]);
    if (octave < 0 || octave > 8) {
      return {
        error: {
          code: 'OCTAVE_OUT_OF_RANGE',
          message: `Octave in token "${token}" is outside the supported range.`,
          line,
          staff,
          measure,
          token,
          fixHint: 'Use an octave from 0 through 8.'
        }
      };
    }
  }

  if (/^[A-G][#bn]?\d+:/.test(token)) {
    return {
      error: {
        code: 'INVALID_DURATION',
        message: `Invalid duration in token "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use one of these duration codes after the colon: w, h, q, e, or s.'
      }
    };
  }

  if (/^[A-G][#bn]?\d+$/.test(token)) {
    return {
      error: {
        code: 'INVALID_DURATION',
        message: `Token "${token}" is missing a duration.`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Add a duration after a colon, such as C4:q.'
      }
    };
  }

  if (/^[A-G]/.test(token)) {
    return {
      error: {
        code: 'INVALID_NOTE',
        message: `Invalid note token "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use note syntax like C4:q, F#4:e, or Bb3:h.'
      }
    };
  }

  return {
    error: {
      code: 'INVALID_TOKEN',
      message: `Invalid token "${token}".`,
      line,
      staff,
      measure,
      token,
      fixHint: 'Replace this with a valid note like C4:q or rest like R:q.'
    }
  };
}

export function validateMeasureLength(
  totalUnits: number,
  time: TimeSignature,
  staff: StaffName,
  measure: number,
  line?: number
): ValidationError | null {
  if (totalUnits === time.measureUnits) return null;

  const actual = formatQuarterBeats(totalUnits);
  const expected = formatQuarterBeats(time.measureUnits);

  if (totalUnits < time.measureUnits) {
    return {
      code: 'MEASURE_TOO_SHORT',
      message: `${staff} measure ${measure} totals ${actual} quarter beats, but time signature ${time.raw} requires ${expected} quarter beats.`,
      line,
      staff,
      measure,
      fixHint: `Add notes or rests to ${staff} measure ${measure} so it equals exactly ${expected} quarter beats.`
    };
  }

  return {
    code: 'MEASURE_TOO_LONG',
    message: `${staff} measure ${measure} totals ${actual} quarter beats, but time signature ${time.raw} requires ${expected} quarter beats.`,
    line,
    staff,
    measure,
    fixHint: `Shorten ${staff} measure ${measure} so it equals exactly ${expected} quarter beats.`
  };
}
