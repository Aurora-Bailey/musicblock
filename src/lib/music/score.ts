import type {
  ChordEvent,
  DynamicMark,
  ExpressionMark,
  MarkEvent,
  Measure,
  MusicEvent,
  NoteEvent,
  NotePitch,
  VoiceLine
} from './types';

export function getMeasureVoices(measure: Measure): VoiceLine[] {
  if (Array.isArray(measure.voices) && measure.voices.length > 0) return measure.voices;

  return [
    {
      id: 'default',
      events: measure.events ?? [],
      totalBeats: measure.totalBeats ?? 0,
      totalUnits: measure.totalUnits ?? 0
    }
  ];
}

export function isPlayableEvent(event: MusicEvent): event is NoteEvent | ChordEvent {
  return event.type === 'note' || event.type === 'chord';
}

export function isTimedEvent(event: MusicEvent): event is NoteEvent | ChordEvent | Exclude<MusicEvent, MarkEvent> {
  return event.type !== 'mark';
}

export function isDynamicMark(mark: string): mark is DynamicMark {
  return mark === 'pp' || mark === 'p' || mark === 'mp' || mark === 'mf' || mark === 'f' || mark === 'ff';
}

export function isExpressionMark(mark: string): mark is ExpressionMark {
  return (
    mark === 'crescendo'
    || mark === 'diminuendo'
    || mark === 'legato'
    || mark === 'staccato'
    || mark === 'accent'
    || mark === 'pedal_on'
    || mark === 'pedal_off'
  );
}

export function pitchKey(note: NotePitch): string {
  return `${note.pitch}${note.accidental ?? ''}${note.octave}`;
}

export function eventPitchKeys(event: NoteEvent | ChordEvent): string[] {
  if (event.type === 'note') return [pitchKey(event)];
  return event.notes.map(pitchKey);
}

export function playableEventsMatch(a: NoteEvent | ChordEvent, b: NoteEvent | ChordEvent): boolean {
  const aKeys = eventPitchKeys(a);
  const bKeys = eventPitchKeys(b);

  return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index]);
}
