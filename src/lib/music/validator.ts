import { DURATION_UNITS, SUPPORTED_TIME_SIGNATURES } from './constants';
import {
  getMeasureVoices,
  isDynamicMark,
  isExpressionMark,
  isPlayableEvent,
  isTimedEvent,
  playableEventsMatch
} from './score';
import type {
  ChordEvent,
  DurationCode,
  MusicEvent,
  NotePitch,
  NoteEvent,
  Score,
  StaffName,
  TimeSignature,
  ValidationError,
  VoiceId
} from './types';

const NOTE_TOKEN_PATTERN = /^([A-G])([#bn]?)([0-8]):([whqes])(\.)?(~)?$/;
const CHORD_NOTE_PATTERN = /^([A-G])([#bn]?)(-?\d+)$/;
const CHORD_TOKEN_PATTERN = /^\[([^\]]+)\]:([whqes])(\.)?(~)?$/;
const REST_TOKEN_PATTERN = /^R:([whqes])(\.)?$/;
const MAX_CHORD_NOTES = 6;

export function parseTimeSignature(raw: string | undefined): TimeSignature | null {
  if (!raw) return null;
  return SUPPORTED_TIME_SIGNATURES[raw.trim()] ?? null;
}

export function durationToUnits(duration: DurationCode, dots = 0): number {
  const baseUnits = DURATION_UNITS[duration];
  return dots > 0 ? baseUnits + baseUnits / 2 : baseUnits;
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

  if (isDynamicMark(token) || isExpressionMark(token)) {
    return {
      event: {
        type: 'mark',
        mark: token,
        category: isDynamicMark(token) ? 'dynamic' : 'expression',
        beats: 0,
        units: 0,
        raw: token
      }
    };
  }

  if (token.startsWith('[')) {
    return parseChordToken(token, line, staff, measure);
  }

  const restMatch = token.match(REST_TOKEN_PATTERN);
  if (restMatch) {
    const duration = restMatch[1] as DurationCode;
    const dots = restMatch[2] ? 1 : 0;
    const units = durationToUnits(duration, dots);
    return {
      event: {
        type: 'rest',
        duration,
        dots,
        beats: unitsToQuarterBeats(units),
        units,
        raw: token
      }
    };
  }

  if (token.startsWith('R')) {
    return {
      error: {
        code: token.endsWith('~') ? 'INVALID_TIE' : token.includes(':') ? 'INVALID_DURATION' : 'INVALID_REST',
        message: `Invalid rest token "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: token.endsWith('~')
          ? 'Remove the tie marker. Rests cannot be tied.'
          : 'Use rest syntax like R:q, R:h, R:e, or dotted rest syntax like R:q.'
      }
    };
  }

  const noteMatch = token.match(NOTE_TOKEN_PATTERN);
  if (noteMatch) {
    const [, pitch, accidental, octaveRaw, durationRaw, dotRaw, tieRaw] = noteMatch;
    const duration = durationRaw as DurationCode;
    const dots = dotRaw ? 1 : 0;
    const units = durationToUnits(duration, dots);
    return {
      event: {
        type: 'note',
        pitch: pitch as NoteEvent['pitch'],
        accidental: accidental ? (accidental as '#' | 'b' | 'n') : undefined,
        octave: Number(octaveRaw),
        duration,
        dots,
        beats: unitsToQuarterBeats(units),
        units,
        tie: tieRaw ? true : undefined,
        raw: token
      }
    };
  }

  if (/^[A-G][#bn]?(-?\d+):[whqes]\.?~?$/.test(token)) {
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
        fixHint: 'Use one duration code after the colon: w, h, q, e, or s. Add one optional dot before any tie marker, like C4:q. or C4:q.~.'
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

  if (/^[a-z_]+$/.test(token)) {
    return {
      error: {
        code: 'INVALID_MARK',
        message: `Invalid expression or dynamic mark "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use one of: pp, p, mp, mf, f, ff, crescendo, diminuendo, legato, staccato, accent, pedal_on, or pedal_off.'
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

function parseChordToken(
  token: string,
  line: number,
  staff: StaffName,
  measure: number
): { event?: MusicEvent; error?: ValidationError } {
  const chordMatch = token.match(CHORD_TOKEN_PATTERN);

  if (!chordMatch) {
    return {
      error: {
        code: token.includes(']:') ? 'INVALID_DURATION' : 'INVALID_CHORD',
        message: `Invalid chord token "${token}".`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use chord syntax like [C4 E4 G4]:q with the duration after the closing bracket.'
      }
    };
  }

  const [, inner, durationRaw, dotRaw, tieRaw] = chordMatch;
  const noteTokens = inner.trim().split(/\s+/).filter(Boolean);

  if (noteTokens.length < 2) {
    return {
      error: {
        code: 'INVALID_CHORD',
        message: `Chord "${token}" must contain at least two notes.`,
        line,
        staff,
        measure,
        token,
        fixHint: 'Use at least two notes in a chord, like [C4 E4]:q, or write a single note like C4:q.'
      }
    };
  }

  if (noteTokens.length > MAX_CHORD_NOTES) {
    return {
      error: {
        code: 'INVALID_CHORD',
        message: `Chord "${token}" has ${noteTokens.length} notes, but the maximum is ${MAX_CHORD_NOTES}.`,
        line,
        staff,
        measure,
        token,
        fixHint: `Remove notes from the chord so it contains no more than ${MAX_CHORD_NOTES} notes.`
      }
    };
  }

  const notes: NotePitch[] = [];

  for (const noteToken of noteTokens) {
    if (noteToken.startsWith('R')) {
      return {
        error: {
          code: 'INVALID_CHORD',
          message: `Chord "${token}" contains a rest.`,
          line,
          staff,
          measure,
          token: noteToken,
          fixHint: 'Remove the rest from the chord. Chords can contain notes only.'
        }
      };
    }

    const noteMatch = noteToken.match(CHORD_NOTE_PATTERN);
    if (!noteMatch) {
      return {
        error: {
          code: noteToken.includes(':') ? 'INVALID_CHORD' : 'INVALID_NOTE',
          message: `Invalid chord note "${noteToken}" in "${token}".`,
          line,
          staff,
          measure,
          token: noteToken,
          fixHint: 'Use note names without durations inside chords, like [C4 E4 G4]:q.'
        }
      };
    }

    const [, pitch, accidental, octaveRaw] = noteMatch;
    const octave = Number(octaveRaw);
    if (octave < 0 || octave > 8) {
      return {
        error: {
          code: 'OCTAVE_OUT_OF_RANGE',
          message: `Octave in chord note "${noteToken}" is outside the supported range.`,
          line,
          staff,
          measure,
          token: noteToken,
          fixHint: 'Use an octave from 0 through 8.'
        }
      };
    }

    notes.push({
      pitch: pitch as NoteEvent['pitch'],
      accidental: accidental ? (accidental as '#' | 'b' | 'n') : undefined,
      octave,
      raw: noteToken
    });
  }

  const duration = durationRaw as DurationCode;
  const dots = dotRaw ? 1 : 0;
  const units = durationToUnits(duration, dots);

  return {
    event: {
      type: 'chord',
      notes,
      duration,
      dots,
      beats: unitsToQuarterBeats(units),
      units,
      tie: tieRaw ? true : undefined,
      raw: token
    }
  };
}

export function validateTies(score: Score): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const staff of Object.keys(score.staves) as StaffName[]) {
    const voiceIds = new Set<VoiceId>();
    for (const measure of score.staves[staff]) {
      for (const voice of getMeasureVoices(measure)) voiceIds.add(voice.id);
    }

    for (const voiceId of voiceIds) {
      const entries = [];

      for (const measure of score.staves[staff]) {
        const voice = getMeasureVoices(measure).find((entry) => entry.id === voiceId);
        if (!voice) continue;

        let cursorUnits = (measure.index - 1) * score.time.measureUnits;
        for (const event of voice.events) {
          if (event.type === 'mark') continue;

          entries.push({
            event,
            startUnits: cursorUnits,
            line: measure.line,
            measure: measure.index
          });

          if (isTimedEvent(event)) cursorUnits += event.units;
        }
      }

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const event = entry.event;
        if (!isPlayableEvent(event) || !event.tie) continue;

        const nextEntry = entries[index + 1];
        const expectedStart = entry.startUnits + event.units;

        if (!nextEntry) {
          errors.push(buildTieError(staff, voiceId, entry.measure, entry.line, event.raw, 'Tie markers must connect to a following note or chord.', 'Add the matching tied note or remove the trailing ~ marker.'));
          continue;
        }

        if (nextEntry.startUnits !== expectedStart || !isPlayableEvent(nextEntry.event)) {
          errors.push(buildTieError(staff, voiceId, entry.measure, entry.line, event.raw, 'Tie markers must connect directly to the next note or chord in the same voice.', 'Remove any rest or gap between tied notes, or remove the ~ marker.'));
          continue;
        }

        if (!playableEventsMatch(event, nextEntry.event)) {
          errors.push(buildTieError(staff, voiceId, entry.measure, entry.line, event.raw, `Tie from "${event.raw}" does not connect to the same pitch content.`, 'Change the next tied event so it has exactly the same note or chord pitches, or remove the ~ marker.'));
        }
      }
    }
  }

  return errors;
}

function buildTieError(
  staff: StaffName,
  voice: VoiceId,
  measure: number,
  line: number | undefined,
  token: string,
  message: string,
  fixHint: string
): ValidationError {
  return {
    code: 'INVALID_TIE',
    message,
    line,
    staff,
    measure,
    voice,
    token,
    fixHint
  };
}

export function validateMeasureLength(
  totalUnits: number,
  time: TimeSignature,
  staff: StaffName,
  measure: number,
  line?: number,
  voice?: VoiceId
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
      voice,
      fixHint: `Add notes or rests to ${staff} measure ${measure}${voice && voice !== 'default' ? ` ${voice}` : ''} so it equals exactly ${expected} quarter beats.`
    };
  }

  return {
    code: 'MEASURE_TOO_LONG',
    message: `${staff} measure ${measure} totals ${actual} quarter beats, but time signature ${time.raw} requires ${expected} quarter beats.`,
    line,
    staff,
    measure,
    voice,
    fixHint: `Shorten ${staff} measure ${measure}${voice && voice !== 'default' ? ` ${voice}` : ''} so it equals exactly ${expected} quarter beats.`
  };
}
