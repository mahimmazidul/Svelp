const BAL_FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function bal_focus_first(bal_container: HTMLElement): void {
  const bal_all = bal_container.querySelectorAll<HTMLElement>(BAL_FOCUSABLE);
  (bal_all[0] ?? bal_container).focus();
}

export function bal_trap_tab(
  bal_event: KeyboardEvent,
  bal_container: HTMLElement | undefined | null
): void {
  if (!bal_container || bal_event.key !== 'Tab') return;
  const bal_all = Array.from(
    bal_container.querySelectorAll<HTMLElement>(BAL_FOCUSABLE)
  ).filter((bal_el) => bal_el.offsetParent !== null || bal_el === document.activeElement);
  if (bal_all.length === 0) return;
  const bal_first = bal_all[0];
  const bal_last = bal_all[bal_all.length - 1];
  const bal_active = document.activeElement;
  if (bal_event.shiftKey && bal_active === bal_first) {
    bal_event.preventDefault();
    bal_last.focus();
  } else if (!bal_event.shiftKey && bal_active === bal_last) {
    bal_event.preventDefault();
    bal_first.focus();
  }
}
