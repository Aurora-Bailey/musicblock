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
| mf C4:e. D4:s E4:q G4:q~ G4:q |
| v1:G4:q A4:q B4:h ; v2:[C4 E4 G4]:h R:h |

bass:
| p C3:h G2:h |
| [F2 C3]:h [G2 D3]:h |
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
chords use [note note note]:duration, like [C4 E4 G4]:q.
all notes in a chord share one duration.
do not put rests inside chords.
do not put durations inside chord notes.
chords must contain 2 to 6 notes.
durations are:
w = whole note
h = half note
q = quarter note
e = eighth note
s = sixteenth note
add one dot after a duration for a dotted rhythm, like C4:q. or R:e.
add ~ after a note or chord duration to tie it to the next same note or chord, like C4:q~ C4:q.
combine dotted rhythms and ties as Duration.~, like C4:q.~
ties must connect directly to the same note or chord in the same voice.
voices inside a measure use v1:, v2:, v3:, or v4: separated by semicolons.
example: | v1:E5:h D5:h ; v2:[C4 G4]:q [E4 G4]:q [D4 F4]:q R:q |
if a measure uses voices, every voice clause must fill the full measure.
do not mix unvoiced notes and v1/v2 syntax in the same measure.
dynamics are pp, p, mp, mf, f, and ff.
expression marks are crescendo, diminuendo, legato, staccato, accent, pedal_on, and pedal_off.
dynamics and expression marks go before the note, chord, or rest they affect.
example: | p C4:q crescendo D4:q accent E4:q staccato G4:q |
do not use triplets.
do not use lyrics.
do not use section labels or repeats.
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
| mp C4:e. Eb4:s G4:q Bb4:q~ Bb4:q |
| v1:Bb4:q Ab4:q G4:h ; v2:[Eb4 G4]:h R:h |
| crescendo F4:q Eb4:q D4:q C4:q |
| pedal_on [Eb4 G4 C5]:h pedal_off Eb4:h |

bass:
| [C3 G3]:h G2:h |
| Ab2:h G2:h |
| F2:h G2:h |
| C3:q. R:e [G2 D3]:h |
END`;
