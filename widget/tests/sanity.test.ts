import { describe, it, expect } from 'vitest';
import { WIDGET_VERSION } from '../src/index.js';

describe('widget sanity', () => {
  it('exports a version', () => {
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
