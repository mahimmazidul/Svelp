import { describe, expect, it } from 'vitest';
import {
  suggest_variable_name,
  bal_normalize_tokens,
  next_variable_name,
  unique_variable_name,
  validate_variable_name
} from './variable_names';

describe('suggest_variable_name', () => {
  it('produces deterministic snake_case from content words', () => {
    expect(suggest_variable_name('How often do you consume fish?')).toBe(
      suggest_variable_name('How often do you consume fish?')
    );
    const bal_first = suggest_variable_name('How often do you consume fish?');
    expect(bal_first).toMatch(/fish/);
    expect(bal_first.length).toBeLessThanOrEqual(32);
  });

  it('drops stopwords and question scaffolding', () => {
    expect(suggest_variable_name('What is your age?')).toBe('age');
  });

  it('caps very long labels', () => {
    const bal_name = suggest_variable_name(
      'Please describe the entire household food purchasing pattern during the last month'
    );
    expect(bal_name.length).toBeLessThanOrEqual(32);
    expect(bal_name.startsWith('_') || /^[a-z]/.test(bal_name)).toBe(true);
  });

  it('returns empty for stopwords only', () => {
    expect(suggest_variable_name('How often?')).toBe('');
  });

  it('normalizes diacritics and punctuation', () => {
    expect(bal_normalize_tokens('Café — naïve')).toEqual(['cafe', 'naive']);
  });
});

describe('next_variable_name', () => {
  it('returns the first free name', () => {
    expect(next_variable_name([])).toBe('q1');
    expect(next_variable_name(['q1', 'q2'])).toBe('q3');
  });
});

describe('unique_variable_name', () => {
  it('keeps a free name unchanged', () => {
    expect(unique_variable_name(['q1'], 'age')).toBe('age');
  });

  it('suffixes a taken name', () => {
    expect(unique_variable_name(['age'], 'age')).toBe('age_2');
    expect(unique_variable_name(['age', 'age_2'], 'age')).toBe('age_3');
  });
});

describe('validate_variable_name', () => {
  it('rejects empty and malformed names', () => {
    expect(validate_variable_name('', [])).not.toBeNull();
    expect(validate_variable_name('1abc', [])).not.toBeNull();
    expect(validate_variable_name('has space', [])).not.toBeNull();
  });

  it('rejects duplicates and accepts valid names', () => {
    expect(validate_variable_name('age', ['age'])).not.toBeNull();
    expect(validate_variable_name('age', ['sex'])).toBeNull();
    expect(validate_variable_name('_private1', [])).toBeNull();
  });
});
