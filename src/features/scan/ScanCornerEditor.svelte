<script lang="ts">
  import { dhon_scan_asset } from '../../db/scan_repo';
  import Button from '../../components/ui/Button.svelte';
  import type { ScanPageRecord } from '../../models/scan_models';

  let {
    open,
    page,
    onsubmit,
    onclose
  }: {
    open: boolean;
    page: ScanPageRecord | null;
    onsubmit: (bal_points: { x: number; y: number }[]) => Promise<void> | void;
    onclose: () => void;
  } = $props();

  interface bal_HandlePoint {
    x: number;
    y: number;
  }

  let bal_box = $state<HTMLDivElement | undefined>(undefined);
  let bal_image_url = $state<string | null>(null);
  let bal_image_size = $state<{ width: number; height: number } | null>(null);
  let bal_points = $state<bal_HandlePoint[]>([]);
  let bal_drag_index = $state<number | null>(null);
  let bal_saving = $state(false);
  let bal_error = $state<string | null>(null);

  const bal_labels = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];

  $effect(() => {
    if (!open || !page) return;
    let bal_cancelled = false;
    void (async () => {
      const bal_asset = page.sourceAssetId ? await dhon_scan_asset(page.sourceAssetId) : null;
      if (bal_cancelled) return;
      if (bal_image_url) URL.revokeObjectURL(bal_image_url);
      bal_image_url = bal_asset ? URL.createObjectURL(bal_asset.bytes) : null;
      if (bal_image_url) {
        const bal_img = new Image();
        bal_img.onload = () => {
          if (bal_cancelled) return;
          bal_image_size = { width: bal_img.naturalWidth, height: bal_img.naturalHeight };
          if (bal_points.length !== 4) {
            bal_points = [
              { x: 0.08, y: 0.06 },
              { x: 0.92, y: 0.06 },
              { x: 0.92, y: 0.94 },
              { x: 0.08, y: 0.94 }
            ];
          }
        };
        bal_img.src = bal_image_url;
      }
    })();
    return () => {
      bal_cancelled = true;
    };
  });

  $effect(() => {
    return () => {
      if (bal_image_url) URL.revokeObjectURL(bal_image_url);
    };
  });

  function bal_pointer_fraction(bal_event: PointerEvent): bal_HandlePoint | null {
    const bal_rect = bal_box?.getBoundingClientRect();
    if (!bal_rect) return null;
    return {
      x: Math.min(1, Math.max(0, (bal_event.clientX - bal_rect.left) / bal_rect.width)),
      y: Math.min(1, Math.max(0, (bal_event.clientY - bal_rect.top) / bal_rect.height))
    };
  }

  function bal_start_drag(bal_index: number) {
    return (bal_event: PointerEvent) => {
      bal_event.preventDefault();
      bal_drag_index = bal_index;
      (bal_event.currentTarget as HTMLElement).setPointerCapture(bal_event.pointerId);
    };
  }

  function bal_move_drag(bal_event: PointerEvent): void {
    if (bal_drag_index === null) return;
    const bal_fraction = bal_pointer_fraction(bal_event);
    if (!bal_fraction) return;
    bal_points = bal_points.map((bal_point, bal_index) => (bal_index === bal_drag_index ? bal_fraction : bal_point));
  }

  function bal_end_drag(): void {
    bal_drag_index = null;
  }

  async function bal_save(): Promise<void> {
    const bal_size = bal_image_size;
    if (!bal_size || bal_points.length !== 4) {
      bal_error = 'Place all four corner handles first.';
      return;
    }
    bal_error = null;
    bal_saving = true;
    try {
      await onsubmit(
        bal_points.map((bal_point) => ({
          x: Math.round(bal_point.x * bal_size.width),
          y: Math.round(bal_point.y * bal_size.height)
        }))
      );
      onclose();
    } finally {
      bal_saving = false;
    }
  }
</script>

{#if open}
  <div class="editor" role="dialog" aria-modal="true" aria-label="Correct page corners">
    <header class="editor-head">
      <div>
        <h3>Correct page corners</h3>
        <p>Drag each handle to a printed page corner. Exact placement is not needed.</p>
      </div>
      <Button size="sm" variant="secondary" onclick={onclose}>Cancel</Button>
    </header>
    {#if bal_image_url}
      <div class="stage" role="application" aria-label="Corner placement stage" bind:this={bal_box} onpointermove={bal_move_drag} onpointerup={bal_end_drag} onpointercancel={bal_end_drag}>
        <img src={bal_image_url} alt="" draggable="false" />
        {#if bal_points.length === 4}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon
              points="{bal_points[0].x * 100},{bal_points[0].y * 100} {bal_points[1].x * 100},{bal_points[1].y * 100} {bal_points[2].x * 100},{bal_points[2].y * 100} {bal_points[3].x * 100},{bal_points[3].y * 100}"
            />
          </svg>
          {#each bal_points as bal_point, bal_index (bal_index)}
            <button
              class="handle"
              class:dragging={bal_drag_index === bal_index}
              style="left: {bal_point.x * 100}%; top: {bal_point.y * 100}%;"
              type="button"
              aria-label="{bal_labels[bal_index]} corner"
              onpointerdown={bal_start_drag(bal_index)}
            ></button>
          {/each}
        {/if}
      </div>
    {:else}
      <p class="missing">The original photo was removed from this device; corners cannot be corrected.</p>
    {/if}
    {#if bal_error}
      <p class="error" role="alert">{bal_error}</p>
    {/if}
    <div class="actions">
      <Button variant="primary" disabled={bal_saving || !bal_image_url} onclick={() => void bal_save()}>
        {bal_saving ? 'Rebuilding…' : 'Save and re-transform'}
      </Button>
    </div>
  </div>
{/if}

<style>
  .editor {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    overflow: auto;
  }
  .editor-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .editor-head h3 {
    margin: 0;
    font-size: var(--text-lg);
  }
  .editor-head p {
    margin: var(--space-1) 0 0;
    color: var(--color-ink-2);
    font-size: var(--text-sm);
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 300px;
    touch-action: none;
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .stage img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    user-select: none;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  svg polygon {
    fill: rgba(0, 0, 0, 0.15);
    stroke: var(--color-accent);
    stroke-width: 0.4;
  }
  .handle {
    position: absolute;
    width: 36px;
    height: 36px;
    margin: -18px 0 0 -18px;
    border-radius: 50%;
    border: 3px solid var(--color-surface);
    background: var(--color-accent);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    cursor: grab;
    touch-action: none;
    padding: 0;
  }
  .handle.dragging {
    cursor: grabbing;
    background: var(--color-accent-strong, var(--color-accent));
  }
  .missing {
    color: var(--color-ink-2);
  }
  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
