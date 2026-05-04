import { describe, it, expect } from 'vitest';
import { parseVisitorMessage } from '../../src/ws/protocol.js';

describe('protocol', () => {
  it('parses valid hello', () => {
    const m = parseVisitorMessage('{"type":"hello","visitorId":"v_abcdef012345","sessionId":"s_abcdef012345","page":{"url":"https://simple1031x.com/x","title":"X"},"utms":{},"referrer":null,"userAgent":"Mozilla/5.0"}');
    expect(m?.type).toBe('hello');
  });
  it('rejects unknown type', () => {
    expect(parseVisitorMessage('{"type":"garbage"}')).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseVisitorMessage('not json')).toBeNull();
  });
});
