export const BAL_VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const BAL_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'why',
  'where',
  'when',
  'do',
  'does',
  'did',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'can',
  'could',
  'would',
  'should',
  'will',
  'shall',
  'may',
  'might',
  'you',
  'your',
  'yours',
  'they',
  'their',
  'them',
  'he',
  'she',
  'his',
  'her',
  'we',
  'us',
  'our',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'please',
  'specify',
  'enter',
  'provide',
  'state',
  'give',
  'any',
  'often',
  'much',
  'many'
]);

const BAL_MAX_SUGGESTION_LENGTH = 32;

export function bal_normalize_tokens(bal_label: string): string[] {
  const bal_ascii = bal_label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return bal_ascii
    .split(/[^a-z0-9]+/)
    .filter((bal_token) => bal_token !== '' && !BAL_STOPWORDS.has(bal_token));
}

export function suggest_variable_name(bal_label: string): string {
  const bal_tokens = bal_normalize_tokens(bal_label).slice(0, 3);
  if (bal_tokens.length === 0) return '';
  let bal_name = '';
  for (const bal_token of bal_tokens) {
    const bal_candidate = bal_name === '' ? bal_token : `${bal_name}_${bal_token}`;
    if (bal_candidate.length > BAL_MAX_SUGGESTION_LENGTH) break;
    bal_name = bal_candidate;
  }
  if (bal_name === '') return bal_tokens[0].slice(0, BAL_MAX_SUGGESTION_LENGTH);
  if (!/^[a-z_]/.test(bal_name)) bal_name = `_${bal_name}`;
  return bal_name;
}

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
