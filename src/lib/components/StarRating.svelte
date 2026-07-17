<script lang="ts">
  import { Star } from '@lucide/svelte';
  import type { StarRatingValue } from '$lib/music/types';

  export let rating: StarRatingValue | undefined = undefined;
  export let interactive = false;
  export let label = 'Piece rating';
  export let onRate: (rating: StarRatingValue) => void = () => {};

  const stars = [1, 2, 3, 4, 5] as StarRatingValue[];

  function isFilled(star: StarRatingValue) {
    return Boolean(rating && star <= rating);
  }
</script>

<div
  class:interactive
  class="star-rating"
  role={interactive ? 'radiogroup' : 'img'}
  aria-label={rating ? `${label}: ${rating} out of 5 stars` : `${label}: not rated`}
>
  {#each stars as star}
    {#if interactive}
      <button
        class:filled={isFilled(star)}
        class="star-button"
        type="button"
        role="radio"
        aria-checked={rating === star}
        aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
        title={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
        on:click={() => onRate(star)}
      >
        <Star size={18} fill={isFilled(star) ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    {:else}
      <span class:filled={isFilled(star)} class="star-display" aria-hidden="true">
        <Star size={16} fill={isFilled(star) ? 'currentColor' : 'none'} />
      </span>
    {/if}
  {/each}
</div>

<style>
  .star-rating {
    align-items: center;
    color: #9a7a25;
    display: inline-flex;
    gap: 2px;
    min-height: 24px;
  }

  .star-button,
  .star-display {
    align-items: center;
    color: #b8aa8b;
    display: inline-flex;
    flex: 0 0 auto;
    height: 26px;
    justify-content: center;
    width: 26px;
  }

  .star-button {
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
  }

  .star-button:hover,
  .star-button:focus-visible {
    background: rgba(197, 133, 18, 0.12);
  }

  .filled {
    color: #c58512;
  }
</style>
