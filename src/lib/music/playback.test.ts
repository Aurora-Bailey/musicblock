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

    expect(timeline.secondsPerUnit).toBe(0.125);
    expect(timeline.totalSeconds).toBe(2);
    expect(timeline.events).toEqual([
      {
        notes: ['C3'],
        noteLabels: [{ letter: 'C', isBlackKey: false }],
        startSeconds: 0,
        durationSeconds: 1,
        startUnits: 0,
        durationUnits: 8,
        staff: 'bass',
        measure: 1
      },
      {
        notes: ['C4'],
        noteLabels: [{ letter: 'C', isBlackKey: false }],
        startSeconds: 0,
        durationSeconds: 0.5,
        startUnits: 0,
        durationUnits: 4,
        staff: 'treble',
        measure: 1
      },
      {
        notes: ['G2'],
        noteLabels: [{ letter: 'G', isBlackKey: false }],
        startSeconds: 1,
        durationSeconds: 1,
        startUnits: 8,
        durationUnits: 8,
        staff: 'bass',
        measure: 1
      },
      {
        notes: ['E4', 'G4'],
        noteLabels: [
          { letter: 'E', isBlackKey: false },
          { letter: 'G', isBlackKey: false }
        ],
        startSeconds: 1,
        durationSeconds: 1,
        startUnits: 8,
        durationUnits: 8,
        staff: 'treble',
        measure: 1
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
    expect(getActiveNotesAtUnits(result.score, 8)).toEqual({
      treble: [
        { letter: 'F', isBlackKey: true },
        { letter: 'A', isBlackKey: false }
      ],
      bass: [{ letter: 'G', isBlackKey: false }]
    });
    expect(getActiveNotesAtUnits(result.score, 6)).toEqual({
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
    expect(getMeasureEndUnits(result.score, 1)).toBe(16);
    expect(getMeasureStartUnits(result.score, 2)).toBe(16);
    expect(getMeasureForUnits(result.score, 0)).toBe(1);
    expect(getMeasureForUnits(result.score, 16)).toBe(2);
    expect(getAdjacentMeasure(result.score, 1, -1)).toBe(1);
    expect(getAdjacentMeasure(result.score, 1, 1)).toBe(2);
    expect(getAdjacentMeasure(result.score, 2, 1)).toBe(2);
  });
});
