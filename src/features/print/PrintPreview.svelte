<script lang="ts">
  import IconButton from '../../components/ui/IconButton.svelte';
  import Switch from '../../components/ui/Switch.svelte';
  import { bal_page_svg, type bal_OverlayFlags } from './print_svg';
  import type { bal_PrintDocument } from './print_layout';

  let {
    document: bal_doc,
    pageNumber,
    onpage
  }: {
    document: bal_PrintDocument;
    pageNumber: number;
    onpage: (bal_page: number) => void;
  } = $props();

  let bal_zoom = $state(1);
  let bal_fit_width = $state(false);
  let bal_overlays_open = $state(false);
  let bal_flags = $state<bal_OverlayFlags>({
    contentBounds: false,
    safeBounds: false,
    answerRegions: false,
    itemBounds: false,
    quietZone: false,
    alignmentMarkers: false
  });

  const bal_page = $derived(bal_doc.pages[Math.min(pageNumber, bal_doc.pageCount) - 1]);
  const bal_svg = $derived(bal_page ? bal_page_svg(bal_page, bal_doc, bal_flags) : '');
  const bal_aspect = $derived(
    bal_page ? bal_page.regions.width / bal_page.regions.height : 210 / 297
  );
  const bal_base_width = $derived(bal_fit_width ? 720 : 340);

  function bal_prev(): void {
    if (pageNumber > 1) onpage(pageNumber - 1);
  }

  function bal_next(): void {
    if (pageNumber < bal_doc.pageCount) onpage(pageNumber + 1);
  }

  function bal_zoom_step(bal_delta: number): void {
    bal_zoom = Math.min(3, Math.max(0.4, Math.round((bal_zoom + bal_delta) * 10) / 10));
  }
</script>

<div class="preview">
  <div class="toolbar no-print-gap">
    <IconButton icon="chevron-left" label="Previous page"disabled={pageNumber <= 1} onclick={bal_prev} />
    <span class="page-label">Page {pageNumber} of {bal_doc.pageCount}</span>
    <IconButton icon="chevron-right" label="Next page"disabled={pageNumber >= bal_doc.pageCount} onclick={bal_next} />
    <span class="spacer"></span>
    <IconButton icon="zoom-out" label="Zoom out"onclick={() => bal_zoom_step(-0.1)} />
    <span class="zoom-label">{Math.round(bal_zoom * 100)}%</span>
    <IconButton icon="zoom-in" label="Zoom in"onclick={() => bal_zoom_step(0.1)} />
    <button
      type="button"
      class="fit-toggle"
      class:active={bal_fit_width}
      onclick={() => (bal_fit_width = !bal_fit_width)}
    >
      Fit width
    </button>
    <IconButton
      icon="sliders"
      label="Geometry overlays"
      onclick={() => (bal_overlays_open = !bal_overlays_open)}
    />
  </div>

  {#if bal_overlays_open}
    <div class="overlay-panel">
      <p class="overlay-note">Layout geometry overlays. Never shown in the generated PDF.</p>
      <Switch checked={bal_flags.contentBounds} label="Content bounds" onchange={(bal_v) => (bal_flags = { ...bal_flags, contentBounds: bal_v })} />
      <Switch checked={bal_flags.safeBounds} label="Scanner-safe bounds" onchange={(bal_v) => (bal_flags = { ...bal_flags, safeBounds: bal_v })} />
      <Switch checked={bal_flags.answerRegions} label="Answer regions" onchange={(bal_v) => (bal_flags = { ...bal_flags, answerRegions: bal_v })} />
      <Switch checked={bal_flags.itemBounds} label="Item bounds" onchange={(bal_v) => (bal_flags = { ...bal_flags, itemBounds: bal_v })} />
      <Switch checked={bal_flags.quietZone} label="QR quiet zone" onchange={(bal_v) => (bal_flags = { ...bal_flags, quietZone: bal_v })} />
    </div>
  {/if}

  <div class="stage">
    <div
      class="page"
      style="--page-width:{(bal_base_width * bal_zoom).toFixed(0)}px; --page-aspect:{bal_aspect.toFixed(4)}"
    >
      {@html bal_svg}
    </div>
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .spacer {
    flex: 1;
  }

  .page-label,
  .zoom-label {
    font-size: var(--text-xs);
    color: var(--color-ink);
    opacity: 0.75;
    min-width: 5.5rem;
    text-align: center;
  }

  .fit-toggle {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    height: 2rem;
    padding: 0 0.7rem;
    font-size: var(--text-xs);
    color: var(--color-ink);
    cursor: pointer;
  }

  .fit-toggle.active {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .overlay-panel {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }

  .overlay-note {
    width: 100%;
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-ink);
    opacity: 0.65;
  }

  .stage {
    background: var(--color-canvas);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    overflow: auto;
    display: flex;
    justify-content: center;
  }

  .page {
    width: var(--page-width);
    aspect-ratio: var(--page-aspect);
    background: #ffffff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
    border-radius: 2px;
    overflow: hidden;
  }

  .page :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
