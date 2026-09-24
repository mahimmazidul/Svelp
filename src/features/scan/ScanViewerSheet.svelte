<script lang="ts">
  import { dhon_scan_asset } from '../../db/scan_repo';
  import Sheet from '../../components/ui/Sheet.svelte';
  import EmptyState from '../../components/ui/EmptyState.svelte';
  import type { ScanPageRecord } from '../../models/scan_models';

  let {
    open,
    page,
    onclose
  }: {
    open: boolean;
    page: ScanPageRecord | null;
    onclose: () => void;
  } = $props();

  let bal_source_url = $state<string | null>(null);
  let bal_normalized_url = $state<string | null>(null);
  let bal_swipe = $state(50);
  let bal_wide = $state(true);
  let bal_loading = $state(false);

  function bal_revoke(bal_url: string | null): void {
    if (bal_url) URL.revokeObjectURL(bal_url);
  }

  $effect(() => {
    if (!open || !page) return;
    let bal_cancelled = false;
    bal_loading = true;
    void (async () => {
      const bal_source = page.sourceAssetId ? await dhon_scan_asset(page.sourceAssetId) : null;
      const bal_normalized = page.normalizedAssetId ? await dhon_scan_asset(page.normalizedAssetId) : null;
      if (bal_cancelled) return;
      bal_revoke(bal_source_url);
      bal_revoke(bal_normalized_url);
      bal_source_url = bal_source ? URL.createObjectURL(bal_source.bytes) : null;
      bal_normalized_url = bal_normalized ? URL.createObjectURL(bal_normalized.bytes) : null;
      bal_loading = false;
    })();
    return () => {
      bal_cancelled = true;
    };
  });

  $effect(() => {
    return () => {
      bal_revoke(bal_source_url);
      bal_revoke(bal_normalized_url);
    };
  });
</script>

<Sheet {open} title={page ? page.sourceName : 'Page viewer'} side="bottom" {onclose}>
  {#if page}
    <div class="viewer">
      <div class="mode-row">
        <button class="mode-btn" class:active={bal_wide} type="button" onclick={() => (bal_wide = true)}>Side by side</button>
        <button class="mode-btn" class:active={!bal_wide} type="button" onclick={() => (bal_wide = false)}>Swipe</button>
      </div>
      {#if bal_loading}
        <p class="hint">Loading images…</p>
      {:else if !bal_source_url && !bal_normalized_url}
        <EmptyState icon="eye" title="No images stored" body="The originals were removed and no normalized page is available." />
      {:else if bal_wide}
        <div class="wide">
          <figure>
            <figcaption>Original</figcaption>
            {#if bal_source_url}
              <img src={bal_source_url} alt="Original photo of {page.sourceName}" />
            {:else}
              <div class="missing">Original removed</div>
            {/if}
          </figure>
          <figure>
            <figcaption>Normalized</figcaption>
            {#if bal_normalized_url}
              <img src={bal_normalized_url} alt="Normalized page of {page.sourceName}" />
            {:else}
              <div class="missing">Not normalized</div>
            {/if}
          </figure>
        </div>
      {:else}
        <div class="swipe">
          {#if bal_normalized_url}
            <img class="base" src={bal_normalized_url} alt="Normalized page of {page.sourceName}" />
            {#if bal_source_url}
              <div class="clip" style="width: {bal_swipe}%">
                <img src={bal_source_url} alt="Original photo of {page.sourceName}" />
              </div>
            {/if}
            <input
              class="swipe-input"
              type="range"
              min="0"
              max="100"
              bind:value={bal_swipe}
              aria-label="Compare original and normalized"
            />
          {:else if bal_source_url}
            <img src={bal_source_url} alt="Original photo of {page.sourceName}" />
          {/if}
        </div>
      {/if}
      <dl class="facts">
        <div><dt>Status</dt><dd>{page.status}</dd></div>
        <div><dt>Rotation applied</dt><dd>{page.alignment?.rotationApplied ?? 0}°</dd></div>
        <div><dt>Markers found</dt><dd>{page.alignment?.markersFound ?? 0} of 4</dd></div>
        {#if page.transform}
          <div><dt>Output size</dt><dd>{page.transform.outWidth} × {page.transform.outHeight} px</dd></div>
        {/if}
        {#if page.payload}
          <div><dt>Code</dt><dd class="mono">{page.payload}</dd></div>
        {/if}
      </dl>
    </div>
  {/if}
</Sheet>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .mode-row {
    display: flex;
    gap: var(--space-2);
  }
  .mode-btn {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-full);
    border: var(--border-width) solid var(--color-border);
    background: var(--color-surface);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .mode-btn.active {
    background: var(--color-accent-soft, var(--color-surface-2));
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .wide {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
    margin-bottom: var(--space-1);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  img {
    width: 100%;
    height: auto;
    max-height: 46vh;
    object-fit: contain;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
  }
  .missing {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .swipe {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .swipe .base {
    width: 100%;
    max-height: 52vh;
    object-fit: contain;
    display: block;
  }
  .clip {
    position: absolute;
    inset: 0 auto 0 0;
    overflow: hidden;
    border-right: 2px solid var(--color-accent);
  }
  .clip img {
    width: auto;
    height: 100%;
    max-height: 52vh;
    object-fit: cover;
    display: block;
  }
  .swipe-input {
    width: 100%;
    margin-top: var(--space-2);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
    margin: 0;
  }
  .facts div {
    display: flex;
    flex-direction: column;
  }
  dt {
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }
  dd {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .mono {
    font-family: var(--font-mono, monospace);
  }
  .hint {
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  @media (max-width: 640px) {
    .wide {
      grid-template-columns: 1fr;
    }
  }
</style>
