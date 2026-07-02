import type { MusicEvent, NotePitch, Score, StaffName } from './types';

type ToneModule = typeof import('tone');
type ToneSampler = import('tone').Sampler;
type ToneVolume = import('tone').Volume;

export type PlaybackEvent = {
  notes: string[];
  noteLabels: NoteLabelItem[];
  startSeconds: number;
  durationSeconds: number;
  startUnits: number;
  durationUnits: number;
  staff: StaffName;
  measure: number;
};

export type PlaybackTimeline = {
  events: PlaybackEvent[];
  totalSeconds: number;
  secondsPerUnit: number;
};

export type NoteLabelItem = {
  letter: NotePitch['pitch'];
  isBlackKey: boolean;
};

export type ActiveGuideNotes = {
  treble: NoteLabelItem[];
  bass: NoteLabelItem[];
};

export type PlayScoreOptions = {
  volume?: number;
  onEnded?: () => void;
  startMeasure?: number;
  loopMeasure?: number;
};

const PIANO_BASE_URL = '/audio/piano/';
const PIANO_SAMPLE_URLS = {
  C2: 'C2.wav',
  E2: 'E2.wav',
  'G#2': 'Gs2.wav',
  C3: 'C3.wav',
  E3: 'E3.wav',
  'G#3': 'Gs3.wav',
  C4: 'C4.wav',
  E4: 'E4.wav',
  'G#4': 'Gs4.wav',
  C5: 'C5.wav',
  E5: 'E5.wav',
  'G#5': 'Gs5.wav',
  C6: 'C6.wav'
};

let toneModule: ToneModule | null = null;
let sampler: ToneSampler | null = null;
let outputVolume: ToneVolume | null = null;
let loadPromise: Promise<void> | null = null;
let scheduledEventIds: number[] = [];
let endedCallback: (() => void) | null = null;

export function buildPlaybackTimeline(score: Score): PlaybackTimeline {
  const secondsPerUnit = 60 / score.tempo / 4;
  const events: PlaybackEvent[] = [];

  addStaffEvents(score, 'treble', secondsPerUnit, events);
  addStaffEvents(score, 'bass', secondsPerUnit, events);

  events.sort((a, b) => a.startSeconds - b.startSeconds || a.staff.localeCompare(b.staff));

  return {
    events,
    totalSeconds: score.staves.treble.length * score.time.measureUnits * secondsPerUnit,
    secondsPerUnit
  };
}

export async function playScore(
  score: Score,
  options: PlayScoreOptions = {}
): Promise<void> {
  const Tone = await ensurePiano();
  const piano = sampler;
  if (!piano) throw new Error('Piano sampler was not initialized.');

  stopPlayback();
  setPlaybackVolume(options.volume ?? 0.8);
  endedCallback = options.onEnded ?? null;

  const timeline = buildPlaybackTimeline(score);
  const transport = Tone.getTransport();
  const startMeasure = clampMeasure(score, options.startMeasure ?? 1);
  const startSeconds = getMeasureStartSeconds(score, startMeasure);
  const loopMeasure = options.loopMeasure ? clampMeasure(score, options.loopMeasure) : null;
  transport.cancel(0);
  transport.stop();
  transport.loop = false;
  transport.seconds = startSeconds;

  for (const event of timeline.events) {
    const id = transport.schedule((time) => {
      piano.triggerAttackRelease(event.notes, event.durationSeconds, time, 0.82);
    }, event.startSeconds);
    scheduledEventIds.push(id);
  }

  if (loopMeasure) {
    transport.setLoopPoints(
      getMeasureStartSeconds(score, loopMeasure),
      getMeasureEndSeconds(score, loopMeasure)
    );
    transport.loop = true;
  } else {
    const endId = transport.scheduleOnce((time) => {
      Tone.getDraw().schedule(() => {
        const callback = endedCallback;
        stopPlayback();
        callback?.();
      }, time);
    }, timeline.totalSeconds + 0.08);
    scheduledEventIds.push(endId);
  }

  transport.start('+0.03', startSeconds);
}

export async function resumePlayback(): Promise<void> {
  const Tone = await ensureTone();
  await Tone.start();
  Tone.getTransport().start('+0.02');
}

export function pausePlayback(): void {
  if (!toneModule) return;
  toneModule.getTransport().pause();
  sampler?.releaseAll();
}

export function stopPlayback(): void {
  if (!toneModule) return;

  const transport = toneModule.getTransport();
  transport.stop();
  transport.loop = false;
  for (const id of scheduledEventIds) {
    transport.clear(id);
  }
  transport.cancel(0);
  transport.seconds = 0;
  scheduledEventIds = [];
  endedCallback = null;
  sampler?.releaseAll();
}

