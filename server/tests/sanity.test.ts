import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('server sanity', () => {
  it('exports a version string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
