export function setupAnalyticsBridge(send: (msg: any) => void): void {
  window.addEventListener('simple1031:calculator_used', (e: any) => {
    send({ type: 'lead_signal', kind: 'calculator_used', payload: e.detail ?? null });
  });
  window.addEventListener('simple1031:exit_intent', () => {
    send({ type: 'lead_signal', kind: 'exit_intent' });
  });
  window.addEventListener('simple1031:form_started', () => {
    send({ type: 'lead_signal', kind: 'form_started' });
  });
  window.addEventListener('simple1031:high_intent', (e: any) => {
    send({ type: 'lead_signal', kind: 'high_intent', payload: e.detail ?? null });
  });
}
