import { describe, expect, it } from 'vitest';
import { parseMusicBlock } from './parser';
import {
  buildPlaybackTimeline,
  DEFAULT_STAFF_VOICES,
  getActiveNotesAtUnits,
  getAdjacentMeasure,
  getMeasureEndUnits,
  getMeasureForUnits,
  getMeasureStartUnits,
  PLAYBACK_VOICE_OPTIONS
} from './playback';

const block = `MUSIC_BLOCK v1

title: playback test
tempo: 120
key: C major
time: 4/4

treble:
| C4:q R:q [E4 G4]:h |

bass:
| C3:h G2:h |
END`;

describe('buildPlaybackTimeline', () => {
  it('defines independent default voices for both staves', () => {
    expect(DEFAULT_STAFF_VOICES).toEqual({
      treble: 'piano',
      bass: 'piano'
    });
    expect(PLAYBACK_VOICE_OPTIONS.map((option) => option.id)).toEqual([
      'piano',
      'warm-synth',
      'bright-synth',
      'bell',
      'organ',
      'soft-bass'
    ]);
  });

  it('converts notes, rests, chords, and both staves into timed events', () => {
    const result = parseMusicBlock(block);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const timeline = buildPlaybackTimeline(result.score);

    expect(timeline.secondsPerUnit).toBe(0.03125);
    expect(timeline.totalSeconds).toBe(2);
    expect(timeline.events).toEqual([
      {
        notes: ['C3'],
        noteLabels: [{ letter: 'C', isBlackKey: false }],
        startSeconds: 0,
        durationSeconds: 1,
        startUnits: 0,
        durationUnits: 32,
        velocity: 0.78,
        staff: 'bass',
        measure: 1,
        voice: 'default'
      },
      {
        notes: ['C4'],
        noteLabels: [{ letter: 'C', isBlackKey: false }],
        startSeconds: 0,
        durationSeconds: 0.5,
        startUnits: 0,
        durationUnits: 16,
        velocity: 0.78,
        staff: 'treble',
        measure: 1,
        voice: 'default'
      },
      {
        notes: ['G2'],
        noteLabels: [{ letter: 'G', isBlackKey: false }],
        startSeconds: 1,
        durationSeconds: 1,
        startUnits: 32,
        durationUnits: 32,
        velocity: 0.78,
        staff: 'bass',
        measure: 1,
        voice: 'default'
      },
      {
        notes: ['E4', 'G4'],
        noteLabels: [
          { letter: 'E', isBlackKey: false },
          { letter: 'G', isBlackKey: false }
        ],
        startSeconds: 1,
        durationSeconds: 1,
        startUnits: 32,
        durationUnits: 32,
        velocity: 0.78,
        staff: 'treble',
        measure: 1,
        voice: 'default'
      }
    ]);
  });

  it('normalizes natural accidentals for playback notes', () => {
    const result = parseMusicBlock(block.replace('C4:q', 'Fn4:q'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const timeline = buildPlaybackTimeline(result.score);
    expect(timeline.events.some((event) => event.notes.includes('F4'))).toBe(true);
    expect(getActiveNotesAtUnits(result.score, 0).treble).toEqual([
      { letter: 'F', isBlackKey: false }
    ]);
  });

  it('looks up active note labels at the cursor position', () => {
    const result = parseMusicBlock(block.replace('[E4 G4]:h', '[F#4 A4]:h'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getActiveNotesAtUnits(result.score, 0)).toEqual({
      treble: [{ letter: 'C', isBlackKey: false }],
      bass: [{ letter: 'C', isBlackKey: false }]
    });
    expect(getActiveNotesAtUnits(result.score, 32)).toEqual({
      treble: [
        { letter: 'F', isBlackKey: true },
        { letter: 'A', isBlackKey: false }
      ],
      bass: [{ letter: 'G', isBlackKey: false }]
    });
    expect(getActiveNotesAtUnits(result.score, 24)).toEqual({
      treble: [],
      bass: [{ letter: 'C', isBlackKey: false }]
    });
  });

  it('calculates measure starts, ends, lookup, and adjacent clamping', () => {
    const twoMeasureBlock = block.replace('| C4:q R:q [E4 G4]:h |', '| C4:q R:q [E4 G4]:h |\n| D4:w |')
      .replace('| C3:h G2:h |', '| C3:h G2:h |\n| D3:w |');
    const result = parseMusicBlock(twoMeasureBlock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getMeasureStartUnits(result.score, 1)).toBe(0);
    expect(getMeasureEndUnits(result.score, 1)).toBe(64);
    expect(getMeasureStartUnits(result.score, 2)).toBe(64);
    expect(getMeasureForUnits(result.score, 0)).toBe(1);
    expect(getMeasureForUnits(result.score, 64)).toBe(2);
    expect(getAdjacentMeasure(result.score, 1, -1)).toBe(1);
    expect(getAdjacentMeasure(result.score, 1, 1)).toBe(2);
    expect(getAdjacentMeasure(result.score, 2, 1)).toBe(2);
  });

  it('uses dotted durations in the playback timeline', () => {
    const result = parseMusicBlock(block.replace('C4:q R:q [E4 G4]:h', 'C4:e. D4:s E4:q G4:h'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const timeline = buildPlaybackTimeline(result.score);
    const trebleEvents = timeline.events.filter((event) => event.staff === 'treble');

    expect(trebleEvents.map((event) => event.startUnits)).toEqual([0, 12, 16, 32]);
    expect(trebleEvents.map((event) => event.durationUnits)).toEqual([12, 4, 16, 32]);
  });

  it('sustains tied notes as one playback event', () => {
    const result = parseMusicBlock(block.replace('C4:q R:q [E4 G4]:h', 'C4:q~ C4:q R:h'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const timeline = buildPlaybackTimeline(result.score);
    const tied = timeline.events.find((event) => event.staff === 'treble' && event.notes[0] === 'C4');

    expect(tied?.durationUnits).toBe(32);
    expect(timeline.events.filter((event) => event.staff === 'treble')).toHaveLength(1);
  });

  it('plays multiple voices in the same staff concurrently', () => {
    const result = parseMusicBlock(
      block.replace('C4:q R:q [E4 G4]:h', 'v1:C5:w ; v2:E4:h G4:h')
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const timeline = buildPlaybackTimeline(result.score);
    const trebleAtStart = timeline.events.filter(
      (event) => event.staff === 'treble' && event.startUnits === 0
    );

    expect(trebleAtStart.map((event) => event.voice).sort()).toEqual(['v1', 'v2']);
    expect(trebleAtStart.flatMap((event) => event.notes).sort()).toEqual(['C5', 'E4']);
  });

  it('applies dynamics and simple expression to playback events', () => {
    const result = parseMusicBlock(
      block.replace('C4:q R:q [E4 G4]:h', 'p C4:q f D4:q accent E4:q staccato G4:q')
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const trebleEvents = buildPlaybackTimeline(result.score).events.filter(
      (event) => event.staff === 'treble'
    );

    expect(trebleEvents.map((event) => event.velocity)).toEqual([0.48, 0.9, 1, 0.9]);
    expect(trebleEvents[3].durationSeconds).toBeCloseTo(0.26);
  });
});
