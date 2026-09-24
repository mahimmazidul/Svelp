<script lang="ts">
  import { icon_primitives, type IconName } from './icon_defs';

  let {
    name,
    size = 20,
    stroke = 2
  }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each icon_primitives[name] as bal_p, bal_pi (bal_pi)}
    {#if bal_p.tag === 'circle'}
      <circle
        cx={bal_p.cx}
        cy={bal_p.cy}
        r={bal_p.r}
        fill={bal_p.filled ? 'currentColor' : 'none'}
        stroke={bal_p.filled ? 'none' : 'currentColor'}
      />
    {:else if bal_p.tag === 'rect'}
      <rect
        x={bal_p.x}
        y={bal_p.y}
        width={bal_p.width}
        height={bal_p.height}
        rx={bal_p.rx}
        ry={bal_p.rx}
      />
    {:else}
      <path d={bal_p.d} />
    {/if}
  {/each}
</svg>
