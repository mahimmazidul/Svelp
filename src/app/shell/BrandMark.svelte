<script lang="ts">
  let {
    size = 28,
    wordmark = false,
    tagline = false
  }: { size?: number; wordmark?: boolean; tagline?: boolean } = $props();
</script>

<span class="brand-mark">
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M14 24v-6a4 4 0 0 1 4-4h6"
      stroke="var(--color-accent)"
      stroke-width="3.5"
      stroke-linecap="round"
    />
    <path
      d="M40 14h6a4 4 0 0 1 4 4v6"
      stroke="var(--color-accent)"
      stroke-width="3.5"
      stroke-linecap="round"
    />
    <path
      d="M50 40v6a4 4 0 0 1-4 4h-6"
      stroke="var(--color-accent)"
      stroke-width="3.5"
      stroke-linecap="round"
    />
    <path
      d="M24 50h-6a4 4 0 0 1-4-4v-6"
      stroke="var(--color-accent)"
      stroke-width="3.5"
      stroke-linecap="round"
    />
    <rect x="23" y="18" width="18" height="28" rx="2.5" stroke="var(--color-ink)" stroke-width="3" />
    <path d="M27.5 26h9" stroke="var(--color-ink)" stroke-width="2.5" stroke-linecap="round" />
    <path d="M27.5 31.5h9" stroke="var(--color-ink)" stroke-width="2.5" stroke-linecap="round" />
    <path d="M27.5 37h5.5" stroke="var(--color-ink)" stroke-width="2.5" stroke-linecap="round" />
  </svg>
  {#if wordmark}
    <span class="brand-text">
      <span class="brand-name">Svelp</span>
      {#if tagline}<span class="brand-tagline">Survey Help, simplified.</span>{/if}
    </span>
  {/if}
</span>

<style>
  .brand-mark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .brand-mark svg {
    flex: none;
  }

  .brand-text {
    display: grid;
    line-height: var(--leading-tight);
  }

  .brand-name {
    font-weight: 650;
    font-size: var(--text-lg);
    letter-spacing: -0.01em;
    color: var(--color-ink);
  }

  .brand-tagline {
    font-size: var(--text-xs);
    color: var(--color-ink-3);
    white-space: nowrap;
  }
</style>
