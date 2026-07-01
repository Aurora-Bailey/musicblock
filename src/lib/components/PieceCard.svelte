<script lang="ts">
  import { Check, Copy, CopyPlus, ExternalLink, Pencil, Trash2 } from '@lucide/svelte';
  import type { SavedPiece } from '$lib/music/types';
  import { copyText } from '$lib/utils/clipboard';

  export let piece: SavedPiece;
  export let onDuplicate: (id: string) => void;
  export let onRename: (id: string, title: string) => void;
  export let onDelete: (id: string) => void;

  let copied = false;
  let editing = false;
  let draftTitle = piece.title;

  $: if (!editing) draftTitle = piece.title;

  async function copySource() {
    const ok = await copyText(piece.sourceText);
    if (!ok) return;
    copied = true;
    window.setTimeout(() => {
      copied = false;
    }, 1400);
  }

  function submitRename() {
    onRename(piece.id, draftTitle);
    editing = false;
  }
</script>

<article class="piece-card">
  <div class="piece-main">
    {#if editing}
      <form class="rename-form" on:submit|preventDefault={submitRename}>
        <input aria-label="Piece title" bind:value={draftTitle} />
        <button class="icon-button" type="submit" title="Save title">
          <Check size={18} aria-hidden="true" />
        </button>
      </form>
    {:else}
      <h2>{piece.title}</h2>
    {/if}
    {#if piece.composer}
      <p>{piece.composer}</p>
    {/if}
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
      <div>
        <dt>Imported</dt>
        <dd>{new Date(piece.createdAt).toLocaleDateString()}</dd>
      </div>
    </dl>
  </div>

  <div class="card-actions">
    <a class="icon-button" href={`/reader/${piece.id}`} title="Open score">
      <ExternalLink size={18} aria-hidden="true" />
    </a>
    <button class="icon-button" type="button" on:click={() => (editing = true)} title="Rename">
      <Pencil size={18} aria-hidden="true" />
    </button>
    <button class="icon-button" type="button" on:click={() => onDuplicate(piece.id)} title="Duplicate">
      <CopyPlus size={18} aria-hidden="true" />
    </button>
    <button class="icon-button" type="button" on:click={copySource} title="Copy source">
      {#if copied}
        <Check size={18} aria-hidden="true" />
      {:else}
        <Copy size={18} aria-hidden="true" />
      {/if}
    </button>
    <button class="icon-button danger" type="button" on:click={() => onDelete(piece.id)} title="Delete">
      <Trash2 size={18} aria-hidden="true" />
    </button>
  </div>
</article>

<style>
  .piece-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    padding: 18px;
  }

  .piece-main {
    min-width: 0;
  }

  h2 {
    font-size: 1.15rem;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }

  p {
    color: var(--muted);
    margin: 0 0 14px;
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin: 0;
  }

  dt {
    color: var(--muted);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  dd {
    margin: 3px 0 0;
  }

  .card-actions {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(5, 38px);
  }

  .rename-form {
    align-items: center;
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  input {
    min-width: 0;
  }

  @media (max-width: 760px) {
    .piece-card {
      flex-direction: column;
    }

    .card-actions {
      display: flex;
      flex-wrap: wrap;
    }
  }
</style>
