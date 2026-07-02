<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Pause, Play, Repeat2, RotateCcw, SkipBack, SkipForward, Square, Volume2 } from '@lucide/svelte';
  import {
    getAdjacentMeasure,
    getMeasureForUnits,
    getMeasureStartUnits,
    getPlaybackCursorUnits,
    pausePlayback,
    PLAYBACK_VOICE_OPTIONS,
    playScore,
    resumePlayback,
    setPlaybackVolume,
    stopPlayback,
    type PlaybackVoiceId,
    type StaffVoices
  } from '$lib/music/playback';
  import type { SavedPiece } from '$lib/music/types';

  export let piece: SavedPiece;
  export let selectedMeasure = 1;
  export let beginnerGuide = true;
  export let onCursorUpdate: (cursorUnits: number, selectedMeasure: number) => void = () => {};
  export let onMeasureSelect: (measure: number) => void = () => {};
  export let onBeginnerGuideChange: (enabled: boolean) => void = () => {};

  type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

  let state: PlaybackState = 'idle';
  let errorMessage = '';
  let volume = 0.8;
  let repeatBar = false;
  let voices: StaffVoices = {
    treble: 'piano',
    bass: 'piano'
  };
  let progressFrame: number | null = null;

  async function play(measure = selectedMeasure) {
    errorMessage = '';

    if (state === 'paused') {
      try {
        await resumePlayback();
        state = 'playing';
      } catch (error) {
        showError(error);
      }
      return;
    }

    state = 'loading';
    try {
      await playScore(piece.score, {
        volume,
        voices,
        startMeasure: measure,
        loopMeasure: repeatBar ? measure : undefined,
        onEnded: () => {
          state = 'idle';
          stopProgressLoop();
        }
      });
      state = 'playing';
      startProgressLoop();
    } catch (error) {
      showError(error);
    }
  }

  function pause() {
    pausePlayback();
    stopProgressLoop();
    state = 'paused';
  }

  function stop() {
    stopPlayback();
    stopProgressLoop();
    state = 'idle';
    moveCursorToMeasure(selectedMeasure);
  }

  function reset() {
    stopPlayback();
    stopProgressLoop();
    errorMessage = '';
    state = 'idle';
    repeatBar = false;
    onMeasureSelect(1);
    onCursorUpdate(0, 1);
  }

  function changeVolume(event: Event) {
    volume = Number((event.currentTarget as HTMLInputElement).value);
    setPlaybackVolume(volume);
  }

  function changeVoice(staff: keyof StaffVoices, event: Event) {
    voices = {
      ...voices,
      [staff]: (event.currentTarget as HTMLSelectElement).value as PlaybackVoiceId
    };

    if (state === 'playing') {
      stopPlayback();
      stopProgressLoop();
      void play(selectedMeasure);
    }
  }

  function showError(error: unknown) {
    state = 'error';
    errorMessage = error instanceof Error ? error.message : 'Playback could not start.';
  }

  function moveMeasure(direction: -1 | 1) {
    const nextMeasure = getAdjacentMeasure(piece.score, selectedMeasure, direction);
    onMeasureSelect(nextMeasure);
    moveCursorToMeasure(nextMeasure);

    if (state === 'playing') {
      stopPlayback();
      stopProgressLoop();
      void play(nextMeasure);
    } else if (state === 'paused') {
      stopPlayback();
      stopProgressLoop();
      state = 'idle';
    }
  }

  function toggleRepeatBar() {
    repeatBar = !repeatBar;

    if (state === 'playing') {
      stopPlayback();
      stopProgressLoop();
      void play(selectedMeasure);
    }
  }

  function toggleBeginnerGuide(event: Event) {
    beginnerGuide = (event.currentTarget as HTMLInputElement).checked;
    onBeginnerGuideChange(beginnerGuide);
  }

  function moveCursorToMeasure(measure: number) {
    onCursorUpdate(getMeasureStartUnits(piece.score, measure), measure);
  }

  function startProgressLoop() {
    stopProgressLoop();

    const tick = () => {
      const cursorUnits = getPlaybackCursorUnits(piece.score);
      onCursorUpdate(cursorUnits, getMeasureForUnits(piece.score, cursorUnits));
      progressFrame = requestAnimationFrame(tick);
    };

    progressFrame = requestAnimationFrame(tick);
  }

  function stopProgressLoop() {
    if (progressFrame) {
      cancelAnimationFrame(progressFrame);
      progressFrame = null;
    }
  }

  onDestroy(() => {
    stopProgressLoop();
    stopPlayback();
  });
