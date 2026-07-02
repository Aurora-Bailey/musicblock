import {
  getMeasureVoices,
  isDynamicMark,
  isPlayableEvent,
  playableEventsMatch
} from './score';
import type { ChordEvent, MarkEvent, Measure, MusicEvent, NoteEvent, SavedPiece, StaffName, VoiceId } from './types';

type VexflowModule = typeof import('vexflow');

export type ScoreMeasureLayout = {
  measure: number;
  systemIndex: number;
  x: number;
  y: number;
  width: number;
  top: number;
  bottom: number;
  startUnits: number;
  endUnits: number;
};

export type ScoreLayout = {
  width: number;
  height: number;
  measureUnits: number;
  measures: ScoreMeasureLayout[];
};

const STAFF_HEIGHT = 92;
const SYSTEM_GAP = 54;
const TOP_MARGIN = 20;
const LEFT_MARGIN = 20;
const RIGHT_MARGIN = 20;
const MIN_RENDER_WIDTH = 260;
const MIN_MEASURE_WIDTH = 132;

type VexflowContext = ReturnType<InstanceType<VexflowModule['Renderer']>['getContext']>;
type VexflowStave = InstanceType<VexflowModule['Stave']>;
type VexflowStaveNote = InstanceType<VexflowModule['StaveNote']>;
type RenderedEventNote = {
  staff: StaffName;
  voice: VoiceId;
  measure: number;
  systemIndex: number;
  event: NoteEvent | ChordEvent;
  note: VexflowStaveNote;
};

