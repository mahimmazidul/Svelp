const bal_formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export function shawya_format_datetime(bal_ts: number): string {
  return bal_formatter.format(new Date(bal_ts));
}