export function getPlaybackCursorUnits(score: Score): number {
  if (!toneModule) return 0;
  const timeline = buildPlaybackTimeline(score);
  return clampUnits(score, toneModule.getTransport().seconds / timeline.secondsPerUnit);
}

export function getMeasureStartUnits(score: Score, measure: number): number {
  return (clampMeasure(score, measure) - 1) * score.time.measureUnits;
}

export function getMeasureEndUnits(score: Score, measure: number): number {
  return getMeasureStartUnits(score, measure) + score.time.measureUnits;
}

export function getMeasureForUnits(score: Score, units: number): number {
  const totalMeasures = score.staves.treble.length;
  const clamped = clampUnits(score, units);
  if (clamped >= totalMeasures * score.time.measureUnits) return totalMeasures;

  return clampMeasure(score, Math.floor(clamped / score.time.measureUnits) + 1);
}

export function getActiveNotesAtUnits(score: Score, units: number): ActiveGuideNotes {
  const events = buildPlaybackTimeline(score).events.filter(
    (event) => units >= event.startUnits && units < event.startUnits + event.durationUnits
  );
  const notes: ActiveGuideNotes = {
    treble: [],
    bass: []
  };

  for (const event of events) {
    notes[event.staff].push(...event.noteLabels);
  }

  return notes;
}

export function getAdjacentMeasure(score: Score, currentMeasure: number, direction: -1 | 1): number {
  return clampMeasure(score, currentMeasure + direction);
}

export function setPlaybackVolume(volume: number): void {
  if (!outputVolume) return;

  const clamped = Math.max(0, Math.min(1, volume));
  outputVolume.volume.value = clamped === 0 ? -Infinity : 20 * Math.log10(clamped);
}

function addStaffEvents(
  score: Score,
  staff: StaffName,
  secondsPerUnit: number,
  events: PlaybackEvent[]
) {
  for (const measure of score.staves[staff]) {
    let cursorUnits = (measure.index - 1) * score.time.measureUnits;

    for (const event of measure.events) {
      const notes = eventToNotes(event);

      if (notes.length > 0) {
        events.push({
          notes,
          noteLabels: eventToNoteLabels(event),
          startSeconds: cursorUnits * secondsPerUnit,
          durationSeconds: event.units * secondsPerUnit,
          startUnits: cursorUnits,
          durationUnits: event.units,
          staff,
          measure: measure.index
        });
      }

      cursorUnits += event.units;
    }
  }
}

function eventToNotes(event: MusicEvent): string[] {
  if (event.type === 'rest') return [];
  if (event.type === 'chord') return event.notes.map(pitchToToneNote);
  return [pitchToToneNote(event)];
}

function eventToNoteLabels(event: MusicEvent): NoteLabelItem[] {
  if (event.type === 'rest') return [];

  const notes = event.type === 'chord' ? event.notes : [event];
  return notes.map((note) => ({
    letter: note.pitch,
    isBlackKey: note.accidental === '#' || note.accidental === 'b'
  }));
}

function pitchToToneNote(note: NotePitch): string {
  const accidental = note.accidental === 'n' || !note.accidental ? '' : note.accidental;
  return `${note.pitch}${accidental}${note.octave}`;
}

function clampMeasure(score: Score, measure: number): number {
  return Math.max(1, Math.min(score.staves.treble.length, measure));
}

function clampUnits(score: Score, units: number): number {
  const maxUnits = score.staves.treble.length * score.time.measureUnits;
  return Math.max(0, Math.min(maxUnits, units));
}

function getMeasureStartSeconds(score: Score, measure: number): number {
  return getMeasureStartUnits(score, measure) * buildPlaybackTimeline(score).secondsPerUnit;
}

function getMeasureEndSeconds(score: Score, measure: number): number {
  return getMeasureEndUnits(score, measure) * buildPlaybackTimeline(score).secondsPerUnit;
}

async function ensurePiano(): Promise<ToneModule> {
  const Tone = await ensureTone();
  await Tone.start();

  if (sampler?.loaded) return Tone;
  if (!outputVolume) outputVolume = new Tone.Volume(-2).toDestination();
  const destination = outputVolume;

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      sampler = new Tone.Sampler({
        urls: PIANO_SAMPLE_URLS,
        baseUrl: PIANO_BASE_URL,
        attack: 0.004,
        release: 0.9,
        onload: resolve,
        onerror: reject
      }).connect(destination);
    });
  }

  await loadPromise;
  return Tone;
}

async function ensureTone(): Promise<ToneModule> {
  if (!toneModule) {
    toneModule = await import('tone');
  }

  return toneModule;
}
