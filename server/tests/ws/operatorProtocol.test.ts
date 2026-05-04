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

  it('parses update_visitor with empty email (allows clearing the field)', () => {
    const m = parseOperatorMessage('{"type":"update_visitor","visitorId":"v_abcdef123456","name":"Pat","email":"","phone":""}');
    expect(m?.type).toBe('update_visitor');
    expect((m as any).email).toBe('');
  });

  it('parses update_visitor with valid email', () => {
    const m = parseOperatorMessage('{"type":"update_visitor","visitorId":"v_abcdef123456","email":"a@b.com"}');
    expect(m?.type).toBe('update_visitor');
    expect((m as any).email).toBe('a@b.com');
  });

  it('rejects update_visitor with malformed email', () => {
    expect(parseOperatorMessage('{"type":"update_visitor","visitorId":"v_abcdef123456","email":"not-an-email"}')).toBeNull();
  });
});
