<script lang="ts">
  import { goto } from '$app/navigation';
  import { FileUp, RotateCcw } from '@lucide/svelte';
  import ErrorReport from './ErrorReport.svelte';
  import { EXAMPLE_PLACEHOLDER } from '$lib/music/instructionBlock';
  import { parseMusicBlock } from '$lib/music/parser';
  import { savePiece } from '$lib/music/storage';
  import type { ValidationError } from '$lib/music/types';
  import { createId } from '$lib/utils/ids';

  let sourceText = '';
  let errors: ValidationError[] = [];
  let touched = false;

  function importPiece() {
    touched = true;
    const result = parseMusicBlock(sourceText);

    if (!result.ok) {
      errors = result.errors;
      return;
    }

    const now = new Date().toISOString();
    const id = createId();
    savePiece({
      id,
      title: result.score.title,
      composer: result.score.composer,
      createdAt: now,
      updatedAt: now,
      sourceText,
      score: result.score
    });
    void goto(`/reader/${id}`);
  }

  function clearImport() {
    sourceText = '';
    errors = [];
    touched = false;
  }
</script>

<section class="import-panel">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Step 2</p>
      <h2>Paste the returned music block</h2>
    </div>
    <div class="actions">
      <button class="button" type="button" on:click={clearImport}>
        <RotateCcw size={18} aria-hidden="true" />
        <span>Clear</span>
      </button>
      <button class="button primary" type="button" on:click={importPiece}>
        <FileUp size={18} aria-hidden="true" />
        <span>Import piece</span>
      </button>
    </div>
  </div>

  <label for="musicblock-import">Musicblock block</label>
  <textarea
    id="musicblock-import"
    bind:value={sourceText}
    placeholder={EXAMPLE_PLACEHOLDER}
    spellcheck="false"
  ></textarea>

  {#if touched && errors.length > 0}
    <ErrorReport {errors} {sourceText} />
  {/if}
</section>

<style>
  .import-panel {
    display: grid;
    gap: 16px;
  }

  .section-heading {
    align-items: end;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }

  h2 {
    font-size: clamp(1.35rem, 3vw, 1.9rem);
    margin: 0;
  }

  label {
    color: var(--muted);
    font-weight: 700;
  }

  textarea {
    min-height: 360px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  @media (max-width: 760px) {
    .section-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .actions {
      justify-content: stretch;
    }

    .actions .button {
      flex: 1;
    }
  }
</style>
