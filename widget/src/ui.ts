type UIHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onSend: (body: string) => void;
  onSubmitCapture: (data: { name: string; email: string; phone: string }) => void;
};

export type Phase = 'closed' | 'chat' | 'capture' | 'success';

export class WidgetUI {
  private bubble?: HTMLDivElement;
  private peek?: HTMLDivElement;
  private panel?: HTMLDivElement;
  private body?: HTMLDivElement;
  private phase: Phase = 'closed';
  private operatorOnline = true;
  private knownEmail: string | null = null;

  constructor(private handlers: UIHandlers) {}

  mount(operatorOnline: boolean) {
    this.operatorOnline = operatorOnline;
    this.bubble = document.createElement('div');
    this.bubble.className = 's1031-bubble s1031-pulse';
    this.bubble.textContent = '💬';
    this.bubble.onclick = () => this.open();
    document.body.appendChild(this.bubble);

    this.peek = document.createElement('div');
    this.peek.className = 's1031-peek';
    this.peek.textContent = '👋 Hi! Have a question about your 1031?';
    this.peek.onclick = () => this.open();
    document.body.appendChild(this.peek);
    setTimeout(() => this.peek?.remove(), 10000);
  }

  open() {
    if (this.phase !== 'closed') return;
    this.peek?.remove();
    this.bubble?.remove();
    this.phase = 'chat';
    this.handlers.onOpen();
    this.renderPanel();
  }

  close() {
    this.panel?.remove();
    this.phase = 'closed';
    this.mount(this.operatorOnline);
    this.handlers.onClose();
  }

  setOperatorOnline(online: boolean) { this.operatorOnline = online; }
  setKnownEmail(email: string | null) { this.knownEmail = email; }

  showMessage(msg: { sender: 'visitor' | 'operator' | 'system'; body: string }) {
    if (!this.body) return;
    const el = document.createElement('div');
    if (msg.sender === 'system') {
      el.className = 's1031-system';
      el.textContent = msg.body;
    } else {
      el.className = `s1031-msg ${msg.sender}`;
      el.textContent = msg.body;
    }
    this.body.appendChild(el);
    this.body.scrollTop = this.body.scrollHeight;
  }

  replay(messages: Array<{ sender: 'visitor' | 'operator' | 'system'; body: string }>) {
    if (!this.body) return;
    this.body.innerHTML = '';
    for (const m of messages) this.showMessage(m);
  }

  hasBody(): boolean { return !!this.body; }

  showOperatorTyping(isTyping: boolean) {
    if (!this.body) return;
    const existing = this.body.querySelector('.s1031-typing');
    if (isTyping && !existing) {
      const el = document.createElement('div');
      el.className = 's1031-typing';
      el.textContent = 'Alex is typing…';
      this.body.appendChild(el);
      this.body.scrollTop = this.body.scrollHeight;
    } else if (!isTyping && existing) {
      existing.remove();
    }
  }

  enterCapturePhase(knownEmail: string | null) {
    this.knownEmail = knownEmail;
    if (this.phase === 'capture' || this.phase === 'success') return;
    this.phase = 'capture';
    if (knownEmail) {
      this.renderEmailOnFile(knownEmail);
    } else {
      this.renderCaptureForm();
    }
  }

  showSuccess(name: string, email: string) {
    this.phase = 'success';
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header success">
        <div class="s1031-avatar" style="color:#16a34a;">✓</div>
        <div><h4>Got it — thanks${name ? `, ${escapeHtml(name)}` : ''}!</h4><p>We'll be in touch soon</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-success">
        <div class="s1031-success-icon">✓</div>
        <h4 style="margin:0;font-size:16px;">You're all set</h4>
        <p style="margin:8px 0;font-size:13px;color:#475569;">Alex will follow up at <strong>${escapeHtml(email)}</strong> within the next business hour.</p>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
  }

  private renderPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 's1031-panel';
    this.panel.innerHTML = `
      <div class="s1031-header">
        <div class="s1031-avatar">A</div>
        <div><h4>Alex from Simple 1031</h4><p>${this.operatorOnline ? 'Active now' : 'Replies in a few minutes'}</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-body"></div>
      <div class="s1031-composer">
        <input type="text" placeholder="Type a message..." />
        <button type="button" aria-label="Send">↑</button>
      </div>
    `;
    document.body.appendChild(this.panel);
    this.body = this.panel.querySelector('.s1031-body') as HTMLDivElement;

    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());

    const input = this.panel.querySelector('input') as HTMLInputElement;
    const button = this.panel.querySelector('button') as HTMLButtonElement;
    const send = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      this.showMessage({ sender: 'visitor', body: v });
      this.handlers.onSend(v);
    };
    button.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    input.focus();

    if (this.body.childElementCount === 0) {
      const sys = document.createElement('div');
      sys.className = 's1031-system';
      sys.textContent = "We usually reply within a few minutes. What's on your mind?";
      this.body.appendChild(sys);
    }
  }

  private renderCaptureForm() {
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header away">
        <div class="s1031-avatar" style="color:#475569;">A</div>
        <div><h4>We're not available right now</h4><p>Leave your info, we'll follow up fast</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-capture">
        <div class="intro">Sorry, no one's available to chat right this second. Drop your contact info and we'll get back to you within the hour during business hours.</div>
        <div><label>Name</label><input type="text" name="name" placeholder="Your name" /></div>
        <div><label>Email</label><input type="email" name="email" placeholder="you@example.com" required /></div>
        <div><label>Phone (optional)</label><input type="tel" name="phone" placeholder="(___) ___-____" /></div>
        <button type="button">Send & we'll follow up</button>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
    const button = this.panel.querySelector('.s1031-capture button') as HTMLButtonElement;
    button.addEventListener('click', () => {
      const inputs = this.panel!.querySelectorAll<HTMLInputElement>('input');
      const name = (inputs[0].value || '').trim();
      const email = (inputs[1].value || '').trim();
      const phone = (inputs[2].value || '').trim();
      if (!email) { inputs[1].focus(); return; }
      this.handlers.onSubmitCapture({ name, email, phone });
      this.showSuccess(name, email);
    });
  }

  private renderEmailOnFile(email: string) {
    if (!this.panel) return;
    this.panel.innerHTML = `
      <div class="s1031-header away">
        <div class="s1031-avatar" style="color:#475569;">A</div>
        <div><h4>We'll be right back</h4><p>Stepped away for a moment</p></div>
        <span class="s1031-close">&times;</span>
      </div>
      <div class="s1031-success">
        <p style="font-size:13px;color:#475569;">No need to leave your info again — we'll follow up at <strong>${escapeHtml(email)}</strong> as soon as we're back.</p>
      </div>
    `;
    this.panel.querySelector('.s1031-close')!.addEventListener('click', () => this.close());
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
