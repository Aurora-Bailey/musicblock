import { STAFF_NAMES } from './constants';
import {
  parseEventToken,
  parseTimeSignature,
  unitsToQuarterBeats,
  validateMeasureLength
} from './validator';
import type {
  Measure,
  ParseResult,
  Score,
  StaffName,
  ValidationError,
  ValidationWarning
} from './types';

type SourceLine = {
  text: string;
  number: number;
};

type Fields = {
  title?: string;
  composer?: string;
  tempo?: string;
  key?: string;
  time?: string;
};

export function parseMusicBlock(sourceText: string): ParseResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];
  const lines = normalizeLines(sourceText);

  if (lines.length === 0 || lines[0].text !== 'MUSIC_BLOCK v1') {
    errors.push({
      code: 'INVALID_HEADER',
      message: 'The first non-empty line must be MUSIC_BLOCK v1.',
      line: lines[0]?.number,
      fixHint: 'Start the block with exactly MUSIC_BLOCK v1.'
    });
  }

  if (lines.length === 0 || lines[lines.length - 1].text !== 'END') {
    errors.push({
      code: 'MISSING_END',
      message: 'The final non-empty line must be END.',
      line: lines[lines.length - 1]?.number,
      fixHint: 'End the block with exactly END on its own line.'
    });
  }

  const contentLines = lines.filter((line) => line.text !== 'MUSIC_BLOCK v1' && line.text !== 'END');
  const fields: Fields = {};
  const staffRaw: Record<StaffName, SourceLine[]> = {
    treble: [],
    bass: []
  };
  let currentStaff: StaffName | null = null;

  for (const line of contentLines) {
    if (line.text.startsWith('#')) continue;

    if (line.text === 'treble:' || line.text === 'bass:') {
      currentStaff = line.text.slice(0, -1) as StaffName;
      continue;
    }

    if (currentStaff) {
      staffRaw[currentStaff].push(line);
      continue;
    }

    const fieldMatch = line.text.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (fieldMatch) {
      const [, rawKey, rawValue] = fieldMatch;
      const key = rawKey.toLowerCase();
      if (key === 'title' || key === 'composer' || key === 'tempo' || key === 'time' || key === 'key') {
        fields[key] = rawValue.trim();
      } else {
        warnings.push({
          code: 'UNKNOWN_FIELD',
          message: `Unknown field "${rawKey}" was ignored.`,
          line: line.number
        });
      }
      continue;
    }

    errors.push({
      code: 'INVALID_TOKEN',
      message: `Could not understand line "${line.text}".`,
      line: line.number,
      fixHint: 'Use metadata fields before the staff sections, or put measure lines inside treble: or bass:.'
    });
  }

  if (!fields.title) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: title.',
      fixHint: 'Add a non-empty title field, like title: small candle song.'
    });
  }

  if (!fields.tempo) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: tempo.',
      fixHint: 'Add a tempo field, like tempo: 76.'
    });
  }

  if (!fields.key) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: key.',
      fixHint: 'Add a key field, like key: C minor.'
    });
  }

  if (!fields.time) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: time.',
      fixHint: 'Add a time field with one of: 4/4, 3/4, 2/4, or 6/8.'
    });
  }

  const tempo = parseTempo(fields.tempo);
  if (fields.tempo && tempo === null) {
    errors.push({
      code: 'INVALID_TEMPO',
      message: 'Tempo must be an integer from 30 to 240.',
      fixHint: 'Change tempo to an integer from 30 through 240, like tempo: 72.'
    });
  }

  const time = parseTimeSignature(fields.time);
  if (fields.time && !time) {
    errors.push({
      code: 'INVALID_TIME_SIGNATURE',
      message: 'Time signature must be 4/4, 3/4, 2/4, or 6/8.',
      fixHint: 'Change time to one of the supported values: 4/4, 3/4, 2/4, or 6/8.'
    });
  }

  for (const staff of STAFF_NAMES) {
    if (staffRaw[staff].length === 0) {
      errors.push({
        code: 'MISSING_STAFF',
        message: `Missing required staff section: ${staff}.`,
        staff,
        fixHint: `Add a ${staff}: section with at least one valid measure.`
      });
    }
  }

  if (errors.length > 0 || !time || tempo === null || !fields.title || !fields.key) {
    return { ok: false, errors };
  }

  const staves = {
    treble: parseStaffMeasures(staffRaw.treble, 'treble', time, errors),
    bass: parseStaffMeasures(staffRaw.bass, 'bass', time, errors)
  };

  const totalEvents = staves.treble.reduce((sum, measure) => sum + measure.events.length, 0)
    + staves.bass.reduce((sum, measure) => sum + measure.events.length, 0);

  if (totalEvents === 0) {
    errors.push({
      code: 'NO_MUSIC_EVENTS',
      message: 'The block does not contain any playable notes or rests.',
      fixHint: 'Add at least one valid note or rest in treble and bass.'
    });
  }

  if (staves.treble.length !== staves.bass.length) {
    errors.push({
      code: 'STAVE_MEASURE_COUNT_MISMATCH',
      message: `Treble has ${staves.treble.length} measures, but bass has ${staves.bass.length} measures.`,
      fixHint: 'Make treble and bass contain the same number of measures.'
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const score: Score = {
    version: '1',
    title: fields.title,
    composer: fields.composer || undefined,
    tempo,
    key: fields.key,
    time,
    staves
  };

  return { ok: true, score, warnings };
}

function normalizeLines(sourceText: string): SourceLine[] {
  return sourceText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((text, index) => ({ text: text.trim(), number: index + 1 }))
    .filter((line) => line.text.length > 0);
}

function parseTempo(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const tempo = Number(raw);
  return tempo >= 30 && tempo <= 240 ? tempo : null;
}

function parseStaffMeasures(
  lines: SourceLine[],
  staff: StaffName,
  time: NonNullable<ReturnType<typeof parseTimeSignature>>,
  errors: ValidationError[]
): Measure[] {
  const measures: Measure[] = [];

  for (const line of lines) {
    if (line.text.startsWith('#')) continue;

    if (!line.text.startsWith('|') || !line.text.endsWith('|')) {
      errors.push({
        code: 'INVALID_MEASURE_BAR',
        message: `${staff} measure line must start and end with | bar lines.`,
        line: line.number,
        staff,
        fixHint: 'Wrap each measure line with |, like | C4:q D4:q E4:h |.'
      });
      continue;
    }

    const inner = line.text.slice(1, -1).trim();
    const index = measures.length + 1;

    if (!inner) {
      errors.push({
        code: 'EMPTY_MEASURE',
        message: `${staff} measure ${index} is empty.`,
        line: line.number,
        staff,
        measure: index,
        fixHint: `Add notes or rests to ${staff} measure ${index}.`
      });
      measures.push({
        index,
        events: [],
        totalBeats: 0,
        totalUnits: 0,
        line: line.number
      });
      continue;
    }

    const tokens = inner.split(/\s+/);
    const events = [];
    let totalUnits = 0;

    for (const token of tokens) {
      const parsed = parseEventToken(token, line.number, staff, index);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      if (parsed.event) {
        events.push(parsed.event);
        totalUnits += parsed.event.units;
      }
    }

    const lengthError = validateMeasureLength(totalUnits, time, staff, index, line.number);
    if (lengthError) errors.push(lengthError);

    measures.push({
      index,
      events,
      totalBeats: unitsToQuarterBeats(totalUnits),
      totalUnits,
      line: line.number
    });
  }

  return measures;
}