export async function renderScore(container: HTMLDivElement, piece: SavedPiece): Promise<ScoreLayout> {
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
  const layout: ScoreLayout = {
    width,
    height,
    measureUnits: piece.score.time.measureUnits,
    measures: []
  };
  const renderedNotes: RenderedEventNote[] = [];

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
      y,
      layout,
      renderedNotes
    });
  }

  drawTies(vf, context, renderedNotes);

  return layout;
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
  y,
  layout,
  renderedNotes
}: {
  vf: VexflowModule;
  context: VexflowContext;
  piece: SavedPiece;
  firstMeasure: number;
  visibleMeasures: number;
  systemIndex: number;
  width: number;
  y: number;
  layout: ScoreLayout;
  renderedNotes: RenderedEventNote[];
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
    layout.measures.push({
      measure: measureIndex + 1,
      systemIndex,
      x,
      y,
      width: currentMeasureWidth,
      top: y + 4,
      bottom: y + STAFF_HEIGHT + 74,
      startUnits: measureIndex * piece.score.time.measureUnits,
      endUnits: (measureIndex + 1) * piece.score.time.measureUnits
    });

    if (offset === 0 && hasClef) {
      trebleStave.addClef('treble').addTimeSignature(piece.score.time.raw);
      bassStave.addClef('bass').addTimeSignature(piece.score.time.raw);
    }

    trebleStave.setContext(context).draw();
    bassStave.setContext(context).draw();

    drawMeasureVoices(vf, context, piece.score.staves.treble[measureIndex], trebleStave, 'treble', systemIndex, renderedNotes);
    drawMeasureVoices(vf, context, piece.score.staves.bass[measureIndex], bassStave, 'bass', systemIndex, renderedNotes);

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

function drawMeasureVoices(
  vf: VexflowModule,
  context: VexflowContext,
  measure: Measure,
  stave: VexflowStave,
  staff: StaffName,
  systemIndex: number,
  renderedNotes: RenderedEventNote[]
) {
  const voices = getMeasureVoices(measure)
    .map((voiceLine, index) => {
      const notes = toStaveNotes(vf, voiceLine.events, staff, getStemDirection(vf, voiceLine.id, index));
      notes.rendered.forEach((rendered) => {
        renderedNotes.push({
          staff,
          voice: voiceLine.id,
          measure: measure.index,
          systemIndex,
          event: rendered.event,
          note: rendered.note
        });
      });

      const voice = new vf.Voice({
        numBeats: measure.totalUnits,
        beatValue: 64
      }).setStrict(false);

      voice.addTickables(notes.notes);
      return voice;
    })
    .filter((voice) => voice.getTickables().length > 0);

  if (voices.length === 0) return;

  new vf.Formatter().joinVoices(voices).format(voices, Math.max(stave.getWidth() - 36, 80));
  voices.forEach((voice) => voice.draw(context, stave));
}

function toStaveNotes(
  vf: VexflowModule,
  events: MusicEvent[],
  staff: StaffName,
  stemDirection: number
): { notes: VexflowStaveNote[]; rendered: Array<{ event: NoteEvent | ChordEvent; note: VexflowStaveNote }> } {
  const notes: VexflowStaveNote[] = [];
  const rendered: Array<{ event: NoteEvent | ChordEvent; note: VexflowStaveNote }> = [];
  const pendingMarks: MarkEvent[] = [];

  for (const event of events) {
    if (event.type === 'mark') {
      pendingMarks.push(event);
      continue;
    }

    const note = toStaveNote(vf, event, staff, stemDirection);
    applyPendingMarks(vf, note, pendingMarks);
    pendingMarks.length = 0;
    notes.push(note);

    if (isPlayableEvent(event)) {
      rendered.push({ event, note });
    }
  }

  return { notes, rendered };
}

function toStaveNote(
  vf: VexflowModule,
  event: Exclude<MusicEvent, MarkEvent>,
  staff: StaffName,
  stemDirection: number
) {
  const clef = staff === 'treble' ? 'treble' : 'bass';

  if (event.type === 'rest') {
    return new vf.StaveNote({
      clef,
      keys: [restKey(staff)],
      duration: `${durationToVexflow(event)}r`,
      stemDirection
    });
  }

  if (event.type === 'chord') {
    const chord = new vf.StaveNote({
      clef,
      keys: event.notes.map((note) => `${note.pitch.toLowerCase()}/${note.octave}`),
      duration: durationToVexflow(event),
      stemDirection
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
    duration: durationToVexflow(event),
    stemDirection
  });

  if (event.accidental) {
    note.addModifier(new vf.Accidental(event.accidental === 'n' ? 'n' : event.accidental), 0);
  }

  return note;
}

function getStemDirection(vf: VexflowModule, voice: VoiceId, index: number): number {
  if (voice === 'v1') return vf.Stem.UP;
  if (voice === 'v2') return vf.Stem.DOWN;
  if (voice === 'v3') return vf.Stem.UP;
  if (voice === 'v4') return vf.Stem.DOWN;
  return index % 2 === 0 ? vf.Stem.UP : vf.Stem.DOWN;
}

function applyPendingMarks(vf: VexflowModule, note: VexflowStaveNote, marks: MarkEvent[]) {
  for (const mark of marks) {
    if (isDynamicMark(mark.mark)) {
      note.addModifier(
        new vf.Annotation(mark.mark)
          .setJustification(vf.Annotation.HorizontalJustify.CENTER)
          .setVerticalJustification(vf.Annotation.VerticalJustify.BOTTOM),
        0
      );
      continue;
    }

    if (mark.mark === 'staccato' || mark.mark === 'accent') {
      const articulation = new vf.Articulation(mark.mark === 'staccato' ? 'a.' : 'a>');
      articulation.setPosition(vf.Modifier.Position.ABOVE);
      note.addModifier(articulation, 0);
      continue;
    }

    note.addModifier(
      new vf.Annotation(formatExpressionMark(mark.mark))
        .setJustification(vf.Annotation.HorizontalJustify.CENTER)
        .setVerticalJustification(vf.Annotation.VerticalJustify.TOP),
      0
    );
  }
}

function drawTies(vf: VexflowModule, context: VexflowContext, renderedNotes: RenderedEventNote[]) {
  const groups = new Map<string, RenderedEventNote[]>();

  for (const rendered of renderedNotes) {
    const key = `${rendered.staff}:${rendered.voice}`;
    groups.set(key, [...(groups.get(key) ?? []), rendered]);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.measure - b.measure);

    for (let index = 0; index < group.length - 1; index += 1) {
      const current = group[index];
      const next = group[index + 1];
      if (!current.event.tie || !playableEventsMatch(current.event, next.event)) continue;

      const firstIndexes = getTieIndexes(current.event);
      const lastIndexes = getTieIndexes(next.event);

      if (current.systemIndex === next.systemIndex) {
        new vf.StaveTie({
          firstNote: current.note,
          lastNote: next.note,
          firstIndexes,
          lastIndexes
        })
          .setContext(context)
          .draw();
      } else {
        new vf.StaveTie({
          firstNote: current.note,
          lastNote: null,
          firstIndexes,
          lastIndexes: firstIndexes
        })
          .setContext(context)
          .draw();
        new vf.StaveTie({
          firstNote: null,
          lastNote: next.note,
          firstIndexes: lastIndexes,
          lastIndexes
        })
          .setContext(context)
          .draw();
      }
    }
  }
}

function getTieIndexes(event: NoteEvent | ChordEvent): number[] {
  const count = event.type === 'chord' ? event.notes.length : 1;
  return Array.from({ length: count }, (_, index) => index);
}

function formatExpressionMark(mark: MarkEvent['mark']): string {
  switch (mark) {
    case 'crescendo':
      return 'cresc.';
    case 'diminuendo':
      return 'dim.';
    case 'pedal_on':
      return 'Ped.';
    case 'pedal_off':
      return '*';
    default:
      return mark;
  }
}

function restKey(staff: StaffName): string {
  return staff === 'treble' ? 'b/4' : 'd/3';
}

function durationToVexflow(event: Exclude<MusicEvent, MarkEvent>): string {
  let duration: string;

  switch (event.duration) {
    case 'w':
      duration = 'w';
      break;
    case 'h':
      duration = 'h';
      break;
    case 'q':
      duration = 'q';
      break;
    case 'e':
      duration = '8';
      break;
    case 's':
      duration = '16';
      break;
  }

  return event.dots > 0 ? `${duration}d` : duration;
}
