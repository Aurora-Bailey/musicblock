<script lang="ts">
  import { Check, Copy } from '@lucide/svelte';
  import { MUSICBLOCK_INSTRUCTION_BLOCK } from '$lib/music/instructionBlock';
  import { copyText } from '$lib/utils/clipboard';

  let copied = false;

  async function copyInstructions() {
    const ok = await copyText(MUSICBLOCK_INSTRUCTION_BLOCK);
    if (!ok) return;
    copied = true;
    window.setTimeout(() => {
      copied = false;
    }, 1400);
  }
</script>

<section class="instruction-block">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Step 1</p>
      <h1>Copy the Musicblock rules</h1>
    </div>
    <button class="button primary" type="button" on:click={copyInstructions}>
      {#if copied}
        <Check size={18} aria-hidden="true" />
        <span>Copied</span>
      {:else}
        <Copy size={18} aria-hidden="true" />
        <span>Copy</span>
      {/if}
    </button>
  </div>
  <textarea aria-label="Musicblock instruction block" readonly value={MUSICBLOCK_INSTRUCTION_BLOCK}></textarea>
</section>

<style>
  .instruction-block {
    display: grid;
    gap: 16px;
  }

  .section-heading {
    align-items: end;
    display: flex;
    gap: 16px;
    justify-content: space-between;
  }

  h1 {
    font-size: clamp(1.6rem, 3vw, 2.35rem);
    margin: 0;
  }

  textarea {
    min-height: 360px;
  }

  @media (max-width: 680px) {
    .section-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
