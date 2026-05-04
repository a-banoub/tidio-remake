import { describe, it, expect } from 'vitest';
import { parseOperatorMessage } from '../../src/ws/operatorProtocol.js';

describe('operatorProtocol', () => {
  it('parses subscribe', () => {
    const m = parseOperatorMessage('{"type":"subscribe"}');
    expect(m?.type).toBe('subscribe');
  });
  it('parses send_message with valid IDs', () => {
    const m = parseOperatorMessage('{"type":"send_message","conversationId":"c_abcdef0123456789","body":"hello"}');
    expect(m?.type).toBe('send_message');
  });
  it('rejects send_message with bad conversationId', () => {
    expect(parseOperatorMessage('{"type":"send_message","conversationId":"bad","body":"x"}')).toBeNull();
  });
  it('rejects unknown type', () => {
    expect(parseOperatorMessage('{"type":"garbage"}')).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseOperatorMessage('not json')).toBeNull();
  });
});
