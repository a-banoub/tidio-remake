import { describe, it, expect, vi } from 'vitest';
import { setupAnalyticsBridge } from '../src/analytics.js';

describe('setupAnalyticsBridge', () => {
  it('forwards calculator_used custom event as lead_signal', () => {
    const send = vi.fn();
    setupAnalyticsBridge(send);
    window.dispatchEvent(new CustomEvent('simple1031:calculator_used', { detail: { sale: 1000000 } }));
    expect(send).toHaveBeenCalledWith({ type: 'lead_signal', kind: 'calculator_used', payload: { sale: 1000000 } });
  });

  it('forwards exit_intent without payload', () => {
    const send = vi.fn();
    setupAnalyticsBridge(send);
    window.dispatchEvent(new CustomEvent('simple1031:exit_intent'));
    expect(send).toHaveBeenCalledWith({ type: 'lead_signal', kind: 'exit_intent' });
  });
});
