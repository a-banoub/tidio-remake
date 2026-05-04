import { describe, it, expect } from 'vitest';
import UAParser from 'ua-parser-js';

describe('UA parsing', () => {
  it('extracts browser and os from a Chrome desktop UA', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const r = new UAParser(ua).getResult();
    expect(r.browser.name).toBe('Chrome');
    expect(r.os.name).toBe('Windows');
  });

  it('detects mobile device type for an iPhone UA', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const r = new UAParser(ua).getResult();
    expect(r.device.type).toBe('mobile');
    expect(r.os.name).toBe('iOS');
  });
});
