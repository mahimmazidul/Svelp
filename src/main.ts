import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';
import { bal_show_update_banner, bal_clear_cache_and_reload } from './app/update_banner';

registerSW({
  immediate: true,
  onNeedRefresh() {
    bal_show_update_banner('A new version of Svelp is available.', 'Update now', () => {
      bal_show_update_banner('Updating…', 'Please wait', () => undefined);
      window.location.reload();
    });
  }
});

window.addEventListener('vite:preloadError', (bal_event) => {
  bal_event.preventDefault();
  const bal_key = 'svelp-chunk-recovered';
  if (!sessionStorage.getItem(bal_key)) {
    sessionStorage.setItem(bal_key, '1');
    bal_show_update_banner(
      'Svelp could not load part of the app. This is usually fixed by refreshing the offline copy.',
      'Fix and reload',
      bal_clear_cache_and_reload
    );
    return;
  }
  bal_clear_cache_and_reload();
});

const bal_app = mount(App, {
  target: document.getElementById('app') as HTMLElement
});

export default bal_app;
