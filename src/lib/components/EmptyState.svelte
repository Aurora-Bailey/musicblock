<script lang="ts">
  import { FileUp } from '@lucide/svelte';

  export let title = 'No pieces yet.';
  export let body = 'Import your first score.';
  export let actionHref = '/import';
  export let actionText = 'Import score';
</script>

<section class="empty-state">
  <div class="icon-wrap">
    <FileUp size={28} aria-hidden="true" />
  </div>
  <h1>{title}</h1>
  <p>{body}</p>
  <a class="button primary" href={actionHref}>{actionText}</a>
</section>

<style>
  .empty-state {
    align-items: center;
    border: 1px dashed var(--line-strong);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    margin: 48px auto;
    max-width: 620px;
    padding: 52px 24px;
    text-align: center;
  }

  .icon-wrap {
    align-items: center;
    background: var(--accent-soft);
    border-radius: 8px;
    color: var(--accent);
    display: inline-flex;
    height: 56px;
    justify-content: center;
    margin-bottom: 18px;
    width: 56px;
  }

  h1 {
    font-size: clamp(1.5rem, 3vw, 2rem);
    margin: 0 0 8px;
  }

  p {
    color: var(--muted);
    margin: 0 0 24px;
  }
</style>
