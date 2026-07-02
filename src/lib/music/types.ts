export type StaffName = 'treble' | 'bass';

export type DurationCode = 'w' | 'h' | 'q' | 'e' | 's';

export type DynamicMark = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';

export type ExpressionMark =
  | 'crescendo'
  | 'diminuendo'
  | 'legato'
  | 'staccato'
  | 'accent'
  | 'pedal_on'
  | 'pedal_off';

export type MusicMark = DynamicMark | ExpressionMark;

export type VoiceId = 'default' | `v${number}`;

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
  dots: number;
  beats: number;
  units: number;
  tie?: boolean;
};

export type RestEvent = {
  type: 'rest';
  duration: DurationCode;
  dots: number;
  beats: number;
  units: number;
  raw: string;
};

export type ChordEvent = {
  type: 'chord';
  notes: NotePitch[];
  duration: DurationCode;
  dots: number;
  beats: number;
  units: number;
  tie?: boolean;
  raw: string;
};

export type MarkEvent = {
  type: 'mark';
  mark: MusicMark;
  category: 'dynamic' | 'expression';
  beats: 0;
  units: 0;
  raw: string;
};

export type MusicEvent = NoteEvent | RestEvent | ChordEvent | MarkEvent;

export type VoiceLine = {
  id: VoiceId;
  events: MusicEvent[];
  totalBeats: number;
  totalUnits: number;
};

export type Measure = {
  index: number;
  events: MusicEvent[];
  voices: VoiceLine[];
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
    | 'INVALID_TIE'
    | 'INVALID_VOICE'
    | 'INVALID_MARK'
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
  voice?: VoiceId;
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
