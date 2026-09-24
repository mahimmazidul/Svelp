<script lang="ts">
  import type { QuestionnaireItem } from '../../../models/types';
  import Button from '../../../components/ui/Button.svelte';
  import type { SignatureAnswer } from '../preview_answers';

  let {
    item,
    number,
    answer = null,
    onanswer
  }: {
    item: QuestionnaireItem;
    number: string;
    answer?: SignatureAnswer | null;
    onanswer: (bal_answer: SignatureAnswer) => void;
  } = $props();

  let bal_canvas = $state<HTMLCanvasElement | undefined>(undefined);
  let bal_drawing = $state(false);
  let bal_has_ink = $state(false);
  let bal_context = $state<CanvasRenderingContext2D | null>(null);

  const bal_config = $derived(item.signature);
  const bal_answer = $derived(
    answer ?? { data: null, printedName: '', date: '' }
  );

  $effect(() => {
    if (!bal_canvas || bal_context) return;
    const bal_ratio = window.devicePixelRatio || 1;
    const bal_rect = bal_canvas.getBoundingClientRect();
    bal_canvas.width = Math.max(1, bal_rect.width * bal_ratio);
    bal_canvas.height = Math.max(1, bal_rect.height * bal_ratio);
    const bal_ctx = bal_canvas.getContext('2d');
    if (!bal_ctx) return;
    bal_ctx.scale(bal_ratio, bal_ratio);
    bal_ctx.lineWidth = 2;
    bal_ctx.lineCap = 'round';
    bal_ctx.lineJoin = 'round';
    bal_ctx.strokeStyle = '#171a21';
    bal_context = bal_ctx;
  });

  function bal_pos(bal_event: PointerEvent): { x: number; y: number } {
    const bal_rect = (bal_event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: bal_event.clientX - bal_rect.left,
      y: bal_event.clientY - bal_rect.top
    };
  }

  function bal_start(bal_event: PointerEvent): void {
    if (!bal_context) return;
    bal_drawing = true;
    (bal_event.currentTarget as HTMLCanvasElement).setPointerCapture(bal_event.pointerId);
    const bal_p = bal_pos(bal_event);
    bal_context.beginPath();
    bal_context.moveTo(bal_p.x, bal_p.y);
  }

  function bal_move(bal_event: PointerEvent): void {
    if (!bal_drawing || !bal_context) return;
    const bal_p = bal_pos(bal_event);
    bal_context.lineTo(bal_p.x, bal_p.y);
    bal_context.stroke();
    bal_has_ink = true;
  }

  function bal_end(): void {
    if (!bal_drawing) return;
    bal_drawing = false;
    bal_commit();
  }

  function bal_commit(): void {
    if (!bal_canvas) return;
    onanswer({
      ...bal_answer,
      data: bal_has_ink ? bal_canvas.toDataURL('image/png') : null
    });
  }

  function bal_clear(): void {
    if (!bal_context || !bal_canvas) return;
    const bal_ratio = window.devicePixelRatio || 1;
    bal_context.clearRect(
      0,
      0,
      bal_canvas.width / bal_ratio,
      bal_canvas.height / bal_ratio
    );
    bal_has_ink = false;
    onanswer({ ...bal_answer, data: null });
  }
</script>

<fieldset class="pv-sign">
  <legend class="pv-sign-legend">
    <span class="pv-q-num">{number}</span>
    <span>{item.label.trim() !== '' ? item.label : 'Signature'}</span>
  </legend>
  <div class="pv-sign-pad">
    <canvas
      bind:this={bal_canvas}
      class="pv-sign-canvas"
      aria-label="Signature drawing area"
      onpointerdown={bal_start}
      onpointermove={bal_move}
      onpointerup={bal_end}
      onpointercancel={bal_end}
      onpointerleave={bal_end}
    ></canvas>
    {#if !bal_has_ink}
      <span class="pv-sign-hint">Draw the signature here</span>
    {/if}
    {#if bal_answer.data && !bal_has_ink}
      <img class="pv-sign-image" src={bal_answer.data} alt="Captured signature" />
    {/if}
  </div>
  <div class="pv-sign-actions">
    <Button variant="secondary" size="sm" onclick={bal_clear} disabled={!bal_has_ink}>
      Clear
    </Button>
  </div>
  {#if bal_config?.includePrintedName}
    <label class="pv-sign-field">
      <span class="pv-sign-label">
        Printed name
        {#if bal_config.signerRole.trim() !== ''}
          <span class="pv-sign-role">({bal_config.signerRole})</span>
        {/if}
      </span>
      <input
        class="pv-sign-input"
        type="text"
        value={bal_answer.printedName}
        oninput={(bal_event) =>
          onanswer({
            ...bal_answer,
            printedName: (bal_event.currentTarget as HTMLInputElement).value
          })}
      />
    </label>
  {/if}
  {#if bal_config?.includeDate}
    <label class="pv-sign-field">
      <span class="pv-sign-label">Date</span>
      <input
        class="pv-sign-input"
        type="date"
        value={bal_answer.date}
        onchange={(bal_event) =>
          onanswer({
            ...bal_answer,
            date: (bal_event.currentTarget as HTMLInputElement).value
          })}
      />
    </label>
  {/if}
</fieldset>

<style>
  .pv-sign {
    border: none;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }

  .pv-sign-legend {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: 0;
    font-weight: 600;
  }

  .pv-q-num {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-3);
  }

  .pv-sign-pad {
    position: relative;
    height: 140px;
    border: var(--border-width) dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow: hidden;
  }

  .pv-sign-canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    display: block;
  }

  .pv-sign-hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: var(--text-sm);
    color: var(--color-ink-3);
    pointer-events: none;
  }

  .pv-sign-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  .pv-sign-actions {
    display: flex;
    justify-content: flex-end;
  }

  .pv-sign-field {
    display: grid;
    gap: var(--space-1);
  }

  .pv-sign-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink-2);
  }

  .pv-sign-role {
    font-weight: 400;
    color: var(--color-ink-3);
  }

  .pv-sign-input {
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-ink);
    max-width: 320px;
  }

  .pv-sign-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }
</style>
