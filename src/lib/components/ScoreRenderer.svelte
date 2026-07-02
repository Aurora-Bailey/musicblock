<script lang="ts">
  import { onMount } from 'svelte';
  import { getActiveNotesAtUnits } from '$lib/music/playback';
  import type { SavedPiece } from '$lib/music/types';
  import { renderScore, type ScoreLayout, type ScoreMeasureLayout } from '$lib/music/vexflowRender';

  export let piece: SavedPiece;
  export let cursorUnits = 0;
  export let selectedMeasure = 1;
  export let beginnerGuide = true;

  let shell: HTMLDivElement;
  let container: HTMLDivElement;
  let layout: ScoreLayout | null = null;
  let renderError: string | null = null;
  let details: string | null = null;
  let lastRenderedWidth = 0;
  let frame: number | null = null;
  let renderToken = 0;
  let lastScrolledMeasure = 0;

  $: activeMeasure = getActiveMeasureLayout(layout, cursorUnits, selectedMeasure);
  $: activeNotes = getActiveNotesAtUnits(piece.score, cursorUnits);
  $: cursorX = activeMeasure ? getCursorX(activeMeasure, cursorUnits, layout?.measureUnits ?? 1) : 0;
  $: labelX = layout ? clampGuideX(layout.width, cursorX) : cursorX;
  $: cursorHeight = activeMeasure ? activeMeasure.bottom - activeMeasure.top : 0;
  $: if (layout && selectedMeasure !== lastScrolledMeasure) {
    queueScrollToMeasure(selectedMeasure);
  }

  async function draw(force = false) {
    if (!container) return;

    const width = Math.floor(container.getBoundingClientRect().width);
    if (!force && Math.abs(width - lastRenderedWidth) < 2) return;

    lastRenderedWidth = width;
    const token = ++renderToken;
    renderError = null;
    details = null;

    try {
      const nextLayout = await renderScore(container, piece);
      if (token !== renderToken) return;
      layout = nextLayout;
      queueScrollToMeasure(selectedMeasure);
    } catch (error) {
      if (token !== renderToken) return;
      renderError = 'This piece imported successfully, but rendering failed.';
      details = error instanceof Error ? error.stack ?? error.message : String(error);
    }
  }

  function queueDraw(force = false) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      void draw(force);
    });
  }

  onMount(() => {
    queueDraw(true);
    const resizeObserver = new ResizeObserver(() => {
      queueDraw();
    });
    resizeObserver.observe(container);

    return () => {
      renderToken += 1;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  });

  function getActiveMeasureLayout(
    scoreLayout: ScoreLayout | null,
    units: number,
    fallbackMeasure: number
  ): ScoreMeasureLayout | null {
    if (!scoreLayout) return null;

    return (
      scoreLayout.measures.find((measure) => units >= measure.startUnits && units < measure.endUnits)
      ?? scoreLayout.measures.find((measure) => measure.measure === fallbackMeasure)
      ?? scoreLayout.measures[0]
      ?? null
    );
  }

  function getCursorX(measure: ScoreMeasureLayout, units: number, measureUnits: number): number {
    const unitsIntoMeasure = Math.max(0, Math.min(measureUnits, units - measure.startUnits));
    return measure.x + (unitsIntoMeasure / measureUnits) * measure.width;
  }

  function clampGuideX(width: number, x: number): number {
    const margin = Math.min(112, Math.max(52, width / 2 - 8));
    return Math.max(margin, Math.min(width - margin, x));
  }

  function queueScrollToMeasure(measureNumber: number) {
    if (typeof window === 'undefined' || !shell || !layout) return;
    lastScrolledMeasure = measureNumber;

    requestAnimationFrame(() => {
      const measure = layout?.measures.find((entry) => entry.measure === measureNumber);
      if (!measure || !shell) return;

      const shellRect = shell.getBoundingClientRect();
      const measureTop = shellRect.top + measure.top;
      const measureBottom = shellRect.top + measure.bottom;
      const topLimit = 92;
      const bottomLimit = window.innerHeight - 44;

      if (measureTop < topLimit || measureBottom > bottomLimit) {
        window.scrollTo({
          top: window.scrollY + measureTop - 124,
          behavior: 'smooth'
        });
      }
    });
  }
</script>

{#if renderError}
  <section class="render-error">
    <h2>{renderError}</h2>
    {#if details}
      <details>
        <summary>Technical details</summary>
        <pre>{details}</pre>
      </details>
    {/if}
  </section>
{/if}

<div class="score-shell" bind:this={shell}>
  <div class="score-canvas" bind:this={container} aria-label={`Rendered score for ${piece.title}`}></div>

  {#if activeMeasure}
    <div
      class="active-measure"
      style={`left: ${activeMeasure.x}px; top: ${activeMeasure.top}px; width: ${activeMeasure.width}px; height: ${cursorHeight}px;`}
      aria-hidden="true"
    ></div>
    <div
      class="score-cursor"
      style={`left: ${cursorX}px; top: ${activeMeasure.top}px; height: ${cursorHeight}px;`}
      aria-hidden="true"
    ></div>
    {#if beginnerGuide && activeNotes.treble.length > 0}
      <span
        class="note-guide treble-guide"
        style={`left: ${labelX}px; top: ${activeMeasure.top - 32}px;`}
        aria-hidden="true"
      >
        {#each activeNotes.treble as note}
          <span class:black-key={note.isBlackKey} class:white-key={!note.isBlackKey} class="note-bubble">
            {note.letter}
          </span>
        {/each}
      </span>
    {/if}

    {#if beginnerGuide && activeNotes.bass.length > 0}
      <span
        class="note-guide bass-guide"
        style={`left: ${labelX}px; top: ${activeMeasure.bottom + 6}px;`}
        aria-hidden="true"
      >
        {#each activeNotes.bass as note}
          <span class:black-key={note.isBlackKey} class:white-key={!note.isBlackKey} class="note-bubble">
            {note.letter}
          </span>
        {/each}
      </span>
    {/if}
  {/if}
</div>

<style>
  .score-shell {
    position: relative;
  }

  .score-canvas {
    background: #fffdf8;
    border: 1px solid var(--line);
    border-radius: 8px;
    min-height: 420px;
    max-width: 100%;
    overflow-x: hidden;
    padding: 0;
    width: 100%;
  }

  .active-measure,
  .score-cursor {
    pointer-events: none;
    position: absolute;
    z-index: 2;
  }

  .active-measure {
    background: rgba(72, 139, 198, 0.13);
    border-radius: 3px;
  }

  .score-cursor {
    border-left: 3px solid #111;
  }

  .note-guide {
    align-items: center;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(17, 17, 17, 0.58);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
    display: flex;
    gap: 4px;
    max-width: min(220px, 52vw);
    overflow: hidden;
    padding: 4px;
    position: absolute;
    transform: translateX(-50%);
    z-index: 3;
  }

  .note-bubble {
    align-items: center;
    border: 1px solid #111;
    border-radius: 8px;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: clamp(0.72rem, 2.2vw, 0.95rem);
    font-weight: 800;
    height: 25px;
    justify-content: center;
    line-height: 1;
    min-width: 24px;
    padding: 0 6px;
  }

  .note-bubble.white-key {
    background: #fff;
    color: #111;
  }

  .note-bubble.black-key {
    background: #111;
    color: #fff;
  }

  .score-canvas :global(svg) {
    display: block;
    height: auto;
    max-width: 100%;
    width: 100%;
  }

  .render-error {
    background: #fff7ed;
    border: 1px solid #fdba74;
    border-radius: 8px;
    margin-bottom: 18px;
    padding: 16px;
  }

  .render-error h2 {
    color: #7c2d12;
    font-size: 1.05rem;
    margin: 0 0 10px;
  }

  pre {
    overflow-x: auto;
    white-space: pre-wrap;
  }
</style>
