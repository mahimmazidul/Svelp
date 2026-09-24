<script lang="ts">
  import { dhon_scan_asset } from '../../db/scan_repo';
  import Sheet from '../../components/ui/Sheet.svelte';
  import Button from '../../components/ui/Button.svelte';
  import type { ScanPageRecord } from '../../models/scan_models';
  import { bal_format_bytes } from './scan_ui_helpers';

  let {
    open,
    pair,
    onresolve,
    onclose
  }: {
    open: boolean;
    pair: { a: ScanPageRecord; b: ScanPageRecord } | null;
    onresolve: (bal_resolution: 'keep-a' | 'keep-b' | 'keep-both' | 'reject') => void;
    onclose: () => void;
  } = $props();

  let bal_url_a = $state<string | null>(null);
  let bal_url_b = $state<string | null>(null);

  function bal_prefer(bal_page: ScanPageRecord): string {
    return bal_page.normalizedAssetId ?? bal_page.sourceAssetId ?? '';
  }

  $effect(() => {
    if (!open || !pair) return;
    let bal_cancelled = false;
    void (async () => {
      const bal_asset_a = bal_prefer(pair.a) ? await dhon_scan_asset(bal_prefer(pair.a)) : null;
      const bal_asset_b = bal_prefer(pair.b) ? await dhon_scan_asset(bal_prefer(pair.b)) : null;
      if (bal_cancelled) return;
      if (bal_url_a) URL.revokeObjectURL(bal_url_a);
      if (bal_url_b) URL.revokeObjectURL(bal_url_b);
      bal_url_a = bal_asset_a ? URL.createObjectURL(bal_asset_a.bytes) : null;
      bal_url_b = bal_asset_b ? URL.createObjectURL(bal_asset_b.bytes) : null;
    })();
    return () => {
      bal_cancelled = true;
    };
  });

  $effect(() => {
    return () => {
      if (bal_url_a) URL.revokeObjectURL(bal_url_a);
      if (bal_url_b) URL.revokeObjectURL(bal_url_b);
    };
  });

  function bal_quality_line(bal_page: ScanPageRecord): string {
    if (!bal_page.quality) return 'No quality data';
    if (bal_page.quality.overallStatus === 'good') return 'Quality: good';
    if (bal_page.quality.overallStatus === 'warning') return `Quality: warnings — ${bal_page.quality.qualityIssues[0] ?? ''}`;
    return `Quality: problems — ${bal_page.quality.qualityIssues[0] ?? ''}`;
  }
</script>

<Sheet {open} title="Compare duplicates" side="bottom" {onclose}>
  {#if pair}
    <div class="compare">
      {#if pair.a.id === pair.b.id}
        <p class="context">
          {pair.a.sourceName} is marked as a duplicate, but no second copy with matching identity was found.
          You can restore it to the review queue or leave it rejected.
        </p>
        <div class="actions">
          <Button variant="secondary" onclick={() => onresolve('keep-both')}>Restore to review</Button>
          <Button variant="secondary" onclick={onclose}>Leave as is</Button>
        </div>
      {:else}
        <p class="context">
          Both files identify as the same questionnaire page. Compare them and choose which copy to keep.
          Selection is based on recovery quality only — never on page contents.
        </p>
        <div class="pair">
          <figure>
            <figcaption>A — {pair.a.sourceName} ({bal_format_bytes(pair.a.sourceBytes)})</figcaption>
            {#if bal_url_a}
              <img src={bal_url_a} alt="Copy A" />
            {:else}
              <div class="missing">Image removed</div>
            {/if}
            <p class="quality">{bal_quality_line(pair.a)}</p>
            <Button size="sm" variant="primary" onclick={() => onresolve('keep-a')}>Keep A</Button>
          </figure>
          <figure>
            <figcaption>B — {pair.b.sourceName} ({bal_format_bytes(pair.b.sourceBytes)})</figcaption>
            {#if bal_url_b}
              <img src={bal_url_b} alt="Copy B" />
            {:else}
              <div class="missing">Image removed</div>
            {/if}
            <p class="quality">{bal_quality_line(pair.b)}</p>
            <Button size="sm" variant="primary" onclick={() => onresolve('keep-b')}>Keep B</Button>
          </figure>
        </div>
        <div class="actions">
          <Button variant="secondary" onclick={() => onresolve('keep-both')}>Keep both</Button>
          <Button variant="danger" onclick={() => onresolve('reject')}>Reject both</Button>
        </div>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .compare {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .context {
    margin: 0;
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  figcaption {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
  }
  img {
    width: 100%;
    max-height: 40vh;
    object-fit: contain;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
  }
  .missing {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .quality {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink-2);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  @media (max-width: 640px) {
    .pair {
      grid-template-columns: 1fr;
    }
  }
</style>
