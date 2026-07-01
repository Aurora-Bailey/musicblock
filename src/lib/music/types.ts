export type StaffName = 'treble' | 'bass';

export type DurationCode = 'w' | 'h' | 'q' | 'e' | 's';

export type TimeSignature = {
  raw: string;
  beatsPerMeasure: number;
  beatUnit: number;
  measureValue: number;
  measureUnits: number;
};

export type NotePitch = {
  pitch: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  accidental?: '#' | 'b' | 'n';
  octave: number;
  raw: string;
};

export type NoteEvent = NotePitch & {
  type: 'note';
  duration: DurationCode;
  beats: number;
  units: number;
};

export type RestEvent = {
  type: 'rest';
  duration: DurationCode;
  beats: number;
  units: number;
  raw: string;
};

export type ChordEvent = {
  type: 'chord';
  notes: NotePitch[];
  duration: DurationCode;
  beats: number;
  units: number;
  raw: string;
};

export type MusicEvent = NoteEvent | RestEvent | ChordEvent;

export type Measure = {
  index: number;
  events: MusicEvent[];
  totalBeats: number;
  totalUnits: number;
  line?: number;
};

export type Score = {
  version: '1';
  title: string;
  composer?: string;
  tempo: number;
  key: string;
  time: TimeSignature;
  staves: {
    treble: Measure[];
    bass: Measure[];
  };
};

export type SavedPiece = {
  id: string;
  title: string;
  composer?: string;
  createdAt: string;
  updatedAt: string;
  sourceText: string;
  score: Score;
};

export type ValidationError = {
  code:
    | 'INVALID_HEADER'
    | 'MISSING_END'
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_TEMPO'
    | 'INVALID_TIME_SIGNATURE'
    | 'MISSING_STAFF'
    | 'INVALID_MEASURE_BAR'
    | 'INVALID_TOKEN'
    | 'INVALID_NOTE'
    | 'INVALID_REST'
    | 'INVALID_CHORD'
    | 'INVALID_DURATION'
    | 'OCTAVE_OUT_OF_RANGE'
    | 'MEASURE_TOO_SHORT'
    | 'MEASURE_TOO_LONG'
    | 'STAVE_MEASURE_COUNT_MISMATCH'
    | 'EMPTY_MEASURE'
    | 'NO_MUSIC_EVENTS';
  message: string;
  line?: number;
  staff?: StaffName;
  measure?: number;
  token?: string;
  fixHint: string;
};

export type ValidationWarning = {
  code: string;
  message: string;
  line?: number;
};

export type ParseResult =
  | { ok: true; score: Score; warnings: ValidationWarning[] }
  | { ok: false; errors: ValidationError[] };
