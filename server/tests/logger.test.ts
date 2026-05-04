import { describe, it, expect } from 'vitest';
import { logger, createLogger } from '../src/logger.js';

describe('logger', () => {
  it('exports a default logger', () => {
    expect(typeof logger.info).toBe('function');
  });
  it('createLogger returns child', () => {
    const child = createLogger({ component: 'test' });
    expect(typeof child.info).toBe('function');
  });
});
