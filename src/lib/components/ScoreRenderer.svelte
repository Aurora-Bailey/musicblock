<script lang="ts">
  import { onMount } from 'svelte';
  import type { SavedPiece } from '$lib/music/types';
  import { renderScore } from '$lib/music/vexflowRender';

  export let piece: SavedPiece;

  let container: HTMLDivElement;
  let renderError: string | null = null;
  let details: string | null = null;
  let lastRenderedWidth = 0;
  let frame: number | null = null;
  let renderToken = 0;

  async function draw(force = false) {
    if (!container) return;

    const width = Math.floor(container.getBoundingClientRect().width);
    if (!force && Math.abs(width - lastRenderedWidth) < 2) return;

    lastRenderedWidth = width;
    const token = ++renderToken;
    renderError = null;
    details = null;

    try {
      await renderScore(container, piece);
      if (token !== renderToken) return;
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

<div class="score-canvas" bind:this={container} aria-label={`Rendered score for ${piece.title}`}></div>

<style>
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
