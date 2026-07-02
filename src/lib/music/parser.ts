import { STAFF_NAMES } from './constants';
import {
  parseEventToken,
  parseTimeSignature,
  unitsToQuarterBeats,
  validateMeasureLength,
  validateTies
} from './validator';
import type {
  Measure,
  MusicEvent,
  ParseResult,
  Score,
  StaffName,
  ValidationError,
  ValidationWarning,
  VoiceId,
  VoiceLine
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

  const totalEvents = countMusicEvents(staves.treble) + countMusicEvents(staves.bass);

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

  const score: Score = {
    version: '1',
    title: fields.title,
    composer: fields.composer || undefined,
    tempo,
    key: fields.key,
    time,
    staves
  };

  errors.push(...validateTies(score));

  if (errors.length > 0) {
    return { ok: false, errors };
  }

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
        voices: [],
        totalBeats: 0,
        totalUnits: 0,
        line: line.number
      });
      continue;
    }

    const voices = parseMeasureVoices(inner, line.number, staff, index, time, errors);
    const events = voices.flatMap((voice) => voice.events);
    const totalUnits = voices.length > 0 ? Math.max(...voices.map((voice) => voice.totalUnits)) : 0;

    measures.push({
      index,
      events,
      voices,
      totalBeats: unitsToQuarterBeats(totalUnits),
      totalUnits,
      line: line.number
    });
  }

  return measures;
}

function parseMeasureVoices(
  inner: string,
  line: number,
  staff: StaffName,
  measure: number,
  time: NonNullable<ReturnType<typeof parseTimeSignature>>,
  errors: ValidationError[]
): VoiceLine[] {
  const voiceClauses = splitVoiceClauses(inner);
  const hasVoiceSyntax = voiceClauses.some((clause) => /^v\d+:/.test(clause));

  if (!hasVoiceSyntax) {
    const voice = parseVoiceEvents('default', inner, line, staff, measure, errors);
    const lengthError = validateMeasureLength(voice.totalUnits, time, staff, measure, line, voice.id);
    if (lengthError) errors.push(lengthError);
    return [voice];
  }

  const voices: VoiceLine[] = [];
  const seen = new Set<VoiceId>();

  for (const clause of voiceClauses) {
    const voiceMatch = clause.match(/^(v\d+):\s*(.+)$/);

    if (!voiceMatch) {
      errors.push({
        code: 'INVALID_VOICE',
        message: `${staff} measure ${measure} mixes voiced and unvoiced syntax.`,
        line,
        staff,
        measure,
        fixHint: 'When a measure uses voices, every clause must start with v1:, v2:, v3:, or v4:.'
      });
      continue;
    }

    const [, rawVoiceId, voiceContent] = voiceMatch;
    if (!/^v[1-4]$/.test(rawVoiceId)) {
      errors.push({
        code: 'INVALID_VOICE',
        message: `Invalid voice id "${rawVoiceId}" in ${staff} measure ${measure}.`,
        line,
        staff,
        measure,
        token: rawVoiceId,
        fixHint: 'Use voice ids v1, v2, v3, or v4.'
      });
      continue;
    }

    const voiceId = rawVoiceId as VoiceId;
    if (seen.has(voiceId)) {
      errors.push({
        code: 'INVALID_VOICE',
        message: `${staff} measure ${measure} uses ${voiceId} more than once.`,
        line,
        staff,
        measure,
        voice: voiceId,
        fixHint: `Merge the duplicated ${voiceId} clauses into one voice clause.`
      });
      continue;
    }

    seen.add(voiceId);
    const voice = parseVoiceEvents(voiceId, voiceContent, line, staff, measure, errors);
    const lengthError = validateMeasureLength(voice.totalUnits, time, staff, measure, line, voice.id);
    if (lengthError) errors.push(lengthError);
    voices.push(voice);
  }

  if (voices.length === 0) {
    errors.push({
      code: 'EMPTY_MEASURE',
      message: `${staff} measure ${measure} has no valid voice content.`,
      line,
      staff,
      measure,
      fixHint: `Add at least one complete voice to ${staff} measure ${measure}.`
    });
  }

  return voices;
}

function parseVoiceEvents(
  id: VoiceId,
  source: string,
  line: number,
  staff: StaffName,
  measure: number,
  errors: ValidationError[]
): VoiceLine {
  const tokens = tokenizeMeasure(source);
  const events: MusicEvent[] = [];
  let totalUnits = 0;

  for (const token of tokens) {
    const parsed = parseEventToken(token, line, staff, measure);
    if (parsed.error) {
      errors.push({
        ...parsed.error,
        voice: id === 'default' ? parsed.error.voice : id
      });
      continue;
    }
    if (parsed.event) {
      events.push(parsed.event);
      totalUnits += parsed.event.units;
    }
  }

  return {
    id,
    events,
    totalBeats: unitsToQuarterBeats(totalUnits),
    totalUnits
  };
}

function splitVoiceClauses(inner: string): string[] {
  const clauses: string[] = [];
  let start = 0;
  let bracketDepth = 0;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];

    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if (char === ';' && bracketDepth === 0) {
      clauses.push(inner.slice(start, index).trim());
      start = index + 1;
    }
  }

  clauses.push(inner.slice(start).trim());
  return clauses.filter(Boolean);
}

function tokenizeMeasure(inner: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < inner.length) {
    if (/\s/.test(inner[index])) {
      index += 1;
      continue;
    }

    if (inner[index] === '[') {
      const closeIndex = inner.indexOf(']', index + 1);
      if (closeIndex === -1) {
        tokens.push(inner.slice(index).trim());
        break;
      }

      let endIndex = closeIndex + 1;
      if (inner[endIndex] === ':') {
        endIndex += 1;
        while (endIndex < inner.length && !/\s/.test(inner[endIndex])) {
          endIndex += 1;
        }
      }

      tokens.push(inner.slice(index, endIndex));
      index = endIndex;
      continue;
    }

    let endIndex = index + 1;
    while (endIndex < inner.length && !/\s/.test(inner[endIndex])) {
      endIndex += 1;
    }

    tokens.push(inner.slice(index, endIndex));
    index = endIndex;
  }

  return tokens;
}

function countMusicEvents(measures: Measure[]): number {
  return measures.reduce(
    (sum, measure) =>
      sum
      + measure.voices.reduce(
        (voiceSum, voice) => voiceSum + voice.events.filter((event) => event.type !== 'mark').length,
        0
      ),
    0
  );
}
