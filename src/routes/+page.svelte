<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getPieces } from '$lib/music/storage';

  onMount(() => {
    const pieces = getPieces();
    void goto(pieces.length > 0 ? '/library' : '/import', { replaceState: true });
  });
</script>

<main class="page narrow">
  <p>Loading Musicblock...</p>
</main>
