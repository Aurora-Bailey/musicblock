import { DURATION_UNITS } from './constants';
import { getMeasureVoices, isDynamicMark, isPlayableEvent, playableEventsMatch } from './score';
import type { MusicEvent, NotePitch, Score, StaffName, VoiceId } from './types';

type ToneModule = typeof import('tone');
type ToneSampler = import('tone').Sampler;
type ToneVolume = import('tone').Volume;
type PlaybackInstrument = {
  triggerAttackRelease(
    notes: string | string[],
    duration: number,
    time?: number,
    velocity?: number
  ): unknown;
  releaseAll(time?: number): unknown;
  connect(destination: ToneVolume): unknown;
};

export type PlaybackVoiceId =
  | 'piano'
  | 'warm-synth'
  | 'bright-synth'
  | 'bell'
  | 'organ'
  | 'soft-bass';

export type StaffVoices = Record<StaffName, PlaybackVoiceId>;

export type PlaybackVoiceOption = {
  id: PlaybackVoiceId;
  label: string;
};

export type PlaybackEvent = {
  notes: string[];
  noteLabels: NoteLabelItem[];
  startSeconds: number;
  durationSeconds: number;
  startUnits: number;
  durationUnits: number;
  velocity: number;
  staff: StaffName;
  measure: number;
  voice: VoiceId;
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

type PlayableMusicEvent = Extract<MusicEvent, { type: 'note' | 'chord' }>;

type VoicePlaybackState = {
  velocity: number;
  nextDurationScale: number;
  nextVelocityMultiplier: number;
};

type TimedPlaybackEntry = {
  event: PlayableMusicEvent;
  startUnits: number;
  measure: number;
  voice: VoiceId;
  velocity: number;
  durationScale: number;
};

export type PlayScoreOptions = {
  volume?: number;
  onEnded?: () => void;
  startMeasure?: number;
  loopMeasure?: number;
  voices?: Partial<StaffVoices>;
};

export const PLAYBACK_VOICE_OPTIONS: PlaybackVoiceOption[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'warm-synth', label: 'Warm synth' },
  { id: 'bright-synth', label: 'Bright synth' },
  { id: 'bell', label: 'Bell' },
  { id: 'organ', label: 'Organ' },
  { id: 'soft-bass', label: 'Soft bass' }
];

