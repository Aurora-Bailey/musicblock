import type { Measure, MusicEvent, SavedPiece, StaffName } from './types';

type VexflowModule = typeof import('vexflow');

const STAFF_HEIGHT = 92;
const SYSTEM_GAP = 54;
const TOP_MARGIN = 20;
const LEFT_MARGIN = 20;
const RIGHT_MARGIN = 20;
const MIN_RENDER_WIDTH = 260;
const MIN_MEASURE_WIDTH = 132;

export async function renderScore(container: HTMLDivElement, piece: SavedPiece): Promise<void> {
  container.innerHTML = '';

  const vf = await import('vexflow');
  const measureCount = piece.score.staves.treble.length;
  const availableWidth = Math.max(getRenderableWidth(container), MIN_RENDER_WIDTH);
  const measuresPerSystem = getMeasuresPerSystem(availableWidth);
  const systems = Math.ceil(measureCount / measuresPerSystem);
  const width = availableWidth;
  const systemHeight = STAFF_HEIGHT * 2 + SYSTEM_GAP;
  const height = TOP_MARGIN + systems * systemHeight + 24;
  const renderer = new vf.Renderer(container, vf.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  context.setFont('Arial', 10);

  for (let systemIndex = 0; systemIndex < systems; systemIndex += 1) {
    const firstMeasure = systemIndex * measuresPerSystem;
    const visibleMeasures = Math.min(measuresPerSystem, measureCount - firstMeasure);
    const y = TOP_MARGIN + systemIndex * systemHeight;
    drawSystem({
      vf,
      context,
      piece,
      firstMeasure,
      visibleMeasures,
      systemIndex,
      width,
      y
    });
  }
}

function getRenderableWidth(container: HTMLDivElement): number {
  const styles = getComputedStyle(container);
  const padding =
    Number.parseFloat(styles.paddingLeft || '0') + Number.parseFloat(styles.paddingRight || '0');
  const measuredWidth = container.clientWidth - padding;

  return Math.floor(measuredWidth);
}

function getMeasuresPerSystem(width: number): number {
  if (width < 620) return 1;
  if (width < 1080) return 2;
  if (width < 1260) return 3;
  return 4;
}

function drawSystem({
  vf,
  context,
  piece,
  firstMeasure,
  visibleMeasures,
  systemIndex,
  width,
  y
}: {
  vf: VexflowModule;
  context: ReturnType<InstanceType<VexflowModule['Renderer']>['getContext']>;
  piece: SavedPiece;
  firstMeasure: number;
  visibleMeasures: number;
  systemIndex: number;
  width: number;
  y: number;
}) {
  const hasClef = systemIndex === 0;
  const firstMeasureExtra = hasClef ? 48 : 10;
  const measureWidth = Math.max(
    MIN_MEASURE_WIDTH,
    (width - LEFT_MARGIN - RIGHT_MARGIN - firstMeasureExtra) / visibleMeasures
  );

  const trebleStaves = [];
  const bassStaves = [];

  for (let offset = 0; offset < visibleMeasures; offset += 1) {
    const measureIndex = firstMeasure + offset;
    const x = LEFT_MARGIN + offset * measureWidth + (offset === 0 ? 0 : firstMeasureExtra);
    const currentMeasureWidth = measureWidth + (offset === 0 ? firstMeasureExtra : 0);
    const trebleStave = new vf.Stave(x, y, currentMeasureWidth);
    const bassStave = new vf.Stave(x, y + STAFF_HEIGHT, currentMeasureWidth);

    if (offset === 0 && hasClef) {
      trebleStave.addClef('treble').addTimeSignature(piece.score.time.raw);
      bassStave.addClef('bass').addTimeSignature(piece.score.time.raw);
    }

    trebleStave.setContext(context).draw();
    bassStave.setContext(context).draw();

    drawVoice(vf, context, piece.score.staves.treble[measureIndex], trebleStave, 'treble');
    drawVoice(vf, context, piece.score.staves.bass[measureIndex], bassStave, 'bass');

    trebleStaves.push(trebleStave);
    bassStaves.push(bassStave);
  }

  if (trebleStaves[0] && bassStaves[0]) {
    new vf.StaveConnector(trebleStaves[0], bassStaves[0])
      .setType(vf.StaveConnector.type.BRACE)
      .setContext(context)
      .draw();
    new vf.StaveConnector(trebleStaves[0], bassStaves[0])
      .setType(vf.StaveConnector.type.SINGLE_LEFT)
      .setContext(context)
      .draw();
  }
}

function drawVoice(
  vf: VexflowModule,
  context: ReturnType<InstanceType<VexflowModule['Renderer']>['getContext']>,
  measure: Measure,
  stave: InstanceType<VexflowModule['Stave']>,
  staff: StaffName
) {
  const notes = measure.events.map((event) => toStaveNote(vf, event, staff));
  const voice = new vf.Voice({
    numBeats: measure.totalUnits,
    beatValue: 16
  }).setStrict(false);

  voice.addTickables(notes);
  new vf.Formatter().joinVoices([voice]).format([voice], Math.max(stave.getWidth() - 36, 80));
  voice.draw(context, stave);
}

function toStaveNote(vf: VexflowModule, event: MusicEvent, staff: StaffName) {
  const clef = staff === 'treble' ? 'treble' : 'bass';

  if (event.type === 'rest') {
    return new vf.StaveNote({
      clef,
      keys: [restKey(staff)],
      duration: `${durationToVexflow(event.duration)}r`
    });
  }

  if (event.type === 'chord') {
    const chord = new vf.StaveNote({
      clef,
      keys: event.notes.map((note) => `${note.pitch.toLowerCase()}/${note.octave}`),
      duration: durationToVexflow(event.duration)
    });

    event.notes.forEach((note, index) => {
      if (note.accidental) {
        chord.addModifier(new vf.Accidental(note.accidental === 'n' ? 'n' : note.accidental), index);
      }
    });

    return chord;
  }

  const note = new vf.StaveNote({
    clef,
    keys: [`${event.pitch.toLowerCase()}/${event.octave}`],
    duration: durationToVexflow(event.duration)
  });

  if (event.accidental) {
    note.addModifier(new vf.Accidental(event.accidental === 'n' ? 'n' : event.accidental), 0);
  }

  return note;
}

function restKey(staff: StaffName): string {
  return staff === 'treble' ? 'b/4' : 'd/3';
}

function durationToVexflow(duration: MusicEvent['duration']): string {
  switch (duration) {
    case 'w':
      return 'w';
    case 'h':
      return 'h';
    case 'q':
      return 'q';
    case 'e':
      return '8';
    case 's':
      return '16';
  }
}
