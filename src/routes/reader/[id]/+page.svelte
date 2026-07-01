<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ScoreRenderer from '$lib/components/ScoreRenderer.svelte';
  import { getPiece } from '$lib/music/storage';
  import type { SavedPiece } from '$lib/music/types';

  let piece: SavedPiece | null = null;

  onMount(() => {
    const id = $page.params.id;
    piece = id ? getPiece(id) : null;
  });
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
    <ScoreRenderer {piece} />
  {:else}
    <EmptyState title="Piece not found." body="Return to the library and choose another score." actionHref="/library" actionText="Open library" />
  {/if}
</main>

<style>
  .reader-page {
    max-width: 1280px;
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
