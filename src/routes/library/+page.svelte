<script lang="ts">
  import { onMount } from 'svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PieceCard from '$lib/components/PieceCard.svelte';
  import {
    deletePiece,
    duplicatePiece,
    getPieces,
    renamePiece
  } from '$lib/music/storage';
  import type { SavedPiece } from '$lib/music/types';

  let pieces: SavedPiece[] = [];

  function refresh() {
    pieces = getPieces().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  function handleDuplicate(id: string) {
    duplicatePiece(id);
    refresh();
  }

  function handleRename(id: string, title: string) {
    renamePiece(id, title);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this piece?')) return;
    deletePiece(id);
    refresh();
  }

  onMount(refresh);
</script>

<svelte:head>
  <title>Library | Musicblock</title>
</svelte:head>

<main class="page">
  <div class="library-heading">
    <div>
      <p class="eyebrow">Local library</p>
      <h1>Saved pieces</h1>
    </div>
    <a class="button primary" href="/import">Import score</a>
  </div>

  {#if pieces.length === 0}
    <EmptyState title="No pieces yet." body="Import your first score." />
  {:else}
    <section class="piece-grid" aria-label="Saved pieces">
      {#each pieces as piece (piece.id)}
        <PieceCard
          {piece}
          onDuplicate={handleDuplicate}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      {/each}
    </section>
  {/if}
</main>

<style>
  .library-heading {
    align-items: end;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    margin-bottom: 28px;
  }

  h1 {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    margin: 0;
  }

  .piece-grid {
    display: grid;
    gap: 14px;
  }

  @media (max-width: 680px) {
    .library-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
