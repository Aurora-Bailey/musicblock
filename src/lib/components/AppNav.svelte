<script lang="ts">
  import { FileUp, Library, Music2 } from '@lucide/svelte';
</script>

<header class="app-nav">
  <a class="brand" href="/">
    <Music2 size={22} aria-hidden="true" />
    <span>Musicblock</span>
  </a>
  <nav aria-label="Primary navigation">
    <a href="/library">
      <Library size={18} aria-hidden="true" />
      <span>Library</span>
    </a>
    <a href="/import">
      <FileUp size={18} aria-hidden="true" />
      <span>Import</span>
    </a>
  </nav>
</header>

<style>
  .app-nav {
    align-items: center;
    background: rgba(250, 248, 243, 0.92);
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    min-height: 64px;
    padding: 0 28px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .brand,
  nav a {
    align-items: center;
    color: var(--ink);
    display: inline-flex;
    gap: 8px;
    text-decoration: none;
  }

  .brand {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 700;
  }

  nav {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  nav a {
    border-radius: 8px;
    color: var(--muted);
    font-size: 0.95rem;
    min-height: 40px;
    padding: 0 12px;
  }

  nav a:hover,
  nav a:focus-visible {
    background: var(--surface-strong);
    color: var(--ink);
    outline: none;
  }

  @media (max-width: 580px) {
    .app-nav {
      padding: 0 16px;
    }

    .brand span {
      display: none;
    }
  }
</style>