export const DEFAULT_STAFF_VOICES: StaffVoices = {
  treble: 'piano',
  bass: 'piano'
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

const DYNAMIC_VELOCITY = {
  pp: 0.36,
  p: 0.48,
  mp: 0.64,
  mf: 0.78,
  f: 0.9,
  ff: 1
};

let toneModule: ToneModule | null = null;
let sampler: ToneSampler | null = null;
let instruments = new Map<PlaybackVoiceId, PlaybackInstrument>();
let outputVolume: ToneVolume | null = null;
let loadPromise: Promise<void> | null = null;
let scheduledEventIds: number[] = [];
let endedCallback: (() => void) | null = null;

export function buildPlaybackTimeline(score: Score): PlaybackTimeline {
  const secondsPerUnit = 60 / score.tempo / DURATION_UNITS.q;
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
  const staffVoices = {
    ...DEFAULT_STAFF_VOICES,
    ...options.voices
  };
  const Tone = await ensureTone();
  await Tone.start();
  const activeInstruments = await ensureStaffInstruments(staffVoices);

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
    const instrument = activeInstruments[event.staff];
    const id = transport.schedule((time) => {
      instrument.triggerAttackRelease(event.notes, event.durationSeconds, time, event.velocity);
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
  releaseAllInstruments();
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
  const entries: TimedPlaybackEntry[] = [];
  const voiceStates = new Map<VoiceId, VoicePlaybackState>();

  for (const measure of score.staves[staff]) {
    for (const voice of getMeasureVoices(measure)) {
      let cursorUnits = (measure.index - 1) * score.time.measureUnits;
      const state = voiceStates.get(voice.id) ?? {
        velocity: DYNAMIC_VELOCITY.mf,
        nextDurationScale: 1,
        nextVelocityMultiplier: 1
      };

      for (const event of voice.events) {
        if (event.type === 'mark') {
          if (isDynamicMark(event.mark)) {
            state.velocity = DYNAMIC_VELOCITY[event.mark];
          } else if (event.mark === 'staccato') {
            state.nextDurationScale = 0.52;
          } else if (event.mark === 'accent') {
            state.nextVelocityMultiplier = 1.16;
          } else if (event.mark === 'legato') {
            state.nextDurationScale = 1.04;
          }
          continue;
        }

        if (isPlayableEvent(event)) {
          entries.push({
            event,
            startUnits: cursorUnits,
            measure: measure.index,
            voice: voice.id,
            velocity: Math.max(0.1, Math.min(1, state.velocity * state.nextVelocityMultiplier)),
            durationScale: state.nextDurationScale
          });
          state.nextDurationScale = 1;
          state.nextVelocityMultiplier = 1;
        }

        cursorUnits += event.units;
      }

      voiceStates.set(voice.id, state);
    }
  }

  entries.sort(
    (a, b) =>
      a.startUnits - b.startUnits
      || a.voice.localeCompare(b.voice)
      || eventPitchSortKey(a.event).localeCompare(eventPitchSortKey(b.event))
  );

  const consumed = new Set<number>();
  for (let index = 0; index < entries.length; index += 1) {
    if (consumed.has(index)) continue;

    const entry = entries[index];
    let durationUnits = entry.event.units;
    let chainIndex = index;

    while (entryCanTieTo(entries[chainIndex], entries[chainIndex + 1])) {
      consumed.add(chainIndex + 1);
      durationUnits += entries[chainIndex + 1].event.units;
      chainIndex += 1;
    }

    const durationScale = chainIndex === index ? entry.durationScale : 1;
    events.push({
      notes: eventToNotes(entry.event),
      noteLabels: eventToNoteLabels(entry.event),
      startSeconds: entry.startUnits * secondsPerUnit,
      durationSeconds: durationUnits * secondsPerUnit * durationScale,
      startUnits: entry.startUnits,
      durationUnits,
      velocity: entry.velocity,
      staff,
      measure: entry.measure,
      voice: entry.voice
    });
  }
}

function eventToNotes(event: MusicEvent): string[] {
  if (event.type === 'rest' || event.type === 'mark') return [];
  if (event.type === 'chord') return event.notes.map(pitchToToneNote);
  return [pitchToToneNote(event)];
}

function eventToNoteLabels(event: MusicEvent): NoteLabelItem[] {
  if (event.type === 'rest' || event.type === 'mark') return [];

  const notes = event.type === 'chord' ? event.notes : [event];
  return notes.map((note) => ({
    letter: note.pitch,
    isBlackKey: note.accidental === '#' || note.accidental === 'b'
  }));
}

function entryCanTieTo(
  entry: {
    event: PlayableMusicEvent;
    startUnits: number;
    voice: VoiceId;
  } | undefined,
  nextEntry: {
    event: PlayableMusicEvent;
    startUnits: number;
    voice: VoiceId;
  } | undefined
): boolean {
  if (!entry || !nextEntry || !entry.event.tie) return false;
  if (entry.voice !== nextEntry.voice) return false;
  if (nextEntry.startUnits !== entry.startUnits + entry.event.units) return false;

  return playableEventsMatch(entry.event, nextEntry.event);
}

function eventPitchSortKey(event: PlayableMusicEvent): string {
  if (event.type === 'note') return pitchToToneNote(event);
  return event.notes.map(pitchToToneNote).join(',');
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
  const destination = ensureOutputVolume(Tone);

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

async function ensureStaffInstruments(voices: StaffVoices): Promise<Record<StaffName, PlaybackInstrument>> {
  const treble = await ensureInstrument(voices.treble);
  const bass = await ensureInstrument(voices.bass);

  return { treble, bass };
}

async function ensureInstrument(voice: PlaybackVoiceId): Promise<PlaybackInstrument> {
  if (voice === 'piano') {
    await ensurePiano();
    if (!sampler) throw new Error('Piano sampler was not initialized.');
    return sampler;
  }

  const existing = instruments.get(voice);
  if (existing) return existing;

  const Tone = await ensureTone();
  const destination = ensureOutputVolume(Tone);
  const instrument = createSynthInstrument(Tone, voice);
  instrument.connect(destination);
  instruments.set(voice, instrument);
  return instrument;
}

function createSynthInstrument(Tone: ToneModule, voice: PlaybackVoiceId): PlaybackInstrument {
  switch (voice) {
    case 'warm-synth':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.025, decay: 0.22, sustain: 0.5, release: 0.9 }
      }) as PlaybackInstrument;
    case 'bright-synth':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.006, decay: 0.14, sustain: 0.32, release: 0.34 }
      }) as PlaybackInstrument;
    case 'bell':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.8,
        modulationIndex: 9,
        envelope: { attack: 0.01, decay: 0.7, sustain: 0.08, release: 1.4 },
        modulationEnvelope: { attack: 0.01, decay: 0.35, sustain: 0.05, release: 0.9 }
      }) as PlaybackInstrument;
    case 'organ':
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.08, sustain: 0.78, release: 0.28 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.03, decay: 0.1, sustain: 0.5, release: 0.25 }
      }) as PlaybackInstrument;
    case 'soft-bass':
      return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sine' },
        filter: { Q: 1, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.015, decay: 0.18, sustain: 0.42, release: 0.45 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.12,
          sustain: 0.18,
          release: 0.4,
          baseFrequency: 90,
          octaves: 2.2
        }
      }) as PlaybackInstrument;
    case 'piano':
      throw new Error('Piano is created through the sampler.');
  }
}

function releaseAllInstruments(): void {
  sampler?.releaseAll();
  for (const instrument of instruments.values()) {
    instrument.releaseAll();
  }
}

function ensureOutputVolume(Tone: ToneModule): ToneVolume {
  if (!outputVolume) outputVolume = new Tone.Volume(-2).toDestination();
  return outputVolume;
}

async function ensureTone(): Promise<ToneModule> {
  if (!toneModule) {
    toneModule = await import('tone');
  }

  return toneModule;
}
