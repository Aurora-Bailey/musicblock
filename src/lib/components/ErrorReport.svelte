<script lang="ts">
  import { AlertTriangle, Check, Copy } from '@lucide/svelte';
  import type { ValidationError } from '$lib/music/types';
  import { buildAgentRepairPrompt } from '$lib/music/errorReport';
  import { copyText } from '$lib/utils/clipboard';

  export let errors: ValidationError[] = [];
  export let sourceText = '';

  let copied = false;

  $: repairPrompt = buildAgentRepairPrompt(sourceText, errors);

  async function copyRepairPrompt() {
    const ok = await copyText(repairPrompt);
    if (!ok) return;
    copied = true;
    window.setTimeout(() => {
      copied = false;
    }, 1400);
  }
</script>

<section class="error-report" aria-live="polite">
  <div class="error-heading">
    <AlertTriangle size={22} aria-hidden="true" />
    <div>
      <h2>Import needs repair</h2>
      <p>Copy this report back to the agent and ask for a corrected Musicblock block.</p>
    </div>
  </div>

  <ul>
    {#each errors as error}
      <li>
        <strong>[{error.code}]</strong>
        <span>{error.message}</span>
        <small>{error.fixHint}</small>
      </li>
    {/each}
  </ul>

  <button class="button warning" type="button" on:click={copyRepairPrompt}>
    {#if copied}
      <Check size={18} aria-hidden="true" />
      <span>Copied repair prompt</span>
    {:else}
      <Copy size={18} aria-hidden="true" />
      <span>Copy repair prompt</span>
    {/if}
  </button>
</section>

<style>
  .error-report {
    background: #fff7ed;
    border: 1px solid #fdba74;
    border-radius: 8px;
    display: grid;
    gap: 18px;
    padding: 18px;
  }

  .error-heading {
    align-items: flex-start;
    color: #9a3412;
    display: flex;
    gap: 12px;
  }

  h2 {
    color: #7c2d12;
    font-size: 1.1rem;
    margin: 0 0 4px;
  }

  p {
    color: #9a3412;
    margin: 0;
  }

  ul {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(253, 186, 116, 0.65);
    border-radius: 8px;
    display: grid;
    gap: 4px;
    padding: 12px;
  }

  small {
    color: #9a3412;
    font-size: 0.9rem;
  }
</style>
