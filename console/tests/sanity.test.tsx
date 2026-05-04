import { describe, it, expect } from 'vitest';
import { CONSOLE_VERSION } from '../src/main.js';

describe('console sanity', () => {
  it('exports a version', () => {
    expect(CONSOLE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
