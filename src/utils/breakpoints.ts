import { readable } from 'svelte/store';

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

function bal_current_mode(): LayoutMode {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

export const ghora_layout = readable<LayoutMode>(bal_current_mode(), (bal_set) => {
  const bal_update = (): void => bal_set(bal_current_mode());
  const bal_queries = [
    window.matchMedia('(max-width: 767px)'),
    window.matchMedia('(min-width: 1024px)')
  ];
  for (const bal_query of bal_queries) {
    bal_query.addEventListener('change', bal_update);
  }
  return () => {
    for (const bal_query of bal_queries) {
      bal_query.removeEventListener('change', bal_update);
    }
  };
});
