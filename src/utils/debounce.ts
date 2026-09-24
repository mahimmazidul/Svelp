export interface VorkiDebounced<T extends (...args: never[]) => unknown> {
  (...bal_args: Parameters<T>): void;
  flush(): Promise<void>;
  cancel(): void;
}

export function vorki_debounce<T extends (...args: never[]) => unknown>(
  bal_fn: T,
  bal_wait: number
): VorkiDebounced<T> {
  let bal_timer: ReturnType<typeof setTimeout> | null = null;
  let bal_last_args: Parameters<T> | null = null;

  const bal_wrapped = (...bal_args: Parameters<T>): void => {
    bal_last_args = bal_args;
    if (bal_timer !== null) clearTimeout(bal_timer);
    bal_timer = setTimeout(() => {
      bal_timer = null;
      const bal_pending = bal_last_args;
      bal_last_args = null;
      if (bal_pending) void bal_fn(...bal_pending);
    }, bal_wait);
  };

  bal_wrapped.flush = async (): Promise<void> => {
    if (bal_timer !== null) {
      clearTimeout(bal_timer);
      bal_timer = null;
    }
    const bal_pending = bal_last_args;
    bal_last_args = null;
    if (bal_pending) await bal_fn(...bal_pending);
  };

  bal_wrapped.cancel = (): void => {
    if (bal_timer !== null) {
      clearTimeout(bal_timer);
      bal_timer = null;
    }
    bal_last_args = null;
  };

  return bal_wrapped as VorkiDebounced<T>;
}
