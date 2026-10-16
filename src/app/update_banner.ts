export interface UpdateBannerHandle {
  bal_show: (bal_message: string, bal_action_label: string, bal_action: () => void) => void;
  bal_remove: () => void;
}

const BAL_BANNER_ID = 'svelp-update-banner';

export function bal_ensure_banner_host(): HTMLElement {
  let bal_host = document.getElementById(BAL_BANNER_ID);
  if (bal_host) return bal_host;
  bal_host = document.createElement('div');
  bal_host.id = BAL_BANNER_ID;
  bal_host.setAttribute('role', 'status');
  bal_host.style.cssText = [
    'position:fixed',
    'left:12px',
    'right:12px',
    'bottom:calc(var(--bottomnav-height, 60px) + env(safe-area-inset-bottom, 0px) + 12px)',
    'z-index:9999',
    'display:none',
    'align-items:center',
    'justify-content:space-between',
    'gap:10px',
    'padding:10px 12px',
    'background:var(--color-surface, #ffffff)',
    'color:var(--color-ink, #1a1a1a)',
    'border:1px solid var(--color-border, #d0d0d0)',
    'border-radius:10px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.16)',
    'font:500 13px/1.4 system-ui, sans-serif'
  ].join(';');
  document.body.appendChild(bal_host);
  return bal_host;
}

export function bal_show_update_banner(
  bal_message: string,
  bal_action_label: string,
  bal_action: () => void
): void {
  const bal_host = bal_ensure_banner_host();
  bal_host.textContent = '';
  const bal_text = document.createElement('span');
  bal_text.textContent = bal_message;
  const bal_button = document.createElement('button');
  bal_button.type = 'button';
  bal_button.textContent = bal_action_label;
  bal_button.style.cssText = [
    'flex:none',
    'padding:7px 12px',
    'border:1px solid var(--color-border-strong, #9a9a9a)',
    'border-radius:8px',
    'background:var(--color-accent, #2438c6)',
    'color:#ffffff',
    'font:600 13px system-ui, sans-serif',
    'cursor:pointer',
    'min-height:36px'
  ].join(';');
  bal_button.addEventListener('click', bal_action);
  bal_host.appendChild(bal_text);
  bal_host.appendChild(bal_button);
  bal_host.style.display = 'flex';
}

export function bal_clear_cache_and_reload(): void {
  void (async () => {
    try {
      if ('caches' in window) {
        const bal_names = await caches.keys();
        await Promise.all(bal_names.map((bal_name) => caches.delete(bal_name)));
      }
      if (navigator.serviceWorker) {
        const bal_regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(bal_regs.map((bal_reg) => bal_reg.unregister()));
      }
    } catch {
      void 0;
    }
    const bal_url = new URL(window.location.href);
    bal_url.searchParams.set('svelp-refresh', Date.now().toString(36));
    window.location.replace(bal_url.toString());
  })();
}
