export const STYLES = `
.s1031-bubble {
  position: fixed; bottom: 16px; right: 16px;
  width: 56px; height: 56px;
  background: #2563eb; color: white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; cursor: pointer; z-index: 2147483647;
  box-shadow: 0 6px 20px rgba(37,99,235,0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.s1031-bubble.s1031-pulse { animation: s1031pulse 1s ease-out 3; }
@keyframes s1031pulse { 0% { box-shadow: 0 6px 20px rgba(37,99,235,0.4), 0 0 0 0 rgba(37,99,235,0.5); } 100% { box-shadow: 0 6px 20px rgba(37,99,235,0.4), 0 0 0 18px rgba(37,99,235,0); } }
.s1031-peek {
  position: fixed; bottom: 86px; right: 16px;
  background: white; color: #0f172a; padding: 10px 14px;
  border-radius: 12px; border-bottom-right-radius: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1); width: 220px; line-height: 1.4;
  font-size: 13px; z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer;
}
.s1031-panel {
  position: fixed; bottom: 16px; right: 16px;
  width: 360px; max-height: 560px; height: 560px;
  background: white; border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0,0,0,0.18);
  display: flex; flex-direction: column; overflow: hidden;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.s1031-header { background: #2563eb; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 10px; }
.s1031-header.away { background: #475569; }
.s1031-header.success { background: #16a34a; }
.s1031-avatar { width: 32px; height: 32px; background: white; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.s1031-header h4 { margin: 0; font-size: 14px; font-weight: 600; }
.s1031-header p { margin: 0; font-size: 11px; opacity: 0.9; }
.s1031-close { margin-left: auto; cursor: pointer; font-size: 20px; opacity: 0.8; padding: 4px; }
.s1031-body { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }
.s1031-system { text-align: center; font-size: 11px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; line-height: 1.4; }
.s1031-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
.s1031-msg.visitor { align-self: flex-end; background: #2563eb; color: white; border-top-right-radius: 4px; }
.s1031-msg.operator { align-self: flex-start; background: white; border: 1px solid #e4e4e7; border-top-left-radius: 4px; }
.s1031-typing { align-self: flex-start; padding: 8px 12px; background: white; border: 1px solid #e4e4e7; border-radius: 12px; font-size: 11px; color: #94a3b8; font-style: italic; }
.s1031-composer { padding: 10px 12px; background: white; border-top: 1px solid #e4e4e7; display: flex; gap: 8px; align-items: center; }
.s1031-composer input { flex: 1; border: 1px solid #d4d4d8; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-family: inherit; outline: none; }
.s1031-composer input:focus { border-color: #2563eb; }
.s1031-composer button { background: #2563eb; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; }
.s1031-capture { padding: 16px; background: white; flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.s1031-capture .intro { font-size: 13px; color: #475569; line-height: 1.5; }
.s1031-capture label { font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 4px; }
.s1031-capture input { width: 100%; box-sizing: border-box; border: 1px solid #d4d4d8; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit; }
.s1031-capture button { background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
.s1031-success { padding: 24px 16px; text-align: center; background: white; flex: 1; }
.s1031-success-icon { width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #16a34a; font-size: 30px; margin: 12px auto; }
@media (max-width: 480px) {
  .s1031-panel { width: calc(100vw - 16px); right: 8px; bottom: 8px; max-height: calc(100vh - 16px); height: calc(100vh - 16px); }
  .s1031-bubble { right: 12px; bottom: 12px; }
}
`;

export function injectStyles(): void {
  if (document.getElementById('s1031-widget-styles')) return;
  const el = document.createElement('style');
  el.id = 's1031-widget-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
}