</script>

<section class="playback-controls" aria-label="Playback controls">
  <div class="transport">
    <button class="icon-button" type="button" on:click={() => moveMeasure(-1)} title="Last bar">
      <SkipBack size={18} aria-hidden="true" />
    </button>

    {#if state === 'playing'}
      <button class="button primary" type="button" on:click={pause}>
        <Pause size={18} aria-hidden="true" />
        <span>Pause</span>
      </button>
    {:else}
      <button class="button primary" type="button" on:click={() => play()} disabled={state === 'loading'}>
        <Play size={18} aria-hidden="true" />
        <span>{state === 'loading' ? 'Loading piano' : state === 'paused' ? 'Resume' : 'Play'}</span>
      </button>
    {/if}

    <button class="icon-button" type="button" on:click={() => moveMeasure(1)} title="Next bar">
      <SkipForward size={18} aria-hidden="true" />
    </button>

    <button class="icon-button" type="button" on:click={stop} title="Stop playback">
      <Square size={18} aria-hidden="true" />
    </button>

    <button class="icon-button" type="button" on:click={reset} disabled={state === 'loading'} title="Reset to first bar">
      <RotateCcw size={18} aria-hidden="true" />
    </button>

    <button
      class:active={repeatBar}
      class="icon-button"
      type="button"
      on:click={toggleRepeatBar}
      title="Repeat bar"
      aria-pressed={repeatBar}
    >
      <Repeat2 size={18} aria-hidden="true" />
    </button>
  </div>

  <label class="guide-toggle">
    <input type="checkbox" checked={beginnerGuide} on:change={toggleBeginnerGuide} />
    <span>Beginner guide</span>
  </label>

  <div class="voice-settings" aria-label="Voice settings">
    <label>
      <span>Treble</span>
      <select value={voices.treble} on:change={(event) => changeVoice('treble', event)}>
        {#each PLAYBACK_VOICE_OPTIONS as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>Bass</span>
      <select value={voices.bass} on:change={(event) => changeVoice('bass', event)}>
        {#each PLAYBACK_VOICE_OPTIONS as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="volume">
    <Volume2 size={18} aria-hidden="true" />
    <span>Volume</span>
    <input
      aria-label="Playback volume"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      on:input={changeVolume}
    />
  </label>

  {#if state === 'error'}
    <p class="playback-error" role="alert">{errorMessage}</p>
  {/if}
</section>

<style>
  .playback-controls {
    align-items: center;
    background: rgba(255, 250, 241, 0.96);
    border: 1px solid var(--line);
    border-radius: 8px;
    bottom: max(12px, env(safe-area-inset-bottom));
    box-shadow: 0 12px 36px rgba(38, 37, 34, 0.2);
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: space-between;
    left: 50%;
    margin: 0;
    padding: 12px;
    position: fixed;
    transform: translateX(-50%);
    width: min(1224px, calc(100vw - 24px));
    z-index: 30;
  }

  .transport,
  .guide-toggle,
  .voice-settings,
  .voice-settings label,
  .volume {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .guide-toggle {
    color: var(--muted);
    font-weight: 800;
  }

  .voice-settings {
    flex-wrap: wrap;
  }

  .voice-settings label {
    color: var(--muted);
    font-weight: 800;
  }

  .voice-settings select {
    background: #fffdf8;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    color: var(--ink);
    font-weight: 700;
    min-height: 36px;
    padding: 0 28px 0 10px;
  }

  .guide-toggle input {
    accent-color: var(--accent);
    height: 18px;
    width: 18px;
  }

  .volume {
    color: var(--muted);
    font-weight: 700;
    min-width: min(100%, 280px);
  }

  .volume input {
    accent-color: var(--accent);
    min-width: 150px;
    padding: 0;
  }

  .playback-error {
    color: #9a3412;
    flex-basis: 100%;
    font-size: 0.92rem;
    margin: 0;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .icon-button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  @media (max-width: 620px) {
    .playback-controls,
    .transport,
    .guide-toggle,
    .voice-settings,
    .voice-settings label,
    .volume {
      align-items: stretch;
      width: 100%;
    }

    .playback-controls {
      flex-direction: column;
    }

    .transport {
      display: grid;
      grid-template-columns: 42px 1fr 42px 42px 42px 42px;
    }

    .voice-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .voice-settings label {
      flex-direction: column;
      gap: 4px;
    }
  }
</style>
