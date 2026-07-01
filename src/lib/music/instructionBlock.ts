export const MUSICBLOCK_INSTRUCTION_BLOCK = `You are writing music for an app called Musicblock.

Return only one valid Musicblock music block.
Do not include markdown.
Do not include explanations.
Do not include commentary before or after the block.

Use this exact format:

MUSIC_BLOCK v1

title: [short title]
composer: [your name or generated]
tempo: [integer 30-240]
key: [example: C major, A minor, D dorian]
time: [4/4, 3/4, 2/4, or 6/8]

treble:
| C4:q D4:q E4:q G4:q |
| A4:h G4:h |

bass:
| C3:h G2:h |
| F2:h G2:h |
END

Rules:

treble and bass are required.
treble and bass must contain the same number of measures.
every measure must be wrapped in | bar lines.
every measure must add up exactly to the time signature.
notes are separated by spaces.
note format is PitchOctave:Duration, like C4:q.
rests use R:Duration, like R:q.
pitches are A B C D E F G.
accidentals are # for sharp, b for flat, and n for natural.
examples: F#4:q, Bb3:h, Gn4:q.
octaves must be 0 through 8.
durations are:
w = whole note
h = half note
q = quarter note
e = eighth note
s = sixteenth note
do not use chords.
do not use dotted notes.
do not use triplets.
do not use ties.
do not use lyrics.
do not use inline comments.
keep the piece simple and readable.

Duration math:

in 4/4, each measure must equal 4 quarter-note beats.
in 3/4, each measure must equal 3 quarter-note beats.
in 2/4, each measure must equal 2 quarter-note beats.
in 6/8, each measure must equal six eighth notes, or 3 quarter-note beats.

When asked to repair a Musicblock music block, return the full corrected block, not just the changed measure.`;

export const EXAMPLE_PLACEHOLDER = `MUSIC_BLOCK v1

title: small candle song
composer: generated
tempo: 76
key: C minor
time: 4/4

treble:
| C4:q Eb4:q G4:q Bb4:q |
| Ab4:h G4:h |
| F4:q Eb4:q D4:q C4:q |
| Eb4:w |

bass:
| C3:h G2:h |
| Ab2:h G2:h |
| F2:h G2:h |
| C3:w |
END`;
