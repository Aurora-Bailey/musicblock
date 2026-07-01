<script lang="ts">
  import ImportPanel from '$lib/components/ImportPanel.svelte';
  import InstructionBlock from '$lib/components/InstructionBlock.svelte';
</script>

<svelte:head>
  <title>Import | Musicblock</title>
</svelte:head>

<main class="page">
  <div class="flow">
    <InstructionBlock />
    <ImportPanel />
  </div>
</main>
