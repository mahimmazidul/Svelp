export const BAL_VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function next_variable_name(bal_taken: string[], bal_base = 'q'): string {
  const bal_set = new Set(bal_taken);
  let bal_n = 1;
  while (bal_set.has(`${bal_base}${bal_n}`)) bal_n += 1;
  return `${bal_base}${bal_n}`;
}

export function unique_variable_name(bal_taken: string[], bal_desired: string): string {
  if (!BAL_VARIABLE_NAME_PATTERN.test(bal_desired)) return bal_desired;
  const bal_set = new Set(bal_taken);
  if (!bal_set.has(bal_desired)) return bal_desired;
  let bal_n = 2;
  while (bal_set.has(`${bal_desired}_${bal_n}`)) bal_n += 1;
  return `${bal_desired}_${bal_n}`;
}

export function validate_variable_name(
  bal_value: string,
  bal_taken: string[]
): string | null {
  if (bal_value.trim() === '') return 'A variable name is required.';
  if (!BAL_VARIABLE_NAME_PATTERN.test(bal_value)) {
    return 'Use letters, digits, and underscores only. The name must start with a letter or underscore.';
  }
  if (bal_taken.includes(bal_value)) {
    return 'This variable name is already used by another question.';
  }
  return null;
}
