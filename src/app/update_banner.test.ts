import { beforeEach, describe, expect, it } from 'vitest';
import { bal_ensure_banner_host, bal_show_update_banner } from './update_banner';

describe('update banner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a single host element and shows the action', () => {
    bal_show_update_banner('New version available.', 'Update now', () => undefined);
    const bal_first = document.getElementById('svelp-update-banner');
    expect(bal_first).not.toBeNull();
    bal_show_update_banner('Second message.', 'Fix', () => undefined);
    const bal_all = document.querySelectorAll('#svelp-update-banner');
    expect(bal_all.length).toBe(1);
    expect(bal_first?.textContent).toContain('Second message');
    const bal_button = bal_first?.querySelector('button');
    expect(bal_button?.textContent).toBe('Fix');
  });

  it('uses a status role for assistive tech', () => {
    bal_ensure_banner_host();
    expect(document.getElementById('svelp-update-banner')?.getAttribute('role')).toBe('status');
  });
});
