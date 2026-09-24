import { describe, expect, it } from 'vitest';
import {
  next_variable_name,
  unique_variable_name,
  validate_variable_name
} from './variable_names';

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
