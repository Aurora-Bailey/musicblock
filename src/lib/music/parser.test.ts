import { describe, expect, it } from 'vitest';
import { buildAgentRepairPrompt } from './errorReport';
import { EXAMPLE_PLACEHOLDER } from './instructionBlock';
import { parseMusicBlock } from './parser';

const validBlock = `MUSIC_BLOCK v1

title: small candle song
composer: generated
tempo: 76
key: C minor
time: 4/4

treble:
| C4:q Eb4:q G4:q Bb4:q |
| Ab4:h G4:h |

bass:
| C3:h G2:h |
| F2:h G2:h |
END`;

describe('parseMusicBlock', () => {
  it('imports a valid 4/4 block', () => {
    const result = parseMusicBlock(validBlock);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score.title).toBe('small candle song');
      expect(result.score.staves.treble).toHaveLength(2);
    }
  });

  it('keeps the bundled placeholder importable', () => {
    const result = parseMusicBlock(EXAMPLE_PLACEHOLDER);
    expect(result.ok).toBe(true);
  });

  it('imports a valid block with rests', () => {
    const result = parseMusicBlock(validBlock.replace('Ab4:h G4:h', 'R:h G4:h'));
    expect(result.ok).toBe(true);
  });

  it('imports a valid block with chords', () => {
    const result = parseMusicBlock(
      validBlock
        .replace('C4:q Eb4:q G4:q Bb4:q', '[C4 Eb4 G4]:q Eb4:q G4:q Bb4:q')
        .replace('C3:h G2:h', '[C3 G3]:h G2:h')
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score.staves.treble[0].events[0].type).toBe('chord');
      expect(result.score.staves.treble[0].totalBeats).toBe(4);
    }
  });

  it('imports dotted rhythms with exact measure math', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'C4:e. Eb4:s G4:q Bb4:h')
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score.staves.treble[0].events[0].units).toBe(12);
      expect(result.score.staves.treble[0].totalBeats).toBe(4);
    }
  });

  it('imports valid tied notes', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'C4:q~ C4:q G4:h')
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const firstEvent = result.score.staves.treble[0].events[0];
      expect(firstEvent.type).toBe('note');
      if (firstEvent.type === 'note') expect(firstEvent.tie).toBe(true);
    }
  });

  it('fails when a tie does not connect to the same pitch', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'C4:q~ D4:q G4:h')
    );
    expectError(result, 'INVALID_TIE');
  });

  it('fails when a rest is tied', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'R:q~ C4:q G4:h')
    );
    expectError(result, 'INVALID_TIE');
  });

  it('imports multiple voices inside a staff measure', () => {
    const result = parseMusicBlock(
      validBlock.replace(
        'C4:q Eb4:q G4:q Bb4:q',
        'v1:C5:h D5:h ; v2:[C4 G4]:q [E4 G4]:q [D4 F4]:q R:q'
      )
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const measure = result.score.staves.treble[0];
      expect(measure.voices.map((voice) => voice.id)).toEqual(['v1', 'v2']);
      expect(measure.voices.map((voice) => voice.totalUnits)).toEqual([64, 64]);
    }
  });

  it('fails when a voice is too short', () => {
    const result = parseMusicBlock(
      validBlock.replace(
        'C4:q Eb4:q G4:q Bb4:q',
        'v1:C5:h D5:h ; v2:[C4 G4]:q [E4 G4]:q [D4 F4]:q'
      )
    );
    expectError(result, 'MEASURE_TOO_SHORT');
  });

  it('fails with an invalid voice id', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'v5:C5:w')
    );
    expectError(result, 'INVALID_VOICE');
  });

  it('fails when voiced and unvoiced syntax are mixed', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'C5:h ; v2:E4:h')
    );
    expectError(result, 'INVALID_VOICE');
  });

  it('imports dynamics and expression marks', () => {
    const result = parseMusicBlock(
      validBlock.replace(
        'C4:q Eb4:q G4:q Bb4:q',
        'p C4:q crescendo Eb4:q accent G4:q staccato Bb4:q'
      )
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score.staves.treble[0].events.map((event) => event.type)).toEqual([
        'mark',
        'note',
        'mark',
        'note',
        'mark',
        'note',
        'mark',
        'note'
      ]);
    }
  });

  it('fails with an invalid expression mark', () => {
    const result = parseMusicBlock(
      validBlock.replace('C4:q Eb4:q G4:q Bb4:q', 'mystery C4:q Eb4:q G4:q Bb4:q')
    );
    expectError(result, 'INVALID_MARK');
  });

  it('fails without MUSIC_BLOCK v1', () => {
    const result = parseMusicBlock(validBlock.replace('MUSIC_BLOCK v1', 'hello'));
    expectError(result, 'INVALID_HEADER');
  });

  it('fails without END', () => {
    const result = parseMusicBlock(validBlock.replace('\nEND', ''));
    expectError(result, 'MISSING_END');
  });

  it('fails without title', () => {
    const result = parseMusicBlock(validBlock.replace('title: small candle song\n', ''));
    expectError(result, 'MISSING_REQUIRED_FIELD');
  });

  it('fails with invalid tempo', () => {
    const result = parseMusicBlock(validBlock.replace('tempo: 76', 'tempo: 500'));
    expectError(result, 'INVALID_TEMPO');
  });

  it('fails with invalid time signature', () => {
    const result = parseMusicBlock(validBlock.replace('time: 4/4', 'time: 5/4'));
    expectError(result, 'INVALID_TIME_SIGNATURE');
  });

  it('fails with invalid note token', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', 'H4:q'));
    expectError(result, 'INVALID_TOKEN');
  });

  it('fails with invalid duration', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', 'C4:x'));
    expectError(result, 'INVALID_DURATION');
  });

  it('fails with invalid chord duration', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', '[C4 E4 G4]:x'));
    expectError(result, 'INVALID_DURATION');
  });

  it('fails with octave outside 0-8', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', 'C9:q'));
    expectError(result, 'OCTAVE_OUT_OF_RANGE');
  });

  it('fails with octave outside 0-8 inside a chord', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', '[C4 E9 G4]:q'));
    expectError(result, 'OCTAVE_OUT_OF_RANGE');
  });

  it('fails when a chord contains a rest', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', '[C4 R G4]:q'));
    expectError(result, 'INVALID_CHORD');
  });

  it('fails when a chord has too many notes', () => {
    const result = parseMusicBlock(validBlock.replace('C4:q', '[C4 D4 E4 F4 G4 A4 B4]:q'));
    expectError(result, 'INVALID_CHORD');
  });

  it('fails with treble/bass measure count mismatch', () => {
    const result = parseMusicBlock(validBlock.replace('| F2:h G2:h |\nEND', 'END'));
    expectError(result, 'STAVE_MEASURE_COUNT_MISMATCH');
  });

  it('fails when a measure is too long', () => {
    const result = parseMusicBlock(validBlock.replace('| Ab4:h G4:h |', '| Ab4:h G4:h C5:q |'));
    expectError(result, 'MEASURE_TOO_LONG');
  });

  it('fails when a measure is too short', () => {
    const result = parseMusicBlock(validBlock.replace('| Ab4:h G4:h |', '| Ab4:h |'));
    expectError(result, 'MEASURE_TOO_SHORT');
  });

  it('fails when a measure is empty', () => {
    const result = parseMusicBlock(validBlock.replace('| Ab4:h G4:h |', '| |'));
    expectError(result, 'EMPTY_MEASURE');
  });

  it('builds a repair prompt with original block and errors', () => {
    const result = parseMusicBlock(validBlock.replace('tempo: 76', 'tempo: slow'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const prompt = buildAgentRepairPrompt(validBlock, result.errors);
      expect(prompt).toContain('original block:');
      expect(prompt).toContain(validBlock);
      expect(prompt).toContain('[INVALID_TEMPO]');
    }
  });
});

function expectError(result: ReturnType<typeof parseMusicBlock>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.some((error) => error.code === code)).toBe(true);
  }
}
