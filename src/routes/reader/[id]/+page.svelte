<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PlaybackControls from '$lib/components/PlaybackControls.svelte';
  import ScoreRenderer from '$lib/components/ScoreRenderer.svelte';
  import { getMeasureStartUnits } from '$lib/music/playback';
  import { getPiece } from '$lib/music/storage';
  import type { SavedPiece } from '$lib/music/types';

  let piece: SavedPiece | null = null;
  let cursorUnits = 0;
  let selectedMeasure = 1;
  let beginnerGuide = true;

  onMount(() => {
    const id = $page.params.id;
    piece = id ? getPiece(id) : null;
    cursorUnits = 0;
    selectedMeasure = 1;
  });

  function updateCursor(nextCursorUnits: number, nextMeasure: number) {
    cursorUnits = nextCursorUnits;
    selectedMeasure = nextMeasure;
  }

  function selectMeasure(measure: number) {
    if (!piece) return;
    selectedMeasure = measure;
    cursorUnits = getMeasureStartUnits(piece.score, measure);
  }
</script>

<svelte:head>
  <title>{piece?.title ?? 'Reader'} | Musicblock</title>
</svelte:head>

<main class="page reader-page">
  {#if piece}
    <header class="score-heading">
      <div>
        <p class="eyebrow">Score reader</p>
        <h1>{piece.title}</h1>
        {#if piece.composer}
          <p class="composer">{piece.composer}</p>
        {/if}
      </div>
      <dl>
        <div>
          <dt>Key</dt>
          <dd>{piece.score.key}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{piece.score.time.raw}</dd>
        </div>
        <div>
          <dt>Tempo</dt>
          <dd>{piece.score.tempo}</dd>
        </div>
      </dl>
    </header>
    <PlaybackControls
      {piece}
      {selectedMeasure}
      {beginnerGuide}
      onCursorUpdate={updateCursor}
      onMeasureSelect={selectMeasure}
      onBeginnerGuideChange={(enabled) => (beginnerGuide = enabled)}
    />
    <ScoreRenderer {piece} {cursorUnits} {selectedMeasure} {beginnerGuide} />
  {:else}
    <EmptyState title="Piece not found." body="Return to the library and choose another score." actionHref="/library" actionText="Open library" />
  {/if}
</main>

<style>
  .reader-page {
    max-width: 1280px;
    padding-bottom: clamp(170px, 24vh, 260px);
    padding-left: clamp(12px, 2.5vw, 24px);
    padding-right: clamp(12px, 2.5vw, 24px);
  }

  .score-heading {
    align-items: end;
    display: flex;
    gap: 20px;
    justify-content: space-between;
    margin-bottom: 22px;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 4rem);
    margin: 0;
  }

  .composer {
    color: var(--muted);
    margin: 8px 0 0;
  }

  dl {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    display: flex;
    gap: 20px;
    margin: 0;
    padding: 14px 16px;
  }

  dt {
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  dd {
    font-size: 1.05rem;
    margin: 3px 0 0;
  }

  @media (max-width: 720px) {
    .score-heading {
      align-items: stretch;
      flex-direction: column;
    }

    dl {
      flex-wrap: wrap;
    }
  }

  @media (max-width: 520px) {
    .reader-page {
      padding-left: 10px;
      padding-right: 10px;
    }
  }
</style>
